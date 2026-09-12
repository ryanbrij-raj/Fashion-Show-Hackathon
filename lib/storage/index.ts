"use client";

// Thin localStorage wrapper. Every read/write is guarded so this module is
// safe to import from components that also render on the server (Next.js
// App Router renders client components on the server for the first pass).

import type {
  Garment,
  PersonaSession,
  RescueSession,
  SizeProfile,
  UserStyleProfile,
} from "@/types";

const KEYS = {
  onboardingComplete: "cr.onboardingComplete",
  styleProfile: "cr.styleProfile",
  sizeProfile: "cr.sizeProfile",
  closet: "cr.closet",
  rescueSession: "cr.rescueSession",
  personaSession: "cr.personaSession",
  demoMode: "cr.demoMode",
} as const;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function read<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — fail silently, app still works in-memory
  }
}

function remove(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const storage = {
  isOnboardingComplete(): boolean {
    return read<boolean>(KEYS.onboardingComplete) ?? false;
  },
  setOnboardingComplete(value: boolean): void {
    write(KEYS.onboardingComplete, value);
  },

  getStyleProfile(): UserStyleProfile | null {
    return read<UserStyleProfile>(KEYS.styleProfile);
  },
  setStyleProfile(profile: UserStyleProfile): void {
    write(KEYS.styleProfile, profile);
  },

  getSizeProfile(): SizeProfile | null {
    return read<SizeProfile>(KEYS.sizeProfile);
  },
  setSizeProfile(profile: SizeProfile): void {
    write(KEYS.sizeProfile, profile);
  },

  getCloset(): Garment[] {
    return read<Garment[]>(KEYS.closet) ?? [];
  },
  setCloset(closet: Garment[]): void {
    write(KEYS.closet, closet);
  },
  addGarment(garment: Garment): Garment[] {
    const closet = storage.getCloset();
    const next = [...closet, garment];
    storage.setCloset(next);
    return next;
  },
  removeGarment(id: string): Garment[] {
    const next = storage.getCloset().filter((g) => g.id !== id);
    storage.setCloset(next);
    return next;
  },
  updateGarment(id: string, patch: Partial<Garment>): Garment[] {
    const next = storage.getCloset().map((g) =>
      g.id === id ? { ...g, ...patch } : g
    );
    storage.setCloset(next);
    return next;
  },

  getRescueSession(): RescueSession | null {
    return read<RescueSession>(KEYS.rescueSession);
  },
  setRescueSession(session: RescueSession | null): void {
    if (session === null) remove(KEYS.rescueSession);
    else write(KEYS.rescueSession, session);
  },

  getPersonaSession(): PersonaSession | null {
    return read<PersonaSession>(KEYS.personaSession);
  },
  setPersonaSession(session: PersonaSession | null): void {
    if (session === null) remove(KEYS.personaSession);
    else write(KEYS.personaSession, session);
  },

  isDemoMode(): boolean {
    return read<boolean>(KEYS.demoMode) ?? false;
  },
  setDemoMode(value: boolean): void {
    write(KEYS.demoMode, value);
  },

  resetAll(): void {
    Object.values(KEYS).forEach(remove);
  },
};
