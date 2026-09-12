"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Shirt, Users } from "lucide-react";
import { storage } from "@/lib/storage";
import { personalizeTrends, type PersonalizedTrendWithTrend } from "@/lib/trends";
import type { Garment, UserStyleProfile } from "@/types";
import { PersonalMatchHero } from "@/components/trends/PersonalMatchHero";
import { TrendCard } from "@/components/trends/TrendCard";
import { ClosetGrid } from "@/components/closet/ClosetGrid";
import { Button } from "@/components/editorial/Button";
import { SectionHeading } from "@/components/editorial/SectionHeading";

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserStyleProfile | null>(null);
  const [closet, setCloset] = useState<Garment[]>([]);

  useEffect(() => {
    if (!storage.isOnboardingComplete()) {
      router.replace("/onboarding");
      return;
    }
    setProfile(storage.getStyleProfile());
    setCloset(storage.getCloset());
    setReady(true);
  }, [router]);

  const personalized: PersonalizedTrendWithTrend[] = useMemo(() => {
    if (!profile) return [];
    return personalizeTrends({
      styleWeights: profile.styleWeights,
      closet,
      preferredFit: profile.preferredFit,
    });
  }, [profile, closet]);

  if (!ready || !profile) return null;

  const topMatch = personalized[0];
  const nextFive = personalized.slice(1, 6);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <SectionHeading
        eyebrow="Welcome back"
        title="Your wardrobe is more current than you think."
        description="Here's what The Jerry found for you today."
      />

      {topMatch && (
        <div className="mt-8">
          <PersonalMatchHero
            personalized={topMatch}
            onBuildLook={() => router.push(`/style-now?trend=${topMatch.trend.id}`)}
          />
        </div>
      )}

      <div className="mt-14 flex items-center justify-between">
        <SectionHeading eyebrow="Personalized" title="Your Trend Radar" />
        <Link href="/trends" className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
          See all 50 <ArrowRight size={14} />
        </Link>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {nextFive.map((p) => (
          <TrendCard key={p.trendId} personalized={p} />
        ))}
      </div>

      <div className="mt-14 flex items-center justify-between">
        <SectionHeading eyebrow={`${closet.length} pieces`} title="Your Closet" />
        <Link href="/rescue" className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
          Add more <ArrowRight size={14} />
        </Link>
      </div>
      <div className="mt-6">
        {closet.length > 0 ? (
          <ClosetGrid garments={closet} compact />
        ) : (
          <p className="text-sm text-ink-soft">
            Your closet is empty so far.{" "}
            <Link href="/rescue" className="underline">
              Start a rescue
            </Link>{" "}
            to add your first pieces.
          </p>
        )}
      </div>

      <div className="mt-16 grid gap-5 sm:grid-cols-2">
        <Link
          href="/rescue"
          className="group flex flex-col gap-3 rounded-xl border border-line bg-card p-7 transition-colors hover:border-ink"
        >
          <Shirt className="text-rescue" size={22} strokeWidth={1.5} />
          <h3 className="font-serif-display text-xl text-ink">Rescue Something</h3>
          <p className="text-sm text-ink-soft">Show us a piece you never know how to wear.</p>
          <Button variant="secondary" size="md" className="mt-auto w-fit">
            Start a Rescue
          </Button>
        </Link>
        <Link
          href="/style-like"
          className="group flex flex-col gap-3 rounded-xl border border-line bg-card p-7 transition-colors hover:border-ink"
        >
          <Users className="text-rescue" size={22} strokeWidth={1.5} />
          <h3 className="font-serif-display text-xl text-ink">Style Like Someone</h3>
          <p className="text-sm text-ink-soft">Decode a real or fictional style and make it yours.</p>
          <Button variant="secondary" size="md" className="mt-auto w-fit">
            Style Like
          </Button>
        </Link>
      </div>
    </main>
  );
}
