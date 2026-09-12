"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Check, Sparkles } from "lucide-react";
import { STYLE_TAGS, type PreferredFit, type SizeProfile, type StyleTag, type UserStyleProfile } from "@/types";
import { storage } from "@/lib/storage";
import { DEMO_CLOSET, DEMO_SIZE_PROFILE, DEMO_STYLE_PROFILE } from "@/lib/demo";
import { Button } from "@/components/editorial/Button";
import { SectionHeading } from "@/components/editorial/SectionHeading";
import { CameraStage, type CameraStageHandle } from "@/components/video/CameraStage";
import { LoadingSequence } from "@/components/editorial/LoadingSequence";

const FIT_OPTIONS: PreferredFit[] = ["fitted", "regular", "relaxed", "oversized"];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemoLink = searchParams.get("demo") === "1";

  const [selectedTags, setSelectedTags] = useState<Set<StyleTag>>(new Set());
  const [preferredFit, setPreferredFit] = useState<PreferredFit>("regular");
  const [showCamera, setShowCamera] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoverySummary, setDiscoverySummary] = useState<string | null>(null);
  const [showSizing, setShowSizing] = useState(false);
  const [size, setSize] = useState<Partial<SizeProfile>>({ sizingSystem: "US" });
  const cameraRef = useRef<CameraStageHandle>(null);

  function toggleTag(tag: StyleTag) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  async function handleDiscoverStyle() {
    const frame = cameraRef.current?.capture();
    if (!frame) return;
    setDiscovering(true);
    try {
      const res = await fetch("/api/gemini/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: frame.base64, mimeType: frame.mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const detected: StyleTag[] = data.result.detectedStyleTags;
      setSelectedTags((prev) => new Set([...prev, ...detected]));
      setDiscoverySummary(data.result.summary);
    } catch {
      setDiscoverySummary(
        "We couldn't reach Gemini just now — pick your styles manually below, that works just as well."
      );
    } finally {
      setDiscovering(false);
      setShowCamera(false);
    }
  }

  function finishOnboarding() {
    const weights: Partial<Record<StyleTag, number>> = {};
    const tags = Array.from(selectedTags);
    tags.forEach((tag, i) => {
      weights[tag] = Number((1 - i * 0.08).toFixed(2));
    });

    const profile: UserStyleProfile = {
      styleWeights: weights,
      favoriteColors: [],
      avoidedColors: [],
      preferredFit,
      discoveredAt: new Date().toISOString(),
    };

    storage.setStyleProfile(profile);
    if (Object.keys(size).length > 1) {
      storage.setSizeProfile({
        sizingSystem: size.sizingSystem ?? "US",
        tops: size.tops,
        bottoms: size.bottoms,
        waist: size.waist,
        inseam: size.inseam,
        jeans: size.jeans,
        dress: size.dress,
        jacket: size.jacket,
        shoes: size.shoes,
        preferredFit,
      });
    }
    storage.setOnboardingComplete(true);
    router.push("/dashboard");
  }

  function startDemoMode() {
    storage.setDemoMode(true);
    storage.setStyleProfile(DEMO_STYLE_PROFILE);
    storage.setSizeProfile(DEMO_SIZE_PROFILE);
    storage.setCloset(DEMO_CLOSET);
    storage.setOnboardingComplete(true);
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-14 sm:px-8">
      {isDemoLink && (
        <div className="mb-10 flex flex-col gap-3 rounded-xl border border-rescue/30 bg-rescue/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Skip straight to a fully populated demo.</p>
            <p className="text-xs text-ink-soft">No camera or API keys needed — loads a sample closet and style profile.</p>
          </div>
          <Button onClick={startDemoMode} variant="secondary">
            Try Demo Mode
          </Button>
        </div>
      )}

      <SectionHeading eyebrow="Step 1 of 3" title="What feels like you?" description="Pick as many as apply — you can change these later." />

      <div className="mt-6 flex flex-wrap gap-2">
        {STYLE_TAGS.map(({ id, label }) => {
          const active = selectedTags.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleTag(id)}
              className={
                active
                  ? "rounded-full border border-ink bg-ink px-4 py-2 text-sm text-paper"
                  : "rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink"
              }
            >
              {active && <Check size={12} className="mr-1 inline" />}
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {!showCamera ? (
          <Button variant="ghost" size="md" className="px-0" onClick={() => setShowCamera(true)}>
            <Camera size={16} /> Discover My Style with the camera
          </Button>
        ) : discovering ? (
          <LoadingSequence headline="Reading your outfit…" steps={["Reading the palette", "Mapping silhouettes", "Noting layering"]} />
        ) : (
          <div className="mt-2">
            <CameraStage ref={cameraRef} hint="Show your outfit — clothing only, no need to include your face." />
            <Button className="mt-3" onClick={handleDiscoverStyle}>
              <Sparkles size={16} /> Analyze This Outfit
            </Button>
          </div>
        )}
        {discoverySummary && <p className="mt-3 text-sm italic text-ink-soft">{discoverySummary}</p>}
      </div>

      <SectionHeading className="mt-14" eyebrow="Step 2 of 3" title="Preferred fit" />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FIT_OPTIONS.map((fit) => (
          <button
            key={fit}
            type="button"
            onClick={() => setPreferredFit(fit)}
            className={
              preferredFit === fit
                ? "rounded-lg border border-ink bg-ink px-4 py-3 text-sm capitalize text-paper"
                : "rounded-lg border border-line px-4 py-3 text-sm capitalize text-ink-soft hover:border-ink hover:text-ink"
            }
          >
            {fit}
          </button>
        ))}
      </div>

      <SectionHeading className="mt-14" eyebrow="Step 3 of 3 · Optional" title="Size profile" description="Sizing varies by brand. The Jerry uses this only to estimate compatibility." />
      {!showSizing ? (
        <Button variant="ghost" size="md" className="mt-4 px-0" onClick={() => setShowSizing(true)}>
          Add my sizes
        </Button>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {(["tops", "bottoms", "waist", "inseam", "jeans", "shoes"] as const).map((field) => (
            <label key={field} className="text-sm">
              <span className="mb-1 block capitalize text-ink-soft">{field}</span>
              <input
                value={size[field] ?? ""}
                onChange={(e) => setSize((s) => ({ ...s, [field]: e.target.value }))}
                className="w-full rounded-md border border-line bg-card px-3 py-2 outline-none focus:border-ink"
              />
            </label>
          ))}
        </div>
      )}

      <div className="mt-14 flex justify-end">
        <Button size="lg" onClick={finishOnboarding} disabled={selectedTags.size === 0}>
          Enter The Jerry
        </Button>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingContent />
    </Suspense>
  );
}
