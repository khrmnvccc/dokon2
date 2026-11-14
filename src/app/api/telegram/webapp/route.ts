import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getTelegram } from '@/lib/telegram/server';
import { getShopBot } from '@/lib/telegram/shop-bot';
import { verifyInitData, type WebAppUser } from '@/lib/telegram/webapp-auth';
import { ensureShopUser, profileOf } from '@/lib/telegram/tg-users';

// Telegram mini-ilova ichida avtomatik kirish. Brauzer Telegram imzolagan initData ni yuboradi; server uni
// bot tokeni bilan tekshiradi va sessiya cookie sini oʻrnatadi. Parol ham, email ham soʻralmaydi.
//  • Doʻkon boti: xaridor (akkaunt boʻlmasa — yaratiladi, saytda kirgan boʻlsa — Telegrami shu akkauntga bogʻlanadi).
//  • Admin boti: faqat Telegrami oldindan ulangan xodim yoki Ega. Begona odam hech narsa olmaydi.
export const dynamic = 'force-dynamic';

const deny = (error: string, status = 403) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { initData?: unknown } | null;
  const initData = typeof body?.initData === 'string' ? body.initData : '';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return deny('Server sozlanmagan', 503);

  const [shop, admin] = await Promise.all([getShopBot().catch(() => null), getTelegram().catch(() => null)]);
  let kind: 'shop' | 'admin' | null = null;
  let tgUser: WebAppUser | null = null;
  if (shop && (tgUser = verifyInitData(initData, shop.token, 86_400))) kind = 'shop';
  else if (admin && (tgUser = verifyInitData(initData, admin.token, 3_600))) kind = 'admin';
  if (!kind || !tgUser) return deny('Telegram maʼlumoti tasdiqlanmadi', 401);

  const service = getServiceSupabase();
  const supabase = await getServerSupabase();
  const { data: { user: current } } = await supabase.auth.getUser();

  // Kimga kiramiz
  let userId: string | null = null;
  const { data: person } = await service.from('telegram_people').select('user_id').eq('chat_id', tgUser.id).maybeSingle();
  if (kind === 'admin') {
    userId = (person?.user_id as string | undefined) ?? (admin?.chatId === tgUser.id ? admin.ownerUserId ?? null : null);
    if (!userId) return deny('Telegramingiz hali admin panelga ulanmagan. Kompyuterda admin panelga kiring va “Mening Telegramim” orqali ulang.');
  } else {
    userId = await ensureShopUser(tgUser, current?.id ?? null);
    if (!userId) return deny('Akkaunt yaratib boʻlmadi. Birozdan keyin qayta urinib koʻring', 500);
  }

  const profile = await profileOf(userId);
  const extra = { kind, needPhone: kind === 'shop' && !profile?.phone, clientNo: profile?.client_no ?? null };
  if (profile?.is_blocked) return deny('Akkaunt bloklangan');
  if (current?.id === userId) return NextResponse.json({ ok: true, changed: false, ...extra });

  const { data: authUser } = await service.auth.admin.getUserById(userId);
  const email = authUser.user?.email ?? profile?.email;
  if (!email) return deny('Akkauntda email yoʻq', 500);
  const link = await service.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link.data.properties?.hashed_token;
  if (!tokenHash) return deny('Kirish havolasi yaratilmadi', 500);
  const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (error) {
    console.error('webapp verify', error.message);
    return deny('Kirib boʻlmadi. Qayta urinib koʻring', 500);
  }
  return NextResponse.json({ ok: true, changed: true, ...extra });
}
