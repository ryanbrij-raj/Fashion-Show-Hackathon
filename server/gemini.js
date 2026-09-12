import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const TEXT_MODEL = 'gemini-3.6-flash';
const IMAGE_MODEL = 'gemini-3.1-flash-image';

function toPart(base64DataUrl) {
  const match = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error('Expected a base64 data URL image');
  const [, mimeType, data] = match;
  return { inlineData: { mimeType, data } };
}

// Closet entries carry full base64 image/rawImage fields — never JSON.stringify
// a raw entry into a text prompt (blows past the token limit). Only the
// descriptive fields belong in prompt text.
function describeItem(item) {
  const { name, type, color, material, silhouette, season, style } = item;
  return { name, type, color, material, silhouette, season, style };
}

const GARMENT_CATEGORY_HINT = `Clothing includes, and you should actively look for: tops (t-shirts, blouses, sweaters, hoodies), bottoms (pants, jeans, shorts, skirts, leggings), outerwear (jackets, coats, blazers), dresses/jumpsuits, shoes, and accessories (hats, bags, belts, scarves). Bottoms like shorts and pants are still valid even when folded, bunched up, only partially unfolded, held loosely, or shown at an odd angle — don't dismiss something as unclear just because it isn't laid flat.`;

const GARMENT_FIELDS_SHAPE = `{"name": string, "type": string, "color": string, "material": string, "silhouette": string, "season": string, "style": string}`;

export async function identifyGarments(imageDataUrl) {
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          toPart(imageDataUrl),
          {
            text: `Identify EVERY distinct clothing item visible in this image — if someone is wearing a full outfit (e.g. a top AND shorts/pants AND shoes), list each one separately, don't just pick the most obvious one. ${GARMENT_CATEGORY_HINT}

Reply with strict JSON only, no markdown fences, matching this shape:
{"items": [${GARMENT_FIELDS_SHAPE}, ...]}
"name" is a short human-friendly label like "Navy Blue Hoodie" or "Black Denim Jacket". If truly nothing wearable is visible, return {"items": []}.`,
          },
        ],
      },
    ],
  });
  const text = response.text.trim().replace(/^```json\s*|\s*```$/g, '');
  return JSON.parse(text).items;
}

export async function checkGarmentFrame(imageDataUrl) {
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          toPart(imageDataUrl),
          {
            text: `You are scanning a live camera feed to build a digital closet. Clothing worn or just held up close to the camera is enough; you do NOT need to see a full body or a person at all. If someone is wearing or holding MULTIPLE garments at once (e.g. a top AND shorts/pants AND shoes), identify ALL of them separately — do not just pick the most obvious one. ${GARMENT_CATEGORY_HINT}

Look at this frame and reply with strict JSON only, no markdown fences:
{"detected": boolean, "caption": string, "items": [${GARMENT_FIELDS_SHAPE}, ...]}

- "detected": true if at least one clothing item is clearly visible enough to identify (close-up is fine, doesn't need to be worn or full-body). Err toward true if you can make a reasonable guess at the garment type, even if some details like material are uncertain.
- "caption": if not detected, a short instruction under 8 words (e.g. "Hold an item up to the camera", "Move closer"); if detected, a short confirmation naming what you see, mentioning the count if more than one (e.g. "Got it — shirt + shorts detected").
- "items": one entry per distinct garment found (empty array if not detected). Take your best guess on every field rather than leaving them vague.`,
          },
        ],
      },
    ],
  });
  const text = response.text.trim().replace(/^```json\s*|\s*```$/g, '');
  return JSON.parse(text);
}

export async function chatAboutItem(item, closet, message, history = [], profile = null, personPhoto = null) {
  const closetSummary = closet
    .map((c) => `- ${c.type} (${c.color}, ${c.style})`)
    .join('\n');
  const profileLine = profile
    ? `\nUser's style profile: ${JSON.stringify(profile)}. Use their fit preference and sizes as a soft guide, never claim precise measurements from any photo.`
    : '';
  const photoLine = personPhoto
    ? `\nA photo of the user is attached — you may reference their general coloring, style, or vibe to personalize feedback (e.g. how a color might complement them), but never estimate exact body measurements from it.`
    : '';
  const focusLine = item
    ? `The user is asking about this specific closet item: ${JSON.stringify(describeItem(item))}.`
    : `The user has not focused on a specific item — this is a general styling question. Answer it directly using their closet inventory where relevant (e.g. occasion, weather, or "what goes with what" questions).`;
  const parts = [];
  if (personPhoto) parts.push(toPart(personPhoto));
  parts.push({
    text: `You are a personal stylist. ${focusLine}
Their full closet inventory:
${closetSummary || '(empty)'}
${profileLine}${photoLine}

Only recommend pairings using items from their real inventory above. Be concise and specific. You do not have access to real-time data like today's actual weather or current events — if the question depends on that, say so briefly and ask the user to tell you the conditions, rather than guessing.

User question: ${message}`,
  });
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [...history, { role: 'user', parts }],
  });
  return response.text;
}

// Turns a messy capture (held up at an angle, worn on a body, cluttered
// background) into a clean flat-lay product photo of just the garment.
// When the source frame has multiple garments in it, `targetDescription`
// (e.g. "the black shorts") tells it which one to isolate.
export async function normalizeGarmentImage(rawImageDataUrl, targetDescription = null) {
  const targetLine = targetDescription
    ? `The image may contain more than one clothing item — isolate specifically this one: ${targetDescription}. Ignore every other garment visible in the frame.`
    : 'If the image contains more than one clothing item, isolate only the single most prominent one.';
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          toPart(rawImageDataUrl),
          {
            text: `This is a photo editing task, not a creative one. ${targetLine} Re-render just that item straightened, laid flat, facing forward, centered, on a plain white background, with any hands, body, other garments, other people, or background clutter removed.

This must remain the literal same physical item — not a similar or generic substitute. Preserve exactly: the precise color and shade, every pattern, print, graphic, logo, text, stitching detail, texture, and the garment's real proportions and cut. Do not invent, simplify, "clean up", genericize, or restyle any detail that was visible in the original. If part of the garment is not visible in the source image (folded under, out of frame), leave your best literal reconstruction of only that hidden part minimal and consistent with what IS visible — do not add new design elements.

Return only the resulting image, no text.`,
          },
        ],
      },
    ],
  });
  const imagePart = response.candidates[0].content.parts.find((p) => p.inlineData);
  if (!imagePart) throw new Error('Gemini did not return an image');
  return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}

export async function tryOnComposite(personImageDataUrl, garmentImageDataUrl, profile = null) {
  const fitLine = profile?.fitPreference
    ? ` The user prefers a ${profile.fitPreference} fit — drape/size the garment accordingly.`
    : '';
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          toPart(personImageDataUrl),
          toPart(garmentImageDataUrl),
          {
            text: `Take the person exactly as they appear in the first image and add the clothing item from the second image onto them.

Do not change, beautify, or regenerate: their face, facial features, expression, skin tone, hair, body shape, proportions, pose, or the background. Those must stay pixel-for-pixel identical to the first image wherever the new garment doesn't physically cover them. Only the garment area should change.${fitLine}

Return only the resulting image, no text.`,
          },
        ],
      },
    ],
  });

  const imagePart = response.candidates[0].content.parts.find(
    (p) => p.inlineData
  );
  if (!imagePart) throw new Error('Gemini did not return an image');
  return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}

// Closes the loop after a try-on: what does the user already own that pairs
// with the new piece? Ties "discovering something new" back to the closet.
export async function suggestPairingsForNewItem(garmentImageDataUrl, closet, profile = null) {
  // Try-on garment photos are expected to be a single item, even if
  // identifyGarments finds incidental extras — take the primary one.
  const detected = await identifyGarments(garmentImageDataUrl);
  const newItem = detected[0] || { name: 'this piece', type: 'unknown', color: 'unknown', material: 'unknown', silhouette: 'unknown', season: 'unknown', style: 'unknown' };
  const closetSummary = closet
    .map((c) => `- ${c.type} (${c.color}, ${c.style})`)
    .join('\n');
  const profileLine = profile
    ? `\nUser's style profile: ${JSON.stringify(profile)}. Use their fit preference as a soft guide.`
    : '';
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are a personal stylist. The user just tried on this new piece (not yet in their closet): ${JSON.stringify(
              newItem
            )}.
Their existing closet inventory:
${closetSummary || '(empty)'}
${profileLine}

Unprompted, suggest 1-2 specific items from their real closet inventory above that would pair well with this new piece. If the closet is empty, say so briefly instead of inventing items. Be concise (2-3 sentences).`,
          },
        ],
      },
    ],
  });
  return { item: newItem, reply: response.text };
}

// Automatic first message when an item is selected: a brief score + feedback,
// so the chat doesn't start as a blank box waiting for a question.
export async function assessItem(item, closet, profile = null, personPhoto = null) {
  const profileLine = profile
    ? `\nUser's style profile: ${JSON.stringify(profile)}.`
    : '';
  const photoLine = personPhoto
    ? `\nA photo of the user is attached — you may factor in their general coloring or style when giving your take, but never estimate exact body measurements from it.`
    : '';
  const parts = [];
  if (personPhoto) parts.push(toPart(personPhoto));
  parts.push({
    text: `You are a personal stylist. The user just tapped this closet item to focus the chat on: ${JSON.stringify(
      describeItem(item)
    )}.${profileLine}${photoLine}

Give a brief, friendly opening take: a versatility score out of 10, and one quick observation about how to style it or what it works well with. 2 sentences max. End by inviting them to ask anything else about it.`,
  });
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: 'user', parts }],
  });
  return response.text;
}

// "Show me a pairing picture": suggests one specific complementary piece and
// generates a quick visual of it, rather than only describing it in text.
export async function suggestPairingWithImage(item, closet, profile = null) {
  const closetSummary = closet
    .map((c) => `- ${c.type} (${c.color}, ${c.style})`)
    .join('\n');
  const profileLine = profile
    ? `\nUser's style profile: ${JSON.stringify(profile)}.`
    : '';
  const planResponse = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are a personal stylist. The user wants a visual of one specific piece that would pair well with this closet item: ${JSON.stringify(
              describeItem(item)
            )}.
Their closet inventory:
${closetSummary || '(empty)'}
${profileLine}

Reply with strict JSON only, no markdown fences:
{"reply": string, "imagePrompt": string}
- "reply": 1-2 conversational sentences naming the piece you're suggesting and why.
- "imagePrompt": a concise product-photo description of that ONE piece (garment type, color, style) suitable for generating a clean e-commerce-style image. Do not describe the original item, only the new suggested piece.`,
          },
        ],
      },
    ],
  });
  const text = planResponse.text.trim().replace(/^```json\s*|\s*```$/g, '');
  const { reply, imagePrompt } = JSON.parse(text);

  const imageResponse = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Generate a clean e-commerce-style product photo of: ${imagePrompt}. Flat-lay or front-facing, centered, plain white background. Return only the image, no text.`,
          },
        ],
      },
    ],
  });
  const imagePart = imageResponse.candidates[0].content.parts.find((p) => p.inlineData);
  const image = imagePart
    ? `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
    : null;

  return { reply, image };
}
