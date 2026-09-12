// Core domain types for The Jerry.
// Keep these in sync with schemas/index.ts (Zod schemas validate anything AI-generated).

export type StyleTag =
  | "minimal"
  | "streetwear"
  | "workwear"
  | "preppy"
  | "vintage"
  | "classic"
  | "smart-casual"
  | "business"
  | "sporty"
  | "avant-garde"
  | "romantic"
  | "bohemian"
  | "y2k"
  | "quiet-luxury"
  | "western"
  | "gorpcore"
  | "techwear"
  | "americana"
  | "coastal"
  | "dark-academia"
  | "skater"
  | "contemporary"
  | "tailored"
  | "relaxed"
  | "experimental";

export const STYLE_TAGS: { id: StyleTag; label: string }[] = [
  { id: "minimal", label: "Minimal" },
  { id: "streetwear", label: "Streetwear" },
  { id: "workwear", label: "Workwear" },
  { id: "preppy", label: "Preppy" },
  { id: "vintage", label: "Vintage" },
  { id: "classic", label: "Classic" },
  { id: "smart-casual", label: "Smart Casual" },
  { id: "business", label: "Business" },
  { id: "sporty", label: "Sporty" },
  { id: "avant-garde", label: "Avant-Garde" },
  { id: "romantic", label: "Romantic" },
  { id: "bohemian", label: "Bohemian" },
  { id: "y2k", label: "Y2K" },
  { id: "quiet-luxury", label: "Quiet Luxury" },
  { id: "western", label: "Western" },
  { id: "gorpcore", label: "Gorpcore" },
  { id: "techwear", label: "Techwear" },
  { id: "americana", label: "Americana" },
  { id: "coastal", label: "Coastal" },
  { id: "dark-academia", label: "Dark Academia" },
  { id: "skater", label: "Skater" },
  { id: "contemporary", label: "Contemporary" },
  { id: "tailored", label: "Tailored" },
  { id: "relaxed", label: "Relaxed" },
  { id: "experimental", label: "Experimental" },
];

export type PreferredFit = "fitted" | "regular" | "relaxed" | "oversized";

export interface UserStyleProfile {
  styleWeights: Partial<Record<StyleTag, number>>;
  favoriteColors: string[];
  avoidedColors: string[];
  preferredFit: PreferredFit;
  notes?: string;
  discoveredAt?: string;
}

export type SizingSystem = "US" | "UK" | "EU" | "Other";

export interface SizeProfile {
  sizingSystem: SizingSystem;
  tops?: string;
  bottoms?: string;
  waist?: string;
  inseam?: string;
  jeans?: string;
  dress?: string;
  jacket?: string;
  shoes?: string;
  preferredFit: PreferredFit;
}

export type GarmentCategory =
  | "top"
  | "bottom"
  | "outerwear"
  | "dress"
  | "footwear"
  | "accessory"
  | "headwear"
  | "other";

export type Season = "spring" | "summer" | "fall" | "winter";

export interface Garment {
  id: string;
  image: string; // data URL or object URL, stored client-side only
  name: string;
  category: GarmentCategory;
  subcategory: string;
  primaryColor: string;
  secondaryColors: string[];
  material: string;
  pattern: string;
  fit: string;
  silhouette: string;
  formality: number; // 1 (very casual) - 5 (very formal)
  styleTags: StyleTag[];
  seasonality: Season[];
  observations: string;
  confidence: number; // 0-1
  addedAt: string;
  isRescueItem?: boolean;
  rescueReason?: string;
}

export interface Outfit {
  id: string;
  name: string;
  vibe: string;
  garmentIds: string[];
  explanation: string;
  stylingNotes: string[];
  occasion: string;
  colorHarmony: string;
  trendIds: string[];
  confidenceScore: number; // 0-1
  optionalTweak?: string;
  missingPieces?: string[];
  lane?: "safe" | "current" | "push-me" | "closet" | "full-send";
}

export type TrendCategory =
  | "garment"
  | "silhouette"
  | "material"
  | "color"
  | "pattern"
  | "styling-technique"
  | "footwear"
  | "accessory"
  | "aesthetic";

export interface TrendSource {
  name: string;
  url: string;
}

export interface Trend {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: TrendCategory;
  applicableCategories: GarmentCategory[];
  styleTags: StyleTag[];
  genderPresentation: "unisex" | "feminine-leaning" | "masculine-leaning";
  season: Season[];
  colors: string[];
  materials: string[];
  silhouettes: string[];
  stylingRules: string[];
  sourceNames: string[];
  sourceUrls: string[];
  sourceCount: number;
  trendScore: number; // 0-100, "Trend Signal"
  recencyScore: number; // 0-1
  crossSourceScore: number; // 0-1
  confidence: number; // 0-1
  updatedAt: string;
}

export type TrendDifficulty =
  | "already-in-closet"
  | "one-piece-away"
  | "requires-additions";

export interface PersonalizedTrend {
  trendId: string;
  compatibilityScore: number; // 0-100 overall
  closetCompatibilityScore: number; // 0-100
  styleCompatibilityScore: number; // 0-100
  fitCompatibilityScore: number; // 0-100
  reason: string;
  ownedGarmentIds: string[];
  missingPieces: string[];
  suggestedOutfit?: Outfit;
  difficulty: TrendDifficulty;
}

export type PersonaType = "real_person" | "fictional_character";

export interface StylePersona {
  id: string;
  name: string;
  type: PersonaType;
  sourceWork?: string;
  description: string;
  styleTags: StyleTag[];
  signaturePieces: string[];
  colors: string[];
  materials: string[];
  patterns: string[];
  silhouettes: string[];
  footwear: string[];
  accessories: string[];
  layeringRules: string[];
  formalityRange: [number, number];
  recurringStylePrinciples: string[];
  confidence: number;
  sources: TrendSource[];
}

export interface StyleSimilarityBreakdown {
  silhouette: number;
  colorLanguage: number;
  layering: number;
  footwear: number;
  accessories: number;
}

export interface PersonaOutfit extends Outfit {
  whyThisFeelsLikeThem: string[];
  styleSimilarity: StyleSimilarityBreakdown;
  overallSimilarity: number;
}

export interface PersonaMatch {
  personaId: string;
  overallMatch: number;
  closetMatch: number;
  styleMatch: number;
  overlapTags: StyleTag[];
  availableGarmentIds: string[];
  missingCategories: string[];
  outfits: PersonaOutfit[];
  trendOverlap?: { trendId: string; explanation: string }[];
}

export type RescueStage =
  | "WELCOME"
  | "CAMERA"
  | "RESCUE_ITEM"
  | "ITEM_ANALYSIS"
  | "CLOSET_CAPTURE"
  | "OUTFIT_GENERATION"
  | "OUTFIT_SELECTION"
  | "AI_STYLIST"
  | "FINAL_ANALYSIS"
  | "RESCUE_CARD";

export interface RescueSession {
  stage: RescueStage;
  rescueItem?: Garment;
  rescueReason?: string;
  closet: Garment[];
  outfits: Outfit[];
  selectedOutfitId?: string;
  finalCritique?: string;
  createdAt: string;
}

export type PersonaStage =
  | "PERSON_SEARCH"
  | "PERSONA_ANALYSIS"
  | "PERSONA_MATCH"
  | "OUTFIT_GENERATION"
  | "AI_STYLIST"
  | "FINAL_CARD";

export interface PersonaSession {
  stage: PersonaStage;
  query?: string;
  persona?: StylePersona;
  intensity: number; // 0-1
  occasion?: string;
  match?: PersonaMatch;
  selectedOutfitId?: string;
  finalCritique?: string;
  createdAt: string;
}

export type StylistTargetKind = "rescue" | "style-now" | "persona";

export interface FinalLookCard {
  id: string;
  kind: StylistTargetKind;
  headline: string;
  outfitName: string;
  styleDna: StyleTag[];
  garmentNames: string[];
  closetUsedCount: number;
  closetTotalCount: number;
  trendMatchName?: string;
  personaName?: string;
  styleSimilarity?: number;
  rescueItemName?: string;
  tagline: string;
  createdAt: string;
}
