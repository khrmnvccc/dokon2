'use client';

// Sozlamalar → "Brend va dizayn" (faqat Ega). Kassa src/pages/Settings.tsx BrandCard'dan aynan ko'chirilgan:
// o'zgartirgan zahoti butun sayt yangi ko'rinishda chiqadi, "Saqlash" bosilmaguncha boshqalarga ko'rinmaydi.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { BRAND_LIMITS, COLOR_PRESETS, DEFAULT_BRAND, MENU_GROUPS, EFFECTS, cleanBrand, type BrandSettings, type EffectName } from '@/lib/brand/config';
import { groupLabel, previewBrand, setBrand, useBrand } from '@/lib/brand/store';
import { saveSetting } from '@/lib/actions/admin/settings';
import { BrandMark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert, Card, Segmented } from '@/components/ui/kit';
import { useToast } from '@/components/ui/toast';

/** A picked logo, shrunk to at most 256 px so it stays small, as a PNG data URL. */
function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return reject(new Error('PNG, JPG yoki SVG rasm tanlang'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 256 / Math.max(img.width || 256, img.height || 256));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((img.width || 256) * scale));
      canvas.height = Math.max(1, Math.round((img.height || 256) * scale));
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const data = canvas.toDataURL('image/png');
      if (data.length > BRAND_LIMITS.logo) reject(new Error('Rasm juda katta. Kichikroq rasm tanlang'));
      else resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Rasm ochilmadi')); };
    img.src = url;
  });
}

const EFFECT_ICONS: Record<EffectName, string> = { none: '▫️', stars: '✨', snow: '❄️', sparks: '🔥', bubbles: '🫧', confetti: '🎉', petals: '🌸', glow: '🌈' };

/** Owner only: the site's name, main colour, logo, corners, moving background, sign-in text and menu section names. */
export function BrandCard() {
  const saved = useBrand();
  const toast = useToast();
  const router = useRouter();
  const [draft, setDraft] = useState<BrandSettings | null>(null);
  const b = draft ?? saved;
  const changed = draft !== null && JSON.stringify(cleanBrand(draft)) !== JSON.stringify(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const edit = (change: Partial<BrandSettings>) => setDraft((d) => ({ ...(d ?? saved), ...change }));

  // The page shows the new colour and corners while they are tried; leaving without saving puts the old ones back.
  useEffect(() => { previewBrand(draft ? cleanBrand(draft) : null); }, [draft]);
  useEffect(() => () => previewBrand(null), []);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await saveSetting('brand', cleanBrand(b));
      if (!res.ok) throw new Error(res.error);
      setBrand(b);
      setDraft(null);
      toast('Dizayn saqlandi', 'success', 'Hamma xaridor va xodimlarda sahifa ochilganda koʻrinadi.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pickLogo = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try { edit({ logo: await readLogo(f) }); } catch (e) { setError((e as Error).message); }
    if (file.current) file.current.value = '';
  };
  const custom = !COLOR_PRESETS.some((c) => c.value === b.color);

  return (
    <Card className="xl:col-span-2" padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">Brend va dizayn</h3>
          <p className="mt-0.5 text-[13px] text-ink-3">Sayt nomi, logotip, asosiy rang va koʻrinish. Oʻzgarishni darhol shu sahifada koʻrasiz, saqlaganingizdan keyin hammaga qoʻllanadi.</p>
        </div>
        <div className="flex gap-2">
          {changed && <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={busy}>Bekor</Button>}
          <Button size="sm" variant="primary" loading={busy} disabled={!changed} onClick={save}>Saqlash</Button>
        </div>
      </div>
      <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sayt nomi" htmlFor="br-name"><Input id="br-name" value={b.name} maxLength={BRAND_LIMITS.name} onChange={(e) => edit({ name: e.target.value })} placeholder={DEFAULT_BRAND.name} /></Field>
            <Field label="Nom ostidagi yozuv" htmlFor="br-tag" hint="Boʻsh qoldirsangiz koʻrinmaydi"><Input id="br-tag" value={b.tagline} maxLength={BRAND_LIMITS.tagline} onChange={(e) => edit({ tagline: e.target.value })} placeholder={DEFAULT_BRAND.tagline} /></Field>
          </div>

          <Field label="Logotip" hint="PNG, JPG yoki SVG. Kvadrat yoki yotiq rasm yaxshi koʻrinadi">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-14 w-24 items-center justify-center rounded-lg border border-line bg-surface-2 p-2"><BrandMark brand={b} className="max-h-10 w-auto max-w-20" /></span>
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
              <Button size="sm" onClick={() => file.current?.click()}>Rasm tanlash</Button>
              {b.logo && <Button size="sm" variant="ghost" onClick={() => edit({ logo: null })}>Standart belgini qaytarish</Button>}
            </div>
          </Field>

          <Field label="Asosiy rang" hint="Tugmalar, havolalar va tanlangan menyu shu rangda boʻladi">
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((c) => (
                <button key={c.value} type="button" title={c.label} aria-label={c.label} aria-pressed={b.color === c.value} onClick={() => edit({ color: c.value })}
                  className={`size-9 rounded-full border border-line transition-transform hover:scale-105 ${b.color === c.value ? 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--bg)]' : ''}`} style={{ background: c.value }} />
              ))}
              <label title="Boshqa rang" className={`relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-line-strong text-ink-3 ${custom ? 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--bg)]' : ''}`} style={custom ? { background: b.color } : undefined}>
                {!custom && <Plus className="size-4" />}
                <input type="color" aria-label="Boshqa rang" value={b.color} onChange={(e) => edit({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
            </div>
          </Field>

          <Field label="Burchaklar">
            <Segmented value={b.corners} onChange={(v) => edit({ corners: v })} options={[{ value: 'sharp', label: 'Tik' }, { value: 'soft', label: 'Oddiy' }, { value: 'round', label: 'Yumaloq' }]} />
          </Field>

          <Field label="Harakatlanuvchi fon" hint="Sahifa orqasida yengil harakat. Telefonida “kamroq harakat” yoqilgan xodimda chiqmaydi">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {EFFECTS.map((e) => (
                <button key={e.value} type="button" aria-pressed={b.effect === e.value} onClick={() => edit({ effect: e.value })}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${b.effect === e.value ? 'border-primary bg-primary-soft text-ink' : 'border-line bg-surface-2 text-ink-2 hover:bg-surface-3'}`}>
                  <span aria-hidden="true" className="text-base leading-none">{EFFECT_ICONS[e.value]}</span>{e.label}
                </button>
              ))}
            </div>
            {b.effect !== 'none' && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Segmented value={b.effectAmount} onChange={(v) => edit({ effectAmount: v })} options={[{ value: 'low', label: 'Kam' }, { value: 'mid', label: 'Oʻrtacha' }, { value: 'high', label: 'Koʻp' }]} />
                <Segmented value={b.effectWhere} onChange={(v) => edit({ effectWhere: v })} options={[{ value: 'all', label: 'Hamma sahifada' }, { value: 'login', label: 'Faqat kirish sahifasida' }]} />
                <Segmented value={b.effectLayer} onChange={(v) => edit({ effectLayer: v })} options={[{ value: 'front', label: 'Sahifa ustida' }, { value: 'back', label: 'Faqat orqa fonda' }]} />
              </div>
            )}
          </Field>

          <Field label="Kirish sahifasidagi katta yozuv" htmlFor="br-head">
            <Input id="br-head" value={b.headline} maxLength={BRAND_LIMITS.headline} onChange={(e) => edit({ headline: e.target.value })} placeholder={DEFAULT_BRAND.headline} />
          </Field>

          <Field label="Menyu boʻlimlari nomi" hint="Har bir oynaning nomini pastdagi Oynalar boʻlimida oʻzgartirasiz">
            <div className="grid gap-2 sm:grid-cols-3">
              {MENU_GROUPS.map((g) => (
                <Input key={g} aria-label={`${g} boʻlimi nomi`} value={b.groups[g] ?? ''} placeholder={g} maxLength={BRAND_LIMITS.group}
                  onChange={(e) => edit({ groups: { ...b.groups, [g]: e.target.value } })} />
              ))}
            </div>
          </Field>
          {JSON.stringify(cleanBrand(b)) !== JSON.stringify(DEFAULT_BRAND) && <Button size="sm" variant="ghost" onClick={() => setDraft({ ...DEFAULT_BRAND })}>Asl dizaynga qaytarish</Button>}
        </div>

        {/* How the menu and a button look with these settings. */}
        <div className="self-start rounded-xl border border-line bg-[var(--bg)] p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Koʻrinishi</div>
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2.5">
              <BrandMark brand={b} className="h-7 w-auto max-w-[64px] shrink-0" />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[15px] font-semibold tracking-tight text-ink">{b.name || DEFAULT_BRAND.name}</div>
                {b.tagline && <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{b.tagline}</div>}
              </div>
            </div>
            <div className="mt-4 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{groupLabel(b, 'Asosiy')}</div>
            <div className="mt-1.5 rounded-lg bg-surface-3 px-3 py-2 text-sm font-medium text-ink">Dashboard</div>
            <div className="px-3 py-2 text-sm font-medium text-ink-2">Buyurtmalar</div>
            <div className="mt-3"><Button variant="primary" className="w-full" icon={<Plus className="size-4" />}>Yangi mahsulot</Button></div>
            <div className="mt-3 text-sm text-primary">Havola shunday koʻrinadi</div>
          </div>
        </div>
      </div>
      {error && <div className="px-5 pb-4"><Alert>{error}</Alert></div>}
    </Card>
  );
}

