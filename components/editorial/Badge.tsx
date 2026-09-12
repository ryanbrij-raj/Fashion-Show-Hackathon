import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "rescue" | "signal";
}) {
  const tones = {
    default: "border-line text-ink-soft",
    rescue: "border-rescue/40 text-rescue-dark bg-rescue/5",
    signal: "border-signal/40 text-signal bg-signal/5",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em]",
        tones[tone],
        className ?? undefined
      )}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-medium uppercase tracking-[0.2em] text-ink-faint", className ?? undefined)}>
      {children}
    </p>
  );
}
