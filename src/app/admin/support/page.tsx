import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { formatDateTime } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { PageHeader } from '@/components/admin/ui';
import { Alert } from '@/components/ui/kit';
import { cn } from '@/components/ui/cn';
import { SupportReply, ClientIdJump } from '@/components/admin/support-reply';

export const metadata = { title: 'Murojaatlar' };
export const dynamic = 'force-dynamic';

interface Msg { id: number; chat_id: number; user_id: string | null; direction: 'in' | 'out'; text: string | null; photo_file_id: string | null; read_at: string | null; created_at: string }

/** Mijozlar doʻkon botiga yozganlari: chapda suhbatlar, oʻngda tanlangan suhbat va javob. */
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ chat?: string; client?: string }> }) {
  await requirePagePermission('customers.read');
  const sp = await searchParams;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <div><PageHeader title="Murojaatlar" /><Alert tone="warn">Serverda SUPABASE_SERVICE_ROLE_KEY sozlanmagan.</Alert></div>;
  }
  const db = getServiceSupabase();

  // Mijoz ID (client_no) boʻyicha suhbatni ochish
  if (sp.client && /^\d{1,9}$/.test(sp.client)) {
    const { data: p } = await db.from('profiles').select('id').eq('client_no', Number(sp.client)).maybeSingle();
    const { data: sub } = p ? await db.from('telegram_subscribers').select('chat_id').eq('user_id', p.id).eq('via', 'shop').limit(1).maybeSingle() : { data: null };
    redirect(sub ? `/admin/support?chat=${sub.chat_id}` : `/admin/support?notfound=${sp.client}`);
  }

  const { data: recent } = await db.from('support_messages').select('id, chat_id, user_id, direction, text, photo_file_id, read_at, created_at')
    .order('created_at', { ascending: false }).limit(600);
  const rows = (recent ?? []) as Msg[];
  const threads = new Map<number, { last: Msg; unread: number; userId: string | null }>();
  for (const m of rows) {
    const t = threads.get(m.chat_id) ?? { last: m, unread: 0, userId: m.user_id };
    if (m.direction === 'in' && !m.read_at) t.unread++;
    if (!t.userId && m.user_id) t.userId = m.user_id;
    threads.set(m.chat_id, t);
  }
  const chatParam = sp.chat && /^-?\d{1,18}$/.test(sp.chat) ? Number(sp.chat) : null;
  const chatIds = [...new Set([...threads.keys(), ...(chatParam ? [chatParam] : [])])];
  const [{ data: subs }] = await Promise.all([
    chatIds.length ? db.from('telegram_subscribers').select('chat_id, name, username, user_id').in('chat_id', chatIds) : Promise.resolve({ data: [] }),
  ]);
  const subBy = new Map((subs ?? []).map((s) => [Number(s.chat_id), s as { chat_id: number; name: string | null; username: string | null; user_id: string | null }]));
  const userIds = [...new Set([...[...threads.values()].map((t) => t.userId), ...(subs ?? []).map((s) => s.user_id as string | null)].filter((x): x is string => Boolean(x)))];
  const { data: profiles } = userIds.length ? await db.from('profiles').select('id, full_name, phone, client_no').in('id', userIds) : { data: [] };
  const profBy = new Map((profiles ?? []).map((p) => [p.id as string, p as { id: string; full_name: string | null; phone: string | null; client_no: number | null }]));
  const who = (chatId: number, userId?: string | null) => {
    const sub = subBy.get(chatId);
    const p = profBy.get(userId ?? sub?.user_id ?? '');
    return { name: p?.full_name || sub?.name || 'Mijoz', phone: p?.phone ? formatUzPhone(p.phone) : null, clientNo: p?.client_no ?? null, userId: p?.id ?? null, username: sub?.username ?? null };
  };

  const selected = chatParam ?? null;
  let thread: Msg[] = [];
  if (selected !== null) {
    const { data } = await db.from('support_messages').select('id, chat_id, user_id, direction, text, photo_file_id, read_at, created_at')
      .eq('chat_id', selected).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100);
    thread = ((data ?? []) as Msg[]).reverse();
    await db.from('support_messages').update({ read_at: new Date().toISOString() }).eq('chat_id', selected).eq('direction', 'in').is('read_at', null);
  }
  const list = [...threads.entries()].sort((a, b) => b[1].last.created_at.localeCompare(a[1].last.created_at));
  const person = selected !== null ? who(selected, threads.get(selected)?.userId) : null;
  const notFound = (sp as { notfound?: string }).notfound;

  return (
    <div>
      <PageHeader title="Murojaatlar" description="Mijozlar doʻkon botiga yozgan xabarlar. Javobingiz bot orqali mijozning Telegramiga boradi. Qaysi chatga xabar kelishini Xabarlar va Push → “Mijoz botga yozdi” da tanlaysiz." />
      <div className="mb-3"><ClientIdJump notFound={notFound ?? null} /></div>
      <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
        <ul className={cn('overflow-hidden rounded-xl border border-line bg-surface', selected !== null && 'hidden lg:block')}>
          {!list.length && <li className="p-8 text-center text-sm text-ink-3">Hali murojaat yoʻq</li>}
          {list.map(([chatId, t]) => {
            const w = who(chatId, t.userId);
            return (
              <li key={chatId} className="border-t border-line first:border-t-0">
                <Link href={`/admin/support?chat=${chatId}`} className={cn('flex items-start gap-3 px-4 py-3 hover:bg-surface-2', chatId === selected && 'bg-primary-soft/50')}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{w.name.charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{w.name}{w.clientNo ? <span className="font-normal text-ink-3"> · ID {w.clientNo}</span> : null}</span>
                      {t.unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-fg num">{t.unread}</span>}
                    </span>
                    <span className="block truncate text-xs text-ink-3">{t.last.direction === 'out' ? 'Siz: ' : ''}{t.last.text ?? (t.last.photo_file_id ? '📷 Rasm' : '')}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {selected !== null && person ? (
          <section className="flex flex-col rounded-xl border border-line bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <Link href="/admin/support" className="mb-1 inline-block text-xs text-ink-3 lg:hidden">← Murojaatlar</Link>
                <p className="truncate font-semibold">{person.name}{person.clientNo ? <span className="font-normal text-ink-3"> · ID {person.clientNo}</span> : null}</p>
                <p className="text-xs text-ink-3">{[person.phone, person.username ? `@${person.username}` : null].filter(Boolean).join(' · ') || 'Telegram'}</p>
              </div>
              {person.userId && <Link href={`/admin/customers/${person.userId}`} className="text-sm font-medium text-primary">Mijoz profili</Link>}
            </header>
            <div className="flex max-h-[60vh] min-h-[240px] flex-col gap-2 overflow-y-auto bg-surface-2/50 p-4">
              {!thread.length && <p className="m-auto text-sm text-ink-3">Hali xabar yoʻq — birinchi boʻlib yozing.</p>}
              {thread.map((m) => (
                <div key={m.id} className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm', m.direction === 'in' ? 'self-start rounded-tl-md bg-surface' : 'self-end rounded-tr-md bg-primary text-primary-fg')}>
                  {m.photo_file_id && (
                    <a href={`/api/admin/support-photo/${m.id}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/admin/support-photo/${m.id}`} alt="Rasm" className="mb-1 max-h-64 rounded-lg object-contain" />
                    </a>
                  )}
                  {m.text && <p className="whitespace-pre-line break-words">{m.text}</p>}
                  <p className={cn('mt-0.5 text-right text-[10px]', m.direction === 'in' ? 'text-ink-3' : 'text-primary-fg/75')}>{formatDateTime(m.created_at)}</p>
                </div>
              ))}
            </div>
            <SupportReply chatId={selected} />
          </section>
        ) : (
          <div className="hidden rounded-xl border border-dashed border-line p-10 text-center text-sm text-ink-3 lg:block">Chapdan suhbatni tanlang</div>
        )}
      </div>
    </div>
  );
}
