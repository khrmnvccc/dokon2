'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

// Kassa toast: pastda (telefonda tab-bar ustida, kompyuterda o'ng pastda), 3.5 s (xato 6 s), ko'pi bilan 4 ta.
type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; text: string; description?: string }

const ToastContext = createContext<(text: string, kind?: ToastKind, description?: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: ToastKind = 'success', description?: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-3), { id, kind, text, description }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-pop anim-pop">
            {t.kind === 'success' ? <CheckCircle2 className="mt-px size-5 shrink-0 text-success" />
              : t.kind === 'error' ? <AlertCircle className="mt-px size-5 shrink-0 text-danger" />
              : <Info className="mt-px size-5 shrink-0 text-[var(--card)]" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t.text}</p>
              {t.description && <p className="mt-0.5 text-[13px] text-ink-3">{t.description}</p>}
            </div>
            <button onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))} aria-label="Yopish" className="text-ink-3 hover:text-ink">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
