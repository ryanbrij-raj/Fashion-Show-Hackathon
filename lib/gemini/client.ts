import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";

// All Gemini calls are server-side only. The API key never reaches the
// browser bundle because this file is marked server-only and is only ever
// imported from app/api/** route handlers.

const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

let client: GoogleGenAI | null = null;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new GeminiUnavailableError("GEMINI_API_KEY is not configured.");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export class GeminiUnavailableError extends Error {}
export class GeminiOutputError extends Error {}

export interface ImagePart {
  base64: string;
  mimeType: string;
}

/**
 * Calls Gemini with a text prompt (optionally + an image), asks for JSON
 * matching `jsonSchema`, and validates the parsed result against `zodSchema`.
 * Retries once on malformed JSON before surfacing a typed error so callers
 * can fall back gracefully instead of crashing the request.
 */
export async function generateStructured<T>(params: {
  systemInstruction: string;
  prompt: string;
  image?: ImagePart;
  jsonSchema: Record<string, unknown>;
  zodSchema: ZodType<T>;
  temperature?: number;
}): Promise<T> {
  const ai = getClient();
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: params.prompt },
  ];
  if (params.image) {
    parts.push({
      inlineData: { data: params.image.base64, mimeType: params.image.mimeType },
    });
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.6,
          responseMimeType: "application/json",
          responseSchema: params.jsonSchema,
        },
      });

      const text = response.text;
      if (!text) throw new GeminiOutputError("Gemini returned an empty response.");

      const parsed = JSON.parse(text);
      const result = params.zodSchema.safeParse(parsed);
      if (!result.success) {
        throw new GeminiOutputError(
          `Gemini output failed validation: ${result.error.message}`
        );
      }
      return result.data;
    } catch (err) {
      lastError = err;
      if (attempt === 0) continue; // one retry
    }
  }

  if (lastError instanceof Error) {
    throw new GeminiOutputError(
      `Gemini request failed after retry: ${lastError.message}`
    );
  }
  throw new GeminiOutputError("Gemini request failed after retry.");
}

/** Free-form text generation (no schema) — used for conversational stylist copy. */
export async function generateText(params: {
  systemInstruction: string;
  prompt: string;
  image?: ImagePart;
  temperature?: number;
}): Promise<string> {
  const ai = getClient();
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: params.prompt },
  ];
  if (params.image) {
    parts.push({
      inlineData: { data: params.image.base64, mimeType: params.image.mimeType },
    });
  }

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: params.systemInstruction,
      temperature: params.temperature ?? 0.7,
    },
  });

  const text = response.text;
  if (!text) throw new GeminiOutputError("Gemini returned an empty response.");
  return text;
}

/** Structured generation grounded with Google Search — used for real-world trend/persona research. */
export async function generateStructuredGrounded<T>(params: {
  systemInstruction: string;
  prompt: string;
  zodSchema: ZodType<T>;
  temperature?: number;
}): Promise<{ data: T; sources: { title: string; url: string }[] }> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${params.prompt}\n\nRespond ONLY with a single JSON object (no markdown fences, no commentary) matching the requested fields exactly.`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: params.systemInstruction,
      temperature: params.temperature ?? 0.5,
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new GeminiOutputError("Grounded Gemini response did not contain JSON.");
  }
  const parsed = JSON.parse(jsonMatch[0]);
  const result = params.zodSchema.safeParse(parsed);
  if (!result.success) {
    throw new GeminiOutputError(
      `Grounded Gemini output failed validation: ${result.error.message}`
    );
  }

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c) => ({ title: c.web?.title ?? "", url: c.web?.uri ?? "" }))
    .filter((s) => s.url);

  return { data: result.data, sources };
}

