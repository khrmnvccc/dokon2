'use client';

import { useRouter } from 'next/navigation';
import { PlayCircle } from 'lucide-react';

/** Bosh sahifadagi yoʻl-yoʻriqni qayta koʻrsatish. */
export function HelpTourButton() {
  const router = useRouter();
  return (
    <button type="button" className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium shadow-soft hover:bg-surface-2"
      onClick={() => { try { localStorage.removeItem('dk_tour_shop'); } catch { /* */ } router.push('/'); }}>
      <PlayCircle className="size-4 text-primary" aria-hidden /> Yoʻl-yoʻriqni qayta koʻrish
    </button>
  );
}
