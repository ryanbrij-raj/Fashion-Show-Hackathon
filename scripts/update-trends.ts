/**
 * Trend Radar update pipeline.
 *
 * Pulls recent headlines from publicly accessible fashion RSS feeds (no
 * paywall bypass, no auth, no anti-bot circumvention — feeds that 404 or
 * fail are simply skipped), extracts trend concepts, clusters/normalizes
 * them, scores them with the same heuristic used at runtime
 * (lib/scoring/calculateTrendSignal), and writes the top ~50 to
 * data/trends.json.
 *
 * Run with: npm run update-trends
 * Uses Gemini (if GEMINI_API_KEY is set) to extract and normalize trend
 * concepts from headlines; without a key, falls back to a smaller built-in
 * keyword taxonomy so the script still produces a usable file.
 */
import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });

import { GoogleGenAI } from "@google/genai";
import { trendNormalizationResponseSchema } from "../schemas";
import { calculateTrendSignal } from "../lib/scoring";
import type { Trend } from "../types";

interface RssSource {
  name: string;
  url: string;
  authority: number; // 0-1, editorial reach/reputation
}

const SOURCES: RssSource[] = [
  { name: "Vogue", url: "https://www.vogue.com/feed/rss", authority: 0.95 },
  { name: "GQ", url: "https://www.gq.com/feed/rss", authority: 0.9 },
  { name: "Elle", url: "https://www.elle.com/rss/all.xml/", authority: 0.85 },
  { name: "Harper's Bazaar", url: "https://www.harpersbazaar.com/rss/all.xml/", authority: 0.9 },
  { name: "Esquire", url: "https://www.esquire.com/rss/all.xml/", authority: 0.85 },
  { name: "Who What Wear", url: "https://www.whowhatwear.com/rss", authority: 0.75 },
  { name: "Highsnobiety", url: "https://www.highsnobiety.com/feed/", authority: 0.8 },
  { name: "Hypebeast", url: "https://hypebeast.com/feed", authority: 0.8 },
];

interface RawItem {
  title: string;
  source: string;
  sourceUrl: string;
  authority: number;
}

async function fetchFeedItems(source: RssSource, limit = 15): Promise<RawItem[]> {
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "ClosetRescueTrendBot/1.0 (+editorial trend research)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[skip] ${source.name}: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const titles = Array.from(xml.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g))
      .map((m) => m[1].trim())
      .filter((t) => t && !t.toLowerCase().includes(source.name.toLowerCase()));
    return titles.slice(0, limit).map((title) => ({
      title,
      source: source.name,
      sourceUrl: source.url,
      authority: source.authority,
    }));
  } catch (err) {
    console.warn(`[skip] ${source.name}: ${(err as Error).message}`);
    return [];
  }
}

const FALLBACK_TAXONOMY = [
  "wide-leg", "workwear", "quiet luxury", "cargo", "denim", "leather", "puffer",
  "loafers", "western boots", "tailoring", "cardigan", "streetwear", "gorpcore",
  "balletcore", "y2k", "corset", "trench", "bomber", "flannel", "argyle",
];

async function extractWithGemini(items: RawItem[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

  const { trendExtractionPrompt } = await import("../lib/gemini/prompts");
  const { obj, arr, str, enumStr, GARMENT_CATEGORY_ENUM, STYLE_TAG_ENUM, SEASON_ENUM } = await import(
    "../lib/gemini/schema-builders"
  );

  const jsonSchema = obj(
    {
      trends: arr(
        obj(
          {
            name: str(),
            slug: str(),
            description: str(),
            category: enumStr([
              "garment", "silhouette", "material", "color", "pattern",
              "styling-technique", "footwear", "accessory", "aesthetic",
            ]),
            applicableCategories: arr(enumStr(GARMENT_CATEGORY_ENUM)),
            styleTags: arr(enumStr(STYLE_TAG_ENUM)),
            genderPresentation: enumStr(["unisex", "feminine-leaning", "masculine-leaning"]),
            season: arr(enumStr(SEASON_ENUM)),
            colors: arr(str()),
            materials: arr(str()),
            silhouettes: arr(str()),
            stylingRules: arr(str()),
          },
          ["name", "slug", "description", "category"]
        )
      ),
    },
    ["trends"]
  );

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: trendExtractionPrompt(items.map((i) => ({ title: i.title, source: i.source, url: i.sourceUrl }))) }] }],
    config: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: jsonSchema,
    },
  });

  const parsed = JSON.parse(response.text ?? "{}");
  const result = trendNormalizationResponseSchema.safeParse(parsed);
  return result.success ? result.data.trends : null;
}

function extractWithTaxonomy(items: RawItem[]) {
  return FALLBACK_TAXONOMY.filter((keyword) =>
    items.some((i) => i.title.toLowerCase().includes(keyword))
  ).map((keyword) => ({
    name: keyword.replace(/\b\w/g, (c) => c.toUpperCase()),
    slug: keyword.replace(/\s+/g, "-"),
    description: `A recurring reference to "${keyword}" across recent fashion coverage.`,
    category: "aesthetic" as const,
    applicableCategories: [],
    styleTags: [],
    genderPresentation: "unisex" as const,
    season: [],
    colors: [],
    materials: [],
    silhouettes: [],
    stylingRules: [],
  }));
}

async function main() {
  console.log("Fetching accessible fashion sources…");
  const results = await Promise.all(SOURCES.map((s) => fetchFeedItems(s)));
  const items = results.flat();
  console.log(`Collected ${items.length} headlines from ${results.filter((r) => r.length > 0).length}/${SOURCES.length} sources.`);

  if (items.length === 0) {
    console.error("No sources were reachable. Leaving data/trends.json untouched.");
    process.exit(0);
  }

  const candidates = (await extractWithGemini(items)) ?? extractWithTaxonomy(items);
  console.log(`Extracted ${candidates.length} candidate trend concepts.`);

  const outPath = path.resolve(process.cwd(), "data/trends.json");
  const existing: Trend[] = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf-8")) : [];
  const existingBySlug = new Map(existing.map((t) => [t.slug, t]));

  const now = new Date().toISOString();

  const trends: Trend[] = candidates.map((c) => {
    const matchingItems = items.filter((i) =>
      i.title.toLowerCase().includes(c.name.toLowerCase()) ||
      c.name.toLowerCase().split(" ").some((w) => w.length > 3 && i.title.toLowerCase().includes(w))
    );
    const distinctSources = new Set(matchingItems.map((i) => i.source));
    const crossSourceScore = Math.min(1, distinctSources.size / 3);
    const authorityScore =
      matchingItems.length > 0
        ? matchingItems.reduce((s, i) => s + i.authority, 0) / matchingItems.length
        : 0.7;
    const recencyScore = 0.9; // freshly pulled this run

    const trendScore = calculateTrendSignal({ recencyScore, crossSourceScore, sourceAuthorityScore: authorityScore });
    const previous = existingBySlug.get(c.slug);

    const trend: Trend = {
      id: previous?.id ?? `trend_${c.slug}`,
      name: c.name,
      slug: c.slug,
      description: c.description,
      category: c.category,
      applicableCategories: c.applicableCategories.length ? c.applicableCategories : previous?.applicableCategories ?? [],
      styleTags: c.styleTags.length ? c.styleTags : previous?.styleTags ?? [],
      genderPresentation: c.genderPresentation,
      season: c.season.length ? c.season : previous?.season ?? ["spring", "summer", "fall", "winter"],
      colors: c.colors.length ? c.colors : previous?.colors ?? [],
      materials: c.materials.length ? c.materials : previous?.materials ?? [],
      silhouettes: c.silhouettes.length ? c.silhouettes : previous?.silhouettes ?? [],
      stylingRules: c.stylingRules.length ? c.stylingRules : previous?.stylingRules ?? [],
      sourceNames: Array.from(distinctSources.size ? distinctSources : new Set(previous?.sourceNames ?? [])),
      sourceUrls: Array.from(new Set(matchingItems.map((i) => i.sourceUrl))).length
        ? Array.from(new Set(matchingItems.map((i) => i.sourceUrl)))
        : previous?.sourceUrls ?? [],
      sourceCount: distinctSources.size || previous?.sourceCount || 1,
      trendScore,
      recencyScore,
      crossSourceScore,
      confidence: Math.round((0.5 + 0.4 * crossSourceScore) * 100) / 100,
      updatedAt: now,
    };
    return trend;
  });

  trends.sort((a, b) => b.trendScore - a.trendScore);
  const top50 = trends.slice(0, 50);

  writeFileSync(outPath, JSON.stringify(top50, null, 2) + "\n");
  console.log(`Wrote ${top50.length} trends to data/trends.json (updated ${now}).`);
}

main().catch((err) => {
  console.error("Trend update failed:", err);
  process.exit(1);
});
