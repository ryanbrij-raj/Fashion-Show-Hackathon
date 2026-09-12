import { NextResponse } from "next/server";
import { z } from "zod";
import { explainPersonalizedTrend } from "@/lib/gemini/service";
import { isGeminiConfigured, GeminiOutputError } from "@/lib/gemini/client";
import { userStyleProfileSchema } from "@/schemas";
import { getTrendById } from "@/lib/trends";
import type { Garment } from "@/types";

export const runtime = "nodejs";

const garmentSchema = z.custom<Garment>((v) => typeof v === "object" && v !== null);

const bodySchema = z.object({
  trendId: z.string().min(1),
  scoreBreakdown: z.object({
    overall: z.number(),
    styleMatch: z.number(),
    closetMatch: z.number(),
    fitMatch: z.number(),
    trendStrength: z.number(),
  }),
  closet: z.array(garmentSchema),
  styleProfile: userStyleProfileSchema,
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const trend = getTrendById(parsed.data.trendId);
  if (!trend) {
    return NextResponse.json({ error: "Unknown trend." }, { status: 404 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "Gemini is not configured on this server. Add GEMINI_API_KEY or use Demo Mode." },
      { status: 503 }
    );
  }

  try {
    const reason = await explainPersonalizedTrend({
      trend,
      scoreBreakdown: parsed.data.scoreBreakdown,
      closet: parsed.data.closet,
      styleProfile: parsed.data.styleProfile,
    });
    return NextResponse.json({ reason });
  } catch (err) {
    console.error("Trend explanation failed", err);
    const message =
      err instanceof GeminiOutputError
        ? "Gemini couldn't generate an explanation for this trend right now."
        : "Gemini is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
