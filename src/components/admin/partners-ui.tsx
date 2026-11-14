'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Link2, MoreHorizontal, Plus, Snowflake, Sun, Wallet } from 'lucide-react';
import {
  addPartner, decideApplication, decidePayout, givePersonalCoupon, linkReferral, recordPayout, revokePersonalCoupon, unlinkReferral, updatePartner,
} from '@/lib/actions/admin/partners';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/dialog';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { formatPrice } from '@/lib/format';
import type { ActionResult } from '@/lib/types';

/** Server amalini bajaradi, natijani toast bilan koʻrsatadi va sahifani yangilaydi. */
function useAct() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      toast(res.ok ? res.message ?? 'Saqlandi' : res.error, res.ok ? 'success' : 'error');
      if (res.ok) { after?.(); router.refresh(); }
    });
  return { pending, run };
}

const num = (v: string) => Number(String(v).replace(/[^\d.]/g, '')) || 0;

// ---------- Hamkorlar ----------
export function PartnerActions({ userId, name, percent, status }: { userId: string; name: string; percent: number; status: string }) {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState(String(percent));
  const { pending, run } = useAct();
  const confirm = useConfirm();
  const frozen = status === 'frozen';
  return (
    <>
      <Button size="sm" variant="ghost" aria-label="Amallar" onClick={() => setOpen(true)}><MoreHorizontal className="size-4" /></Button>
      <Modal open={open} onClose={() => setOpen(false)} title={name} description="Hamkor foizi va holati">
        <div className="space-y-4">
          <Field label="Komissiya foizi (%)" hint="Doʻstlari “Yetkazildi” boʻlgan har bir buyurtmasidan (chegirmadan keyingi summa)">
            <div className="flex gap-2">
              <Input inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} className="max-w-32" />
              <Button loading={pending} disabled={Number(p) === percent} onClick={() => run(() => updatePartner(userId, { percent: Number(p) }), () => setOpen(false))}>Saqlash</Button>
            </div>
          </Field>
          <div className="border-t border-line pt-4">
            <Button variant={frozen ? 'primary' : 'outline'} loading={pending}
              onClick={async () => {
                if (!frozen && !(await confirm({ title: 'Hamkorni muzlatish?', text: 'Yangi buyurtmalardan foiz hisoblanmaydi. Avvalgi balansi saqlanadi.' }))) return;
                run(() => updatePartner(userId, { status: frozen ? 'active' : 'frozen' }), () => setOpen(false));
              }}>
              {frozen ? <><Sun className="size-4" /> Qayta yoqish</> : <><Snowflake className="size-4" /> Muzlatish</>}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function AddPartnerButton({ defaultPercent }: { defaultPercent: number }) {
  const [open, setOpen] = useState(false);
  const [no, setNo] = useState('');
  const [p, setP] = useState(String(defaultPercent));
  const { pending, run } = useAct();
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Hamkor qoʻshish</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Hamkor qoʻshish" description="Istalgan mijozni (masalan, bloger) bosqichlarsiz darhol hamkor qilish"
        footer={<Button loading={pending} disabled={!no} onClick={() => run(() => addPartner(num(no), Number(p)), () => { setOpen(false); setNo(''); })}>Hamkor qilish</Button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mijoz ID raqami" hint="Mijozlar roʻyxatidagi ID"><Input inputMode="numeric" value={no} onChange={(e) => setNo(e.target.value)} placeholder="1024" /></Field>
          <Field label="Foiz (%)"><Input inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} /></Field>
        </div>
      </Modal>
    </>
  );
}

// ---------- Arizalar ----------
export function ApplicationActions({ userId, percent }: { userId: string; percent: number }) {
  const [p, setP] = useState(String(percent));
  const { pending, run } = useAct();
  const confirm = useConfirm();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="flex items-center gap-1 text-xs text-ink-3">
        <Input inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} className="h-8 w-16 text-right" aria-label="Foiz" />%
      </label>
      <Button size="sm" loading={pending} onClick={() => run(() => decideApplication(userId, true, Number(p)))}>Qabul qilish</Button>
      <Button size="sm" variant="ghost" disabled={pending}
        onClick={async () => { if (await confirm({ title: 'Arizani rad etish?', danger: true })) run(() => decideApplication(userId, false)); }}>Rad etish</Button>
    </div>
  );
}

// ---------- Yechimlar ----------
export function PayoutActions({ id, amount, card }: { id: string; amount: number; card: string | null }) {
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<null | 'paid' | 'rejected'>(null);
  const { pending, run } = useAct();
  return (
    <>
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={() => setOpen('paid')}>Toʻlandi</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen('rejected')}>Rad etish</Button>
      </div>
      <Modal open={open !== null} onClose={() => setOpen(null)} title={open === 'paid' ? 'Toʻlov oʻtkazildimi?' : 'Soʻrovni rad etish'}
        description={`${formatPrice(amount)}${card ? ` · karta ${card}` : ''}`}
        footer={<Button variant={open === 'rejected' ? 'danger' : 'primary'} loading={pending}
          onClick={() => open && run(() => decidePayout(id, open, note), () => { setOpen(null); setNote(''); })}>
          {open === 'paid' ? 'Ha, toʻlandi' : 'Rad etish'}</Button>}>
        <Field label={open === 'rejected' ? 'Sabab (hamkorga koʻrinadi)' : 'Izoh (ixtiyoriy)'}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={open === 'paid' ? 'Masalan: Click orqali' : ''} />
        </Field>
      </Modal>
    </>
  );
}

export function RecordPayoutButton({ partners }: { partners: { id: string; label: string; free: number }[] }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const { pending, run } = useAct();
  const sel = partners.find((x) => x.id === who);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Wallet className="size-4" /> Toʻlovni qayd qilish</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Hamkorga toʻlov" description="Naqd yoki kartaga oʻtkazgan pulingizni hisobga yozing — balansdan ayriladi"
        footer={<Button loading={pending} disabled={!who || !amount} onClick={() => run(() => recordPayout(who, num(amount), note), () => { setOpen(false); setAmount(''); setNote(''); })}>Qayd qilish</Button>}>
        <div className="space-y-3">
          <Field label="Hamkor">
            <select value={who} onChange={(e) => setWho(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface-solid px-3 text-sm">
              <option value="">Tanlang…</option>
              {partners.map((x) => <option key={x.id} value={x.id}>{x.label} — {formatPrice(x.free)}</option>)}
            </select>
          </Field>
          <Field label="Summa (soʻm)" hint={sel ? `Mavjud: ${formatPrice(sel.free)}` : undefined}>
            <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Izoh"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
        </div>
      </Modal>
    </>
  );
}

// ---------- Atributsiya ----------
export function LinkReferralButton() {
  const [open, setOpen] = useState(false);
  const [friend, setFriend] = useState('');
  const [ref, setRef] = useState('');
  const { pending, run } = useAct();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Link2 className="size-4" /> Qoʻlda bogʻlash</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Kim olib kelganini belgilash" description="Masalan, mijoz havolasiz kelgan, lekin doʻsti tavsiya qilgan"
        footer={<Button loading={pending} disabled={!friend || !ref} onClick={() => run(() => linkReferral(num(friend), num(ref)), () => { setOpen(false); setFriend(''); setRef(''); })}>Bogʻlash</Button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Yangi mijoz ID"><Input inputMode="numeric" value={friend} onChange={(e) => setFriend(e.target.value)} /></Field>
          <Field label="Taklif qilgan mijoz ID"><Input inputMode="numeric" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        </div>
      </Modal>
    </>
  );
}

export function UnlinkButton({ friendId }: { friendId: string }) {
  const { pending, run } = useAct();
  const confirm = useConfirm();
  return (
    <Button size="sm" variant="ghost" loading={pending}
      onClick={async () => { if (await confirm({ title: 'Bogʻlanishni olib tashlash?', text: 'Bu mijoz uchun taklif qilganga mukofot berilmaydi.', danger: true })) run(() => unlinkReferral(friendId)); }}>
      Olib tashlash
    </Button>
  );
}

// ---------- Berilgan kuponlar ----------
export function GiftCouponButton() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ clientNo: '', amount: '20000', minOrder: '0', days: '30', note: '', send: true });
  const { pending, run } = useAct();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <>
      <Button onClick={() => setOpen(true)}><Gift className="size-4" /> Kupon berish</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Shaxsiy kupon berish" description="Faqat shu mijoz ishlata oladi — kod boshqaga oʻtsa ham ishlamaydi"
        footer={<Button loading={pending} disabled={!f.clientNo || !f.amount}
          onClick={() => run(() => givePersonalCoupon({ clientNo: num(f.clientNo), amount: num(f.amount), minOrder: num(f.minOrder), days: num(f.days), note: f.note, send: f.send }),
            () => { setOpen(false); setF((x) => ({ ...x, clientNo: '', note: '' })); })}>Berish</Button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mijoz ID"><Input inputMode="numeric" value={f.clientNo} onChange={set('clientNo')} placeholder="1024" /></Field>
          <Field label="Summa (soʻm)"><Input inputMode="numeric" value={f.amount} onChange={set('amount')} /></Field>
          <Field label="Minimal buyurtma (soʻm)" hint="0 — har qanday buyurtmaga"><Input inputMode="numeric" value={f.minOrder} onChange={set('minOrder')} /></Field>
          <Field label="Amal qilish muddati (kun)"><Input inputMode="numeric" value={f.days} onChange={set('days')} /></Field>
          <Field label="Izoh (mijozga koʻrinadi)" className="sm:col-span-2"><Input value={f.note} onChange={set('note')} maxLength={120} placeholder="Masalan: Uzr soʻrab — kechikkan buyurtma uchun" /></Field>
          <div className="sm:col-span-2"><Checkbox label="Mijozga botda yuborish" checked={f.send} onChange={set('send')} /></div>
        </div>
      </Modal>
    </>
  );
}

export function RevokeCouponButton({ id }: { id: string }) {
  const { pending, run } = useAct();
  const confirm = useConfirm();
  return (
    <Button size="sm" variant="ghost" loading={pending}
      onClick={async () => { if (await confirm({ title: 'Kuponni bekor qilish?', text: 'Mijoz uni endi ishlata olmaydi.', danger: true })) run(() => revokePersonalCoupon(id)); }}>
      Bekor qilish
    </Button>
  );
}
