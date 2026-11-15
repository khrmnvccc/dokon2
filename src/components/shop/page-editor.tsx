'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp, useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { cn } from '@/components/ui/cn';
import { loadPageForEdit, savePageInline, type InlinePage } from '@/lib/actions/admin/page-inline';
import { useEditing } from './site-editor';

// Saytning oʻzida sahifa matnini tahrirlash (tahrir rejimida “Matnni tahrirlash”). Savol-javob sahifasida —
// savollar roʻyxati (qoʻshish, oʻchirish, tartib), boshqalarida — oddiy matn. Oʻzbekcha va ruscha alohida.

type Lang = 'uz' | 'ru';
interface QA { q: string; a: string }

/** "### Savol\nJavob" koʻrinishidagi matn → kirish matni + savol-javoblar. */
export function parseFaq(md: string): { intro: string; items: QA[] } {
  const parts = md.replace(/\r\n/g, '\n').split(/^###\s+/m);
  const intro = parts.shift()?.trim() ?? '';
  const items = parts.map((p) => { const [q, ...rest] = p.split('\n'); return { q: q.trim(), a: rest.join('\n').trim() }; }).filter((x) => x.q || x.a);
  return { intro, items };
}
export function buildFaq(intro: string, items: QA[]): string {
  const body = items.filter((x) => x.q.trim()).map((x) => `### ${x.q.trim()}\n${x.a.trim()}`).join('\n\n');
  return [intro.trim(), body].filter(Boolean).join('\n\n');
}

const INLINE_OFF = true;

export function PageEditButton({ slug, faq }: { slug: string; faq?: boolean }) {
  const L = useL();
  const { isStaff } = useApp();
  const editing = useEditing();
  const toast = useToast();
  const router = useRouter();
  const [data, setData] = useState<InlinePage | null>(null);
  const [lang, setLang] = useState<Lang>('uz');
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  // Qalam rejimida faqat oʻlchamlar qoladi (egasi talabi) — matn admin → Sahifalar boʻlimida tahrirlanadi.
  if (INLINE_OFF || !isStaff || !editing) return null;

  const open = async () => {
    setLoading(true);
    const res = await loadPageForEdit(slug);
    setLoading(false);
    if (!res.ok) { toast(res.error ?? L('Xatolik yuz berdi'), 'error'); return; }
    if (!res.data) return;
    setLang('uz');
    setData(res.data);
  };
  const cur = data?.[lang];
  const set = (p: Partial<InlinePage[Lang]>) => data && setData({ ...data, [lang]: { ...data[lang], ...p } });
  const faqData = cur ? parseFaq(cur.content) : { intro: '', items: [] };
  const setFaq = (intro: string, items: QA[]) => set({ content: buildFaq(intro, items) });

  const save = () => data && start(async () => {
    const res = await savePageInline(slug, data);
    if (!res.ok) { toast(res.error ?? L('Saqlanmadi'), 'error'); return; }
    toast(L('Saqlandi'));
    setData(null);
    router.refresh();
  });

  return (
    <>
      <button type="button" onClick={open} disabled={loading}
        className="anim-pop absolute right-2 top-2 z-20 inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-bg shadow-pop ring-2 ring-primary/70 transition hover:scale-105">
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}{L('Matnni tahrirlash')}
      </button>
      <Modal open={!!data} onClose={() => setData(null)} size="lg" title={faq ? L('Savol-javobni tahrirlash') : L('Matnni tahrirlash')}
        footer={<><Button variant="ghost" onClick={() => setData(null)}>{L('Bekor qilish')}</Button><Button loading={pending} onClick={save}>{L('Saqlash')}</Button></>}>
        {cur && (
          <div className="space-y-4">
            <div className="inline-flex rounded-full bg-surface-2 p-1" role="tablist">
              {(['uz', 'ru'] as const).map((l) => (
                <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)}
                  className={cn('h-8 rounded-full px-4 text-sm font-semibold transition', lang === l ? 'bg-[var(--panel)] text-ink shadow-soft' : 'text-ink-3')}>
                  {l === 'uz' ? 'Oʻzbekcha' : 'Русский'}
                </button>
              ))}
            </div>
            {lang === 'ru' && <p className="rounded-xl bg-primary-soft/60 px-3 py-2 text-[13px] text-ink-2">{L('Ruscha boʻsh qolsa, rus tilida oʻzbekchasi koʻrinadi.')}</p>}
            <Field label={L('Sarlavha')}><Input value={cur.title} onChange={(e) => set({ title: e.target.value })} placeholder={lang === 'ru' ? data!.uz.title : ''} /></Field>
            {faq ? (
              <div className="space-y-3">
                <Field label={L('Kirish matni (ixtiyoriy)')}><Textarea rows={2} value={faqData.intro} onChange={(e) => setFaq(e.target.value, faqData.items)} /></Field>
                {faqData.items.map((it, i) => (
                  <div key={i} className="rounded-2xl border border-line bg-surface-2/50 p-3">
                    <div className="mb-2 flex items-center gap-1">
                      <span className="flex-1 text-[12px] font-bold uppercase tracking-wide text-ink-3">{L('Savol')} {i + 1}</span>
                      <button type="button" disabled={i === 0} onClick={() => { const n = [...faqData.items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setFaq(faqData.intro, n); }} aria-label={L('Yuqoriga')} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-3 disabled:opacity-30"><ArrowUp className="size-4" /></button>
                      <button type="button" disabled={i === faqData.items.length - 1} onClick={() => { const n = [...faqData.items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setFaq(faqData.intro, n); }} aria-label={L('Pastga')} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-3 disabled:opacity-30"><ArrowDown className="size-4" /></button>
                      <button type="button" onClick={() => setFaq(faqData.intro, faqData.items.filter((_, k) => k !== i))} aria-label={L('Oʻchirish')} className="flex size-8 items-center justify-center rounded-full text-danger hover:bg-danger-soft"><Trash2 className="size-4" /></button>
                    </div>
                    <Input value={it.q} placeholder={L('Savol')} onChange={(e) => setFaq(faqData.intro, faqData.items.map((x, k) => (k === i ? { ...x, q: e.target.value.replace(/\n/g, ' ') } : x)))} />
                    <Textarea className="mt-2" rows={3} value={it.a} placeholder={L('Javob')} onChange={(e) => setFaq(faqData.intro, faqData.items.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)))} />
                  </div>
                ))}
                <Button variant="secondary" onClick={() => setFaq(faqData.intro, [...faqData.items, { q: lang === 'uz' ? 'Yangi savol' : 'Новый вопрос', a: '' }])}><Plus className="size-4" /> {L('Savol qoʻshish')}</Button>
              </div>
            ) : (
              <Field label={L('Matn')} hint={L('## — sarlavha, - roʻyxat, **qalin**')}>
                <Textarea rows={14} value={cur.content} onChange={(e) => set({ content: e.target.value })} placeholder={lang === 'ru' ? L('Ruscha matn…') : ''} />
              </Field>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
