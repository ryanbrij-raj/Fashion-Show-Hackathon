"use client";

// Reusable camera-frame capture: draws a <video> frame to an off-screen
// canvas, resizes to a sane max dimension, and compresses to JPEG so we
// never ship multi-megabyte base64 payloads to the Gemini API.

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.85;

export interface CapturedFrame {
  dataUrl: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  maxDimension: number = MAX_DIMENSION,
  quality: number = JPEG_QUALITY
): CapturedFrame | null {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) return null;

  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, width, height);

  const mimeType = "image/jpeg";
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const base64 = dataUrl.split(",")[1] ?? "";

  return { dataUrl, base64, mimeType, width, height };
}

/** Downscale/compress an arbitrary image data URL (e.g. from a file input). */
export async function processImageDataUrl(
  dataUrl: string,
  maxDimension: number = MAX_DIMENSION,
  quality: number = JPEG_QUALITY
): Promise<CapturedFrame> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const mimeType = "image/jpeg";
      const out = canvas.toDataURL(mimeType, quality);
      resolve({
        dataUrl: out,
        base64: out.split(",")[1] ?? "",
        mimeType,
        width,
        height,
      });
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = dataUrl;
  });
}

export async function requestCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is not supported in this browser.");
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
}
