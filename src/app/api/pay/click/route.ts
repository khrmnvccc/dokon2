import { NextResponse, after } from 'next/server';
import { handleClick } from '@/lib/payments/online';
import { onOnlinePaid } from '@/lib/telegram/events';

export const dynamic = 'force-dynamic';

/** Click SHOP API: Prepare va Complete ikkalasi ham shu manzilga keladi (action=0 / action=1). */
export async function POST(request: Request) {
  try {
    const res = await handleClick(request, (orderId, provider) => after(() => onOnlinePaid(orderId, provider)));
    return NextResponse.json(res);
  } catch (e) {
    console.error('click', e);
    return NextResponse.json({ error: -7, error_note: 'Failed to update user' });
  }
}
