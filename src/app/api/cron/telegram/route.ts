import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { deliverDue } from '@/lib/telegram/broadcast';
import { sendDailyReport } from '@/lib/telegram/events';
import { getSettings } from '@/lib/data/public';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron (Vercel Cron yoki istalgan rejalashtiruvchi): vaqti kelgan ommaviy xabarlar va kechki hisobot.
 * Kirish: Authorization: Bearer $CRON_SECRET. ?report=1 — kechki hisobotni ham yuborish.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const got = request.headers.get('authorization') ?? '';
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ error: 'Ruxsat yoʻq' }, { status: 401 });
  }
  await deliverDue(true);
  let report = false;
  if (new URL(request.url).searchParams.get('report') === '1') {
    const settings = await getSettings();
    report = await sendDailyReport(settings.brand.name || settings.store.name);
  }
  return NextResponse.json({ ok: true, report });
}
