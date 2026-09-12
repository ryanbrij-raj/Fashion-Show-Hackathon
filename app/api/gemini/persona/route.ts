import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzePersona, generatePersonaOutfits } from "@/lib/gemini/service";
import { isGeminiConfigured, GeminiOutputError } from "@/lib/gemini/client";
import { userStyleProfileSchema } from "@/schemas";
import { getTrendById } from "@/lib/trends";
import type { Garment, StylePersona } from "@/types";
import personasData from "@/data/personas.json";

export const runtime = "nodejs";

const garmentSchema = z.custom<Garment>((v) => typeof v === "object" && v !== null);
const personaSchema = z.custom<StylePersona>((v) => typeof v === "object" && v !== null);

const analyzeBodySchema = z.object({
  mode: z.literal("analyze"),
  query: z.string().min(1).max(120),
});

const outfitsBodySchema = z.object({
  mode: z.literal("outfits"),
  persona: personaSchema,
  intensity: z.number().min(0).max(1),
  occasion: z.string().max(80).optional(),
  closet: z.array(garmentSchema),
  styleProfile: userStyleProfileSchema,
  trendIds: z.array(z.string()).default([]),
});

const bodySchema = z.discriminatedUnion("mode", [analyzeBodySchema, outfitsBodySchema]);

function findCachedPersona(query: string): StylePersona | undefined {
  const normalized = query.trim().toLowerCase();
  return (personasData as StylePersona[]).find(
    (p) => p.name.toLowerCase() === normalized
  );
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (parsed.data.mode === "analyze") {
    const cached = findCachedPersona(parsed.data.query);
    if (cached) {
      return NextResponse.json({ persona: cached, cached: true });
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        {
          error:
            "That style isn't in our cached list, and Gemini isn't configured to look it up. Try one of the cached personas, or add GEMINI_API_KEY.",
        },
        { status: 503 }
      );
    }

    try {
      const analysis = await analyzePersona(parsed.data.query);
      const persona: StylePersona = {
        id: `persona_${analysis.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        ...analysis,
        sources: [],
      };
      return NextResponse.json({ persona, cached: false });
    } catch (err) {
      console.error("Persona analysis failed", err);
      const message =
        err instanceof GeminiOutputError
          ? "Gemini couldn't confidently decode that style. Try a more specific or well-known reference."
          : "Gemini is temporarily unavailable.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "Gemini is not configured on this server. Add GEMINI_API_KEY or use Demo Mode." },
      { status: 503 }
    );
  }

  try {
    const trends = parsed.data.trendIds
      .map((id) => getTrendById(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));

    const outfits = await generatePersonaOutfits({
      persona: parsed.data.persona,
      intensity: parsed.data.intensity,
      occasion: parsed.data.occasion,
      closet: parsed.data.closet,
      styleProfile: parsed.data.styleProfile,
      trends,
    });
    return NextResponse.json({ outfits });
  } catch (err) {
    console.error("Persona outfit generation failed", err);
    const message =
      err instanceof GeminiOutputError
        ? "Gemini had trouble translating that style into your closet. Try adding a couple more pieces."
        : "Gemini is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
