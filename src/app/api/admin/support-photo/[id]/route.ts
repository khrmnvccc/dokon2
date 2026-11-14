import { NextResponse } from 'next/server';
import { getStaffContext } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { downloadShopFile, getShopBot } from '@/lib/telegram/shop-bot';

export const dynamic = 'force-dynamic';

/** Murojaatdagi rasm: doʻkon boti orqali Telegramdan olinadi (token brauzerga chiqmaydi). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getStaffContext();
  if (!ctx?.permissions.has('customers.read')) return new NextResponse('Forbidden', { status: 403 });
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) return new NextResponse('Not found', { status: 404 });
  const { data } = await getServiceSupabase().from('support_messages').select('photo_file_id').eq('id', Number(id)).maybeSingle();
  const config = await getShopBot();
  if (!data?.photo_file_id || !config) return new NextResponse('Not found', { status: 404 });
  const file = await downloadShopFile(config.token, data.photo_file_id as string, 10 * 1024 * 1024);
  if (!file) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(file.bytes as BodyInit, { headers: { 'Content-Type': file.mime, 'Cache-Control': 'private, max-age=3600' } });
}
