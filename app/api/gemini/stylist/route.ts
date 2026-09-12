import { NextResponse } from "next/server";
import { z } from "zod";
import { generateStylistInstructions } from "@/lib/gemini/service";
import { isGeminiConfigured, GeminiOutputError } from "@/lib/gemini/client";
import type { Garment } from "@/types";

export const runtime = "nodejs";

const garmentSchema = z.custom<Garment>((v) => typeof v === "object" && v !== null);

const bodySchema = z.object({
  outfitName: z.string().min(1).max(80),
  garments: z.array(garmentSchema).min(1),
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
    const instructions = await generateStylistInstructions(parsed.data);
    return NextResponse.json({ instructions });
  } catch (err) {
    console.error("Stylist instruction generation failed", err);
    const message =
      err instanceof GeminiOutputError
        ? "Gemini couldn't put together styling steps for this outfit."
        : "Gemini is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
