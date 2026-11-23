import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  notify: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    ({
      title,
      description,
      variant = 'info',
    }: {
      title: string;
      description?: string;
      variant?: ToastVariant;
    }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border bg-white p-4 shadow-md text-xs ${
              t.variant === 'error'
                ? 'border-[#B42318]/40 text-[#B42318]'
                : t.variant === 'success'
                  ? 'border-[#0D4A5A]/40 text-[#083642]'
                  : 'border-[#DCE7E9] text-[#24343B]'
            }`}
          >
            {t.variant === 'success' && (
              <CheckCircle2 className="h-4 w-4 text-[#0D4A5A] shrink-0 mt-0.5" />
            )}
            {t.variant === 'error' && (
              <AlertCircle className="h-4 w-4 text-[#B42318] shrink-0 mt-0.5" />
            )}
            {t.variant === 'info' && (
              <Info className="h-4 w-4 text-[#287887] shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-[#65747B]">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-[#65747B] hover:text-[#24343B] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
