"use client";

export function IntensitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const label = value < 0.4 ? "Subtle" : value < 0.75 ? "Recognizable" : "Iconic";

  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor="intensity" className="text-sm font-medium text-ink">
          How close should we go?
        </label>
        <span className="text-sm font-medium text-rescue">{label}</span>
      </div>
      <input
        id="intensity"
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="mt-3 w-full accent-rescue"
        aria-valuetext={label}
      />
      <div className="mt-1 flex justify-between text-[11px] uppercase tracking-wide text-ink-faint">
        <span>Subtle</span>
        <span>Recognizable</span>
        <span>Iconic</span>
      </div>
    </div>
  );
}
