import "server-only";
import { Vonage } from "@vonage/server-sdk";
import { Auth } from "@vonage/auth";
import { MediaMode } from "@vonage/video";
import fs from "node:fs";

export function isVonageConfigured(): boolean {
  return Boolean(
    process.env.VONAGE_APPLICATION_ID &&
      (process.env.VONAGE_PRIVATE_KEY || process.env.VONAGE_PRIVATE_KEY_PATH)
  );
}

function loadPrivateKey(): string {
  if (process.env.VONAGE_PRIVATE_KEY) {
    return process.env.VONAGE_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  if (process.env.VONAGE_PRIVATE_KEY_PATH) {
    return fs.readFileSync(process.env.VONAGE_PRIVATE_KEY_PATH, "utf-8");
  }
  throw new VonageUnavailableError(
    "Neither VONAGE_PRIVATE_KEY nor VONAGE_PRIVATE_KEY_PATH is configured."
  );
}

export class VonageUnavailableError extends Error {}

let vonage: Vonage | null = null;

function getClient(): Vonage {
  if (!isVonageConfigured()) {
    throw new VonageUnavailableError("Vonage Video credentials are not configured.");
  }
  if (!vonage) {
    const auth = new Auth({
      applicationId: process.env.VONAGE_APPLICATION_ID!,
      privateKey: loadPrivateKey(),
    });
    vonage = new Vonage(auth);
  }
  return vonage;
}

export interface VonageSessionCredentials {
  apiKey: string;
  sessionId: string;
  token: string;
}

/**
 * Creates a fresh Vonage Video session and a publisher token for it.
 * The apiKey we hand back to the browser is the Vonage Application ID —
 * safe to expose, it identifies the project, not a secret.
 */
export async function createStylingSession(): Promise<VonageSessionCredentials> {
  const client = getClient();
  const session = await client.video.createSession({ mediaMode: MediaMode.ROUTED });
  const token = client.video.generateClientToken(session.sessionId, {
    role: "publisher",
    expireTime: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
  });

  return {
    apiKey: process.env.VONAGE_APPLICATION_ID!,
    sessionId: session.sessionId,
    token,
  };
}
