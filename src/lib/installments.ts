// Boʻlib toʻlash (Uzum Nasiya, Alif Nasiya va h.k.): toʻlov usuliga biriktirilgan rejalar va oylik toʻlov hisobi.
// Shartnomani xodim provayder kabinetida rasmiylashtiradi; sayt mijozga oylik toʻlovni koʻrsatadi va tanlangan rejani saqlaydi.
import { z } from 'zod';

export const installmentSchema = z.object({
  provider: z.string().trim().min(1).max(40),
  plans: z.array(z.object({
    months: z.coerce.number().int().min(2).max(36),
    /** Ustama foizi (narxga qoʻshiladi) */
    markup: z.coerce.number().min(0).max(200),
  })).min(1).max(8),
  min_amount: z.coerce.number().int().min(0).default(0),
  max_amount: z.coerce.number().int().min(0).default(0),
});
export type InstallmentConfig = z.infer<typeof installmentSchema>;

export function parseInstallment(v: unknown): InstallmentConfig | null {
  if (!v || typeof v !== 'object') return null;
  const r = installmentSchema.safeParse(v);
  if (!r.success) return null;
  return { ...r.data, plans: [...r.data.plans].sort((a, b) => a.months - b.months) };
}

export const fitsAmount = (c: InstallmentConfig, amount: number) =>
  amount > 0 && amount >= c.min_amount && (!c.max_amount || amount <= c.max_amount);

export function planCost(amount: number, plan: { months: number; markup: number }) {
  const total = Math.round(amount * (1 + plan.markup / 100));
  return { total, monthly: Math.ceil(total / plan.months) };
}

/** Eng arzon oylik toʻlov (mahsulot sahifasidagi “oyiga …dan”) */
export function cheapestMonthly(configs: InstallmentConfig[], amount: number) {
  let best: { monthly: number; months: number; provider: string } | null = null;
  for (const c of configs) {
    if (!fitsAmount(c, amount)) continue;
    for (const p of c.plans) {
      const { monthly } = planCost(amount, p);
      if (!best || monthly < best.monthly) best = { monthly, months: p.months, provider: c.provider };
    }
  }
  return best;
}

export interface OrderInstallment { provider: string; months: number; markup: number; monthly: number; total: number }
