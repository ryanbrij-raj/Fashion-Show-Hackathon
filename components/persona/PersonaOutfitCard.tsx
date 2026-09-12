import type { Garment, PersonaOutfit } from "@/types";
import { OutfitCard } from "@/components/outfits/OutfitCard";

const SIMILARITY_LABELS: { key: keyof PersonaOutfit["styleSimilarity"]; label: string }[] = [
  { key: "silhouette", label: "Silhouette" },
  { key: "colorLanguage", label: "Color language" },
  { key: "layering", label: "Layering" },
  { key: "footwear", label: "Footwear" },
  { key: "accessories", label: "Accessories" },
];

export function PersonaOutfitCard({
  outfit,
  garments,
  onWear,
}: {
  outfit: PersonaOutfit;
  garments: Garment[];
  onWear?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <OutfitCard outfit={outfit} garments={garments} onWear={onWear} />
      <div className="rounded-xl border border-line bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Why this feels like them</p>
        <ul className="mt-2 list-inside list-disc text-sm leading-relaxed text-ink-soft">
          {outfit.whyThisFeelsLikeThem.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>

        <p className="mt-5 text-xs font-medium uppercase tracking-wide text-ink-faint">Style similarity</p>
        <p className="text-[11px] text-ink-faint">Styling only — never a claim about physical resemblance.</p>
        <div className="mt-3 flex flex-col gap-2.5">
          {SIMILARITY_LABELS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-ink-soft">{label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-warm">
                <div
                  className="h-full rounded-full bg-ink"
                  style={{ width: `${outfit.styleSimilarity[key]}%` }}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-xs text-ink-soft">
                {outfit.styleSimilarity[key]}%
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-sm font-medium text-ink">Overall style similarity</span>
          <span className="font-serif-display text-2xl text-ink">{outfit.overallSimilarity}%</span>
        </div>
      </div>
    </div>
  );
}
