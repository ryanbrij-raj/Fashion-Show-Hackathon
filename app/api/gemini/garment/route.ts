import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeGarment } from "@/lib/gemini/service";
import { isGeminiConfigured, GeminiOutputError } from "@/lib/gemini/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().default("image/jpeg"),
  rescueReason: z.string().max(300).optional(),
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
    const analysis = await analyzeGarment(
      { base64: parsed.data.imageBase64, mimeType: parsed.data.mimeType },
      parsed.data.rescueReason
    );
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("Garment analysis failed", err);
    const message =
      err instanceof GeminiOutputError
        ? "Gemini couldn't read that garment clearly. Try a closer, well-lit shot."
        : "Gemini is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
