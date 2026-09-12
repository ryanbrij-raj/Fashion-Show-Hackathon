import { z } from "zod";

// Zod schemas used to validate AI (Gemini) structured output and user-entered
// profile data. Keep field sets in sync with types/index.ts.

// LLMs occasionally return a confidence/similarity as a 0-100 percentage
// even when the prompt/schema asks for 0-1 (or vice versa) — normalize
// instead of failing validation and burning a retry over a units mismatch.
const unitScore = z.preprocess((val) => {
  if (typeof val === "number" && val > 1) return val / 100;
  return val;
}, z.number().min(0).max(1));

const percentScore = z.preprocess((val) => {
  if (typeof val === "number" && val > 0 && val <= 1) return val * 100;
  return val;
}, z.number().min(0).max(100));

export const styleTagSchema = z.enum([
  "minimal",
  "streetwear",
  "workwear",
  "preppy",
  "vintage",
  "classic",
  "smart-casual",
  "business",
  "sporty",
  "avant-garde",
  "romantic",
  "bohemian",
  "y2k",
  "quiet-luxury",
  "western",
  "gorpcore",
  "techwear",
  "americana",
  "coastal",
  "dark-academia",
  "skater",
  "contemporary",
  "tailored",
  "relaxed",
  "experimental",
]);

export const preferredFitSchema = z.enum([
  "fitted",
  "regular",
  "relaxed",
  "oversized",
]);

export const garmentCategorySchema = z.enum([
  "top",
  "bottom",
  "outerwear",
  "dress",
  "footwear",
  "accessory",
  "headwear",
  "other",
]);

export const seasonSchema = z.enum(["spring", "summer", "fall", "winter"]);

export const sizingSystemSchema = z.enum(["US", "UK", "EU", "Other"]);

export const sizeProfileSchema = z.object({
  sizingSystem: sizingSystemSchema.default("US"),
  tops: z.string().optional(),
  bottoms: z.string().optional(),
  waist: z.string().optional(),
  inseam: z.string().optional(),
  jeans: z.string().optional(),
  dress: z.string().optional(),
  jacket: z.string().optional(),
  shoes: z.string().optional(),
  preferredFit: preferredFitSchema.default("regular"),
});

export const userStyleProfileSchema = z.object({
  styleWeights: z.partialRecord(styleTagSchema, z.number().min(0).max(1)),
  favoriteColors: z.array(z.string()).default([]),
  avoidedColors: z.array(z.string()).default([]),
  preferredFit: preferredFitSchema.default("regular"),
  notes: z.string().optional(),
  discoveredAt: z.string().optional(),
});

// --- Gemini structured-output schemas ---

export const garmentAnalysisSchema = z.object({
  name: z.string().min(1).max(80),
  category: garmentCategorySchema,
  subcategory: z.string().min(1).max(60),
  primaryColor: z.string().min(1).max(40),
  secondaryColors: z.array(z.string().max(40)).max(4).default([]),
  material: z.string().min(1).max(80),
  pattern: z.string().min(1).max(40),
  fit: z.string().min(1).max(40),
  silhouette: z.string().min(1).max(60),
  formality: z.number().int().min(1).max(5),
  styleTags: z.array(styleTagSchema).min(1).max(6),
  seasonality: z.array(seasonSchema).min(1).max(4),
  observations: z.string().min(1).max(400),
  confidence: unitScore,
});
export type GarmentAnalysis = z.infer<typeof garmentAnalysisSchema>;

export const styleDiscoverySchema = z.object({
  detectedStyleTags: z.array(styleTagSchema).min(1).max(8),
  palette: z.array(z.string()).max(6).default([]),
  silhouettes: z.array(z.string()).max(6).default([]),
  layering: z.string().max(300).default(""),
  garmentCategoriesObserved: z.array(garmentCategorySchema).default([]),
  formality: z.number().int().min(1).max(5),
  patternUsage: z.string().max(200).default(""),
  visibleAccessories: z.array(z.string()).max(6).default([]),
  summary: z.string().min(1).max(400),
});
export type StyleDiscoveryResult = z.infer<typeof styleDiscoverySchema>;

// Shared base — kept as a plain ZodObject (not `.refine()`-wrapped) so
// personaOutfitSchema below can still `.extend()` it. Both outfit schemas
// require *some* content (real garments or suggested ones), but not
// necessarily any real garmentIds — a fully aspirational outfit (empty
// closet) has nothing owned yet to reference; everything lives in
// missingPieces instead.
const outfitFieldsSchema = z.object({
  name: z.string().min(1).max(60),
  vibe: z.string().min(1).max(60),
  garmentIds: z.array(z.string()).default([]),
  explanation: z.string().min(1).max(500),
  stylingNotes: z.array(z.string().max(200)).min(1).max(5),
  occasion: z.string().min(1).max(80),
  colorHarmony: z.string().min(1).max(200),
  trendIds: z.array(z.string()).default([]),
  confidenceScore: unitScore,
  optionalTweak: z.string().max(200).optional(),
  missingPieces: z.array(z.string().max(80)).default([]),
});

const requiresSomeContent = (o: { garmentIds: string[]; missingPieces: string[] }) =>
  o.garmentIds.length > 0 || o.missingPieces.length > 0;

const someContentRefinement = {
  message: "An outfit needs at least one real or suggested garment.",
  path: ["garmentIds"],
};

export const generatedOutfitSchema = outfitFieldsSchema.refine(requiresSomeContent, someContentRefinement);
export type GeneratedOutfit = z.infer<typeof generatedOutfitSchema>;

export const outfitGenerationResponseSchema = z.object({
  outfits: z.array(generatedOutfitSchema).min(1).max(3),
});

export const trendCandidateSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
  category: z.enum([
    "garment",
    "silhouette",
    "material",
    "color",
    "pattern",
    "styling-technique",
    "footwear",
    "accessory",
    "aesthetic",
  ]),
  applicableCategories: z.array(garmentCategorySchema).default([]),
  styleTags: z.array(styleTagSchema).default([]),
  genderPresentation: z
    .enum(["unisex", "feminine-leaning", "masculine-leaning"])
    .default("unisex"),
  season: z.array(seasonSchema).default([]),
  colors: z.array(z.string()).default([]),
  materials: z.array(z.string()).default([]),
  silhouettes: z.array(z.string()).default([]),
  stylingRules: z.array(z.string()).default([]),
});
export type TrendCandidate = z.infer<typeof trendCandidateSchema>;

export const trendNormalizationResponseSchema = z.object({
  trends: z.array(trendCandidateSchema),
});

export const personaAnalysisSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["real_person", "fictional_character"]),
  sourceWork: z.string().max(120).optional(),
  description: z.string().min(1).max(400),
  styleTags: z.array(styleTagSchema).min(1).max(8),
  signaturePieces: z.array(z.string().max(80)).min(1).max(8),
  colors: z.array(z.string()).min(1).max(8),
  materials: z.array(z.string()).default([]),
  patterns: z.array(z.string()).default([]),
  silhouettes: z.array(z.string()).min(1).max(6),
  footwear: z.array(z.string()).default([]),
  accessories: z.array(z.string()).default([]),
  layeringRules: z.array(z.string()).default([]),
  formalityRange: z.tuple([z.number().min(1).max(5), z.number().min(1).max(5)]),
  recurringStylePrinciples: z.array(z.string()).min(1).max(6),
  confidence: unitScore,
});
export type PersonaAnalysisResult = z.infer<typeof personaAnalysisSchema>;

export const styleSimilarityBreakdownSchema = z.object({
  silhouette: percentScore,
  colorLanguage: percentScore,
  layering: percentScore,
  footwear: percentScore,
  accessories: percentScore,
});

export const personaOutfitSchema = outfitFieldsSchema
  .extend({
    lane: z.enum(["closet", "current", "full-send"]),
    whyThisFeelsLikeThem: z.array(z.string().max(200)).min(1).max(5),
    styleSimilarity: styleSimilarityBreakdownSchema,
    overallSimilarity: percentScore,
  })
  .refine(requiresSomeContent, someContentRefinement);
export type PersonaOutfitResult = z.infer<typeof personaOutfitSchema>;

export const personaOutfitResponseSchema = z.object({
  outfits: z.array(personaOutfitSchema).min(1).max(3),
});

export const finalCritiqueSchema = z.object({
  critique: z.string().min(1).max(500),
  strengths: z.array(z.string().max(150)).min(1).max(4),
  suggestion: z.string().max(200).optional(),
});
export type FinalCritiqueResult = z.infer<typeof finalCritiqueSchema>;

export const stylistInstructionsSchema = z.object({
  steps: z.array(z.string().max(150)).min(1).max(8),
  closingPrompt: z.string().max(150),
});
export type StylistInstructionsResult = z.infer<typeof stylistInstructionsSchema>;

export const personalizedTrendExplanationSchema = z.object({
  reason: z.string().min(1).max(300),
});
