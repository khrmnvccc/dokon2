'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { saveReferralRules } from '@/lib/actions/admin/partners';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Toggle } from '@/components/ui/kit';
import { cn } from '@/components/ui/cn';
import { CouponCard } from '@/components/coupon/coupon-card';
import { COUPON_THEMES, COUPON_THEME_KEYS, couponCardProps, type CouponTheme } from '@/lib/coupon-design';
import { formatPrice } from '@/lib/format';
import type { ReferralSettings } from '@/lib/referral';
import { Panel } from './ui';

const n = (v: string) => Number(String(v).replace(/[^\d.]/g, '')) || 0;

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Marketing → Hamkorlar → Qoidalar: doʻst taklifi bosqichlari, sovgʻa kupon, hamkorlik shartlari. */
export function ReferralRulesForm({ initial }: { initial: ReferralSettings }) {
  const [s, setS] = useState<ReferralSettings>(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const patch = <K extends keyof ReferralSettings>(k: K, v: ReferralSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const setStep = (i: number, k: 'friends' | 'amount' | 'min_order', v: string) =>
    setS((x) => ({ ...x, steps: x.steps.map((st, j) => (j === i ? { ...st, [k]: n(v) } : st)) }));

  const save = () => start(async () => {
    const res = await saveReferralRules(s);
    toast(res.ok ? res.message ?? 'Saqlandi' : res.error, res.ok ? 'success' : 'error');
    if (res.ok) router.refresh();
  });

  const preview = s.steps[0];
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Panel title="Doʻstni taklif qilish" subtitle="Mijoz havolasini doʻstiga yuboradi; doʻsti xarid qilgach — mukofot oladi">
          <div className="divide-y divide-line">
            <Row label="Dastur yoqilgan" hint="Oʻchirilsa yangi doʻstlar bogʻlanmaydi va mukofot berilmaydi (berilgan kuponlar amal qiladi)">
              <Toggle checked={s.enabled} onChange={(v) => patch('enabled', v)} label="Dastur yoqilgan" />
            </Row>
            <Row label="Doʻst qachon “hisoblanadi”" hint="Doʻstning birinchi buyurtmasi shu holatga yetganda">
              <Select value={s.qualify_on} onChange={(e) => patch('qualify_on', e.target.value as ReferralSettings['qualify_on'])} className="w-44">
                <option value="delivered">Yetkazilganda</option>
                <option value="confirmed">Tasdiqlanganda</option>
              </Select>
            </Row>
            <Row label="Doʻst buyurtmasi kamida" hint="Kichik buyurtmalar bilan aldashning oldini oladi. 0 — har qanday">
              <Input inputMode="numeric" className="w-40 text-right" value={String(s.friend_min_order)} onChange={(e) => patch('friend_min_order', n(e.target.value))} />
            </Row>
            <Row label="Kupon amal qilish muddati (kun)" hint="Bosqich kuponlari uchun">
              <Input inputMode="numeric" className="w-24 text-right" value={String(s.coupon_days)} onChange={(e) => patch('coupon_days', n(e.target.value))} />
            </Row>
          </div>
        </Panel>

        <Panel title="Bosqichlar" subtitle="Nechta doʻst shartni bajarganda qancha kupon beriladi. Oxirgi bosqichdan keyin — hamkorlik"
          actions={s.steps.length < 10 && (
            <Button size="sm" variant="outline" onClick={() => {
              const last = s.steps[s.steps.length - 1];
              patch('steps', [...s.steps, { friends: (last?.friends ?? 0) + 1, amount: last?.amount ?? 10_000, min_order: last?.min_order ?? 100_000 }]);
            }}><Plus className="size-4" /> Bosqich</Button>
          )}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="text-left text-xs text-ink-3">
                <th className="py-2 pr-3 font-medium">#</th><th className="py-2 pr-3 font-medium">Doʻstlar soni</th>
                <th className="py-2 pr-3 font-medium">Kupon summasi</th><th className="py-2 pr-3 font-medium">Min. buyurtma</th><th />
              </tr></thead>
              <tbody>
                {s.steps.map((st, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-2 pr-3 font-semibold num">{i + 1}</td>
                    <td className="py-2 pr-3"><Input inputMode="numeric" className="h-9 w-24 text-right" value={String(st.friends)} onChange={(e) => setStep(i, 'friends', e.target.value)} /></td>
                    <td className="py-2 pr-3"><Input inputMode="numeric" className="h-9 w-36 text-right" value={String(st.amount)} onChange={(e) => setStep(i, 'amount', e.target.value)} /></td>
                    <td className="py-2 pr-3"><Input inputMode="numeric" className="h-9 w-36 text-right" value={String(st.min_order)} onChange={(e) => setStep(i, 'min_order', e.target.value)} /></td>
                    <td className="py-2 text-right">
                      {s.steps.length > 1 && (
                        <Button size="sm" variant="ghost" aria-label="Oʻchirish" onClick={() => patch('steps', s.steps.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[13px] text-ink-3">Jami: {formatPrice(s.steps.reduce((a, x) => a + x.amount, 0))} kupon {s.steps[s.steps.length - 1]?.friends} ta doʻst uchun.</p>
        </Panel>

        <Panel title="Taklif qilingan doʻstga sovgʻa" subtitle="Havola orqali kelgan yangi mijoz darhol kupon oladi">
          <div className="divide-y divide-line">
            <Row label="Sovgʻa kupon berish"><Toggle checked={s.welcome.enabled} onChange={(v) => patch('welcome', { ...s.welcome, enabled: v })} label="Sovgʻa kupon" /></Row>
            <div className={cn('grid gap-3 py-3 sm:grid-cols-3', !s.welcome.enabled && 'opacity-50')}>
              <Field label="Summa (soʻm)"><Input inputMode="numeric" value={String(s.welcome.amount)} onChange={(e) => patch('welcome', { ...s.welcome, amount: n(e.target.value) })} /></Field>
              <Field label="Min. buyurtma"><Input inputMode="numeric" value={String(s.welcome.min_order)} onChange={(e) => patch('welcome', { ...s.welcome, min_order: n(e.target.value) })} /></Field>
              <Field label="Muddati (kun)"><Input inputMode="numeric" value={String(s.welcome.days)} onChange={(e) => patch('welcome', { ...s.welcome, days: n(e.target.value) })} /></Field>
            </div>
          </div>
        </Panel>

        <Panel title="Hamkorlik" subtitle="Barcha bosqichni bajargan mijoz hamkor boʻladi va doʻstlari xaridlaridan foiz oladi">
          <div className="divide-y divide-line">
            <Row label="Hamkorlik yoqilgan"><Toggle checked={s.partner.enabled} onChange={(v) => patch('partner', { ...s.partner, enabled: v })} label="Hamkorlik" /></Row>
            <Row label="Avtomatik qabul" hint="Oʻchirilsa — mijoz ariza beradi, siz “Arizalar”da tasdiqlaysiz">
              <Toggle checked={s.partner.auto} onChange={(v) => patch('partner', { ...s.partner, auto: v })} label="Avtomatik qabul" />
            </Row>
            <div className={cn('grid gap-3 py-3 sm:grid-cols-3', !s.partner.enabled && 'opacity-50')}>
              <Field label="Komissiya (%)" hint="Yangi hamkorlar uchun"><Input inputMode="decimal" value={String(s.partner.percent)} onChange={(e) => patch('partner', { ...s.partner, percent: n(e.target.value) })} /></Field>
              <Field label="Tekshiruv muddati (kun)" hint="Qaytarish muddati — shundan keyin yechsa boʻladi"><Input inputMode="numeric" value={String(s.partner.hold_days)} onChange={(e) => patch('partner', { ...s.partner, hold_days: n(e.target.value) })} /></Field>
              <Field label="Minimal yechish (soʻm)"><Input inputMode="numeric" value={String(s.partner.min_payout)} onChange={(e) => patch('partner', { ...s.partner, min_payout: n(e.target.value) })} /></Field>
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Panel title="Kupon koʻrinishi" subtitle="Doʻst taklifi kuponlari shu dizaynda chiqadi">
          <div className="mb-3 flex flex-wrap gap-2">
            {COUPON_THEME_KEYS.map((k) => (
              <button key={k} type="button" onClick={() => patch('design', { ...s.design, theme: k as CouponTheme })} aria-pressed={s.design.theme === k} title={COUPON_THEMES[k].label}
                className={cn('size-9 rounded-full border-2 transition', s.design.theme === k ? 'border-ink scale-105' : 'border-transparent')}
                style={{ background: `linear-gradient(135deg, ${COUPON_THEMES[k].main[0]}, ${COUPON_THEMES[k].main[1]})` }} />
            ))}
          </div>
          <Field label="Chiptadagi qisqa yozuv" hint="Koʻpi bilan 6 belgi, masalan “DOʻST”">
            <Input value={s.design.badge} maxLength={6} onChange={(e) => patch('design', { ...s.design, badge: e.target.value })} />
          </Field>
          {preview && (
            <div className="mt-4">
              <CouponCard {...couponCardProps({ discount_type: 'fixed', value: preview.amount, ends_at: new Date(Date.now() + s.coupon_days * 86_400_000).toISOString(), min_order_amount: preview.min_order, design: s.design }, 'Kupon')} action="Olish" />
            </div>
          )}
        </Panel>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={!dirty || pending} onClick={() => setS(initial)}>Bekor qilish</Button>
          <Button loading={pending} disabled={!dirty} onClick={save}>Saqlash</Button>
        </div>
      </div>
    </div>
  );
}
