import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { deliverDue } from '@/lib/telegram/broadcast';
import { runCartReminders } from '@/lib/jobs/cart-reminders';
import { processStockEvents } from '@/lib/jobs/stock';
import { runScheduledReports } from '@/lib/jobs/reports';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Kirish: Supabase pg_cron (x-jobs-key = app_meta 'jobs_key') yoki Vercel Cron (Bearer CRON_SECRET). */
async function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (secret && same(auth, `Bearer ${secret}`)) return true;
  const key = request.headers.get('x-jobs-key') ?? '';
  if (!key || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const { data } = await getServiceSupabase().from('app_meta').select('value').eq('key', 'jobs_key').maybeSingle();
  const want = typeof data?.value === 'string' ? data.value : '';
  return Boolean(want) && same(key, want);
}

/**
 * Fon ishlari (har 10 daqiqada): rejalashtirilgan ommaviy xabarlar, savat eslatmalari,
 * ombor hodisalari (kam qoldi / qayta keldi), avtomatik hisobotlar. Har biri alohida — biri yiqilsa boshqasi ishlayveradi.
 */
export async function GET(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ error: 'Ruxsat yoʻq' }, { status: 401 });
  const out: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try { out[name] = await fn(); } catch (e) { console.error(`job ${name}`, e); out[name] = { error: true }; }
  };
  await step('broadcasts', () => deliverDue(true));
  await step('stock', () => processStockEvents());
  await step('cart', () => runCartReminders());
  await step('reports', () => runScheduledReports());
  return NextResponse.json({ ok: true, ...out });
}
export const POST = GET;
