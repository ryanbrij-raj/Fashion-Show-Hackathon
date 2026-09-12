import type {
  Garment,
  PreferredFit,
  StyleTag,
  Trend,
} from "@/types";
import { clamp, round } from "@/lib/utils";

/**
 * Deterministic scoring engine. Gemini is used to *explain* these scores,
 * never to invent them — every percentage shown in the UI traces back to a
 * function here so results are stable, debuggable, and can't drift between
 * calls to the model.
 */

function overlap<T>(a: T[], b: T[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const shared = a.filter((x) => setB.has(x)).length;
  return shared / Math.max(a.length, b.length, 1);
}

/** How well a set of style tags aligns with the user's weighted style profile. 0-100. */
export function calculateStyleMatch(
  styleWeights: Partial<Record<StyleTag, number>>,
  candidateTags: StyleTag[]
): number {
  if (candidateTags.length === 0) return 0;
  const weights = Object.values(styleWeights).filter(
    (w): w is number => typeof w === "number"
  );
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 1;
  const total = candidateTags.reduce((sum, tag) => {
    const w = styleWeights[tag] ?? 0;
    return sum + w;
  }, 0);
  const avg = total / candidateTags.length;
  return round(clamp((avg / (maxWeight || 1)) * 100, 0, 100));
}

/** Fraction (0-100) of a trend/outfit's applicable categories the user already owns. */
export function calculateClosetReadiness(
  closet: Garment[],
  requiredCategories: string[],
  requiredStyleTags: StyleTag[] = []
): number {
  if (requiredCategories.length === 0) return 100;
  const ownedCategories = new Set(closet.map((g) => g.category));
  const categoryScore =
    requiredCategories.filter((c) => ownedCategories.has(c as Garment["category"])).length /
    requiredCategories.length;

  const styleScore =
    requiredStyleTags.length === 0
      ? 1
      : overlap(
          requiredStyleTags,
          Array.from(new Set(closet.flatMap((g) => g.styleTags)))
        );

  return round(clamp((categoryScore * 0.75 + styleScore * 0.25) * 100, 0, 100));
}

const FIT_ADJACENCY: Record<PreferredFit, PreferredFit[]> = {
  fitted: ["fitted", "regular"],
  regular: ["regular", "fitted", "relaxed"],
  relaxed: ["relaxed", "regular", "oversized"],
  oversized: ["oversized", "relaxed"],
};

/** How compatible a garment/trend's fit language is with the user's preferred fit. 0-100. */
export function calculateFitMatch(
  preferredFit: PreferredFit,
  candidateFitDescriptor: string
): number {
  const descriptor = candidateFitDescriptor.toLowerCase();
  const adjacency = FIT_ADJACENCY[preferredFit] ?? [preferredFit];
  const matchIndex = adjacency.findIndex((fit) => descriptor.includes(fit));
  if (matchIndex === -1) return 55; // unknown/neutral descriptor, don't penalize hard
  const score = 100 - matchIndex * 25;
  return round(clamp(score, 0, 100));
}

/** Raw trend strength, just the trend's own signal, scaled 0-100. */
export function calculateTrendStrength(trend: Trend): number {
  return round(clamp(trend.trendScore, 0, 100));
}

export interface PersonalMatchInputs {
  styleWeights: Partial<Record<StyleTag, number>>;
  closet: Garment[];
  preferredFit: PreferredFit;
  trend: Trend;
}

export interface PersonalMatchBreakdown {
  overall: number;
  styleMatch: number;
  closetMatch: number;
  fitMatch: number;
  trendStrength: number;
}

/**
 * personalMatch = 0.35 * styleMatch + 0.30 * closetMatch + 0.15 * fitMatch + 0.20 * trendStrength
 */
export function calculatePersonalTrendMatch(
  inputs: PersonalMatchInputs
): PersonalMatchBreakdown {
  const styleMatch = calculateStyleMatch(inputs.styleWeights, inputs.trend.styleTags);
  const closetMatch = calculateClosetReadiness(
    inputs.closet,
    inputs.trend.applicableCategories,
    inputs.trend.styleTags
  );
  const fitMatch = calculateFitMatch(
    inputs.preferredFit,
    inputs.trend.silhouettes.join(" ")
  );
  const trendStrength = calculateTrendStrength(inputs.trend);

  const overall = round(
    clamp(
      0.35 * styleMatch + 0.3 * closetMatch + 0.15 * fitMatch + 0.2 * trendStrength,
      0,
      100
    )
  );

  return { overall, styleMatch, closetMatch, fitMatch, trendStrength };
}

export interface PersonaMatchInputs {
  userStyleTags: StyleTag[];
  closet: Garment[];
  personaStyleTags: StyleTag[];
  personaSignaturePieces: string[];
}

export interface PersonaMatchBreakdown {
  overallMatch: number;
  closetMatch: number;
  styleMatch: number;
  overlapTags: StyleTag[];
}

/** How well a persona's style language can be recreated from the user's closet + taste. */
export function calculatePersonaMatch(
  inputs: PersonaMatchInputs
): PersonaMatchBreakdown {
  const overlapTags = inputs.personaStyleTags.filter((t) =>
    inputs.userStyleTags.includes(t)
  );
  const styleMatch = round(
    clamp(overlap(inputs.personaStyleTags, inputs.userStyleTags) * 100, 0, 100)
  );

  const closetCategories = new Set(inputs.closet.flatMap((g) => g.styleTags));
  const closetOverlap = inputs.personaStyleTags.filter((t) =>
    closetCategories.has(t)
  ).length;
  const closetMatch = round(
    clamp(
      (closetOverlap / Math.max(inputs.personaStyleTags.length, 1)) * 100,
      0,
      100
    )
  );

  const overallMatch = round(clamp(styleMatch * 0.45 + closetMatch * 0.55, 0, 100));

  return { overallMatch, closetMatch, styleMatch, overlapTags };
}

/** Trend Signal heuristic used by the trend updater pipeline. 0-100. */
export function calculateTrendSignal(params: {
  recencyScore: number; // 0-1
  crossSourceScore: number; // 0-1
  sourceAuthorityScore: number; // 0-1
}): number {
  const raw =
    0.4 * params.recencyScore +
    0.35 * params.crossSourceScore +
    0.25 * params.sourceAuthorityScore;
  return round(clamp(raw * 100, 0, 100));
}

export function difficultyFromClosetMatch(
  closetMatch: number
): "already-in-closet" | "one-piece-away" | "requires-additions" {
  if (closetMatch >= 95) return "already-in-closet";
  if (closetMatch >= 65) return "one-piece-away";
  return "requires-additions";
}
