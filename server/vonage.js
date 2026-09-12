import { Vonage } from '@vonage/server-sdk';
import { Auth } from '@vonage/auth';
import fs from 'fs';

const auth = new Auth({
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: fs.readFileSync(process.env.VONAGE_PRIVATE_KEY_PATH),
});

const vonage = new Vonage(auth);

export async function createSession() {
  const session = await vonage.video.createSession({});
  return session.sessionId;
}

export function generateToken(sessionId) {
  return vonage.video.generateClientToken(sessionId, { role: 'publisher' });
}
