import type { Garment, Outfit, Trend } from "@/types";
import { Button } from "@/components/editorial/Button";
import { Badge } from "@/components/editorial/Badge";
import { cn } from "@/lib/utils";

const LANE_LABEL: Record<NonNullable<Outfit["lane"]>, string> = {
  safe: "Safe",
  current: "Current",
  "push-me": "Push Me",
  closet: "Your Closet",
  "full-send": "Full Send",
};

export function OutfitCard({
  outfit,
  garments,
  trends = [],
  onWear,
  footer,
}: {
  outfit: Outfit;
  garments: Garment[];
  trends?: Trend[];
  onWear?: () => void;
  footer?: React.ReactNode;
}) {
  const outfitGarments = outfit.garmentIds
    .map((id) => garments.find((g) => g.id === id))
    .filter((g): g is Garment => Boolean(g));

  const connectedTrends = outfit.trendIds
    .map((id) => trends.find((t) => t.id === id))
    .filter((t): t is Trend => Boolean(t));

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-line p-5">
        <div>
          {outfit.lane && (
            <Badge tone={outfit.lane === "push-me" || outfit.lane === "full-send" ? "rescue" : "default"}>
              {LANE_LABEL[outfit.lane]}
            </Badge>
          )}
          <h3 className="font-serif-display mt-2 text-2xl text-ink">{outfit.name}</h3>
          <p className="mt-1 text-sm italic text-ink-soft">{outfit.vibe}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-medium text-ink">{Math.round(outfit.confidenceScore * 100)}%</p>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">Confidence</p>
        </div>
      </div>

      {outfitGarments.length > 0 && (
        <div className="grid grid-cols-4 gap-2 p-4">
          {outfitGarments.map((g) => (
            <div key={g.id} className="aspect-square overflow-hidden rounded-md bg-paper-warm">
              {g.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.image} alt={g.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-ink-faint">
                  {g.name}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 px-5 pb-5">
        {outfitGarments.length === 0 && (
          <Badge tone="rescue">Fully aspirational — nothing in your closet yet</Badge>
        )}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Why it works</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{outfit.explanation}</p>
        </div>

        {outfit.stylingNotes.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Styling notes</p>
            <ul className="mt-1 list-inside list-disc text-sm leading-relaxed text-ink-soft">
              {outfit.stylingNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Occasion</p>
            <p className="mt-1 text-ink-soft">{outfit.occasion}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Color harmony</p>
            <p className="mt-1 text-ink-soft">{outfit.colorHarmony}</p>
          </div>
        </div>

        {connectedTrends.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {connectedTrends.map((t) => (
              <Badge key={t.id} tone="signal">
                ↑ {t.name}
              </Badge>
            ))}
          </div>
        )}

        {outfit.missingPieces && outfit.missingPieces.length > 0 && (
          <div className="rounded-md border border-dashed border-line bg-paper-warm/60 p-3 text-sm text-ink-soft">
            <span className="font-medium text-ink">
              {outfitGarments.length === 0 ? "What to look for: " : "Optional addition: "}
            </span>
            {outfit.missingPieces.join(", ")}
          </div>
        )}

        {outfit.optionalTweak && (
          <p className="text-sm text-ink-soft">
            <span className="font-medium text-ink">Optional tweak: </span>
            {outfit.optionalTweak}
          </p>
        )}

        <div className={cn("flex items-center gap-3", Boolean(footer) && "flex-wrap")}>
          {outfitGarments.length > 0 ? (
            onWear && (
              <Button variant="primary" onClick={onWear} className="w-full sm:w-auto">
                Wear This Look
              </Button>
            )
          ) : (
            <Button variant="secondary" href="/rescue" className="w-full sm:w-auto">
              Add These to Your Closet
            </Button>
          )}
          {footer}
        </div>
      </div>
    </div>
  );
}
