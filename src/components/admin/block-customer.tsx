'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setCustomerBlocked } from '@/lib/actions/admin/people';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export function BlockCustomer({ userId, blocked, reason }: { userId: string; blocked: boolean; reason: string | null }) {
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (value: boolean) =>
    start(async () => {
      const res = await setCustomerBlocked(userId, value, text);
      toast(res.ok ? res.message ?? 'Saqlandi' : res.error, res.ok ? 'success' : 'error');
      router.refresh();
    });
  if (blocked) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">Bloklangan{reason ? `: ${reason}` : ''}. Mijoz yangi buyurtma bera olmaydi va sharh qoldira olmaydi.</p>
        <Button variant="outline" loading={pending} onClick={() => run(false)}>Blokdan chiqarish</Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Field label="Sabab" htmlFor="block-reason"><Input id="block-reason" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Masalan: soxta buyurtmalar" /></Field>
      <Button variant="danger" loading={pending} onClick={() => run(true)}>Bloklash</Button>
    </div>
  );
}
