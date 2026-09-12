import { NextResponse } from "next/server";
import { z } from "zod";
import { discoverStyleFromFrame } from "@/lib/gemini/service";
import { isGeminiConfigured, GeminiOutputError } from "@/lib/gemini/client";

export const runtime = "nodejs";

const bodySchema = z.object({
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
    const result = await discoverStyleFromFrame({
      base64: parsed.data.imageBase64,
      mimeType: parsed.data.mimeType,
    });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("Style discovery failed", err);
    const message =
      err instanceof GeminiOutputError
        ? "Gemini couldn't make out an outfit in that frame. Try stepping back a little."
        : "Gemini is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
