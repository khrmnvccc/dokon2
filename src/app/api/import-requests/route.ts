import { NextResponse, after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, getCurrentUser } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/data/public';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { sniffImage } from '@/lib/payment-card';
import { normalizeUzPhone } from '@/lib/phone';
import { IMPORT_MAX_BYTES, IMPORT_MAX_IMAGES, parseLinks } from '@/lib/import-requests';
import { onImportRequest, removeImportImages, uploadImportImage } from '@/lib/import-requests-server';

export const dynamic = 'force-dynamic';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
const str = (v: FormDataEntryValue | null | undefined, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Mijoz: Xitoydan olib kelish uchun soʻrov (havolalar va/yoki rasmlar). */
export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fail('Server sozlanmagan', 503);
  const origin = request.headers.get('origin');
  const originHost = (() => { try { return origin ? new URL(origin).host : null; } catch { return '?'; } })();
  if (originHost && originHost !== (request.headers.get('x-forwarded-host') || request.headers.get('host'))) return fail('Ruxsat yoʻq', 403);

  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  if (!settings.import_requests.enabled) return fail('Bu xizmat hozir ishlamayapti', 404);
  if (!user) return fail('Avval tizimga kiring', 401);
  const profile = await getCurrentProfile();
  if (profile?.is_blocked) return fail('Hisobingiz bloklangan', 403);
  if (!(await rateLimit(`import-req:${user.id}`, 10, 3600)) || !(await rateLimit(`import-req-ip:${await getClientIp()}`, 20, 3600))) {
    return fail('Juda koʻp soʻrov. Birozdan keyin qayta urinib koʻring', 429);
  }

  const form = await request.formData().catch(() => null);
  if (!form) return fail('Maʼlumotlar notoʻgʻri');
  const links = parseLinks(str(form.get('links'), 12_000));
  const files = form.getAll('images').filter((f): f is File => f instanceof Blob && f.size > 0).slice(0, IMPORT_MAX_IMAGES);
  if (!links.length && !files.length) return fail('Mahsulot havolasini yoki rasmini qoʻshing');
  const quantity = Math.min(100_000, Math.max(1, Math.round(Number(form.get('quantity')) || 1)));
  const title = str(form.get('title'), 160) || null;
  const description = str(form.get('description'), 1500) || null;
  const name = str(form.get('name'), 120) || profile?.full_name || '';
  const phone = normalizeUzPhone(str(form.get('phone'), 30) || profile?.phone || '');
  if (!name) return fail('Ismingizni kiriting');
  if (!phone) return fail('Telefon raqamini toʻgʻri kiriting');

  const images: { bytes: Uint8Array; mime: keyof typeof EXT }[] = [];
  for (const f of files) {
    if (f.size > IMPORT_MAX_BYTES) return fail('Rasm juda katta (5 MB gacha)');
    const bytes = new Uint8Array(await f.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) return fail('Faqat rasm (JPG, PNG yoki WEBP)');
    images.push({ bytes, mime });
  }

  const s = getServiceSupabase();
  const { count } = await s.from('import_requests').select('id', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['new', 'quoted']);
  if ((count ?? 0) >= settings.import_requests.max_open) return fail(`Ochiq soʻrovlaringiz koʻp (${count} ta). Avvalgilariga javobni kuting`, 409);

  const { data: row, error } = await s.from('import_requests').insert({
    user_id: user.id, customer_name: name, customer_phone: phone, title, links, description, quantity,
  }).select('id, number').single();
  if (error || !row) { console.error('import request', error?.message); return fail('Saqlab boʻlmadi. Qayta urinib koʻring', 500); }

  const paths: string[] = [];
  try {
    for (const img of images) paths.push(await uploadImportImage(row.id, img.bytes, img.mime, EXT[img.mime]));
    if (paths.length) await s.from('import_requests').update({ images: paths }).eq('id', row.id);
  } catch (e) {
    console.error('import upload', e);
    await removeImportImages(paths);
    await s.from('import_requests').update({ status: 'cancelled' }).eq('id', row.id);
    return fail('Rasmni saqlab boʻlmadi. Qayta urinib koʻring', 500);
  }
  await s.from('notifications').insert({
    user_id: null, type: 'import', title: `Buyurtma asosida soʻrov №${row.number}`, body: `${name} — narx berish kerak`, link: `/admin/import-requests/${row.id}`,
  });
  const first = images[0];
  after(() => onImportRequest(row.id, first ? { bytes: first.bytes, mime: first.mime, name: `sorov-${row.number}.${EXT[first.mime]}` } : undefined));
  revalidatePath('/account/requests');
  return NextResponse.json({ ok: true, id: row.id, number: row.number });
}
