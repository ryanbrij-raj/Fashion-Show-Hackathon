import type { Garment, StylePersona, Trend, UserStyleProfile, SizeProfile } from "@/types";

// Dedicated prompt builders. Each hero feature gets its own prompt rather
// than one giant catch-all — this keeps outputs predictable and makes each
// piece independently tunable.

export const STYLIST_PERSONA_SYSTEM_INSTRUCTION = `You are the lead stylist for The Jerry, a fashion app that helps people rediscover and restyle clothes they already own before ever recommending a purchase.

Voice: encouraging, concise, knowledgeable, specific, tasteful. You are willing to say a trend isn't right for someone, and you always prefer a substitution from their own closet over a new purchase.

Hard rules:
- Only describe visible clothing, fabric, color, silhouette, and styling. Never comment on the wearer's body, weight, attractiveness, or any physical characteristic.
- Never fabricate a brand name, exact material composition, or exact price unless it is visibly obvious or explicitly provided to you.
- When uncertain, use generic terms ("likely cotton blend") instead of asserting false precision.
- Never insult a garment. Reframe negatives as styling opportunities ("the heavier texture reads vintage, so pair it with clean modern basics").
- Return ONLY the JSON requested — no markdown fences, no commentary outside the schema.`;

export function garmentAnalysisPrompt(rescueReason?: string): string {
  return `Analyze the single garment shown in this photo. Identify it as specifically as you reasonably can from visual evidence alone.

${rescueReason ? `Context: the owner says they rarely wear this piece because: "${rescueReason}". Keep this in mind for your "observations" field, noting what could make it feel fresh again.` : ""}

Return structured JSON describing: name, category, subcategory, primaryColor, secondaryColors, material (say "likely" if inferring), pattern, fit, silhouette, formality (1-5, 1=loungewear, 5=black tie), styleTags, seasonality, observations (2-3 sentences, encouraging, styling-focused), and confidence (0-1, how confident you are in this reading given image quality/angle).

Do not analyze any person, body, or skin visible in the frame — clothing only. If no garment is clearly visible, still return your best-effort structured guess with low confidence rather than refusing.`;
}

export function styleDiscoveryPrompt(): string {
  return `Look at the outfit being worn in this photo and analyze the CLOTHING ONLY — palette, silhouettes, layering, garment categories, formality, style tags, pattern usage, and visible accessories.

Never infer or mention body shape, weight, height, attractiveness, age, or any personal characteristic. If a face is visible, ignore it entirely.

Return structured JSON: detectedStyleTags (which of the taxonomy tags best describe this outfit), palette (color names), silhouettes, layering (one sentence), garmentCategoriesObserved, formality (1-5), patternUsage (one phrase), visibleAccessories, and summary (2 sentences, friendly, describing the visual fashion language you see).`;
}

export function rescueOutfitPrompt(params: {
  rescueItem: Garment;
  rescueReason?: string;
  closet: Garment[];
  styleProfile: UserStyleProfile;
}): string {
  const { rescueItem, rescueReason, closet, styleProfile } = params;
  return `The owner wants to rescue a forgotten garment and build outfits primarily from clothes they already own.

RESCUE ITEM (garmentId: "${rescueItem.id}"):
${describeGarment(rescueItem)}

${rescueReason ? `Why they stopped wearing it: "${rescueReason}" — your outfits should directly address this concern.` : ""}

REST OF THEIR CLOSET (use these garmentIds when referencing pieces):
${closet
  .filter((g) => g.id !== rescueItem.id)
  .map((g) => `- garmentId "${g.id}": ${describeGarment(g)}`)
  .join("\n") || "(no other items captured yet — build outfits around the rescue item alone, noting missing pieces as optional additions)"}

USER STYLE PROFILE: ${describeStyleProfile(styleProfile)}

Generate exactly 3 distinct outfits that ALWAYS include the rescue item's garmentId and lean primarily on garmentIds already listed above. Only include a garmentId that does not exist in the closet list if you also add a matching entry to missingPieces describing it as an optional addition — never require a purchase. Prefer outfits with zero missing pieces when the closet supports it.

For each outfit return: name, vibe, garmentIds (existing ones only, referencing the ids given above), explanation (reference the rescue reason directly if one was given), stylingNotes (concrete actions: sleeves, tucking, layering order), occasion, colorHarmony, trendIds ([] is fine), confidenceScore, optionalTweak, and missingPieces.`;
}

export function styleMeNowPrompt(params: {
  occasion: string;
  closet: Garment[];
  styleProfile: UserStyleProfile;
  sizeProfile?: SizeProfile | null;
  trends: Trend[];
}): string {
  const { occasion, closet, styleProfile, sizeProfile, trends } = params;
  return `Build outfits for the occasion: "${occasion}".

THEIR CLOSET (use these garmentIds; you may reference at most 1-2 additional items per outfit as optional missing pieces, never more):
${closet.map((g) => `- garmentId "${g.id}": ${describeGarment(g)}`).join("\n") || '(their closet is completely empty — leave garmentIds as an empty array for every outfit, and instead describe every recommended piece as a short, plain-language entry in missingPieces, e.g. "a relaxed white tee". Still build three genuinely distinct, wearable outfits — just fully aspirational ones.)'}

USER STYLE PROFILE: ${describeStyleProfile(styleProfile)}
${sizeProfile ? `PREFERRED FIT: ${sizeProfile.preferredFit}` : ""}

CURRENTLY RELEVANT TRENDS (reference by trendId when an outfit connects to one):
${trends.map((t) => `- trendId "${t.id}" (${t.name}): ${t.description}`).join("\n")}

Generate exactly 3 outfits, each tagged with a distinct "lane" in its name/vibe:
1. SAFE — most naturally aligned with their established style, near-zero risk.
2. CURRENT — trend-forward but still authentically them; connect it to at least one trendId above.
3. PUSH ME — more experimental while remaining plausible for them to actually wear.

All three should draw primarily from their closet. For each return: name, vibe, garmentIds, explanation, stylingNotes, occasion, colorHarmony, trendIds, confidenceScore, optionalTweak, missingPieces.`;
}

export function personaAnalysisPrompt(query: string): string {
  return `Decode the recognizable FASHION LANGUAGE of: "${query}".

This may be a real public figure (celebrity, musician, athlete, historical figure) or a fictional character (movie/TV/anime/comic/video game). Infer which type it is.

Focus entirely on clothing: recurring silhouettes, proportions, signature pieces, colors, materials, patterns, footwear, accessories, layering habits, formality range, and 3-6 recurring style PRINCIPLES that could be translated to someone else's wardrobe (not just a list of exact items).

Do not fabricate biographical facts. Do not describe body type, ethnicity, or physical appearance — clothing and accessories only. If this is an obscure or ambiguous reference, use your best general fashion knowledge and lower the confidence score accordingly rather than refusing.

Return structured JSON: name, type (real_person or fictional_character), sourceWork (movie/show/franchise, omit for real people), description (2 sentences), styleTags, signaturePieces, colors, materials, patterns, silhouettes, footwear, accessories, layeringRules, formalityRange ([min,max] 1-5), recurringStylePrinciples, confidence (0-1).`;
}

export function personaOutfitPrompt(params: {
  persona: StylePersona;
  intensity: number;
  occasion?: string;
  closet: Garment[];
  styleProfile: UserStyleProfile;
  trends: Trend[];
}): string {
  const { persona, intensity, occasion, closet, styleProfile, trends } = params;
  const intensityLabel = intensity < 0.4 ? "SUBTLE" : intensity < 0.75 ? "RECOGNIZABLE" : "ICONIC";

  return `Translate ${persona.name}'s style language into outfits for this specific person's closet. The goal is STYLE TRANSLATION, not costume copying — never suggest literally buying "their exact [item]".

${persona.name.toUpperCase()}'S STYLE LANGUAGE:
- Signature pieces: ${persona.signaturePieces.join(", ")}
- Colors: ${persona.colors.join(", ")}
- Materials: ${persona.materials.join(", ") || "varied"}
- Silhouettes: ${persona.silhouettes.join(", ")}
- Footwear: ${persona.footwear.join(", ") || "varied"}
- Accessories: ${persona.accessories.join(", ") || "minimal"}
- Recurring principles: ${persona.recurringStylePrinciples.join("; ")}

INTENSITY: ${intensityLabel} (${Math.round(intensity * 100)}/100) — how far to lean into the persona's language vs. the user's own established style. Subtle = mostly the user's style with one persona-inspired accent. Iconic = strongly evokes the persona while still using only clothes an ordinary person could own.

${occasion ? `OCCASION: "${occasion}" — translate the persona's civilian style principles to this occasion; do not create a costume.` : ""}

THEIR CLOSET:
${closet.map((g) => `- garmentId "${g.id}": ${describeGarment(g)}`).join("\n") || '(their closet is completely empty — leave garmentIds as an empty array for every outfit, and instead describe every recommended piece as a short, plain-language entry in missingPieces, e.g. "a relaxed cream cardigan". Still build three genuinely distinct outfits across the closet/current/full-send lanes — just fully aspirational ones, all translating the persona\'s language rather than copying it.)'}

USER STYLE PROFILE: ${describeStyleProfile(styleProfile)}

RELEVANT CURRENT TRENDS (cite trendId if the persona's style overlaps with one):
${trends.map((t) => `- trendId "${t.id}" (${t.name}): ${t.description}`).join("\n")}

Generate exactly 3 outfits, each a distinct "lane":
1. "closet" — built almost entirely from garmentIds already in their closet.
2. "current" — persona style crossed with the current trends listed above.
3. "full-send" — the most expressive interpretation, intensity ${intensityLabel}, still wearable.

For each outfit return: name, vibe, garmentIds, explanation, stylingNotes, occasion, colorHarmony, trendIds, confidenceScore, optionalTweak, missingPieces, lane, whyThisFeelsLikeThem (2-4 concrete bullets like "relaxed trouser proportions" or "knitwear as a statement piece"), styleSimilarity ({silhouette, colorLanguage, layering, footwear, accessories}, each 0-100 — these describe STYLING similarity only, never physical resemblance), and overallSimilarity (0-100).`;
}

export function finalCritiquePrompt(params: {
  outfitName: string;
  garments: Garment[];
}): string {
  return `The person is now wearing this outfit and showing it to the camera: "${params.outfitName}" made of: ${params.garments
    .map((g) => g.name)
    .join(", ")}.

Give a short final styling critique of how it's being worn RIGHT NOW (proportions, layering, how pieces are styled together — e.g. tucked vs untucked, sleeves, buttons). Clothing and styling only, never the body wearing it. Be encouraging and specific.

Return structured JSON: critique (2-3 sentences), strengths (1-4 short bullets), suggestion (one optional tweak, or omit if it's already great).`;
}

export function stylistInstructionPrompt(params: {
  outfitName: string;
  garments: Garment[];
}): string {
  return `Act as a live AI stylist guiding someone into this outfit step by step in front of their camera: "${params.outfitName}" — pieces: ${params.garments
    .map((g) => `${g.name} (${g.category})`)
    .join(", ")}.

Return structured JSON: steps (an ordered array of short, spoken-style instructions, one garment/action per step, e.g. "Start with the white tee.", "Add the corduroy overshirt.", "Leave the top button open.", 4-8 steps total ending with them fully dressed), and closingPrompt (a short line asking them to step back so you can see the full outfit, e.g. "Great — step back so I can see the full look.").`;
}

export function trendExtractionPrompt(rawItems: { title: string; source: string; url: string }[]): string {
  return `Below are recent fashion headlines/snippets from public sources. Extract distinct FASHION TREND CONCEPTS (not just headlines) — garments, silhouettes, materials, colors, patterns, styling techniques, footwear, accessories, or broader aesthetics that appear to be currently relevant.

SOURCE ITEMS:
${rawItems.map((i) => `- [${i.source}] ${i.title}`).join("\n")}

For each distinct concept you can identify, return a trend candidate with: name, slug (kebab-case), description (1-2 sentences), category, applicableCategories, styleTags, genderPresentation, season, colors, materials, silhouettes, stylingRules. Merge near-duplicates (e.g. "wide-leg trousers" and "baggy trousers" become one concept) into a single candidate. Only include concepts genuinely supported by the source items — do not invent trends absent from the list.`;
}

export function personalizedTrendReasonPrompt(params: {
  trend: Trend;
  scoreBreakdown: { overall: number; styleMatch: number; closetMatch: number; fitMatch: number; trendStrength: number };
  closet: Garment[];
  styleProfile: UserStyleProfile;
}): string {
  const { trend, scoreBreakdown, closet, styleProfile } = params;
  return `A deterministic scoring engine already computed that "${trend.name}" is a ${scoreBreakdown.overall}% personal match for this user (style match ${scoreBreakdown.styleMatch}%, closet readiness ${scoreBreakdown.closetMatch}%, fit match ${scoreBreakdown.fitMatch}%, trend strength ${scoreBreakdown.trendStrength}%).

Trend: ${trend.description}
User style profile: ${describeStyleProfile(styleProfile)}
User closet categories owned: ${Array.from(new Set(closet.map((g) => g.category))).join(", ") || "none captured yet"}

Do NOT invent a different score. Explain in 1-2 encouraging sentences WHY this trend fits (or doesn't) this specific person, referencing their actual style/closet. Return structured JSON: { "reason": string }.`;
}

function describeGarment(g: Garment): string {
  return `${g.name} — ${g.category}/${g.subcategory}, ${g.primaryColor}${g.secondaryColors.length ? ` + ${g.secondaryColors.join(", ")}` : ""}, ${g.material}, ${g.pattern} pattern, ${g.fit} fit, ${g.silhouette} silhouette, formality ${g.formality}/5, tags: ${g.styleTags.join(", ")}`;
}

function describeStyleProfile(p: UserStyleProfile): string {
  const weights = Object.entries(p.styleWeights)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([tag, w]) => `${tag} (${Math.round((w ?? 0) * 100)}%)`)
    .join(", ");
  return `styles ${weights || "not yet set"}; prefers ${p.preferredFit} fit; favorite colors: ${
    p.favoriteColors.join(", ") || "none specified"
  }; avoids: ${p.avoidedColors.join(", ") || "nothing specified"}.${p.notes ? ` Notes: ${p.notes}` : ""}`;
}
