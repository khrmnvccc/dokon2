import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getTelegram } from '@/lib/telegram/server';
import { getShopBot } from '@/lib/telegram/shop-bot';
import { verifyInitData, type WebAppUser } from '@/lib/telegram/webapp-auth';

// Telegram mini-ilova ichida avtomatik kirish. Brauzer Telegram imzolagan initData ni yuboradi; server uni
// bot tokeni bilan tekshiradi va sessiya cookie sini oʻrnatadi. Parol ham, email ham soʻralmaydi.
//  • Doʻkon boti: xaridor (akkaunt boʻlmasa — yaratiladi, saytda kirgan boʻlsa — Telegrami shu akkauntga bogʻlanadi).
//  • Admin boti: faqat Telegrami oldindan ulangan xodim yoki Ega. Begona odam hech narsa olmaydi.
export const dynamic = 'force-dynamic';

const TG_EMAIL = (id: number) => `tg${id}@telegram.user`;
const display = (u: WebAppUser) => [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username || 'Telegram foydalanuvchi';
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
    const { data: sub } = await service.from('telegram_subscribers').select('user_id').eq('chat_id', tgUser.id).maybeSingle();
    userId = (sub?.user_id as string | null) ?? (person?.user_id as string | undefined) ?? current?.id ?? null;
    if (!userId) {
      const email = TG_EMAIL(tgUser.id);
      const created = await service.auth.admin.createUser({
        email, email_confirm: true, user_metadata: { full_name: display(tgUser), telegram_id: tgUser.id, telegram_username: tgUser.username ?? null },
      });
      if (created.data.user) userId = created.data.user.id;
      else {
        // Avval yaratilgan (obuna qatori oʻchirilgan boʻlsa ham) — email boʻyicha topamiz.
        const { data: p } = await service.from('profiles').select('id').eq('email', email).maybeSingle();
        userId = (p?.id as string | undefined) ?? null;
      }
      if (!userId) return deny('Akkaunt yaratib boʻlmadi. Birozdan keyin qayta urinib koʻring', 500);
    }
    const { error } = await service.from('telegram_subscribers').upsert(
      { chat_id: tgUser.id, user_id: userId, name: display(tgUser), username: tgUser.username ?? null, via: 'shop', last_seen: new Date().toISOString() },
      { onConflict: 'chat_id' },
    );
    if (error) console.error('webapp subscriber', error.message);
  }

  const { data: profile } = await service.from('profiles').select('email, is_blocked').eq('id', userId).maybeSingle();
  if (profile?.is_blocked) return deny('Akkaunt bloklangan');
  if (current?.id === userId) return NextResponse.json({ ok: true, changed: false });

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
  return NextResponse.json({ ok: true, changed: true, kind });
}
