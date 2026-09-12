import type { Garment, PersonaOutfit, StylePersona } from "@/types";
import { calculatePersonaMatch } from "@/lib/scoring";
import { newId } from "@/lib/utils";

/**
 * Deterministic, non-Gemini outfit builder used when a cached persona is
 * requested but Gemini isn't configured (or the request fails). Keeps
 * Style Like usable end-to-end for any of the cached personas, not just the
 * one bundled in Demo Mode's canned dataset.
 */
export function buildFallbackPersonaOutfits(
  persona: StylePersona,
  closet: Garment[]
): PersonaOutfit[] {
  if (closet.length === 0) return buildAspirationalPersonaOutfits(persona);

  const scored = closet
    .map((g) => ({
      garment: g,
      overlap: g.styleTags.filter((t) => persona.styleTags.includes(t)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap);

  const closetMatch = calculatePersonaMatch({
    userStyleTags: Array.from(new Set(closet.flatMap((g) => g.styleTags))),
    closet,
    personaStyleTags: persona.styleTags,
    personaSignaturePieces: persona.signaturePieces,
  });

  const lanes: { lane: PersonaOutfit["lane"]; name: string; count: number; boost: number }[] = [
    { lane: "closet", name: `Your Closet, ${persona.name}-Tinted`, count: Math.min(4, closet.length), boost: 0 },
    { lane: "current", name: `${persona.name} × Right Now`, count: Math.min(4, closet.length), boost: 5 },
    { lane: "full-send", name: `${persona.name}, Full Send`, count: Math.min(5, closet.length), boost: -8 },
  ];

  return lanes.map((laneDef, i) => {
    const picks = scored.slice(0, laneDef.count).map((s) => s.garment);
    const overallSimilarity = Math.max(20, Math.min(97, closetMatch.overallMatch + laneDef.boost));

    return {
      id: newId("persona_outfit_fallback"),
      name: laneDef.name,
      vibe: `${persona.name}'s language, translated`,
      garmentIds: picks.map((p) => p.id),
      explanation: `Built from the pieces in your closet that share the most style DNA with ${persona.name}: ${persona.recurringStylePrinciples[0] ?? "their recurring silhouette"}.`,
      stylingNotes: persona.layeringRules.slice(0, 2).length
        ? persona.layeringRules.slice(0, 2)
        : ["Keep the silhouette relaxed and let one piece carry the color."],
      occasion: "Everyday",
      colorHarmony: `Leans on ${persona.colors.slice(0, 2).join(" and ")}, echoing their usual palette.`,
      trendIds: [],
      confidenceScore: 0.6,
      missingPieces: closet.length < 3 ? [persona.signaturePieces[0]] : [],
      lane: laneDef.lane,
      whyThisFeelsLikeThem: persona.recurringStylePrinciples.slice(0, 3),
      styleSimilarity: {
        silhouette: overallSimilarity,
        colorLanguage: Math.max(15, overallSimilarity - 10 + i * 3),
        layering: Math.max(15, overallSimilarity - 5),
        footwear: Math.max(15, overallSimilarity - 20),
        accessories: Math.max(10, overallSimilarity - 30),
      },
      overallSimilarity,
    };
  });
}

/**
 * A fully aspirational board for an empty closet — nothing owned yet, so
 * every "garment" is a plain-language suggestion in missingPieces instead
 * of a real garmentId. Similarity scores stay low and honest: there's
 * nothing in the closet yet to actually be similar to anything.
 */
function buildAspirationalPersonaOutfits(persona: StylePersona): PersonaOutfit[] {
  const pieces = persona.signaturePieces.length > 0 ? persona.signaturePieces : ["a versatile basic top", "a well-fitting bottom", "a simple pair of shoes"];

  const lanes: { lane: PersonaOutfit["lane"]; name: string; count: number; similarity: number }[] = [
    { lane: "closet", name: `Starting Point, ${persona.name}-Inspired`, count: Math.min(2, pieces.length), similarity: 35 },
    { lane: "current", name: `${persona.name} × Right Now`, count: Math.min(4, pieces.length), similarity: 45 },
    { lane: "full-send", name: `${persona.name}, Full Send`, count: pieces.length, similarity: 55 },
  ];

  return lanes.map((laneDef, i) => ({
    id: newId("persona_outfit_aspirational"),
    name: laneDef.name,
    vibe: `${persona.name}'s language, as a shopping-free starting point`,
    garmentIds: [],
    explanation: `Your closet doesn't have anything captured yet, so this is a fully aspirational look built from ${persona.name}'s recurring style language: ${persona.recurringStylePrinciples[0] ?? "their signature silhouette"}. Add a few real pieces via Rescue and this will translate onto what you actually own instead.`,
    stylingNotes: persona.layeringRules.slice(0, 2).length
      ? persona.layeringRules.slice(0, 2)
      : ["Keep the silhouette relaxed and let one piece carry the color."],
    occasion: "Everyday",
    colorHarmony: `Leans on ${persona.colors.slice(0, 2).join(" and ")}, echoing their usual palette.`,
    trendIds: [],
    confidenceScore: 0.5,
    missingPieces: pieces.slice(0, laneDef.count),
    lane: laneDef.lane,
    whyThisFeelsLikeThem: persona.recurringStylePrinciples.slice(0, 3),
    styleSimilarity: {
      silhouette: laneDef.similarity,
      colorLanguage: Math.max(15, laneDef.similarity - 10 + i * 3),
      layering: Math.max(15, laneDef.similarity - 5),
      footwear: Math.max(15, laneDef.similarity - 20),
      accessories: Math.max(10, laneDef.similarity - 25),
    },
    overallSimilarity: laneDef.similarity,
  }));
}
