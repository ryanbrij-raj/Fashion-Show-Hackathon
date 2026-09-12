import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "inverse" | "inverse-outline" | "rescue";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium tracking-wide transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rescue";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-rescue",
  secondary: "bg-transparent text-ink border border-ink hover:bg-ink hover:text-paper",
  outline: "bg-transparent text-ink-soft border border-line hover:border-ink hover:text-ink",
  ghost: "bg-transparent text-ink-soft hover:text-ink",
  // For use on dark surfaces (the ink-colored hero card, AI Stylist Mode).
  inverse: "bg-paper text-ink hover:bg-rescue hover:text-paper",
  "inverse-outline": "bg-transparent text-paper border border-paper hover:bg-paper hover:text-ink",
  rescue: "bg-rescue text-paper hover:bg-rescue-dark",
};

const sizes: Record<Size, string> = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

interface ButtonOwnProps {
  variant?: Variant;
  size?: Size;
  href?: string;
}

type ButtonProps = ButtonOwnProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size">;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", href, className, children, ...props },
  ref
) {
  const classes = cn(base, variants[variant], sizes[size], className ?? undefined);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button ref={ref} className={classes} {...props}>
      {children}
    </button>
  );
});
