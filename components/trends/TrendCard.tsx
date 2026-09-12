"use client";

import { useState } from "react";
import type { Trend } from "@/types";
import { Badge } from "@/components/editorial/Badge";
import { Button } from "@/components/editorial/Button";
import { formatDate } from "@/lib/utils";
import type { PersonalizedTrendWithTrend } from "@/lib/trends";

export function TrendCard({
  personalized,
  onExplain,
}: {
  personalized: PersonalizedTrendWithTrend;
  onExplain?: (trend: Trend) => Promise<string>;
}) {
  const { trend } = personalized;
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleExplain() {
    if (!onExplain || reason) return;
    setLoading(true);
    try {
      const r = await onExplain(trend);
      setReason(r);
    } catch {
      setReason("Couldn't generate an explanation right now — but the match score above is accurate.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">{trend.category.replace("-", " ")}</p>
          <h3 className="font-serif-display mt-1 text-xl text-ink">{trend.name}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-medium text-ink">{trend.trendScore}</p>
          <p className="text-[10px] uppercase tracking-wide text-ink-faint">Trend Signal</p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-ink-soft">{trend.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {trend.styleTags.slice(0, 4).map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-ink-faint">
        <span>
          {trend.sourceCount} source{trend.sourceCount === 1 ? "" : "s"} · updated {formatDate(trend.updatedAt)}
        </span>
        <span title={trend.sourceNames.join(", ")}>{trend.sourceNames.slice(0, 2).join(", ")}</span>
      </div>

      <div className="flex items-baseline justify-between rounded-md bg-paper-warm px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">Your match</span>
        <span className="font-serif-display text-lg text-ink">{personalized.compatibilityScore}%</span>
      </div>

      {onExplain && (
        <div>
          {reason ? (
            <p className="text-sm italic text-ink-soft">{reason}</p>
          ) : (
            <Button variant="ghost" size="md" onClick={handleExplain} disabled={loading} className="px-0">
              {loading ? "Thinking…" : "Why this matches me →"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
