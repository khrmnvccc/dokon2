import { NextResponse, after } from 'next/server';
import { handlePayme } from '@/lib/payments/online';
import { onOnlinePaid } from '@/lib/telegram/events';

export const dynamic = 'force-dynamic';

/** Payme Merchant API (JSON-RPC). Payme kabinetida “Endpoint URL” sifatida shu manzil kiritiladi. */
export async function POST(request: Request) {
  try {
    const res = await handlePayme(request, (orderId, provider) => after(() => onOnlinePaid(orderId, provider)));
    return NextResponse.json(res);
  } catch (e) {
    console.error('payme', e);
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32400, message: { uz: 'Tizim xatosi', ru: 'Системная ошибка', en: 'System error' } } });
  }
}
