import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './Button';

export function LoadingSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#65747B]">
      <Loader2 className="h-4 w-4 animate-spin text-[#0D4A5A]" />
      <span>{label}</span>
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-lg border border-[#DCE7E9] bg-white p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-9 w-full animate-pulse rounded bg-[#E9F3F3]/60"
        />
      ))}
    </div>
  );
}

export function ErrorState({
  title = 'Unable to load section',
  message = 'An unexpected error occurred while communicating with the EDFIC server.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#B42318]/30 bg-[#FEF3F2] p-6 text-xs text-[#B42318] space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="mt-1">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry Request
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#DCE7E9] bg-white p-8 text-center space-y-3">
      <p className="font-display text-sm font-semibold text-[#083642]">{title}</p>
      <p className="mx-auto max-w-md text-xs text-[#65747B]">{description}</p>
      {actionLabel && onAction && (
        <div className="pt-1">
          <Button type="button" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
