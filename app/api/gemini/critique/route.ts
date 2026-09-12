import { NextResponse } from "next/server";
import { z } from "zod";
import { critiqueFinalLook } from "@/lib/gemini/service";
import { isGeminiConfigured, GeminiOutputError } from "@/lib/gemini/client";
import type { Garment } from "@/types";

export const runtime = "nodejs";

const garmentSchema = z.custom<Garment>((v) => typeof v === "object" && v !== null);

const bodySchema = z.object({
  outfitName: z.string().min(1).max(80),
  garments: z.array(garmentSchema).min(1),
  imageBase64: z.string().min(1),
  mimeType: z.string().default("image/jpeg"),
});

export async function POST(request: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "Gemini is not configured on this server. Add GEMINI_API_KEY or use Demo Mode." },
      { status: 503 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const critique = await critiqueFinalLook(
      { outfitName: parsed.data.outfitName, garments: parsed.data.garments },
      { base64: parsed.data.imageBase64, mimeType: parsed.data.mimeType }
    );
    return NextResponse.json({ critique });
  } catch (err) {
    console.error("Final critique failed", err);
    const message =
      err instanceof GeminiOutputError
        ? "Gemini couldn't get a clear enough look to critique. Try stepping back a bit."
        : "Gemini is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
