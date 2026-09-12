import type { FinalLookCard as FinalLookCardData } from "@/types";
import { formatDate } from "@/lib/utils";

export function FinalLookCard({ card }: { card: FinalLookCardData }) {
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
      <div className="bg-ink px-6 py-5 text-paper">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-paper/60">The Jerry</p>
        <p className="font-serif-display mt-1 text-xl italic">
          {card.kind === "persona" ? "Style Translation" : card.headline}
        </p>
      </div>

      <div className="flex flex-col gap-5 p-6">
        {card.kind === "rescue" && card.rescueItemName && (
          <Field label="Rescued" value={card.rescueItemName} />
        )}
        {card.kind === "persona" && card.personaName && (
          <Field label="Inspired by" value={card.personaName.toUpperCase()} />
        )}

        <Field label={card.kind === "persona" ? "Your look" : "Look"} value={card.outfitName.toUpperCase()} big />

        <Field label="Style DNA" value={card.styleDna.join(" × ")} />

        {card.trendMatchName && <Field label="Trend match" value={`${card.trendMatchName} ↑`} />}

        {card.styleSimilarity !== undefined && (
          <Field label="Style similarity" value={`${card.styleSimilarity}%`} />
        )}

        <Field
          label="Closet used"
          value={`${card.closetUsedCount} / ${card.closetTotalCount} pieces already owned`}
        />

        <div className="border-t border-line pt-4 text-center">
          <p className="font-serif-display text-lg italic text-ink">{card.tagline}</p>
          <p className="mt-2 text-[11px] uppercase tracking-wide text-ink-faint">{formatDate(card.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={big ? "font-serif-display text-2xl text-ink" : "text-sm text-ink"}>{value}</p>
    </div>
  );
}
