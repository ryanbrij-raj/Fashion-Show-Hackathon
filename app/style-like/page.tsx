"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Garment, PersonaOutfit, StylePersona, FinalLookCard as FinalLookCardData } from "@/types";
import { storage } from "@/lib/storage";
import { newId } from "@/lib/utils";
import { personalizeTrends } from "@/lib/trends";
import { DEMO_PERSONA, DEMO_PERSONA_OUTFITS } from "@/lib/demo";
import { buildFallbackPersonaOutfits } from "@/lib/persona/fallback";
import { Button } from "@/components/editorial/Button";
import { SectionHeading } from "@/components/editorial/SectionHeading";
import { Badge } from "@/components/editorial/Badge";
import { LoadingSequence } from "@/components/editorial/LoadingSequence";
import { ErrorState } from "@/components/editorial/ErrorState";
import { PersonaSearch } from "@/components/persona/PersonaSearch";
import { IntensitySlider } from "@/components/persona/IntensitySlider";
import { PersonaOutfitCard } from "@/components/persona/PersonaOutfitCard";
import { StylistOverlay } from "@/components/stylist/StylistOverlay";
import { FinalLookCard } from "@/components/stylist/FinalLookCard";

type Stage = "SEARCH" | "DECODING" | "ANALYSIS" | "GENERATING" | "MATCH" | "STYLIST" | "CARD";

export default function StyleLikePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [closet, setCloset] = useState<Garment[]>([]);
  const [stage, setStage] = useState<Stage>("SEARCH");
  const [query, setQuery] = useState("");
  const [persona, setPersona] = useState<StylePersona | null>(null);
  const [intensity, setIntensity] = useState(0.6);
  const [occasion, setOccasion] = useState("");
  const [outfits, setOutfits] = useState<PersonaOutfit[]>([]);
  const [selectedOutfit, setSelectedOutfit] = useState<PersonaOutfit | null>(null);
  const [finalCard, setFinalCard] = useState<FinalLookCardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storage.isOnboardingComplete()) {
      router.replace("/onboarding");
      return;
    }
    setIsDemo(storage.isDemoMode());
    setCloset(storage.getCloset());
    setReady(true);
  }, [router]);

  async function handleSearch(q: string) {
    setQuery(q);
    setStage("DECODING");
    setError(null);

    if (isDemo && q.toLowerCase() === DEMO_PERSONA.name.toLowerCase()) {
      await new Promise((r) => setTimeout(r, 1300));
      setPersona(DEMO_PERSONA);
      setStage("ANALYSIS");
      return;
    }

    try {
      const res = await fetch("/api/gemini/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "analyze", query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't decode that style.");
      setPersona(data.persona);
      setStage("ANALYSIS");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("SEARCH");
    }
  }

  async function handleBuildOutfits() {
    if (!persona) return;

    setStage("GENERATING");
    setError(null);

    const profile = storage.getStyleProfile();

    if (isDemo && persona.id === DEMO_PERSONA.id) {
      await new Promise((r) => setTimeout(r, 1600));
      setOutfits(DEMO_PERSONA_OUTFITS);
      setStage("MATCH");
      return;
    }

    if (!profile) {
      setOutfits(buildFallbackPersonaOutfits(persona, closet));
      setStage("MATCH");
      return;
    }

    try {
      const personalized = personalizeTrends({
        styleWeights: profile.styleWeights,
        closet,
        preferredFit: profile.preferredFit,
      });
      const res = await fetch("/api/gemini/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "outfits",
          persona,
          intensity,
          occasion: occasion || undefined,
          closet,
          styleProfile: profile,
          trendIds: personalized.slice(0, 5).map((p) => p.trendId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't build outfits for this style.");
      setOutfits(data.outfits);
      setStage("MATCH");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gemini is unavailable — showing a closet-based estimate instead.");
      setOutfits(buildFallbackPersonaOutfits(persona, closet));
      setStage("MATCH");
    }
  }

  function handleStylistComplete() {
    if (!selectedOutfit || !persona) return;
    const usedGarments = selectedOutfit.garmentIds
      .map((id) => closet.find((g) => g.id === id))
      .filter((g): g is Garment => Boolean(g));

    const card: FinalLookCardData = {
      id: newId("card"),
      kind: "persona",
      headline: "Style Translation",
      outfitName: selectedOutfit.name,
      styleDna: Array.from(new Set(usedGarments.flatMap((g) => g.styleTags))).slice(0, 3),
      garmentNames: usedGarments.map((g) => g.name),
      closetUsedCount: usedGarments.length,
      closetTotalCount: usedGarments.length,
      personaName: persona.name,
      styleSimilarity: selectedOutfit.overallSimilarity,
      tagline: "Inspired, not copied.",
      createdAt: new Date().toISOString(),
    };
    setFinalCard(card);
    setStage("CARD");
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      {stage === "SEARCH" && (
        <div className="animate-fade-up">
          <SectionHeading
            eyebrow="Style Like Someone"
            title="Who do you want to dress like?"
            description="Real public figures, historical icons, or fictional characters — we decode the style, not the costume."
          />
          <div className="mt-6">
            <PersonaSearch onSubmit={handleSearch} />
          </div>
          {error && <div className="mt-4"><ErrorState message={error} onRetry={() => setError(null)} /></div>}
        </div>
      )}

      {stage === "DECODING" && (
        <LoadingSequence
          headline={`Decoding ${query || "their"} style…`}
          steps={["Finding recurring silhouettes", "Mapping color language", "Studying layering", "Identifying signature pieces"]}
        />
      )}

      {stage === "ANALYSIS" && persona && (
        <div className="animate-fade-up">
          <SectionHeading eyebrow={persona.type === "real_person" ? "Real person" : persona.sourceWork ?? "Fictional character"} title={persona.name} description={persona.description} />

          <div className="mt-6 flex flex-wrap gap-1.5">
            {persona.styleTags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoBlock label="Signature pieces" items={persona.signaturePieces} />
            <InfoBlock label="Colors" items={persona.colors} />
            <InfoBlock label="Silhouettes" items={persona.silhouettes} />
            <InfoBlock label="Recurring principles" items={persona.recurringStylePrinciples} />
          </div>

          <div className="mt-10">
            <IntensitySlider value={intensity} onChange={setIntensity} />
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-ink">For an occasion? (optional)</label>
            <input
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              placeholder="e.g. First date"
              className="mt-2 w-full rounded-md border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-ink"
            />
          </div>

          <Button size="lg" className="mt-8" onClick={handleBuildOutfits}>
            Build My Version
          </Button>
        </div>
      )}

      {stage === "GENERATING" && (
        <LoadingSequence headline="Translating their style into your closet…" steps={["Matching silhouettes to what you own", "Checking current trend overlap", "Balancing intensity"]} />
      )}

      {stage === "MATCH" && persona && (
        <div className="animate-fade-up">
          <SectionHeading eyebrow={persona.name} title="Your version" description="Three lanes — from your closet to a fuller expression." />
          {error && <div className="mt-4"><ErrorState message={error} /></div>}
          <div className="mt-6 flex flex-col gap-10">
            {outfits.map((outfit) => (
              <PersonaOutfitCard
                key={outfit.id}
                outfit={outfit}
                garments={closet}
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
          onClose={() => setStage("MATCH")}
          onComplete={() => handleStylistComplete()}
        />
      )}

      {stage === "CARD" && finalCard && (
        <div className="animate-fade-up flex flex-col items-center gap-8">
          <SectionHeading align="center" eyebrow="Translation complete" title="Your look is ready" />
          <FinalLookCard card={finalCard} />
          <div className="flex gap-3">
            <Button href="/dashboard" variant="secondary">Back to Dashboard</Button>
            <Button onClick={() => setStage("SEARCH")}>Style Like Someone Else</Button>
          </div>
        </div>
      )}
    </main>
  );
}

function InfoBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 text-sm text-ink-soft">{items.join(", ")}</p>
    </div>
  );
}
