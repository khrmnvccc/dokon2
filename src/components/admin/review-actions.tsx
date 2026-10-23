'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { moderateReview } from '@/lib/actions/admin/people';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ReviewActions({ id, approved }: { id: string; approved: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const run = (a: 'approve' | 'hide' | 'delete') => start(async () => {
    const res = await moderateReview(id, a);
    toast(res.ok ? res.message ?? 'Bajarildi' : res.error, res.ok ? 'success' : 'error');
    router.refresh();
  });
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" loading={pending} onClick={() => run(approved ? 'hide' : 'approve')}>{approved ? 'Yashirish' : 'Ko‘rsatish'}</Button>
      <Button size="sm" variant="ghost" className="text-red-600" disabled={pending} onClick={async () => { if (await confirm({ title: 'Sharhni o‘chirish?', danger: true, confirmText: 'O‘chirish' })) run('delete'); }}>O‘chirish</Button>
    </div>
  );
}
