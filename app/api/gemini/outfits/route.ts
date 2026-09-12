import { NextResponse } from "next/server";
import { z } from "zod";
import { generateRescueOutfits, generateStyleMeNowOutfits } from "@/lib/gemini/service";
import { isGeminiConfigured, GeminiOutputError } from "@/lib/gemini/client";
import { userStyleProfileSchema, sizeProfileSchema } from "@/schemas";
import { getTrendById } from "@/lib/trends";
import type { Garment } from "@/types";

export const runtime = "nodejs";

const garmentSchema = z.custom<Garment>((v) => typeof v === "object" && v !== null);

const rescueBodySchema = z.object({
  mode: z.literal("rescue"),
  rescueItem: garmentSchema,
  rescueReason: z.string().max(300).optional(),
  closet: z.array(garmentSchema),
  styleProfile: userStyleProfileSchema,
});

const styleNowBodySchema = z.object({
  mode: z.literal("style-now"),
  occasion: z.string().min(1).max(80),
  closet: z.array(garmentSchema),
  styleProfile: userStyleProfileSchema,
  sizeProfile: sizeProfileSchema.nullable().optional(),
  trendIds: z.array(z.string()).default([]),
});

const bodySchema = z.discriminatedUnion("mode", [rescueBodySchema, styleNowBodySchema]);

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
    if (parsed.data.mode === "rescue") {
      const outfits = await generateRescueOutfits({
        rescueItem: parsed.data.rescueItem,
        rescueReason: parsed.data.rescueReason,
        closet: parsed.data.closet,
        styleProfile: parsed.data.styleProfile,
      });
      return NextResponse.json({ outfits });
    }

    const trends = parsed.data.trendIds
      .map((id) => getTrendById(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));

    const outfits = await generateStyleMeNowOutfits({
      occasion: parsed.data.occasion,
      closet: parsed.data.closet,
      styleProfile: parsed.data.styleProfile,
      sizeProfile: parsed.data.sizeProfile,
      trends,
    });
    return NextResponse.json({ outfits });
  } catch (err) {
    console.error("Outfit generation failed", err);
    const message =
      err instanceof GeminiOutputError
        ? "Gemini had trouble building outfits from this closet. Try adding a couple more pieces."
        : "Gemini is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
