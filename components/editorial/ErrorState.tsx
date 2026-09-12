import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({
  title = "Something interrupted us",
  message,
  onRetry,
  retryLabel = "Try again",
  fallback,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  fallback?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-card px-6 py-10 text-center">
      <AlertTriangle className="text-rescue" size={28} strokeWidth={1.5} />
      <div>
        <p className="font-serif-display text-xl text-ink">{title}</p>
        <p className="mt-2 max-w-sm text-sm text-ink-soft">{message}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button variant="secondary" size="md" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
        {fallback}
      </div>
    </div>
  );
}
