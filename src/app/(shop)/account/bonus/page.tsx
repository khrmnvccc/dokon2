import { notFound } from 'next/navigation';
import { Coins } from 'lucide-react';
import { getL } from '@/lib/i18n/server';
import { requireUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data/public';
import { formatDateTime, formatPrice } from '@/lib/format';
import { cn } from '@/components/ui/cn';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bonuslarim' };

const KIND: Record<string, string> = { earn: 'Keshbek', spend: 'Xaridda ishlatildi', refund: 'Qaytarildi', reverse: 'Keshbek qaytarib olindi', adjust: 'Doʻkondan' };

export default async function BonusPage() {
  const L = await getL();
  await requireUser('/account/bonus');
  const settings = await getSettings();
  const cfg = settings.bonus;
  if (!cfg.enabled) notFound();
  const supabase = await getServerSupabase();
  const { data } = await supabase.rpc('my_bonus');
  const b = (data ?? { balance: 0, history: [] }) as { balance: number; history: { amount: number; kind: string; note: string | null; created_at: string; order_number: number | null }[] };
  return (
    <div className="space-y-4">
      <section className="rounded-[24px] p-5 text-white shadow-pop" style={{ background: 'linear-gradient(140deg, #f59e0b, #b45309)' }}>
        <p className="flex items-center gap-2 text-sm opacity-90"><Coins className="size-4" /> {L('Bonus balansi')}</p>
        <p className="num mt-1 text-3xl font-bold">{formatPrice(b.balance)}</p>
        <p className="mt-2 text-[13px] opacity-90">
          {L('Har yetkazilgan xariddan')} <b>{cfg.earn_percent}%</b> {L('keshbek')}{cfg.min_order ? ` (${L('kamida')} ${formatPrice(cfg.min_order)})` : ''}.
          {cfg.spend_enabled && <> {L('Buyurtmaning')} <b>{cfg.max_spend_percent}%</b> {L('gachasini bonus bilan toʻlash mumkin.')}</>}
        </p>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">{L('Tarix')}</h2>
        {b.history.length === 0 ? <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-3">{L('Hali bonus yoʻq. Birinchi xarid yetkazilgach keshbek tushadi.')}</p> : (
          <ul className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
            {b.history.map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{L(KIND[h.kind] ?? h.kind)}{h.order_number ? ` · №${h.order_number}` : ''}</p>
                  <p className="text-xs text-ink-3">{formatDateTime(h.created_at)}{h.kind === 'adjust' && h.note ? ` · ${h.note}` : ''}</p>
                </div>
                <span className={cn('num shrink-0 font-semibold', h.amount > 0 ? 'text-success' : 'text-ink-2')}>{h.amount > 0 ? '+' : '−'}{formatPrice(Math.abs(h.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
