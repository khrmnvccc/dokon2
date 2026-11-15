'use client';

import { useRef, useState } from 'react';
import { Film, Loader2, Trash2, Upload } from 'lucide-react';
import type { SiteSettings } from '@/lib/settings-schema';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Panel } from './ui';
import { SaveBar, useSection } from './settings-editor';

type Help = SiteSettings['help_center'];
type VideoKey = keyof Help['videos'];
const VIDEO_LABELS: Record<VideoKey, string> = { order: 'Buyurtma holati', payment: 'Toʻlov muammosi', address: 'Manzil va ombor' };
const MAX = 50 * 1024 * 1024;

/** Video davomiyligi “1:33” koʻrinishida (fayldan oʻqiladi). */
function readDuration(file: File): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const t = Math.round(v.duration || 0);
      URL.revokeObjectURL(url);
      resolve(t ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : '');
    };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
    v.src = url;
  });
}

/** Sozlamalar → Yordam markazi: Telegram kartasi matnlari, telefon va tez mavzular videolari. */
export function HelpTab({ initial, contactPhone }: { initial: Help; contactPhone: string }) {
  const h = useSection('help_center', initial);
  const v = h.value;
  const set = (p: Partial<Help>) => h.setValue({ ...v, ...p });
  const setVideo = (k: VideoKey, p: Partial<Help['videos'][VideoKey]>) => set({ videos: { ...v.videos, [k]: { ...v.videos[k], ...p } } });
  return (
    <div className="space-y-4">
      <Panel title="Telegram kartasi" subtitle="Yordam markazining tepasidagi koʻk karta. “Telegramʼda yozish” doʻkon botini ochadi va mijozga “Savolingizni shu yerga yozing” deb chiqadi.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sarlavha"><Input value={v.support_title} onChange={(e) => set({ support_title: e.target.value })} /></Field>
          <Field label="Holat yozuvi"><Input value={v.status} onChange={(e) => set({ status: e.target.value })} placeholder="Onlayn · hozir javob beradi" /></Field>
          <Field label="Oʻrtacha javob vaqti"><Input value={v.reply_time} onChange={(e) => set({ reply_time: e.target.value })} placeholder="~2 daq" /></Field>
          <Field label="Ish vaqti"><Input value={v.hours} onChange={(e) => set({ hours: e.target.value })} placeholder="24 / 7" /></Field>
        </div>
      </Panel>
      <Panel title="Telefon orqali" subtitle={contactPhone ? `Boʻsh qoldirsangiz “Aloqa” boʻlimidagi raqam (${contactPhone}) chiqadi.` : 'Raqam kiritilmasa bu boʻlim koʻrinmaydi.'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefon raqami"><Input value={v.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+998 95 131 83 88" inputMode="tel" /></Field>
          <Field label="Qachon javob beriladi"><Input value={v.phone_hours} onChange={(e) => set({ phone_hours: e.target.value })} placeholder="Har kuni 9:30 – 18:00" /></Field>
        </div>
      </Panel>
      <Panel title="Tez mavzular videolari" subtitle="Video qoʻshsangiz, mavzu yonida ▶ 1:33 belgisi chiqadi va bosilganda video ochiladi. Fayl yuklang (50 MB gacha) yoki YouTube havolasini qoʻying.">
        <div className="space-y-4">
          {(Object.keys(VIDEO_LABELS) as VideoKey[]).map((k) => (
            <VideoRow key={k} label={VIDEO_LABELS[k]} value={v.videos[k]} onChange={(p) => setVideo(k, p)} />
          ))}
        </div>
      </Panel>
      <SaveBar pending={h.pending} onSave={() => h.save()} />
    </div>
  );
}

function VideoRow({ label, value, onChange }: { label: string; value: Help['videos'][VideoKey]; onChange: (p: Partial<Help['videos'][VideoKey]>) => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) { toast('MP4, WEBM yoki MOV video tanlang', 'error'); return; }
    if (file.size > MAX) { toast('Video 50 MB dan oshmasin', 'error'); return; }
    setBusy(true);
    try {
      const duration = await readDuration(file);
      const ext = file.type === 'video/quicktime' ? 'mov' : file.type.split('/')[1];
      const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
      const sb = getBrowserSupabase();
      const { error } = await sb.storage.from('help-videos').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
      if (error) throw new Error(error.message.includes('row-level security') ? 'Video yuklash uchun ruxsat yoʻq' : 'Videoni yuklab boʻlmadi');
      onChange({ url: sb.storage.from('help-videos').getPublicUrl(path).data.publicUrl, duration });
      toast('Video yuklandi — “Saqlash”ni bosing');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Film className="size-4 text-primary" /> {label}</div>
      <div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
        <Input value={value.url ?? ''} onChange={(e) => onChange({ url: e.target.value || null })} placeholder="https://youtu.be/… yoki fayl yuklang" aria-label={`${label} video havolasi`} />
        <Input value={value.duration} onChange={(e) => onChange({ duration: e.target.value })} placeholder="1:33" aria-label="Davomiyligi" />
        <div className="flex gap-2">
          <input ref={input} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <Button size="sm" variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Yuklash
          </Button>
          {value.url && <Button size="sm" variant="ghost" onClick={() => onChange({ url: null, duration: '' })} aria-label="Videoni olib tashlash"><Trash2 className="size-4" /></Button>}
        </div>
      </div>
    </div>
  );
}
