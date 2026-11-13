'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { setStaffAccess } from '@/lib/actions/admin/people';
import { PERM_GROUPS, PRESETS } from '@/lib/perms';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/field';
import { Toggle } from '@/components/ui/kit';
import { useToast } from '@/components/ui/toast';

export interface StaffRow {
  user_id: string; email: string | null; full_name: string | null; roles: string[];
  perms: string[] | null; branch_ids: number[] | null;
}

/**
 * Xodim ruxsatlari va filiallari (kassa 3.2, 3.4).
 * "Rol boʻyicha" yoqilgan boʻlsa — rolning standart ruxsatlari; oʻchirilsa — qoʻlda belgilangan roʻyxat.
 * Faqat oʻzingizda bor ruxsatlar faol; "Xabarlarni boshqarish"ni faqat Ega beradi (bazada ham tekshiriladi).
 */
export function StaffAccessButton({ row, myPerms, isOwner, branches, disabled }: {
  row: StaffRow; myPerms: string[]; isOwner: boolean; branches: { id: number; name: string }[]; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [byRole, setByRole] = useState(row.perms === null);
  const [perms, setPerms] = useState<Set<string>>(new Set(row.perms ?? []));
  const [branchIds, setBranchIds] = useState<Set<number>>(new Set(row.branch_ids ?? []));
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const mine = new Set(myPerms);

  const toggle = (k: string, on: boolean) => setPerms((s) => { const n = new Set(s); if (on) n.add(k); else n.delete(k); return n; });
  const toggleBranch = (id: number, on: boolean) => setBranchIds((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  const save = () => start(async () => {
    const res = await setStaffAccess({ userId: row.user_id, perms: byRole ? null : [...perms], branches: [...branchIds] });
    toast(res.ok ? res.message ?? 'Saqlandi' : res.error, res.ok ? 'success' : 'error');
    if (res.ok) { setOpen(false); router.refresh(); }
  });

  return (
    <>
      <Button variant="secondary" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" /> Ruxsatlar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={row.full_name || row.email || 'Xodim'}
        description="Har bir ruxsat alohida belgilanadi. Tayyor toʻplamni tanlab, keyin oʻzgartirish mumkin."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Bekor qilish</Button><Button loading={pending} onClick={save}>Saqlash</Button></>}>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 rounded-[var(--r-md)] bg-surface-2 px-3 py-2.5">
            <div>
              <div className="text-sm font-semibold">Rol boʻyicha standart</div>
              <div className="text-xs text-ink-3">Oʻchirsangiz, quyidagi roʻyxat ishlaydi</div>
            </div>
            <Toggle checked={byRole} onChange={setByRole} label="Rol boʻyicha standart" />
          </div>

          {!byRole && (
            <>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button key={p.key} size="sm" variant="secondary" onClick={() => setPerms(new Set(p.perms.filter((k) => mine.has(k))))}>{p.label}</Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setPerms(new Set())}>Tozalash</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {PERM_GROUPS.map((g) => (
                  <fieldset key={g.title} className="rounded-[var(--r-md)] border border-line p-3">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-3">{g.title}</legend>
                    <div className="space-y-2">
                      {g.perms.map((p) => {
                        const locked = !mine.has(p.key) || (p.ownerOnly && !isOwner);
                        return (
                          <div key={p.key}>
                            <Checkbox label={p.label} checked={perms.has(p.key)} disabled={locked} onChange={(e) => toggle(p.key, e.target.checked)} />
                            <div className="ml-[26px] text-xs text-ink-3">{p.hint}{locked && ' · sizda bu ruxsat yoʻq'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </>
          )}

          {branches.length > 1 && (
            <fieldset className="rounded-[var(--r-md)] border border-line p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-3">Filiallar</legend>
              <p className="mb-2 text-xs text-ink-3">Hech biri belgilanmasa — barcha filiallar.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {branches.map((b) => <Checkbox key={b.id} label={b.name} checked={branchIds.has(b.id)} onChange={(e) => toggleBranch(b.id, e.target.checked)} />)}
              </div>
            </fieldset>
          )}
        </div>
      </Modal>
    </>
  );
}
