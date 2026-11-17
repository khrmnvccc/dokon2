'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { Radio, Send } from 'lucide-react';
import type { SiteSettings } from '@/lib/settings-schema';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { postProductAction, testChannelAction } from '@/lib/actions/admin/channel';
import { Panel } from './ui';
import { SwitchRow } from './growth-ui';
import { SaveBar, useSection } from './settings-editor';

const PRODUCT_VARS = ['nomi', 'narx', 'eski_narx', 'chegirma', 'tavsif', 'havola', 'dokon'];
const FLASH_VARS = ['nomi', 'chegirma', 'tugash', 'tavsif', 'havola', 'dokon'];

export function ChannelSettings({ initial, canEdit, botName }: { initial: SiteSettings['channel_post']; canEdit: boolean; botName: string | null }) {
  const s = useSection('channel_post', initial);
  const v = s.value;
  const set = (p: Partial<typeof v>) => s.setValue({ ...v, ...p });
  const toast = useToast();
  const [testing, start] = useTransition();
  const valid = /^@[A-Za-z0-9_]{4,32}$|^-100\d{5,16}$/.test(v.chat);
  return (
    <div className="space-y-4">
      <Panel title="Kanal" subtitle={botName ? `Post ${botName} orqali chiqadi — botni kanalga admin qilib qoʻshing (“Xabar yuborish” huquqi bilan)` : 'Avval Telegram → Botlar boʻlimida doʻkon botini ulang'}>
        <SwitchRow label="Avtomatik postni yoqish" checked={v.enabled} onChange={(x) => set({ enabled: x })} disabled={!canEdit} />
        <div className="grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Kanal manzili" hint="@kanal_nomi yoki yopiq kanal uchun -100… raqami" error={v.chat && !valid ? 'Notoʻgʻri manzil' : undefined}>
            <Input value={v.chat} onChange={(e) => set({ chat: e.target.value.trim() })} placeholder="@mening_dokonim" />
          </Field>
          <Button variant="secondary" loading={testing} disabled={!valid} onClick={() => start(async () => {
            const r = await testChannelAction(v.chat);
            toast(r.ok ? r.message ?? 'Yuborildi' : r.error, r.ok ? undefined : 'error');
          })}><Radio className="size-4" />Sinab koʻrish</Button>
        </div>
        <SwitchRow label="Yangi mahsulot qoʻshilganda" hint="Mahsulot yaratilib, faol holatda saqlanganda bir marta chiqadi" checked={v.new_products} onChange={(x) => set({ new_products: x })} disabled={!canEdit} />
        <SwitchRow label="Flash sale boshlanganda" checked={v.flash_sales} onChange={(x) => set({ flash_sales: x })} disabled={!canEdit} />
      </Panel>
      <Panel title="Post matni" subtitle="*qalin*, {{oʻzgaruvchi}}. Boʻsh qolgan qatorlar avtomatik olib tashlanadi">
        <Field label="Yangi mahsulot" hint={PRODUCT_VARS.map((x) => `{{${x}}}`).join(' ')}>
          <Textarea rows={6} value={v.text} onChange={(e) => set({ text: e.target.value })} maxLength={900} />
        </Field>
        <Field label="Flash sale" hint={FLASH_VARS.map((x) => `{{${x}}}`).join(' ')} className="mt-3">
          <Textarea rows={5} value={v.flash_text} onChange={(e) => set({ flash_text: e.target.value })} maxLength={900} />
        </Field>
        <Field label="Tugma matni" hint="Boʻsh — tugmasiz" className="mt-3">
          <Input value={v.button} onChange={(e) => set({ button: e.target.value })} maxLength={30} />
        </Field>
        <p className="mt-3 text-xs text-ink-3">Mavjud mahsulotni qoʻlda chiqarish: <Link href="/admin/products" className="text-primary">mahsulot sahifasida</Link> “Kanalga yuborish” tugmasi.</p>
        {canEdit ? <SaveBar pending={s.pending} onSave={() => s.save()} /> : <p className="mt-3 text-xs text-ink-3">Oʻzgartirish uchun “Sozlamalar” ruxsati kerak.</p>}
      </Panel>
    </div>
  );
}

export function PostToChannelButton({ productId, postedAt }: { productId: string; postedAt: string | null }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => {
      if (postedAt && !window.confirm('Bu mahsulot kanalga allaqachon chiqqan. Yana yuborilsinmi?')) return;
      const r = await postProductAction(productId);
      toast(r.ok ? r.message ?? 'Yuborildi' : r.error, r.ok ? undefined : 'error');
    })}><Send className="size-4" />Kanalga yuborish</Button>
  );
}
