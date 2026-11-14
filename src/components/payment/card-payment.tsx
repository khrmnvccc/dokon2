'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock3, ImageUp, Loader2, XCircle } from 'lucide-react';
import { useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { formatPrice } from '@/lib/format';
import { RECEIPT_MAX_BYTES, type PaymentCard } from '@/lib/payment-card';
import { CardVisual } from './card-visual';

export interface CardPaymentData {
  orderId: string; total: number; status: string; paymentStatus: string; card: PaymentCard;
  receipts: { id: string; status: 'submitted' | 'approved' | 'rejected'; note: string | null; created_at: string }[];
}

/** Telefondagi katta rasmni 1600px gacha kichraytiradi (Vercel soʻrov chegarasi va tez yuklanishi uchun). */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Kartaga oʻtkazma: karta, summa va chek yuklash joyi; yuklangandan keyin holati. */
export function CardPayment({ data, token, symbol }: { data: CardPaymentData; token?: string; symbol: string }) {
  const L = useL();
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const last = data.receipts[0];
  const paid = data.paymentStatus === 'paid';
  const closed = data.status === 'cancelled' || data.status === 'returned';
  const pending = !paid && last?.status === 'submitted';
  const canUpload = !paid && !pending && !closed;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast(L('Faqat rasm yuklang (skrinshot yoki foto)'), 'error'); return; }
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      const blob = await shrink(file);
      if (blob.size > RECEIPT_MAX_BYTES) throw new Error(L('Rasm juda katta (4 MB gacha)'));
      const form = new FormData();
      form.set('file', blob, 'chek.jpg');
      if (token) form.set('token', token);
      const res = await fetch(`/api/orders/${data.orderId}/receipt`, { method: 'POST', body: form });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ? L(json.error) : L('Yuklab boʻlmadi. Qayta urinib koʻring'));
      toast(L('Chek yuborildi. Tekshirib, tasdiqlaymiz'));
      router.refresh();
    } catch (e) {
      setPreview(null);
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-soft sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight">{L('Kartaga toʻlov')}</h2>
        <p className="text-sm text-ink-3">{L('Summa')}: <b className="num text-base text-ink">{formatPrice(data.total, symbol)}</b></p>
      </div>
      <CardVisual card={data.card} copyLabel={L('Nusxalash')} copiedLabel={L('Nusxalandi')} className="mx-auto" />

      {paid ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="size-5 shrink-0" />
          <span className="font-medium">{L('Toʻlov tasdiqlandi. Buyurtmangizni joʻnatamiz')}</span>
        </div>
      ) : pending ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-warn/10 p-3 text-sm">
          <Clock3 className="size-5 shrink-0 text-warn" />
          <div>
            <p className="font-medium">{L('Chek tekshirilmoqda')}</p>
            <p className="text-xs text-ink-3">{L('Tasdiqlanishi bilan xabar beramiz')}</p>
          </div>
        </div>
      ) : closed ? null : (
        <>
          <ol className="mt-4 space-y-1 text-sm text-ink-2">
            <li>1. {L('Yuqoridagi kartaga summani oʻtkazing')}</li>
            <li>2. {L('Toʻlov chekining skrinshotini pastga yuklang')}</li>
          </ol>
          {last?.status === 'rejected' && (
            <div className="mt-3 flex items-start gap-3 rounded-xl bg-danger/10 p-3 text-sm">
              <XCircle className="mt-0.5 size-5 shrink-0 text-danger" />
              <div>
                <p className="font-medium text-danger">{L('Chek qabul qilinmadi')}</p>
                {last.note && <p className="text-ink-2">{last.note}</p>}
                <p className="text-xs text-ink-3">{L('Toʻgʻri chekni qayta yuklang')}</p>
              </div>
            </div>
          )}
        </>
      )}

      {canUpload && (
        <label className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-surface-2/60 px-4 py-6 text-center transition hover:border-primary hover:bg-primary-soft/40 ${busy ? 'pointer-events-none opacity-70' : ''}`}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-40 rounded-lg object-contain" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary"><ImageUp className="size-6" /></span>
          )}
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? L('Yuklanmoqda…') : L('Chekni yuklash')}
          </span>
          <span className="text-xs text-ink-3">{L('Skrinshot yoki foto · JPG, PNG')}</span>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" className="sr-only" disabled={busy}
            onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      )}
    </section>
  );
}
