"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Garment, Outfit, FinalLookCard as FinalLookCardData } from "@/types";
import { storage } from "@/lib/storage";
import { newId } from "@/lib/utils";
import { loadTrends, personalizeTrends } from "@/lib/trends";
import { DEMO_STYLE_NOW_OUTFITS } from "@/lib/demo";
import { Button } from "@/components/editorial/Button";
import { SectionHeading } from "@/components/editorial/SectionHeading";
import { LoadingSequence } from "@/components/editorial/LoadingSequence";
import { ErrorState } from "@/components/editorial/ErrorState";
import { OutfitCard } from "@/components/outfits/OutfitCard";
import { StylistOverlay } from "@/components/stylist/StylistOverlay";
import { FinalLookCard } from "@/components/stylist/FinalLookCard";

const OCCASIONS = ["Everyday", "Work", "Date", "Dinner", "Party", "Fashion event", "School / campus", "Weekend"];

type Stage = "PICK_OCCASION" | "GENERATING" | "SELECTING" | "STYLIST" | "CARD";

function StyleNowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trendParam = searchParams.get("trend");

  const [ready, setReady] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [closet, setCloset] = useState<Garment[]>([]);
  const [stage, setStage] = useState<Stage>("PICK_OCCASION");
  const [occasion, setOccasion] = useState("");
  const [customOccasion, setCustomOccasion] = useState("");
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);
  const [finalCard, setFinalCard] = useState<FinalLookCardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trends = loadTrends();
  const seedTrend = trendParam ? trends.find((t) => t.id === trendParam) : undefined;

  useEffect(() => {
    if (!storage.isOnboardingComplete()) {
      router.replace("/onboarding");
      return;
    }
    setIsDemo(storage.isDemoMode());
    setCloset(storage.getCloset());
    setReady(true);
  }, [router]);

  async function handleGenerate(chosenOccasion: string) {
    setOccasion(chosenOccasion);
    setStage("GENERATING");
    setError(null);

    const profile = storage.getStyleProfile();
    const sizeProfile = storage.getSizeProfile();

    if (isDemo || !profile) {
      await new Promise((r) => setTimeout(r, 1500));
      setOutfits(DEMO_STYLE_NOW_OUTFITS);
      setStage("SELECTING");
      return;
    }

    try {
      const personalized = personalizeTrends({
        styleWeights: profile.styleWeights,
        closet,
        preferredFit: profile.preferredFit,
      });
      const trendIds = seedTrend
        ? [seedTrend.id, ...personalized.slice(0, 4).map((p) => p.trendId)]
        : personalized.slice(0, 5).map((p) => p.trendId);

      const res = await fetch("/api/gemini/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "style-now",
          occasion: chosenOccasion,
          closet,
          styleProfile: profile,
          sizeProfile,
          trendIds: Array.from(new Set(trendIds)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Outfit generation failed.");
      setOutfits(data.outfits);
      setStage("SELECTING");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gemini is unavailable right now.");
      setOutfits(DEMO_STYLE_NOW_OUTFITS);
      setStage("SELECTING");
    }
  }

  function handleStylistComplete() {
    if (!selectedOutfit) return;
    const usedGarments = selectedOutfit.garmentIds
      .map((id) => closet.find((g) => g.id === id))
      .filter((g): g is Garment => Boolean(g));

    const card: FinalLookCardData = {
      id: newId("card"),
      kind: "style-now",
      headline: selectedOutfit.name,
      outfitName: selectedOutfit.name,
      styleDna: Array.from(new Set(usedGarments.flatMap((g) => g.styleTags))).slice(0, 3),
      garmentNames: usedGarments.map((g) => g.name),
      closetUsedCount: usedGarments.length,
      closetTotalCount: usedGarments.length,
      trendMatchName: trends.find((t) => selectedOutfit.trendIds.includes(t.id))?.name,
      tagline: `Styled for: ${occasion}`,
      createdAt: new Date().toISOString(),
    };
    setFinalCard(card);
    setStage("CARD");
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      {stage === "PICK_OCCASION" && (
        <div className="animate-fade-up">
          <SectionHeading
            eyebrow="Style Me Now"
            title="Where are you going?"
            description={seedTrend ? `We'll build this around "${seedTrend.name}."` : undefined}
          />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                onClick={() => handleGenerate(o)}
                className="rounded-lg border border-line bg-card px-4 py-4 text-sm font-medium text-ink transition-colors hover:border-ink"
              >
                {o}
              </button>
            ))}
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (customOccasion.trim()) handleGenerate(customOccasion.trim());
            }}
          >
            <input
              value={customOccasion}
              onChange={(e) => setCustomOccasion(e.target.value)}
              placeholder="Or describe it — 'rooftop birthday party'"
              className="flex-1 rounded-md border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-ink"
            />
            <Button type="submit" variant="secondary">
              Go
            </Button>
          </form>
        </div>
      )}

      {stage === "GENERATING" && (
        <LoadingSequence headline="Searching your closet…" steps={["Weighing your style", "Checking today's trends", "Finding combinations you'd actually wear"]} />
      )}

      {stage === "SELECTING" && (
        <div className="animate-fade-up">
          <SectionHeading eyebrow={occasion} title="Three ways to wear it" description="Safe, Current, and Push Me — pick your comfort level." />
          {error && <div className="mt-4"><ErrorState message={error} /></div>}
          <div className="mt-6 flex flex-col gap-8">
            {outfits.map((outfit) => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                garments={closet}
                trends={trends}
                onWear={() => {
                  setSelectedOutfit(outfit);
                  setStage("STYLIST");
                }}
              />
            ))}
          </div>
        </div>
      )}

      {stage === "STYLIST" && selectedOutfit && (
        <StylistOverlay
          outfitName={selectedOutfit.name}
          garments={selectedOutfit.garmentIds.map((id) => closet.find((g) => g.id === id)).filter((g): g is Garment => Boolean(g))}
          isDemoMode={isDemo}
          onClose={() => setStage("SELECTING")}
          onComplete={() => handleStylistComplete()}
        />
      )}

      {stage === "CARD" && finalCard && (
        <div className="animate-fade-up flex flex-col items-center gap-8">
          <SectionHeading align="center" eyebrow="Look complete" title="You're ready" />
          <FinalLookCard card={finalCard} />
          <div className="flex gap-3">
            <Button href="/dashboard" variant="secondary">Back to Dashboard</Button>
            <Button onClick={() => setStage("PICK_OCCASION")}>Style Another Occasion</Button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function StyleNowPage() {
  return (
    <Suspense fallback={null}>
      <StyleNowContent />
    </Suspense>
  );
}
