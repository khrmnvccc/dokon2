'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { saveSetting } from '@/lib/actions/admin/settings';
import type { SettingsKey, SiteSettings } from '@/lib/settings-schema';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { cn } from '@/components/ui/cn';
import { ICONS } from '@/components/shop/dynamic-icon';
import { SingleImageField } from './upload';
import { Panel } from './ui';

const TABS = [
  { id: 'store', label: 'Do‘kon va dizayn' },
  { id: 'contact', label: 'Aloqa va ijtimoiy tarmoqlar' },
  { id: 'home', label: 'Bosh sahifa' },
  { id: 'menu', label: 'Menyu va footer' },
  { id: 'checkout', label: 'Buyurtma' },
  { id: 'localization', label: 'Til va valyuta' },
  { id: 'seo', label: 'SEO' },
  { id: 'maintenance', label: 'Texnik rejim' },
] as const;

const SECTION_LABELS: Record<string, string> = {
  hero: 'Asosiy slayder', categories: 'Kategoriyalar', bestsellers: 'Xit mahsulotlar', promo: 'Aksiya bannerlari', new: 'Yangi mahsulotlar',
  sale: 'Chegirmadagilar', middle_banner: 'O‘rta banner', featured: 'Tavsiya etilganlar', advantages: 'Afzalliklar',
};

function useSection<K extends SettingsKey>(key: K, initial: SiteSettings[K]) {
  const [value, setValue] = useState<SiteSettings[K]>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const save = (v: SiteSettings[K] = value) =>
    start(async () => {
      const res = await saveSetting(key, v);
      if (res.ok) {
        setErrors({});
        toast(res.message ?? 'Saqlandi');
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast(res.error, 'error');
      }
    });
  return { value, setValue, errors, pending, save };
}

function SaveBar({ pending, onSave }: { pending: boolean; onSave: () => void }) {
  return <div className="mt-5 flex justify-end border-t border-line pt-4"><Button loading={pending} onClick={onSave}>Saqlash</Button></div>;
}

export function SettingsEditor({ initial }: { initial: SiteSettings }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('store');
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr] lg:items-start">
      <nav className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-2 lg:flex-col" aria-label="Sozlamalar bo‘limlari">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
            className={cn('shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium', tab === t.id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50')}>
            {t.label}
          </button>
        ))}
      </nav>
      <div>
        {tab === 'store' && <StoreTab initial={initial.store} />}
        {tab === 'contact' && <ContactTab contact={initial.contact} social={initial.social} />}
        {tab === 'home' && <HomeTab sections={initial.home_sections} advantages={initial.advantages} announcement={initial.announcement} />}
        {tab === 'menu' && <MenuTab menu={initial.header_menu} footer={initial.footer} />}
        {tab === 'checkout' && <CheckoutTab initial={initial.checkout} />}
        {tab === 'localization' && <LocalizationTab initial={initial.localization} />}
        {tab === 'seo' && <SeoTab initial={initial.seo} />}
        {tab === 'maintenance' && <MaintenanceTab initial={initial.maintenance} />}
      </div>
    </div>
  );
}

function StoreTab({ initial }: { initial: SiteSettings['store'] }) {
  const s = useSection('store', initial);
  const v = s.value;
  const set = (patch: Partial<typeof v>) => s.setValue({ ...v, ...patch });
  return (
    <Panel title="Do‘kon va dizayn">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Do‘kon nomi" error={s.errors.name}><Input value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Shior"><Input value={v.tagline} onChange={(e) => set({ tagline: e.target.value })} /></Field>
        <SingleImageField label="Logotip" folder="branding" aspect="aspect-[3/1]" value={v.logo_url} onChange={(url) => set({ logo_url: url })} />
        <SingleImageField label="Favicon (kvadrat, PNG)" folder="branding" value={v.favicon_url} onChange={(url) => set({ favicon_url: url })} />
        {(['primary_color', 'accent_color'] as const).map((k) => (
          <Field key={k} label={k === 'primary_color' ? 'Asosiy rang' : 'Urg‘u rangi (chegirma, tugmalar)'} error={s.errors[k]}>
            <div className="flex gap-2">
              <input type="color" value={v[k]} onChange={(e) => set({ [k]: e.target.value })} className="h-11 w-14 cursor-pointer rounded-lg border border-line" aria-label="Rang tanlash" />
              <Input value={v[k]} onChange={(e) => set({ [k]: e.target.value })} />
            </div>
          </Field>
        ))}
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm">
          Oldindan ko‘rish:
          <span className="rounded-lg px-4 py-2 font-semibold text-white" style={{ background: v.primary_color }}>Savatchaga</span>
          <span className="rounded-lg px-3 py-1 font-bold text-white" style={{ background: v.accent_color }}>−20%</span>
        </div>
      </div>
      <SaveBar pending={s.pending} onSave={() => s.save()} />
    </Panel>
  );
}

function ContactTab({ contact, social }: { contact: SiteSettings['contact']; social: SiteSettings['social'] }) {
  const c = useSection('contact', contact);
  const so = useSection('social', social);
  const cv = c.value;
  return (
    <div className="space-y-4">
      <Panel title="Aloqa ma’lumotlari">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefon"><Input value={cv.phone} onChange={(e) => c.setValue({ ...cv, phone: e.target.value })} placeholder="+998 71 200 00 00" /></Field>
          <Field label="Qo‘shimcha telefon"><Input value={cv.phone2 ?? ''} onChange={(e) => c.setValue({ ...cv, phone2: e.target.value || null })} /></Field>
          <Field label="Email"><Input value={cv.email} onChange={(e) => c.setValue({ ...cv, email: e.target.value })} /></Field>
          <Field label="Ish vaqti"><Input value={cv.working_hours} onChange={(e) => c.setValue({ ...cv, working_hours: e.target.value })} placeholder="Har kuni 9:00–21:00" /></Field>
          <Field label="Manzil" className="sm:col-span-2"><Input value={cv.address} onChange={(e) => c.setValue({ ...cv, address: e.target.value })} /></Field>
          <Field label="Xarita havolasi" className="sm:col-span-2"><Input value={cv.map_url ?? ''} onChange={(e) => c.setValue({ ...cv, map_url: e.target.value || null })} placeholder="https://yandex.uz/maps/…" /></Field>
        </div>
        <SaveBar pending={c.pending} onSave={() => c.save()} />
      </Panel>
      <Panel title="Ijtimoiy tarmoqlar">
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(so.value) as (keyof SiteSettings['social'])[]).map((k) => (
            <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}><Input value={so.value[k] ?? ''} onChange={(e) => so.setValue({ ...so.value, [k]: e.target.value || null })} placeholder="https://" /></Field>
          ))}
        </div>
        <SaveBar pending={so.pending} onSave={() => so.save()} />
      </Panel>
    </div>
  );
}

function moveItem<T>(list: T[], i: number, d: number) {
  const next = [...list];
  const j = i + d;
  if (j < 0 || j >= next.length) return list;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function HomeTab({ sections, advantages, announcement }: { sections: SiteSettings['home_sections']; advantages: SiteSettings['advantages']; announcement: SiteSettings['announcement'] }) {
  const hs = useSection('home_sections', sections);
  const adv = useSection('advantages', advantages);
  const ann = useSection('announcement', announcement);
  return (
    <div className="space-y-4">
      <Panel title="Bloklar tartibi va ko‘rinishi">
        <ul className="space-y-2">
          {hs.value.map((sec, i) => (
            <li key={sec.key} className="flex items-center gap-3 rounded-lg border border-line p-2.5">
              <div className="flex flex-col">
                <button type="button" onClick={() => hs.setValue(moveItem(hs.value, i, -1))} disabled={i === 0} className="disabled:opacity-30" aria-label="Yuqoriga"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => hs.setValue(moveItem(hs.value, i, 1))} disabled={i === hs.value.length - 1} className="disabled:opacity-30" aria-label="Pastga"><ArrowDown className="h-4 w-4" /></button>
              </div>
              <span className="w-40 shrink-0 text-sm font-medium">{SECTION_LABELS[sec.key]}</span>
              <Input value={sec.title} placeholder="Sarlavha (bo‘sh — standart)" onChange={(e) => hs.setValue(hs.value.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} className="h-9" />
              <Checkbox label="Ko‘rinadi" checked={sec.enabled} onChange={(e) => hs.setValue(hs.value.map((x, k) => (k === i ? { ...x, enabled: e.target.checked } : x)))} />
            </li>
          ))}
        </ul>
        <SaveBar pending={hs.pending} onSave={() => hs.save()} />
      </Panel>
      <Panel title="E’lon satri (sahifa tepasida)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Matn" className="sm:col-span-2"><Input value={ann.value.text} onChange={(e) => ann.setValue({ ...ann.value, text: e.target.value })} placeholder="Masalan: 500 000 so‘mdan yuqori buyurtmalarga bepul yetkazib berish" /></Field>
          <Field label="Havola"><Input value={ann.value.link ?? ''} onChange={(e) => ann.setValue({ ...ann.value, link: e.target.value || null })} /></Field>
          <div className="flex items-end pb-2"><Checkbox label="Ko‘rsatish" checked={ann.value.enabled} onChange={(e) => ann.setValue({ ...ann.value, enabled: e.target.checked })} /></div>
        </div>
        <SaveBar pending={ann.pending} onSave={() => ann.save()} />
      </Panel>
      <Panel title="Afzalliklar bloki" actions={<Button size="sm" variant="secondary" disabled={adv.value.length >= 8} onClick={() => adv.setValue([...adv.value, { icon: 'truck', title: '', text: '' }])}><Plus className="h-4 w-4" /> Qo‘shish</Button>}>
        <div className="space-y-2">
          {adv.value.map((a, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-line p-2.5 sm:grid-cols-[140px_1fr_1.5fr_auto]">
              <Select value={a.icon} onChange={(e) => adv.setValue(adv.value.map((x, k) => (k === i ? { ...x, icon: e.target.value } : x)))} aria-label="Ikonka" className="h-9">
                {Object.keys(ICONS).map((k) => <option key={k}>{k}</option>)}
              </Select>
              <Input className="h-9" value={a.title} placeholder="Sarlavha" onChange={(e) => adv.setValue(adv.value.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} />
              <Input className="h-9" value={a.text} placeholder="Matn" onChange={(e) => adv.setValue(adv.value.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} />
              <Button size="icon" variant="ghost" onClick={() => adv.setValue(adv.value.filter((_, k) => k !== i))} aria-label="O‘chirish"><Trash2 className="h-4 w-4 text-red-600" /></Button>
            </div>
          ))}
        </div>
        <SaveBar pending={adv.pending} onSave={() => adv.save()} />
      </Panel>
    </div>
  );
}

function LinksEditor({ links, onChange, max = 12 }: { links: { label: string; href: string }[]; onChange: (l: { label: string; href: string }[]) => void; max?: number }) {
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex gap-2">
          <div className="flex flex-col justify-center">
            <button type="button" onClick={() => onChange(moveItem(links, i, -1))} disabled={i === 0} className="disabled:opacity-30" aria-label="Yuqoriga"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => onChange(moveItem(links, i, 1))} disabled={i === links.length - 1} className="disabled:opacity-30" aria-label="Pastga"><ArrowDown className="h-3.5 w-3.5" /></button>
          </div>
          <Input className="h-9" value={l.label} placeholder="Nomi" onChange={(e) => onChange(links.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
          <Input className="h-9" value={l.href} placeholder="/sale yoki https://" onChange={(e) => onChange(links.map((x, k) => (k === i ? { ...x, href: e.target.value } : x)))} />
          <Button size="icon" variant="ghost" onClick={() => onChange(links.filter((_, k) => k !== i))} aria-label="O‘chirish"><Trash2 className="h-4 w-4 text-red-600" /></Button>
        </div>
      ))}
      {links.length < max && <Button size="sm" variant="secondary" onClick={() => onChange([...links, { label: '', href: '/' }])}><Plus className="h-4 w-4" /> Havola</Button>}
    </div>
  );
}

function MenuTab({ menu, footer }: { menu: SiteSettings['header_menu']; footer: SiteSettings['footer'] }) {
  const m = useSection('header_menu', menu);
  const f = useSection('footer', footer);
  const fv = f.value;
  return (
    <div className="space-y-4">
      <Panel title="Yuqori menyu (katalog tugmasi yonida)">
        <LinksEditor links={m.value} onChange={m.setValue} />
        <SaveBar pending={m.pending} onSave={() => m.save()} />
      </Panel>
      <Panel title="Footer">
        <div className="grid gap-4">
          <Field label="Do‘kon haqida qisqa matn"><Textarea rows={2} value={fv.about_text} onChange={(e) => f.setValue({ ...fv, about_text: e.target.value })} /></Field>
          <Field label="Mualliflik huquqi satri"><Input value={fv.copyright} onChange={(e) => f.setValue({ ...fv, copyright: e.target.value })} /></Field>
          {fv.columns.map((col, i) => (
            <div key={i} className="rounded-lg border border-line p-3">
              <div className="mb-2 flex gap-2">
                <Input className="h-9 font-semibold" value={col.title} placeholder="Ustun sarlavhasi" onChange={(e) => f.setValue({ ...fv, columns: fv.columns.map((c, k) => (k === i ? { ...c, title: e.target.value } : c)) })} />
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => f.setValue({ ...fv, columns: fv.columns.filter((_, k) => k !== i) })}>Ustunni o‘chirish</Button>
              </div>
              <LinksEditor max={10} links={col.links} onChange={(links) => f.setValue({ ...fv, columns: fv.columns.map((c, k) => (k === i ? { ...c, links } : c)) })} />
            </div>
          ))}
          {fv.columns.length < 5 && <Button variant="outline" size="sm" onClick={() => f.setValue({ ...fv, columns: [...fv.columns, { title: 'Yangi ustun', links: [] }] })}><Plus className="h-4 w-4" /> Ustun qo‘shish</Button>}
        </div>
        {Object.keys(f.errors).length > 0 && <p className="mt-3 text-xs text-red-600">Bo‘sh nom yoki havolalarni to‘ldiring.</p>}
        <SaveBar pending={f.pending} onSave={() => f.save()} />
      </Panel>
    </div>
  );
}

function CheckoutTab({ initial }: { initial: SiteSettings['checkout'] }) {
  const s = useSection('checkout', initial);
  const v = s.value;
  const num = (x: string) => Number(x.replace(/\D/g, '')) || 0;
  return (
    <Panel title="Buyurtma va yetkazib berish">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimal buyurtma summasi (so‘m)" hint="0 — cheklovsiz"><Input inputMode="numeric" value={v.min_order_amount} onChange={(e) => s.setValue({ ...v, min_order_amount: num(e.target.value) })} /></Field>
        <Field label="Bepul yetkazib berish chegarasi (so‘m)" hint="0 — o‘chiq. Yetkazish usulida alohida chegara bo‘lsa, o‘sha ustun"><Input inputMode="numeric" value={v.free_shipping_threshold} onChange={(e) => s.setValue({ ...v, free_shipping_threshold: num(e.target.value) })} /></Field>
        <Field label="Checkout’dagi eslatma" className="sm:col-span-2"><Input value={v.order_note} onChange={(e) => s.setValue({ ...v, order_note: e.target.value })} placeholder="Operator 15 daqiqa ichida qo‘ng‘iroq qiladi" /></Field>
        <Checkbox label="Ro‘yxatdan o‘tmasdan buyurtma berishga ruxsat" checked={v.allow_guest_checkout} onChange={(e) => s.setValue({ ...v, allow_guest_checkout: e.target.checked })} />
      </div>
      <p className="mt-4 text-xs text-muted">Yetkazib berish narxlari va to‘lov usullari “Yetkazish va to‘lov” bo‘limida.</p>
      <SaveBar pending={s.pending} onSave={() => s.save()} />
    </Panel>
  );
}

function LocalizationTab({ initial }: { initial: SiteSettings['localization'] }) {
  const s = useSection('localization', initial);
  const v = s.value;
  const toggleLang = (l: 'uz' | 'ru', on: boolean) => {
    const languages = on ? [...new Set([...v.languages, l])] : v.languages.filter((x) => x !== l);
    s.setValue({ ...v, languages, default_language: languages.includes(v.default_language) ? v.default_language : languages[0] ?? 'uz' });
  };
  return (
    <Panel title="Til va valyuta">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Sayt tillari</p>
          <Checkbox label="O‘zbekcha" checked={v.languages.includes('uz')} onChange={(e) => toggleLang('uz', e.target.checked)} />
          <Checkbox label="Русский" checked={v.languages.includes('ru')} onChange={(e) => toggleLang('ru', e.target.checked)} />
          {s.errors.languages && <p className="text-xs text-red-600">Kamida bitta til tanlang</p>}
          <p className="text-xs text-muted">Interfeys matnlari tarjima qilinadi. Mahsulot va sahifa matnlari kiritilgan tilda ko‘rinadi.</p>
        </div>
        <Field label="Asosiy til">
          <Select value={v.default_language} onChange={(e) => s.setValue({ ...v, default_language: e.target.value as 'uz' | 'ru' })}>
            {v.languages.map((l) => <option key={l} value={l}>{l === 'uz' ? 'O‘zbekcha' : 'Русский'}</option>)}
          </Select>
        </Field>
        <Field label="Valyuta kodi" error={s.errors.currency}><Input value={v.currency} maxLength={3} onChange={(e) => s.setValue({ ...v, currency: e.target.value.toUpperCase() })} /></Field>
        <Field label="Valyuta belgisi" error={s.errors.currency_symbol}><Input value={v.currency_symbol} onChange={(e) => s.setValue({ ...v, currency_symbol: e.target.value })} /></Field>
      </div>
      <SaveBar pending={s.pending} onSave={() => s.save()} />
    </Panel>
  );
}

function SeoTab({ initial }: { initial: SiteSettings['seo'] }) {
  const s = useSection('seo', initial);
  const v = s.value;
  return (
    <Panel title="SEO">
      <div className="grid gap-4">
        <Field label="Sayt sarlavhasi (bosh sahifa)" error={s.errors.title}><Input value={v.title} onChange={(e) => s.setValue({ ...v, title: e.target.value })} /></Field>
        <Field label="Sarlavha shabloni" hint="%s — sahifa nomi. Masalan: %s — Bozorcha"><Input value={v.title_template} onChange={(e) => s.setValue({ ...v, title_template: e.target.value })} /></Field>
        <Field label="Tavsif (meta description)"><Textarea rows={3} maxLength={300} value={v.description} onChange={(e) => s.setValue({ ...v, description: e.target.value })} /></Field>
        <Field label="Kalit so‘zlar"><Input value={v.keywords} onChange={(e) => s.setValue({ ...v, keywords: e.target.value })} /></Field>
        <SingleImageField label="Ijtimoiy tarmoqlar uchun rasm (OpenGraph, 1200×630)" folder="branding" aspect="aspect-[1200/630]" value={v.og_image_url} onChange={(url) => s.setValue({ ...v, og_image_url: url })} />
      </div>
      <SaveBar pending={s.pending} onSave={() => s.save()} />
    </Panel>
  );
}

function MaintenanceTab({ initial }: { initial: SiteSettings['maintenance'] }) {
  const s = useSection('maintenance', initial);
  return (
    <Panel title="Texnik xizmat rejimi">
      <div className="space-y-4">
        <Checkbox label="Yoqish — mijozlar saytni ko‘ra olmaydi (xodimlar ko‘radi)" checked={s.value.enabled} onChange={(e) => s.setValue({ ...s.value, enabled: e.target.checked })} />
        <Field label="Mijozlarga xabar"><Textarea rows={2} value={s.value.message} onChange={(e) => s.setValue({ ...s.value, message: e.target.value })} /></Field>
      </div>
      <SaveBar pending={s.pending} onSave={() => s.save()} />
    </Panel>
  );
}
