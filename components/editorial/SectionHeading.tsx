import { cn } from "@/lib/utils";
import { Eyebrow } from "./Badge";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" && "text-center", className ?? undefined)}>
      {eyebrow && <Eyebrow className={align === "center" ? "justify-center flex" : undefined}>{eyebrow}</Eyebrow>}
      <h2 className="font-serif-display mt-2 text-3xl sm:text-4xl leading-[1.1] text-ink">
        {title}
      </h2>
      {description && (
        <p className="mt-3 max-w-2xl text-ink-soft text-base sm:text-lg leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
