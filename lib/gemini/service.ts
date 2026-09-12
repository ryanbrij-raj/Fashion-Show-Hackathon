import "server-only";
import {
  garmentAnalysisSchema,
  styleDiscoverySchema,
  outfitGenerationResponseSchema,
  personaAnalysisSchema,
  personaOutfitResponseSchema,
  finalCritiqueSchema,
  stylistInstructionsSchema,
  personalizedTrendExplanationSchema,
  type GarmentAnalysis,
  type StyleDiscoveryResult,
  type GeneratedOutfit,
  type PersonaAnalysisResult,
  type PersonaOutfitResult,
  type FinalCritiqueResult,
  type StylistInstructionsResult,
} from "@/schemas";
import type { Garment, StylePersona, Trend, UserStyleProfile, SizeProfile } from "@/types";
import { generateStructured, type ImagePart } from "./client";
import {
  STYLIST_PERSONA_SYSTEM_INSTRUCTION,
  garmentAnalysisPrompt,
  styleDiscoveryPrompt,
  rescueOutfitPrompt,
  styleMeNowPrompt,
  personaAnalysisPrompt,
  personaOutfitPrompt,
  finalCritiquePrompt,
  stylistInstructionPrompt,
  personalizedTrendReasonPrompt,
} from "./prompts";
import { arr, enumStr, int, num, obj, str, GARMENT_CATEGORY_ENUM, SEASON_ENUM, STYLE_TAG_ENUM } from "./schema-builders";

const garmentJsonSchema = obj(
  {
    name: str(),
    category: enumStr(GARMENT_CATEGORY_ENUM),
    subcategory: str(),
    primaryColor: str(),
    secondaryColors: arr(str()),
    material: str(),
    pattern: str(),
    fit: str(),
    silhouette: str(),
    formality: int("1-5"),
    styleTags: arr(enumStr(STYLE_TAG_ENUM)),
    seasonality: arr(enumStr(SEASON_ENUM)),
    observations: str(),
    confidence: num("0-1"),
  },
  ["name", "category", "subcategory", "primaryColor", "material", "pattern", "fit", "silhouette", "formality", "styleTags", "seasonality", "observations", "confidence"]
);

export async function analyzeGarment(image: ImagePart, rescueReason?: string): Promise<GarmentAnalysis> {
  return generateStructured({
    systemInstruction: STYLIST_PERSONA_SYSTEM_INSTRUCTION,
    prompt: garmentAnalysisPrompt(rescueReason),
    image,
    jsonSchema: garmentJsonSchema,
    zodSchema: garmentAnalysisSchema,
    temperature: 0.4,
  });
}

const styleDiscoveryJsonSchema = obj(
  {
    detectedStyleTags: arr(enumStr(STYLE_TAG_ENUM)),
    palette: arr(str()),
    silhouettes: arr(str()),
    layering: str(),
    garmentCategoriesObserved: arr(enumStr(GARMENT_CATEGORY_ENUM)),
    formality: int("1-5"),
    patternUsage: str(),
    visibleAccessories: arr(str()),
    summary: str(),
  },
  ["detectedStyleTags", "formality", "summary"]
);

export async function discoverStyleFromFrame(image: ImagePart): Promise<StyleDiscoveryResult> {
  return generateStructured({
    systemInstruction: STYLIST_PERSONA_SYSTEM_INSTRUCTION,
    prompt: styleDiscoveryPrompt(),
    image,
    jsonSchema: styleDiscoveryJsonSchema,
    zodSchema: styleDiscoverySchema,
    temperature: 0.4,
  });
}

const outfitJsonSchema = obj(
  {
    outfits: arr(
      obj(
        {
          name: str(),
          vibe: str(),
          garmentIds: arr(str()),
          explanation: str(),
          stylingNotes: arr(str()),
          occasion: str(),
          colorHarmony: str(),
          trendIds: arr(str()),
          confidenceScore: num("0-1"),
          optionalTweak: str(),
          missingPieces: arr(str()),
        },
        ["name", "vibe", "garmentIds", "explanation", "stylingNotes", "occasion", "colorHarmony", "confidenceScore"]
      )
    ),
  },
  ["outfits"]
);

export async function generateRescueOutfits(params: {
  rescueItem: Garment;
  rescueReason?: string;
  closet: Garment[];
  styleProfile: UserStyleProfile;
}): Promise<GeneratedOutfit[]> {
  const result = await generateStructured({
    systemInstruction: STYLIST_PERSONA_SYSTEM_INSTRUCTION,
    prompt: rescueOutfitPrompt(params),
    jsonSchema: outfitJsonSchema,
    zodSchema: outfitGenerationResponseSchema,
    temperature: 0.7,
  });
  return result.outfits;
}

export async function generateStyleMeNowOutfits(params: {
  occasion: string;
  closet: Garment[];
  styleProfile: UserStyleProfile;
  sizeProfile?: SizeProfile | null;
  trends: Trend[];
}): Promise<GeneratedOutfit[]> {
  const result = await generateStructured({
    systemInstruction: STYLIST_PERSONA_SYSTEM_INSTRUCTION,
    prompt: styleMeNowPrompt(params),
    jsonSchema: outfitJsonSchema,
    zodSchema: outfitGenerationResponseSchema,
    temperature: 0.75,
  });
  return result.outfits;
}

const personaJsonSchema = obj(
  {
    name: str(),
    type: enumStr(["real_person", "fictional_character"]),
    sourceWork: str(),
    description: str(),
    styleTags: arr(enumStr(STYLE_TAG_ENUM)),
    signaturePieces: arr(str()),
    colors: arr(str()),
    materials: arr(str()),
    patterns: arr(str()),
    silhouettes: arr(str()),
    footwear: arr(str()),
    accessories: arr(str()),
    layeringRules: arr(str()),
    formalityRange: arr(int()),
    recurringStylePrinciples: arr(str()),
    confidence: num("0-1"),
  },
  ["name", "type", "description", "styleTags", "signaturePieces", "colors", "silhouettes", "formalityRange", "recurringStylePrinciples", "confidence"]
);

export async function analyzePersona(query: string): Promise<PersonaAnalysisResult> {
  return generateStructured({
    systemInstruction: STYLIST_PERSONA_SYSTEM_INSTRUCTION,
    prompt: personaAnalysisPrompt(query),
    jsonSchema: personaJsonSchema,
    zodSchema: personaAnalysisSchema,
    temperature: 0.5,
  });
}

const similaritySchema = obj(
  {
    silhouette: num("0-100"),
    colorLanguage: num("0-100"),
    layering: num("0-100"),
    footwear: num("0-100"),
    accessories: num("0-100"),
  },
  ["silhouette", "colorLanguage", "layering", "footwear", "accessories"]
);

const personaOutfitJsonSchema = obj(
  {
    outfits: arr(
      obj(
        {
          name: str(),
          vibe: str(),
          garmentIds: arr(str()),
          explanation: str(),
          stylingNotes: arr(str()),
          occasion: str(),
          colorHarmony: str(),
          trendIds: arr(str()),
          confidenceScore: num("0-1"),
          optionalTweak: str(),
          missingPieces: arr(str()),
          lane: enumStr(["closet", "current", "full-send"]),
          whyThisFeelsLikeThem: arr(str()),
          styleSimilarity: similaritySchema,
          overallSimilarity: num("0-100"),
        },
        [
          "name", "vibe", "garmentIds", "explanation", "stylingNotes", "occasion",
          "colorHarmony", "confidenceScore", "lane", "whyThisFeelsLikeThem",
          "styleSimilarity", "overallSimilarity",
        ]
      )
    ),
  },
  ["outfits"]
);

export async function generatePersonaOutfits(params: {
  persona: StylePersona;
  intensity: number;
  occasion?: string;
  closet: Garment[];
  styleProfile: UserStyleProfile;
  trends: Trend[];
}): Promise<PersonaOutfitResult[]> {
  const result = await generateStructured({
    systemInstruction: STYLIST_PERSONA_SYSTEM_INSTRUCTION,
    prompt: personaOutfitPrompt(params),
    jsonSchema: personaOutfitJsonSchema,
    zodSchema: personaOutfitResponseSchema,
    temperature: 0.75,
  });
  return result.outfits;
}

const critiqueJsonSchema = obj(
  { critique: str(), strengths: arr(str()), suggestion: str() },
  ["critique", "strengths"]
);

export async function critiqueFinalLook(params: { outfitName: string; garments: Garment[] }, image: ImagePart): Promise<FinalCritiqueResult> {
  return generateStructured({
    systemInstruction: STYLIST_PERSONA_SYSTEM_INSTRUCTION,
    prompt: finalCritiquePrompt(params),
    image,
    jsonSchema: critiqueJsonSchema,
    zodSchema: finalCritiqueSchema,
    temperature: 0.6,
  });
}

const stylistJsonSchema = obj(
  { steps: arr(str()), closingPrompt: str() },
  ["steps", "closingPrompt"]
);

export async function generateStylistInstructions(params: { outfitName: string; garments: Garment[] }): Promise<StylistInstructionsResult> {
  return generateStructured({
    systemInstruction: STYLIST_PERSONA_SYSTEM_INSTRUCTION,
    prompt: stylistInstructionPrompt(params),
    jsonSchema: stylistJsonSchema,
    zodSchema: stylistInstructionsSchema,
    temperature: 0.6,
  });
}

const reasonJsonSchema = obj({ reason: str() }, ["reason"]);

export async function explainPersonalizedTrend(params: {
  trend: Trend;
  scoreBreakdown: { overall: number; styleMatch: number; closetMatch: number; fitMatch: number; trendStrength: number };
  closet: Garment[];
  styleProfile: UserStyleProfile;
}): Promise<string> {
  const result = await generateStructured({
    systemInstruction: STYLIST_PERSONA_SYSTEM_INSTRUCTION,
    prompt: personalizedTrendReasonPrompt(params),
    jsonSchema: reasonJsonSchema,
    zodSchema: personalizedTrendExplanationSchema,
    temperature: 0.6,
  });
  return result.reason;
}
