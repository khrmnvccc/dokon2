'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { setStaffRole } from '@/lib/actions/admin/people';
import { ROLE_LABELS } from '@/lib/admin/nav';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Panel, Table } from './ui';

type Role = 'super_admin' | 'manager' | 'operator' | 'warehouse';

export function StaffManager({ staff, currentEmail }: { staff: { user_id: string; email: string | null; full_name: string | null; roles: string[] }[]; currentEmail: string | null }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('operator');
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const run = (input: { email: string; role: Role; grant: boolean }) => start(async () => {
    const res = await setStaffRole(input);
    toast(res.ok ? res.message ?? 'Bajarildi' : res.error, res.ok ? 'success' : 'error');
    if (res.ok) { setEmail(''); router.refresh(); }
  });
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px] xl:items-start">
      <Panel title={`Xodimlar (${staff.length})`} padded={false}>
        <Table>
          <thead><tr><th>Xodim</th><th>Rollar</th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.user_id}>
                <td><div className="font-medium">{s.full_name || '—'}</div><div className="text-xs text-muted">{s.email}{s.email === currentEmail && ' (siz)'}</div></td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {s.roles.map((r) => (
                      <span key={r} className="flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                        {ROLE_LABELS[r] ?? r}
                        {s.email && (
                          <button aria-label={`${ROLE_LABELS[r]} rolini olib tashlash`} disabled={pending} onClick={async () => {
                            if (await confirm({ title: `${s.email} dan “${ROLE_LABELS[r]}” rolini olish?`, danger: true, confirmText: 'Olib tashlash' })) run({ email: s.email!, role: r as Role, grant: false });
                          }}><X className="h-3 w-3" /></button>
                        )}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Panel title="Rol berish">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (role === 'super_admin' && !(await confirm({ title: 'Super admin rolini berish?', text: 'Super admin barcha sozlamalar, xodimlar va ma’lumotlarni boshqara oladi.', confirmText: 'Berish' }))) return;
          run({ email, role, grant: true });
        }}>
          <Field label="Foydalanuvchi emaili" htmlFor="staff-email"><Input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Rol" htmlFor="staff-role">
            <Select id="staff-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Button type="submit" className="w-full" loading={pending} disabled={!email}>Rol berish</Button>
        </form>
      </Panel>
    </div>
  );
}
