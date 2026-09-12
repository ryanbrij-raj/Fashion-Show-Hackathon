"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/editorial/Button";

const EXAMPLES = [
  "Tyler, the Creator",
  "Zendaya",
  "Princess Diana",
  "James Bond",
  "Bruce Wayne",
  "Wednesday Addams",
  "Miles Morales",
];

export function PersonaSearch({ onSubmit }: { onSubmit: (query: string) => void }) {
  const [query, setQuery] = useState("");

  return (
    <div>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) onSubmit(query.trim());
        }}
      >
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Who do you want to dress like?"
            className="w-full rounded-full border border-line bg-card py-3.5 pl-11 pr-4 text-sm text-ink outline-none focus:border-ink"
            aria-label="Who do you want to dress like?"
          />
        </div>
        <Button type="submit" size="lg">
          Decode Style
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQuery(ex);
              onSubmit(ex);
            }}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
