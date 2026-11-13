import { NextResponse, after } from 'next/server';
import { getShopBot, handleShopUpdate, secretMatches, type ShopUpdate } from '@/lib/telegram/shop-bot';

// Doʻkon botining webhooki. Faqat maxfiy kalit (Telegram sarlavhada yuboradi) mos kelsa qabul qilinadi.
// Telegramga darhol 200 qaytariladi, javob after() ichida yuboriladi.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const config = await getShopBot().catch(() => null);
  if (!config || !secretMatches(config, request.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await request.json().catch(() => null)) as ShopUpdate | null;
  if (update?.message) {
    after(() => handleShopUpdate(config, update).catch((e) => console.error('shop bot update', e)));
  }
  return NextResponse.json({ ok: true });
}
