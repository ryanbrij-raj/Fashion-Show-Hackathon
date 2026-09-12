import { Plus } from "lucide-react";
import type { Garment } from "@/types";
import { GarmentCard } from "./GarmentCard";

export function ClosetGrid({
  garments,
  onRename,
  onDelete,
  onAdd,
  compact,
}: {
  garments: Garment[];
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
  onAdd?: () => void;
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {garments.map((g) => (
        <GarmentCard key={g.id} garment={g} onRename={onRename} onDelete={onDelete} compact={compact} highlight={g.isRescueItem} />
      ))}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line text-ink-faint transition-colors hover:border-ink hover:text-ink"
        >
          <Plus size={20} />
          <span className="text-xs font-medium">Add to Closet</span>
        </button>
      )}
    </div>
  );
}
