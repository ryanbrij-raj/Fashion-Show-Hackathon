import type { Garment, PersonalizedTrend, PreferredFit, StyleTag, Trend, UserStyleProfile } from "@/types";
import {
  calculatePersonalTrendMatch,
  difficultyFromClosetMatch,
} from "@/lib/scoring";
import trendsData from "@/data/trends.json";

export function loadTrends(): Trend[] {
  return trendsData as Trend[];
}

export function getTrendById(id: string): Trend | undefined {
  return loadTrends().find((t) => t.id === id);
}

export interface PersonalizedTrendWithTrend extends PersonalizedTrend {
  trend: Trend;
}

/** Ranks every cached trend against this user's style/closet/fit. Pure + deterministic. */
export function personalizeTrends(params: {
  styleWeights: Partial<Record<StyleTag, number>>;
  closet: Garment[];
  preferredFit: PreferredFit;
}): PersonalizedTrendWithTrend[] {
  const trends = loadTrends();

  return trends
    .map((trend) => {
      const breakdown = calculatePersonalTrendMatch({
        styleWeights: params.styleWeights,
        closet: params.closet,
        preferredFit: params.preferredFit,
        trend,
      });

      const ownedGarmentIds = params.closet
        .filter((g) => trend.applicableCategories.includes(g.category))
        .map((g) => g.id);

      const missingPieces = trend.applicableCategories.filter(
        (cat) => !params.closet.some((g) => g.category === cat)
      );

      const personalized: PersonalizedTrendWithTrend = {
        trendId: trend.id,
        compatibilityScore: breakdown.overall,
        closetCompatibilityScore: breakdown.closetMatch,
        styleCompatibilityScore: breakdown.styleMatch,
        fitCompatibilityScore: breakdown.fitMatch,
        reason: "",
        ownedGarmentIds,
        missingPieces,
        difficulty: difficultyFromClosetMatch(breakdown.closetMatch),
        trend,
      };
      return personalized;
    })
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
}

export function topPersonalizedTrends(
  params: Parameters<typeof personalizeTrends>[0],
  count = 5
): PersonalizedTrendWithTrend[] {
  return personalizeTrends(params).slice(0, count);
}

export function defaultStyleProfile(): UserStyleProfile {
  return {
    styleWeights: {},
    favoriteColors: [],
    avoidedColors: [],
    preferredFit: "regular",
  };
}
