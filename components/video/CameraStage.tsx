"use client";

import { useEffect, useImperativeHandle, forwardRef, useState } from "react";
import { Camera, RotateCcw, Video, WifiOff } from "lucide-react";
import { useCameraStage } from "./useCameraStage";
import { captureVideoFrame, type CapturedFrame } from "@/lib/image/capture";
import { Button } from "@/components/editorial/Button";

export interface CameraStageHandle {
  capture: () => CapturedFrame | null;
  retry: () => void;
}

/**
 * The camera surface used everywhere the app needs a live look at what the
 * user is wearing or holding up. Backed by a real Vonage Video session when
 * credentials are configured (badge shown), otherwise a local camera
 * preview — either way `capture()` grabs a compressed JPEG frame.
 */
export const CameraStage = forwardRef<CameraStageHandle, { className?: string; hint?: string }>(
  function CameraStage({ className, hint }, ref) {
    const { videoRef, publisherContainerRef, status, isVonageLive, errorMessage, start, stop } =
      useCameraStage();
    const [flash, setFlash] = useState(false);

    useEffect(() => {
      start();
      return () => stop();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      capture: () => {
        if (!videoRef.current) return null;
        const frame = captureVideoFrame(videoRef.current);
        if (frame) {
          setFlash(true);
          setTimeout(() => setFlash(false), 180);
        }
        return frame;
      },
      retry: () => start(),
    }));

    return (
      <div className={className}>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-line bg-ink">
          {/* Hidden container Vonage's SDK publishes into; we mirror its stream into the visible <video> below. */}
          <div ref={publisherContainerRef} className="hidden" aria-hidden />

          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />

          {flash && <div className="absolute inset-0 bg-white/80 animate-pulse-soft" />}

          {status === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/90 text-paper">
              <div className="flex flex-col items-center gap-3">
                <Video className="animate-pulse-soft" size={28} strokeWidth={1.5} />
                <p className="text-sm">Connecting camera…</p>
              </div>
            </div>
          )}

          {(status === "denied" || status === "error") && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/95 p-6 text-paper">
              <div className="flex flex-col items-center gap-3 text-center">
                <WifiOff size={28} strokeWidth={1.5} />
                <p className="text-sm max-w-xs">
                  {status === "denied"
                    ? "Camera access was denied. Enable camera permissions for this site and try again."
                    : errorMessage ?? "The camera couldn't start."}
                </p>
                <Button variant="inverse-outline" size="md" onClick={start}>
                  <RotateCcw size={14} /> Retry
                </Button>
              </div>
            </div>
          )}

          {status === "live" && (
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-medium text-paper">
                <span className="h-1.5 w-1.5 rounded-full bg-rescue animate-pulse-soft" /> LIVE
              </span>
              {isVonageLive && (
                <span className="rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-medium text-paper">
                  Powered by Vonage Video
                </span>
              )}
            </div>
          )}
        </div>

        {hint && status === "live" && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
            <Camera size={14} /> {hint}
          </p>
        )}
      </div>
    );
  }
);
