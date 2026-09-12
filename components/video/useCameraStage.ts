"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestCameraStream } from "@/lib/image/capture";

export type CameraStatus = "idle" | "connecting" | "live" | "denied" | "error";

interface VonageSessionResponse {
  configured: boolean;
  apiKey?: string;
  sessionId?: string;
  token?: string;
  error?: string;
}

/**
 * Drives the camera surface used across Rescue, Style Me Now, Style Like,
 * and AI Stylist Mode. When Vonage Video credentials are configured on the
 * server, it opens a real Vonage Video session and publishes to it — that
 * publisher's live MediaStream is what gets rendered and captured. When no
 * credentials are configured (local dev / demo mode), it falls back to a
 * plain camera preview so the rest of the app keeps working end to end.
 */
export function useCameraStage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const publisherContainerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [isVonageLive, setIsVonageLive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanupRef = useRef<() => void>(() => {});

  const stop = useCallback(() => {
    cleanupRef.current();
    cleanupRef.current = () => {};
    setStatus("idle");
    setIsVonageLive(false);
  }, []);

  const start = useCallback(async () => {
    stop();
    setStatus("connecting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/vonage/session", { method: "POST" });
      const data: VonageSessionResponse = await res.json();

      if (data.configured && data.apiKey && data.sessionId && data.token) {
        await startVonage(data.apiKey, data.sessionId, data.token);
      } else {
        await startPlainCamera();
      }
    } catch {
      // Network/parse failure talking to our own API — still try local camera
      // so a flaky connection never fully blocks the styling experience.
      try {
        await startPlainCamera();
      } catch (camErr) {
        handleCameraError(camErr);
      }
    }
    // startPlainCamera/startVonage are plain functions redeclared each
    // render closing over stable refs/setters — intentionally left out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);

  async function startPlainCamera() {
    try {
      const stream = await requestCameraStream();
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      cleanupRef.current = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      };
      setIsVonageLive(false);
      setStatus("live");
    } catch (err) {
      handleCameraError(err);
      throw err;
    }
  }

  async function startVonage(apiKey: string, sessionId: string, token: string) {
    try {
      const OTModule = await import("@vonage/client-sdk-video");
      const OT = (OTModule as unknown as { default?: typeof OTModule }).default ?? OTModule;

      const container = publisherContainerRef.current ?? document.createElement("div");
      const session = OT.initSession(apiKey, sessionId);

      const publisher = OT.initPublisher(
        container,
        {
          insertMode: "append",
          width: "100%",
          height: "100%",
          publishAudio: false,
          showControls: false,
          style: { buttonDisplayMode: "off" },
        },
        (err) => {
          if (err) handleCameraError(err);
        }
      );

      publisher.on("mediaStreamAvailable", (event: { mediaStream: MediaStream }) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.mediaStream;
          videoRef.current.play().catch(() => {});
        }
      });

      publisher.on("accessDenied", () => {
        setStatus("denied");
      });

      await new Promise<void>((resolve, reject) => {
        session.connect(token, (err) => (err ? reject(err) : resolve()));
      });

      session.publish(publisher);

      cleanupRef.current = () => {
        session.unpublish(publisher);
        publisher.destroy?.();
        session.disconnect();
        if (videoRef.current) videoRef.current.srcObject = null;
      };

      setIsVonageLive(true);
      setStatus("live");
    } catch {
      // Vonage session/publish failed for some reason (bad credentials,
      // network) — degrade to a local camera preview rather than dead-end.
      await startPlainCamera();
    }
  }

  function handleCameraError(err: unknown) {
    const message = err instanceof Error ? err.message : "Camera unavailable.";
    if (
      err instanceof DOMException &&
      (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
    ) {
      setStatus("denied");
      setErrorMessage("Camera access was denied. Allow camera access and try again.");
      return;
    }
    setStatus("error");
    setErrorMessage(message);
  }

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    videoRef,
    publisherContainerRef,
    status,
    isVonageLive,
    errorMessage,
    start,
    stop,
  };
}
