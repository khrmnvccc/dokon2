import { NextResponse } from 'next/server';
import { REF_COOKIE, parseRefCode } from '@/lib/referral';
import { trackRefOpen } from '@/lib/referral-server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { SITE_URL } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Doʻst havolasi: /r/1234 → cookie (30 kun) va bosh sahifa. Roʻyxatdan oʻtganda yoki birinchi
// buyurtmada mijoz shu ID egasiga bogʻlanadi (faqat yangi mijoz boʻlsa — bazada tekshiriladi).
export async function GET(_req: Request, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const refNo = parseRefCode(no);
  const res = NextResponse.redirect(`${SITE_URL}/?utm_source=referral`, 302);
  if (!refNo) return res;
  res.cookies.set(REF_COOKIE, String(refNo), { maxAge: 30 * 86_400, httpOnly: true, sameSite: 'lax', secure: SITE_URL.startsWith('https://'), path: '/' });
  if (await rateLimit(`refopen:${await getClientIp()}`, 10, 3600)) await trackRefOpen(refNo);
  return res;
}
