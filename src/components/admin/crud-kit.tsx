'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { deleteEntity, reorderEntity, saveEntity, toggleEntity, type EntityName } from '@/lib/actions/admin/crud';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/dialog';

export function useCrud(name: EntityName) {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();

  return {
    pending,
    async save<T extends FieldValues>(id: string | null, data: unknown, setError?: UseFormSetError<T>) {
      const res = await saveEntity(name, id, data);
      if (!res.ok) {
        toast(res.error, 'error');
        if (setError) for (const [k, m] of Object.entries(res.fieldErrors ?? {})) setError(k as Path<T>, { message: m });
        return false;
      }
      toast(res.message ?? 'Saqlandi');
      router.refresh();
      return true;
    },
    async remove(id: string, title = 'O‘chirishni tasdiqlaysizmi?') {
      if (!(await confirm({ title, text: 'Bu amalni qaytarib bo‘lmaydi.', danger: true, confirmText: 'O‘chirish' }))) return;
      start(async () => {
        const res = await deleteEntity(name, id);
        toast(res.ok ? res.message ?? 'O‘chirildi' : res.error, res.ok ? 'success' : 'error');
        router.refresh();
      });
    },
    toggle(id: string, value: boolean, field: 'is_active' | 'is_published' = 'is_active') {
      start(async () => {
        const res = await toggleEntity(name, id, field, value);
        if (!res.ok) toast(res.error, 'error');
        router.refresh();
      });
    },
    reorder(ids: string[]) {
      start(async () => {
        const res = await reorderEntity(name as 'categories', ids);
        if (!res.ok) toast(res.error, 'error');
        router.refresh();
      });
    },
  };
}

export { Toggle } from '@/components/ui/kit';

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete?: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={onEdit} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Tahrirlash"><Pencil className="h-4 w-4" /></button>
      {onDelete && <button type="button" onClick={onDelete} className="rounded-lg p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger" aria-label="O‘chirish"><Trash2 className="h-4 w-4" /></button>}
    </div>
  );
}

export function MoveButtons<T extends { id: string }>({ list, index, onReorder }: { list: T[]; index: number; onReorder: (ids: string[]) => void }) {
  const move = (d: number) => {
    const ids = list.map((x) => x.id);
    const j = index + d;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    onReorder(ids);
  };
  return (
    <div className="flex gap-0.5">
      <button type="button" onClick={() => move(-1)} disabled={index === 0} className="rounded p-1 text-ink-3 hover:bg-surface-2 disabled:opacity-30" aria-label="Yuqoriga"><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => move(1)} disabled={index === list.length - 1} className="rounded p-1 text-ink-3 hover:bg-surface-2 disabled:opacity-30" aria-label="Pastga"><ArrowDown className="h-3.5 w-3.5" /></button>
    </div>
  );
}

/** datetime-local input qiymati (Toshkent vaqti) */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const tz = new Date(d.getTime() + 5 * 3600_000);
  return tz.toISOString().slice(0, 16);
}
