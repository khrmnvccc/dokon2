'use client';

import { CheckCircle2, CreditCard } from 'lucide-react';
import { useL } from '@/components/providers';
import { formatPrice } from '@/lib/format';
import { buttonClass } from '@/components/ui/button';

export interface OnlinePayData { provider: 'click' | 'payme'; label: string; total: number; paid: boolean; payable: boolean; href: string }

const BRAND = { click: { bg: '#0099ff', name: 'Click' }, payme: { bg: '#00cccc', name: 'Payme' } } as const;

/** Click / Payme orqali toʻlash kartasi (buyurtma va “rahmat” sahifalarida). */
export function OnlinePay({ data, symbol }: { data: OnlinePayData; symbol: string }) {
  const L = useL();
  const b = BRAND[data.provider];
  if (data.paid) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-soft">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
        <p className="text-sm font-medium">{L('Toʻlov qabul qilindi')} · {b.name}</p>
      </div>
    );
  }
  if (!data.payable) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: b.bg }}><CreditCard className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{L('Toʻlov kutilmoqda')}</p>
          <p className="text-sm text-ink-3">{data.label} · <b className="num text-ink">{formatPrice(data.total, symbol)}</b></p>
        </div>
      </div>
      <a href={data.href} className={buttonClass('primary', 'lg', 'mt-4 w-full')} style={{ background: b.bg }}>
        {b.name} {L('orqali toʻlash')}
      </a>
      <p className="mt-2 text-center text-xs text-ink-3">{L('Toʻlov tushishi bilan buyurtma avtomatik tasdiqlanadi')}</p>
    </div>
  );
}
