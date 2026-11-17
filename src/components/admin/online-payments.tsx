'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy, KeyRound } from 'lucide-react';
import { clearPaymentSecret, savePaymentProvider } from '@/lib/actions/admin/payments';
import type { PaymentKeyStatus } from '@/lib/payments/config';
import type { SiteSettings } from '@/lib/settings-schema';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { Field, Input } from '@/components/ui/field';
import { Panel } from './ui';
import { SwitchRow } from './growth-ui';
import { useSection, SaveBar } from './settings-editor';

function CopyLine({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">
      <span className="shrink-0 text-ink-3">{label}</span>
      <code className="min-w-0 flex-1 truncate">{value}</code>
      <button type="button" className="shrink-0 text-primary" onClick={() => { void navigator.clipboard?.writeText(value); toast('Nusxalandi'); }} aria-label="Nusxalash"><Copy className="h-4 w-4" /></button>
    </div>
  );
}

function SecretField({ label, has, value, onChange, onClear }: { label: string; has: boolean; value: string; onChange: (v: string) => void; onClear: () => void }) {
  return (
    <Field label={label} hint={has ? 'Kiritilgan. Almashtirish uchun yangisini yozing, boʻsh qoldirsangiz — eskisi qoladi' : 'Kabinetdan nusxalang. Hech kimga koʻrsatilmaydi'}>
      <div className="flex gap-2">
        <Input type="password" autoComplete="off" placeholder={has ? '•••••••• (saqlangan)' : ''} value={value} onChange={(e) => onChange(e.target.value)} />
        {has && <Button type="button" size="sm" variant="outline" onClick={onClear}>Oʻchirish</Button>}
      </div>
    </Field>
  );
}

/** Ega: Click va Payme kalitlari. Kalitlar brauzerga qaytmaydi — faqat “kiritilgan” belgisi. */
export function OnlinePaymentsPanel({ status, siteUrl, settings, isOwner }: { status: PaymentKeyStatus; siteUrl: string; settings: SiteSettings['online_payments']; isOwner: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [click, setClick] = useState({ enabled: status.click.enabled, service_id: status.click.service_id, merchant_id: status.click.merchant_id, merchant_user_id: status.click.merchant_user_id, secret_key: '' });
  const [payme, setPayme] = useState({ enabled: status.payme.enabled, merchant_id: status.payme.merchant_id, key: '', test_key: '', test_mode: status.payme.test_mode, account_field: status.payme.account_field });
  const opts = useSection('online_payments', settings);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const res = await fn();
    if (res.ok) { toast(res.message ?? 'Saqlandi'); router.refresh(); } else toast(res.error ?? 'Xatolik', 'error');
  });

  if (!isOwner) {
    return (
      <Panel title="Onlayn toʻlov (Click / Payme)">
        <p className="text-sm text-ink-3">Click: {status.click.ready ? 'ulangan ✓' : 'ulanmagan'} · Payme: {status.payme.ready ? 'ulangan ✓' : 'ulanmagan'}. Kalitlarni faqat Ega kiritadi.</p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title={<span className="flex items-center gap-2">Click {status.click.ready ? <Badge tone="success"><CheckCircle2 className="h-3.5 w-3.5" /> Ulangan</Badge> : <Badge>Ulanmagan</Badge>}</span>}
        subtitle="Click Business kabinetidagi (merchant.click.uz) maʼlumotlar">
        <SwitchRow label="Click orqali toʻlovni yoqish" hint="Yoqilsa checkout’da “Click” chiqadi va mijoz bir bosishda toʻlaydi" checked={click.enabled} onChange={(v) => setClick({ ...click, enabled: v })} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Service ID"><Input inputMode="numeric" value={click.service_id} onChange={(e) => setClick({ ...click, service_id: e.target.value })} /></Field>
          <Field label="Merchant ID"><Input inputMode="numeric" value={click.merchant_id} onChange={(e) => setClick({ ...click, merchant_id: e.target.value })} /></Field>
          <Field label="Merchant User ID" hint="Ixtiyoriy"><Input inputMode="numeric" value={click.merchant_user_id} onChange={(e) => setClick({ ...click, merchant_user_id: e.target.value })} /></Field>
          <SecretField label="Secret key" has={status.click.hasSecret} value={click.secret_key} onChange={(v) => setClick({ ...click, secret_key: v })} onClear={() => run(() => clearPaymentSecret('click', 'secret_key'))} />
        </div>
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-semibold text-ink-2">Click kabinetiga kiriting (Prepare va Complete URL — ikkalasi bir xil):</p>
          <CopyLine label="URL" value={`${siteUrl}/api/pay/click`} />
        </div>
        <div className="mt-4 flex justify-end"><Button loading={pending} onClick={() => run(() => savePaymentProvider('click', click))}><KeyRound className="h-4 w-4" /> Saqlash</Button></div>
      </Panel>

      <Panel title={<span className="flex items-center gap-2">Payme {status.payme.ready ? <Badge tone="success"><CheckCircle2 className="h-3.5 w-3.5" /> Ulangan</Badge> : <Badge>Ulanmagan</Badge>}{status.payme.test_mode && <Badge tone="warn">Test</Badge>}</span>}
        subtitle="Payme Business kabinetidagi (merchant.paycom.uz) maʼlumotlar">
        <SwitchRow label="Payme orqali toʻlovni yoqish" hint="Yoqilsa checkout’da “Payme” chiqadi" checked={payme.enabled} onChange={(v) => setPayme({ ...payme, enabled: v })} />
        <SwitchRow label="Test rejimi (sandbox)" hint="Payme tekshiruvi paytida yoqing, keyin oʻchiring — haqiqiy pul olinmaydi" checked={payme.test_mode} onChange={(v) => setPayme({ ...payme, test_mode: v })} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Merchant ID (Kassa ID)"><Input value={payme.merchant_id} onChange={(e) => setPayme({ ...payme, merchant_id: e.target.value })} /></Field>
          <Field label="Hisob maydoni" hint="Kabinetdagi “Rekvizit” nomi. Odatda order_id"><Input value={payme.account_field} onChange={(e) => setPayme({ ...payme, account_field: e.target.value })} /></Field>
          <SecretField label="Kalit (key)" has={status.payme.hasKey} value={payme.key} onChange={(v) => setPayme({ ...payme, key: v })} onClear={() => run(() => clearPaymentSecret('payme', 'key'))} />
          <SecretField label="Test kaliti (test key)" has={status.payme.hasTestKey} value={payme.test_key} onChange={(v) => setPayme({ ...payme, test_key: v })} onClear={() => run(() => clearPaymentSecret('payme', 'test_key'))} />
        </div>
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-semibold text-ink-2">Payme kabinetiga kiriting (Endpoint URL):</p>
          <CopyLine label="URL" value={`${siteUrl}/api/pay/payme`} />
          <p className="text-xs text-ink-3">Rekvizit: <b>{payme.account_field || 'order_id'}</b> — buyurtma raqami (masalan 100245).</p>
        </div>
        <div className="mt-4 flex justify-end"><Button loading={pending} onClick={() => run(() => savePaymentProvider('payme', payme))}><KeyRound className="h-4 w-4" /> Saqlash</Button></div>
      </Panel>

      <Panel title="Onlayn toʻlov qoidalari" className="xl:col-span-2">
        <SwitchRow label="Toʻlov tushganda buyurtmani avtomatik tasdiqlash" hint="Yangi buyurtma “Tasdiqlandi”ga oʻtadi va mijozga “Toʻlov tasdiqlandi” xabari boradi" checked={opts.value.auto_confirm} onChange={(v) => opts.setValue({ ...opts.value, auto_confirm: v })} />
        <SwitchRow label="Buyurtma berilishi bilan toʻlov sahifasini ochish" hint="Oʻchirsangiz, mijoz “Rahmat” sahifasida “Toʻlash” tugmasini bosadi" checked={opts.value.redirect_after_checkout} onChange={(v) => opts.setValue({ ...opts.value, redirect_after_checkout: v })} />
        <SaveBar pending={opts.pending} onSave={() => opts.save()} />
      </Panel>
    </div>
  );
}
