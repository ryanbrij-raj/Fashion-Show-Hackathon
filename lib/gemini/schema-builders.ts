// Tiny helpers for building Gemini "responseSchema" objects. Gemini uses its
// own OpenAPI-flavored schema (uppercase type names) rather than standard
// JSON Schema, so we build it by hand and rely on Zod (schemas/index.ts) as
// the real source of truth / validator on the way back in.

export const STYLE_TAG_ENUM = [
  "minimal", "streetwear", "workwear", "preppy", "vintage", "classic",
  "smart-casual", "business", "sporty", "avant-garde", "romantic",
  "bohemian", "y2k", "quiet-luxury", "western", "gorpcore", "techwear",
  "americana", "coastal", "dark-academia", "skater", "contemporary",
  "tailored", "relaxed", "experimental",
];

export const GARMENT_CATEGORY_ENUM = [
  "top", "bottom", "outerwear", "dress", "footwear", "accessory", "headwear", "other",
];

export const SEASON_ENUM = ["spring", "summer", "fall", "winter"];

export function obj(properties: Record<string, unknown>, required: string[]) {
  return { type: "OBJECT", properties, required };
}

export function str(description?: string) {
  return description ? { type: "STRING", description } : { type: "STRING" };
}

export function enumStr(values: string[], description?: string) {
  return { type: "STRING", enum: values, ...(description ? { description } : {}) };
}

export function num(description?: string) {
  return description ? { type: "NUMBER", description } : { type: "NUMBER" };
}

export function int(description?: string) {
  return description ? { type: "INTEGER", description } : { type: "INTEGER" };
}

export function arr(items: unknown, description?: string) {
  return { type: "ARRAY", items, ...(description ? { description } : {}) };
}
