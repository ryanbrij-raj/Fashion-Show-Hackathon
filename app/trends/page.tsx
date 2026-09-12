"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadTrends, personalizeTrends } from "@/lib/trends";
import { storage } from "@/lib/storage";
import type { Garment, Trend, UserStyleProfile } from "@/types";
import { TrendCard } from "@/components/trends/TrendCard";
import { SectionHeading } from "@/components/editorial/SectionHeading";
import { formatDate } from "@/lib/utils";

export default function TrendsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserStyleProfile | null>(null);
  const [closet, setCloset] = useState<Garment[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (!storage.isOnboardingComplete()) {
      router.replace("/onboarding");
      return;
    }
    setProfile(storage.getStyleProfile());
    setCloset(storage.getCloset());
    setIsDemo(storage.isDemoMode());
    setReady(true);
  }, [router]);

  const personalized = useMemo(() => {
    if (!profile) return [];
    return personalizeTrends({
      styleWeights: profile.styleWeights,
      closet,
      preferredFit: profile.preferredFit,
    });
  }, [profile, closet]);

  const trends = loadTrends();
  const updatedAt = trends[0]?.updatedAt;

  async function explain(trend: Trend): Promise<string> {
    const p = personalized.find((x) => x.trendId === trend.id);
    if (!p) throw new Error("not found");

    if (isDemo || !profile) {
      return `Your ${p.compatibilityScore}% match comes from how closely "${trend.name}" lines up with your style profile (${p.styleCompatibilityScore}% style match) and how much of it you already own (${p.closetCompatibilityScore}% closet readiness).`;
    }

    const res = await fetch("/api/gemini/trends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trendId: trend.id,
        scoreBreakdown: {
          overall: p.compatibilityScore,
          styleMatch: p.styleCompatibilityScore,
          closetMatch: p.closetCompatibilityScore,
          fitMatch: p.fitCompatibilityScore,
          trendStrength: trend.trendScore,
        },
        closet,
        styleProfile: profile,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.reason;
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <SectionHeading
        eyebrow={updatedAt ? `Trend Radar updated ${formatDate(updatedAt)}` : "Trend Radar"}
        title="About 50 signals shaping fashion right now"
        description="Ranked for you first — by your style, your closet, and your fit preference — then by raw Trend Signal."
      />

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {personalized.map((p) => (
          <TrendCard key={p.trendId} personalized={p} onExplain={explain} />
        ))}
      </div>
    </main>
  );
}
