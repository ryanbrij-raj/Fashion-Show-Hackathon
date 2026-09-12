"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Sparkles } from "lucide-react";
import type { Garment, Outfit, RescueStage, FinalLookCard as FinalLookCardData } from "@/types";
import type { GarmentAnalysis } from "@/schemas";
import { storage } from "@/lib/storage";
import { DEMO_RESCUE_ITEM, DEMO_CLOSET, DEMO_RESCUE_OUTFITS } from "@/lib/demo";
import { newId } from "@/lib/utils";
import { CameraStage, type CameraStageHandle } from "@/components/video/CameraStage";
import { Button } from "@/components/editorial/Button";
import { SectionHeading } from "@/components/editorial/SectionHeading";
import { LoadingSequence } from "@/components/editorial/LoadingSequence";
import { ErrorState } from "@/components/editorial/ErrorState";
import { ClosetGrid } from "@/components/closet/ClosetGrid";
import { OutfitCard } from "@/components/outfits/OutfitCard";
import { StylistOverlay } from "@/components/stylist/StylistOverlay";
import { FinalLookCard } from "@/components/stylist/FinalLookCard";
import { loadTrends } from "@/lib/trends";

function analysisToGarment(analysis: GarmentAnalysis, image: string, isRescueItem: boolean, rescueReason?: string): Garment {
  return {
    id: newId("g"),
    image,
    name: analysis.name,
    category: analysis.category,
    subcategory: analysis.subcategory,
    primaryColor: analysis.primaryColor,
    secondaryColors: analysis.secondaryColors,
    material: analysis.material,
    pattern: analysis.pattern,
    fit: analysis.fit,
    silhouette: analysis.silhouette,
    formality: analysis.formality,
    styleTags: analysis.styleTags,
    seasonality: analysis.seasonality,
    observations: analysis.observations,
    confidence: analysis.confidence,
    addedAt: new Date().toISOString(),
    isRescueItem,
    rescueReason,
  };
}

export default function RescuePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [stage, setStage] = useState<RescueStage>("WELCOME");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [rescueItem, setRescueItem] = useState<Garment | null>(null);
  const [rescueReason, setRescueReason] = useState("");
  const [sessionCloset, setSessionCloset] = useState<Garment[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);
  const [finalCard, setFinalCard] = useState<FinalLookCardData | null>(null);

  const cameraRef = useRef<CameraStageHandle>(null);
  const trends = loadTrends();

  useEffect(() => {
    if (!storage.isOnboardingComplete()) {
      router.replace("/onboarding");
      return;
    }
    setIsDemo(storage.isDemoMode());
    setSessionCloset(storage.getCloset());
    setReady(true);
  }, [router]);

  async function handleRescueCapture() {
    setError(null);
    const frame = cameraRef.current?.capture();
    setLoading(true);
    setStage("ITEM_ANALYSIS");

    if (isDemo || !frame) {
      await new Promise((r) => setTimeout(r, 1200));
      setRescueItem({ ...DEMO_RESCUE_ITEM, image: frame?.dataUrl ?? "" });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/gemini/garment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: frame.base64, mimeType: frame.mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setRescueItem(analysisToGarment(data.analysis, frame.dataUrl, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gemini is unavailable right now.");
      setStage("RESCUE_ITEM");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddClosetItem() {
    setError(null);
    const frame = cameraRef.current?.capture();
    if (!frame && !isDemo) return;
    setLoading(true);

    if (isDemo) {
      const next = DEMO_CLOSET.filter((g) => !sessionCloset.some((s) => s.id === g.id));
      if (next.length > 0) setSessionCloset((prev) => [...prev, next[0]]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/gemini/garment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: frame!.base64, mimeType: frame!.mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      const garment = analysisToGarment(data.analysis, frame!.dataUrl, false);
      setSessionCloset((prev) => [...prev, garment]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gemini is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBuildLooks() {
    if (!rescueItem) return;
    setError(null);
    setStage("OUTFIT_GENERATION");
    setLoading(true);

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 1600));
      setOutfits(DEMO_RESCUE_OUTFITS);
      setLoading(false);
      setStage("OUTFIT_SELECTION");
      return;
    }

    try {
      const profile = storage.getStyleProfile();
      const res = await fetch("/api/gemini/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "rescue",
          rescueItem,
          rescueReason: rescueReason || undefined,
          closet: sessionCloset,
          styleProfile: profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Outfit generation failed.");
      setOutfits(data.outfits);
      setStage("OUTFIT_SELECTION");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gemini is unavailable right now.");
      setOutfits(DEMO_RESCUE_OUTFITS);
      setStage("OUTFIT_SELECTION");
    } finally {
      setLoading(false);
    }
  }

  function selectOutfit(outfit: Outfit) {
    setSelectedOutfit(outfit);
    setStage("AI_STYLIST");
  }

  function handleStylistComplete() {
    if (!selectedOutfit || !rescueItem) return;
    const fullCloset = [rescueItem, ...sessionCloset];
    const usedGarments = selectedOutfit.garmentIds
      .map((id) => fullCloset.find((g) => g.id === id))
      .filter((g): g is Garment => Boolean(g));

    storage.setCloset(sessionCloset.some((g) => g.id === rescueItem.id) ? sessionCloset : [...sessionCloset, rescueItem]);

    const card: FinalLookCardData = {
      id: newId("card"),
      kind: "rescue",
      headline: selectedOutfit.name,
      outfitName: selectedOutfit.name,
      styleDna: Array.from(new Set(usedGarments.flatMap((g) => g.styleTags))).slice(0, 3),
      garmentNames: usedGarments.map((g) => g.name),
      closetUsedCount: usedGarments.filter((g) => !g.isRescueItem).length + 1,
      closetTotalCount: usedGarments.length,
      trendMatchName: trends.find((t) => selectedOutfit.trendIds.includes(t.id))?.name,
      rescueItemName: rescueItem.name,
      tagline: "Rescued, not replaced.",
      createdAt: new Date().toISOString(),
    };
    setFinalCard(card);
    setStage("RESCUE_CARD");
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      {stage === "WELCOME" && (
        <div className="animate-fade-up text-center">
          <SectionHeading
            align="center"
            eyebrow="Rescue My Closet"
            title="Show me the piece you never know how to wear."
            description="We'll figure out what already works with it — from clothes you own."
          />
          <Button size="lg" className="mt-8" onClick={() => setStage("CAMERA")}>
            Start a Rescue
          </Button>
        </div>
      )}

      {stage === "CAMERA" && (
        <div className="animate-fade-up">
          <SectionHeading eyebrow="Rescue My Closet" title="Hold up the forgotten piece" />
          <div className="mt-6">
            <CameraStage ref={cameraRef} hint="Center the garment in frame, good lighting helps." />
            <Button className="mt-4" size="lg" onClick={handleRescueCapture}>
              <Camera size={16} /> Rescue This Item
            </Button>
          </div>
          {error && <div className="mt-4"><ErrorState message={error} onRetry={() => setError(null)} /></div>}
        </div>
      )}

      {stage === "ITEM_ANALYSIS" && (
        <div className="animate-fade-up">
          {loading || !rescueItem ? (
            <LoadingSequence headline="Reading the piece…" steps={["Identifying color", "Understanding texture", "Mapping silhouette"]} />
          ) : (
            <div>
              <SectionHeading eyebrow={`${Math.round(rescueItem.confidence * 100)}% confidence`} title={rescueItem.name} />
              <p className="mt-3 text-ink-soft">{rescueItem.observations}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-faint">
                <span>{rescueItem.category}</span>·<span>{rescueItem.primaryColor}</span>·<span>{rescueItem.material}</span>·
                <span>{rescueItem.fit} fit</span>
              </div>

              <div className="mt-10">
                <label className="block text-sm font-medium text-ink">Why don&apos;t you wear it? (optional)</label>
                <input
                  value={rescueReason}
                  onChange={(e) => setRescueReason(e.target.value)}
                  placeholder="e.g. It feels too old-fashioned."
                  className="mt-2 w-full rounded-md border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-ink"
                />
              </div>

              <Button size="lg" className="mt-8" onClick={() => setStage("CLOSET_CAPTURE")}>
                Let&apos;s find what already works with it
              </Button>
            </div>
          )}
        </div>
      )}

      {stage === "CLOSET_CAPTURE" && (
        <div className="animate-fade-up">
          <SectionHeading eyebrow="Rescue My Closet" title="Show a few more things you own" description="Capture a few pieces — the more you add, the better the outfits." />
          <div className="mt-6">
            <CameraStage ref={cameraRef} hint="One garment at a time." />
            <Button className="mt-4" onClick={handleAddClosetItem} disabled={loading}>
              {loading ? "Reading…" : "Add to Closet"}
            </Button>
          </div>
          {error && <div className="mt-4"><ErrorState message={error} onRetry={() => setError(null)} /></div>}

          <div className="mt-8">
            <ClosetGrid
              garments={sessionCloset}
              compact
              onDelete={(id) => setSessionCloset((prev) => prev.filter((g) => g.id !== id))}
              onRename={(id, name) => setSessionCloset((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)))}
            />
          </div>

          <Button size="lg" className="mt-8" onClick={handleBuildLooks}>
            <Sparkles size={16} /> Build My Looks
          </Button>
        </div>
      )}

      {stage === "OUTFIT_GENERATION" && (
        <LoadingSequence headline="Searching your closet…" steps={["Finding combinations you'd actually wear", "Balancing color and texture", "Ranking by confidence"]} />
      )}

      {stage === "OUTFIT_SELECTION" && rescueItem && (
        <div className="animate-fade-up">
          <SectionHeading eyebrow="3 looks built for you" title="Pick one to wear" />
          <div className="mt-6 flex flex-col gap-8">
            {outfits.map((outfit) => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                garments={[rescueItem, ...sessionCloset]}
                trends={trends}
                onWear={() => selectOutfit(outfit)}
              />
            ))}
          </div>
        </div>
      )}

      {stage === "AI_STYLIST" && selectedOutfit && rescueItem && (
        <StylistOverlay
          outfitName={selectedOutfit.name}
          garments={selectedOutfit.garmentIds
            .map((id) => [rescueItem, ...sessionCloset].find((g) => g.id === id))
            .filter((g): g is Garment => Boolean(g))}
          isDemoMode={isDemo}
          onClose={() => setStage("OUTFIT_SELECTION")}
          onComplete={handleStylistComplete}
        />
      )}

      {stage === "RESCUE_CARD" && finalCard && (
        <div className="animate-fade-up flex flex-col items-center gap-8">
          <SectionHeading align="center" eyebrow="Rescue complete" title="Your look is ready" />
          <FinalLookCard card={finalCard} />

          <div className="w-full max-w-md rounded-xl border border-line bg-card p-5 text-sm text-ink-soft">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Rescue impact (estimate)</p>
            <ul className="mt-2 space-y-1">
              <li>1 forgotten garment returned to rotation</li>
              <li>Estimated replacement purchase avoided: $45–$120</li>
              <li>Potential additional wears: 20+</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button href="/dashboard" variant="secondary">Back to Dashboard</Button>
            <Button
              onClick={() => {
                setStage("WELCOME");
                setRescueItem(null);
                setOutfits([]);
                setSelectedOutfit(null);
                setFinalCard(null);
                setRescueReason("");
              }}
            >
              Rescue Another Item
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
