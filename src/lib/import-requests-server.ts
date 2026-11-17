import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { ADMIN_URL } from '@/lib/env';
import { getTelegram, notify } from '@/lib/telegram/server';
import { sendToUser } from '@/lib/telegram/shop-bot';
import { linkHost, type ImportRequestRow } from './import-requests';
import { notifyImportSms } from '@/lib/sms/notify';

const BUCKET = 'import-requests';
const db = () => getServiceSupabase();

/** Rasm yoʻllari → 10 daqiqalik imzolangan havolalar (maxfiy papka). */
export async function signImages(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data } = await db().storage.from(BUCKET).createSignedUrls(paths, 600);
  return (data ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
}

export async function uploadImportImage(requestId: string, bytes: Uint8Array, mime: string, ext: string) {
  const path = `${requestId}/${crypto.randomUUID()}.${ext}`;
  const up = await db().storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (up.error) throw new Error(up.error.message);
  return path;
}

export async function removeImportImages(paths: string[]) {
  if (paths.length) await db().storage.from(BUCKET).remove(paths);
}

export async function loadImportRequest(id: string) {
  const { data } = await db().from('import_requests').select('*').eq('id', id).maybeSingle();
  return data as ImportRequestRow | null;
}

const title = (r: Pick<ImportRequestRow, 'title' | 'number'>) => r.title || `Soʻrov №${r.number}`;

/** Yangi soʻrov: xodimlarga (birinchi rasm bilan). Xato tashlamaydi. */
export async function onImportRequest(id: string, photo?: { bytes: Uint8Array; mime: string; name: string }) {
  try {
    if (!(await getTelegram())?.chatId) return;
    const r = await loadImportRequest(id);
    if (!r) return;
    await notify('importRequest', {
      sorov: r.number, mijoz: r.customer_name, telefon: formatUzPhone(r.customer_phone), nomi: title(r), soni: `${r.quantity} dona`,
      havolalar: r.links.map((l) => `${linkHost(l)}: ${l}`).join('\n'), izoh: r.description, havola: `${ADMIN_URL}/admin/import-requests/${r.id}`,
    }, { photo, link: `/admin/import-requests/${r.id}` });
  } catch (e) {
    console.error('import request notify', e);
  }
}

/** Narx berildi / rad etildi: mijozga doʻkon boti orqali. */
export async function notifyImportCustomer(id: string) {
  try {
    const r = await loadImportRequest(id);
    if (!r) return;
    const path = `/account/requests/${r.id}`;
    if (r.status === 'quoted' && r.quote) {
      await sendToUser(r.user_id, 'importQuoted', {
        sorov: r.number, nomi: r.quote.name || title(r), soni: `${r.quantity} dona`, summa: formatPrice(r.quote.total, 'soʻm'),
        muddat: r.quote.days ?? '', izoh: r.quote.note ?? '',
      }, path, `soʻrov:${r.number}`);
    } else if (r.status === 'rejected') {
      await sendToUser(r.user_id, 'importRejected', { sorov: r.number, sabab: r.reject_reason ?? '' }, '/account/requests', `soʻrov:${r.number}`);
    }
    if (r.status === 'quoted') await notifyImportSms(r.id);
    await db().from('notifications').insert({
      user_id: r.user_id, type: 'import',
      title: r.status === 'quoted' ? `Soʻrov №${r.number}: narx tayyor` : `Soʻrov №${r.number} rad etildi`,
      body: r.status === 'quoted' && r.quote ? `Jami: ${formatPrice(r.quote.total, 'soʻm')}` : r.reject_reason ?? null, link: path,
    });
  } catch (e) {
    console.error('import customer notify', e);
  }
}
