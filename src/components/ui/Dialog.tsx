import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edfic-dialog-title"
    >
      <div
        className="fixed inset-0 bg-[#083642]/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[#DCE7E9] bg-white p-5 sm:p-6 shadow-2xl',
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E9F3F3] pb-3">
          <div>
            <h2
              id="edfic-dialog-title"
              className="font-display text-base font-semibold text-[#083642]"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs text-[#65747B]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-[#65747B] hover:bg-[#E9F3F3] hover:text-[#083642] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
