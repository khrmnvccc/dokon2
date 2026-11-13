'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Plus } from 'lucide-react';
import { saveSetting } from '@/lib/actions/admin/settings';
import { saveBranch } from '@/lib/actions/admin/branches';
import { ADMIN_NAV } from '@/lib/admin/nav';
import { LOCKED_PAGES } from '@/lib/admin/pages';
import type { SiteSettings } from '@/lib/settings-schema';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Badge } from '@/components/ui/misc';
import { Toggle } from '@/components/ui/kit';
import { Panel } from './ui';

type Pages = SiteSettings['pages'];

/** "Oynalar" (kassa 3.3): har oyna uchun — vaqtincha toʻxtatish, kim koʻradi, menyudagi nomi. */
export function PagesTab({ initial }: { initial: Pages }) {
  const [pages, setPages] = useState<Pages>(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const get = (href: string) => pages[href] ?? { paused: false, who: 'all' as const, label: '' };
  const set = (href: string, patch: Partial<Pages[string]>) => setPages((p) => ({ ...p, [href]: { ...get(href), ...patch } }));
  const save = () => start(async () => {
    // Standart holatdagi oynalarni saqlamaymiz — JSON ixcham qoladi.
    const clean = Object.fromEntries(Object.entries(pages).filter(([, c]) => c.paused || c.who !== 'all' || c.label.trim()));
    const res = await saveSetting('pages', clean);
    toast(res.ok ? 'Oynalar saqlandi' : res.error, res.ok ? 'success' : 'error');
    if (res.ok) router.refresh();
  });

  return (
    <Panel title="Oynalar" subtitle="Toʻxtatilgan oyna menyuda “Vaqtincha” belgisi bilan qoladi, lekin ochilmaydi. Siz (Ega) baribir ochasiz." padded={false}>
      <div className="divide-y divide-line">
        {ADMIN_NAV.map((g) => (
          <div key={g.title}>
            <div className="bg-surface-2 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{g.title}</div>
            {g.items.map((item) => {
              const c = get(item.href);
              const locked = LOCKED_PAGES.includes(item.href);
              return (
                <div key={item.href} className="grid items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 sm:grid-cols-[1fr_180px_170px_auto]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {item.label}
                      {locked && <Lock className="size-3.5 text-ink-3" aria-label="Qulflangan" />}
                      {c.paused && <Badge tone="warn">Vaqtincha</Badge>}
                    </div>
                    <div className="text-xs text-ink-3">{item.href}</div>
                  </div>
                  <Input aria-label={`${item.label}: menyudagi nomi`} placeholder={item.label} maxLength={30} value={c.label} onChange={(e) => set(item.href, { label: e.target.value })} />
                  <Select aria-label={`${item.label}: kim koʻradi`} disabled={locked} value={locked ? 'all' : c.who} onChange={(e) => set(item.href, { who: e.target.value as Pages[string]['who'] })}>
                    <option value="all">Ruxsati borlar</option>
                    <option value="admins">Faqat adminlar</option>
                    <option value="owner">Faqat Ega</option>
                  </Select>
                  <div className="flex items-center gap-2 text-sm text-ink-2">
                    <Toggle label={`${item.label}: ishlaydi`} disabled={locked} checked={locked || !c.paused} onChange={(on) => set(item.href, { paused: !on })} />
                    <span className="sm:hidden">Ishlaydi</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <p className="text-xs text-ink-3">“Sozlamalar” oynasi qulflangan — uni toʻxtatib yoki yashirib boʻlmaydi.</p>
        <Button loading={pending} onClick={save}>Saqlash</Button>
      </div>
    </Panel>
  );
}

export interface BranchRow { id: number; name: string; is_active: boolean }

/** "Filiallar" (kassa 3.4): qoʻshish, nomini oʻzgartirish, faolsizlantirish. */
export function BranchesTab({ initial }: { initial: BranchRow[] }) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (input: { id?: number; name: string; is_active: boolean }, done?: () => void) => start(async () => {
    const res = await saveBranch(input);
    toast(res.ok ? res.message ?? 'Saqlandi' : res.error, res.ok ? 'success' : 'error');
    if (res.ok) { done?.(); router.refresh(); }
  });

  return (
    <Panel title="Filiallar" subtitle="Sarlavhadagi tanlov orqali buyurtmalar va dashboard filial boʻyicha koʻrinadi. Xodimni filialga “Xodimlar” oynasida biriktirasiz." padded={false}>
      <div className="divide-y divide-line">
        {rows.map((b, i) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="num w-8 text-xs text-ink-3">#{b.id}</span>
            <Input className="min-w-0 flex-1" aria-label="Filial nomi" maxLength={60} value={b.name}
              onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Toggle label="Faol" disabled={b.id === 1} checked={b.is_active}
              onChange={(on) => setRows((r) => r.map((x, j) => (j === i ? { ...x, is_active: on } : x)))} />
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(b)}>Saqlash</Button>
          </div>
        ))}
      </div>
      <form className="flex gap-2 border-t border-line px-4 py-3" onSubmit={(e) => { e.preventDefault(); run({ name, is_active: true }, () => setName('')); }}>
        <Input aria-label="Yangi filial nomi" placeholder="Yangi filial nomi" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" loading={pending} disabled={!name.trim()}><Plus className="size-4" /> Qoʻshish</Button>
      </form>
    </Panel>
  );
}
