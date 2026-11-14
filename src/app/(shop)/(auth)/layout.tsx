import { getL } from '@/lib/i18n/server';
import { ShieldCheck } from 'lucide-react';
import { getSettings } from '@/lib/data/public';
import { BrandMark } from '@/components/brand';

// Kassa 1.11: chap yarmi to'q panel (brend rangida radial dog'lar + 48px to'r chiziqlar), logo, nom va katta headline;
// o'ngda forma. Telefonda faqat forma.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const L = await getL();
  const { brand } = await getSettings();
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl lg:grid-cols-[1fr_480px] lg:border lg:border-line lg:bg-surface lg:shadow-soft">
      <div className="relative hidden overflow-hidden bg-[#0b0d10] lg:block">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--primary) 30%, transparent), transparent 40%), radial-gradient(circle at 80% 70%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 45%)' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative flex h-full min-h-[560px] flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-2.5">
            <BrandMark brand={brand} className="h-9 max-w-[96px]" />
            <span className="text-base font-semibold tracking-tight">{brand.name}</span>
          </div>
          <div className="max-w-md">
            <h2 className="text-[32px] font-semibold leading-[1.15] tracking-tight">{brand.headline}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/60">{L("Buyurtmalaringiz tarixi, sevimlilar va yetkazib berish manzillari bitta hisobda.")}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/50">
            <ShieldCheck className="size-4" /> {L("Himoyalangan kirish va rollar nazorati")}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center py-2 lg:px-10 lg:py-10">
        <div className="w-full max-w-md anim-rise">{children}</div>
      </div>
    </div>
  );
}
