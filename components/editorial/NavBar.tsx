"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { storage } from "@/lib/storage";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/rescue", label: "Rescue" },
  { href: "/style-now", label: "Style Me Now" },
  { href: "/trends", label: "Trend Radar" },
  { href: "/style-like", label: "Style Like" },
];

export function NavBar() {
  const pathname = usePathname();
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    setDemoMode(storage.isDemoMode());
  }, [pathname]);

  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/dashboard" className="font-serif-display text-lg text-ink">
          The Jerry
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm transition-colors",
                pathname.startsWith(link.href) ? "text-ink font-medium" : "text-ink-soft hover:text-ink"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {demoMode && (
          <span className="rounded-full border border-rescue/40 bg-rescue/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-rescue-dark">
            Demo Mode
          </span>
        )}
      </div>
      <nav className="flex items-center gap-4 overflow-x-auto border-t border-line px-5 py-2 md:hidden">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "whitespace-nowrap text-xs",
              pathname.startsWith(link.href) ? "text-ink font-medium" : "text-ink-soft"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
