import { tr } from '@/lib/i18n/ui-ru';
import type { Lang } from '@/lib/i18n/dict';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/components/ui/cn';

export interface CargoStageDef { key: string; label: string; icon: string }
export interface CargoEvent { stage: string; note: string | null; created_at: string }

const ICON: Record<string, string> = { warehouse: '🏭', plane: '✈️', truck: '🚚', border: '🛂', customs: '📋', pin: '📍', box: '📦', check: '✅' };

/** Yuk yoʻli: sozlamadagi bosqichlar, yetib kelganlari belgilangan, sanasi va izohi bilan. */
export function CargoTimeline({ stages, events, current, tracking, carrierUrl, lang = 'uz' }: {
  stages: CargoStageDef[]; events: CargoEvent[]; current: string | null; tracking: string | null; carrierUrl?: string; lang?: Lang;
}) {
  const L = (s: string) => tr(lang, s);
  if (!events.length && !current) return null;
  const idx = stages.findIndex((s) => s.key === current);
  const lastAt = (k: string) => [...events].reverse().find((e) => e.stage === k);
  const link = carrierUrl && tracking && carrierUrl.includes('{{trek}}') ? carrierUrl.replace(/\{\{\s*trek\s*\}\}/g, encodeURIComponent(tracking)) : null;
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-soft sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{L('Yuk qayerda')}</h3>
        {tracking && <span className="text-sm text-ink-3">{L('Trek:')} <b className="text-ink">{tracking}</b></span>}
      </div>
      <ol className="relative space-y-3 pl-1">
        {stages.map((s, i) => {
          const reached = idx >= 0 && i <= idx;
          const ev = lastAt(s.key);
          return (
            <li key={s.key} className="flex gap-3">
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm', reached ? 'bg-primary text-primary-fg' : 'bg-surface-2 opacity-60', i === idx && 'ring-4 ring-primary/20')}>{ICON[s.icon] ?? '📦'}</span>
              <div className="min-w-0 pt-1">
                <p className={cn('text-sm font-medium', !reached && 'text-ink-3')}>{L(s.label)}</p>
                {ev && reached && <p className="text-xs text-ink-3">{formatDateTime(ev.created_at)}{ev.note ? ` · ${ev.note}` : ''}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {link && <a href={link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-primary">{L('Tashuvchi saytida kuzatish')} →</a>}
    </div>
  );
}
