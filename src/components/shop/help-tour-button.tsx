'use client';

import { useL } from '@/components/providers';
import { useRouter } from 'next/navigation';
import { PlayCircle } from 'lucide-react';

/** Bosh sahifadagi yoʻl-yoʻriqni qayta koʻrsatish. */
export function HelpTourButton() {
  const L = useL();
  const router = useRouter();
  return (
    <button type="button" className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium shadow-soft hover:bg-surface-2"
      onClick={() => router.push('/?tour=1')}>
      <PlayCircle className="size-4 text-primary" aria-hidden /> {L("Yoʻl-yoʻriqni qayta koʻrish")}
    </button>
  );
}
