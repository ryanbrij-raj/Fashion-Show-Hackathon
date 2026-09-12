"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import type { Garment } from "@/types";
import { cn } from "@/lib/utils";

export function GarmentCard({
  garment,
  onRename,
  onDelete,
  highlight,
  compact,
}: {
  garment: Garment;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
  highlight?: boolean;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(garment.name);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card",
        highlight ? "border-rescue" : "border-line"
      )}
    >
      <div className={cn("relative w-full overflow-hidden bg-paper-warm", compact ? "aspect-square" : "aspect-[3/4]")}>
        {garment.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={garment.image} alt={garment.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink-faint">
            {garment.category}
          </div>
        )}
        {garment.isRescueItem && (
          <span className="absolute left-2 top-2 rounded-full bg-rescue px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-paper">
            Rescue
          </span>
        )}
        {(onRename || onDelete) && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {onRename && (
              <button
                type="button"
                aria-label="Rename garment"
                onClick={() => setEditing(true)}
                className="rounded-full bg-ink/70 p-1.5 text-paper hover:bg-ink"
              >
                <Pencil size={12} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                aria-label="Remove garment"
                onClick={() => onDelete(garment.id)}
                className="rounded-full bg-ink/70 p-1.5 text-paper hover:bg-rescue"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="p-3">
        {editing ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              onRename?.(garment.id, name.trim() || garment.name);
              setEditing(false);
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-b border-line bg-transparent text-sm outline-none focus:border-ink"
              aria-label="Garment name"
            />
            <button type="submit" aria-label="Save name" className="text-signal">
              <Check size={14} />
            </button>
            <button type="button" aria-label="Cancel rename" onClick={() => setEditing(false)} className="text-ink-faint">
              <X size={14} />
            </button>
          </form>
        ) : (
          <p className="text-sm font-medium text-ink truncate">{garment.name}</p>
        )}
        <p className="mt-0.5 text-xs text-ink-faint capitalize">
          {garment.category} · {garment.primaryColor}
        </p>
      </div>
    </div>
  );
}
