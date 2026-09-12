"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronRight, Sparkles } from "lucide-react";
import type { Garment } from "@/types";
import type { FinalCritiqueResult } from "@/schemas";
import { CameraStage, type CameraStageHandle } from "@/components/video/CameraStage";
import { Button } from "@/components/editorial/Button";
import { LoadingSequence } from "@/components/editorial/LoadingSequence";
import { DEMO_STYLIST_STEPS, DEMO_FINAL_CRITIQUE } from "@/lib/demo";

type Phase = "loading-steps" | "dressing" | "checking" | "done" | "error";

export function StylistOverlay({
  outfitName,
  garments,
  isDemoMode,
  onClose,
  onComplete,
}: {
  outfitName: string;
  garments: Garment[];
  isDemoMode: boolean;
  onClose: () => void;
  onComplete: (critique: FinalCritiqueResult, capturedImage: string | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading-steps");
  const [steps, setSteps] = useState<string[]>([]);
  const [closingPrompt, setClosingPrompt] = useState("Great — step back so I can see the full outfit.");
  const [stepIndex, setStepIndex] = useState(0);
  const [critique, setCritique] = useState<FinalCritiqueResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraStageHandle>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSteps() {
      if (isDemoMode) {
        setSteps(DEMO_STYLIST_STEPS.slice(0, -1));
        setClosingPrompt(DEMO_STYLIST_STEPS[DEMO_STYLIST_STEPS.length - 1]);
        setPhase("dressing");
        return;
      }
      try {
        const res = await fetch("/api/gemini/stylist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outfitName, garments }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Could not load styling steps.");
        setSteps(data.instructions.steps);
        setClosingPrompt(data.instructions.closingPrompt);
        setPhase("dressing");
      } catch {
        if (cancelled) return;
        setSteps(DEMO_STYLIST_STEPS.slice(0, -1));
        setClosingPrompt(DEMO_STYLIST_STEPS[DEMO_STYLIST_STEPS.length - 1]);
        setPhase("dressing");
      }
    }
    loadSteps();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheckLook() {
    const frame = cameraRef.current?.capture();
    setPhase("checking");
    setCapturedImage(frame?.dataUrl ?? null);

    if (isDemoMode || !frame) {
      await new Promise((r) => setTimeout(r, 1400));
      setCritique(DEMO_FINAL_CRITIQUE);
      setPhase("done");
      return;
    }

    try {
      const res = await fetch("/api/gemini/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outfitName,
          garments,
          imageBase64: frame.base64,
          mimeType: frame.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Critique failed.");
      setCritique(data.critique);
      setPhase("done");
    } catch (err) {
      setCritique(DEMO_FINAL_CRITIQUE);
      setError(err instanceof Error ? err.message : null);
      setPhase("done");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink text-paper">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <p className="text-sm font-medium uppercase tracking-[0.15em]">AI Stylist Mode</p>
        </div>
        <button aria-label="Close AI Stylist Mode" onClick={onClose} className="rounded-full p-2 hover:bg-paper/10">
          <X size={20} />
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 pb-8">
        {phase === "loading-steps" ? (
          <div className="text-paper">
            <LoadingSequence headline="Preparing your styling steps…" steps={["Reviewing the outfit", "Sequencing the steps"]} />
          </div>
        ) : (
          <>
            <CameraStage ref={cameraRef} hint={`Building: ${outfitName}`} />

            {phase === "dressing" && (
              <div className="rounded-xl border border-paper/20 bg-paper/5 p-5">
                <p className="text-xs uppercase tracking-wide text-paper/50">
                  Step {Math.min(stepIndex + 1, steps.length)} of {steps.length}
                </p>
                <p className="font-serif-display mt-2 text-2xl italic">
                  {steps[stepIndex] ?? closingPrompt}
                </p>
                <div className="mt-5 flex gap-3">
                  {stepIndex < steps.length - 1 ? (
                    <Button variant="inverse" onClick={() => setStepIndex((i) => i + 1)}>
                      Next step <ChevronRight size={16} />
                    </Button>
                  ) : (
                    <Button variant="rescue" onClick={handleCheckLook}>
                      Check My Look
                    </Button>
                  )}
                </div>
              </div>
            )}

            {phase === "checking" && (
              <div className="text-paper">
                <LoadingSequence
                  headline="Reading the outfit…"
                  steps={["Checking proportions", "Reviewing layering", "Finalizing feedback"]}
                />
              </div>
            )}

            {phase === "done" && critique && (
              <div className="rounded-xl border border-paper/20 bg-paper/5 p-5">
                <p className="text-xs uppercase tracking-wide text-paper/50">Stylist feedback</p>
                <p className="mt-2 text-lg leading-relaxed">{critique.critique}</p>
                <ul className="mt-3 list-inside list-disc text-sm text-paper/80">
                  {critique.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                {critique.suggestion && (
                  <p className="mt-3 text-sm text-paper/70">
                    <span className="font-medium text-paper">Try next time: </span>
                    {critique.suggestion}
                  </p>
                )}
                {error && (
                  <p className="mt-3 text-xs text-paper/50">
                    (Live critique unavailable — showing a representative example instead.)
                  </p>
                )}
                <Button
                  variant="inverse"
                  className="mt-5"
                  onClick={() => onComplete(critique, capturedImage)}
                >
                  Create My Look Card
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
