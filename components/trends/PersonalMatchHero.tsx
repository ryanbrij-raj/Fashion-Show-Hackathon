import { Button } from "@/components/editorial/Button";
import type { PersonalizedTrendWithTrend } from "@/lib/trends";

export function PersonalMatchHero({
  personalized,
  onBuildLook,
}: {
  personalized: PersonalizedTrendWithTrend;
  onBuildLook?: () => void;
}) {
  const { trend } = personalized;
  const allOwned = personalized.difficulty === "already-in-closet";

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-ink text-paper">
      <div className="grid gap-6 p-8 sm:grid-cols-[1.4fr_1fr] sm:p-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-paper/60">Your top trend match</p>
          <h2 className="font-serif-display mt-3 text-4xl leading-[1.05] sm:text-5xl">{trend.name}</h2>
          <p className="mt-4 max-w-md text-paper/80">{trend.description}</p>
          {allOwned && (
            <p className="mt-4 text-sm font-medium text-paper">You already own everything you need.</p>
          )}
          {onBuildLook && (
            <Button
              variant="inverse"
              onClick={onBuildLook}
              className="mt-6"
            >
              Build This Look
            </Button>
          )}
        </div>

        <div className="flex flex-col justify-center gap-4 border-t border-paper/15 pt-6 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
          <Stat label="Overall" value={`${personalized.compatibilityScore}% for you`} big />
          <Stat label="Your style match" value={`${personalized.styleCompatibilityScore}%`} />
          <Stat label="Closet readiness" value={`${personalized.closetCompatibilityScore}%`} />
          <Stat label="Trend signal" value={`${trend.trendScore}`} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-paper/60">{label}</p>
      <p className={big ? "font-serif-display text-3xl" : "text-xl"}>{value}</p>
    </div>
  );
}
