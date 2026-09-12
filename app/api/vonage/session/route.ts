import { NextResponse } from "next/server";
import { createStylingSession, isVonageConfigured, VonageUnavailableError } from "@/lib/vonage/server";

export const runtime = "nodejs";

export async function POST() {
  if (!isVonageConfigured()) {
    // Demo/local fallback: the frontend falls back to a plain getUserMedia
    // camera preview so the app stays fully usable without credentials.
    return NextResponse.json({ configured: false });
  }

  try {
    const session = await createStylingSession();
    return NextResponse.json({ configured: true, ...session });
  } catch (err) {
    if (err instanceof VonageUnavailableError) {
      return NextResponse.json({ configured: false });
    }
    console.error("Vonage session creation failed", err);
    return NextResponse.json(
      { configured: false, error: "Could not start a Vonage Video session." },
      { status: 502 }
    );
  }
}
