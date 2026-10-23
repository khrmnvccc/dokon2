'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import { importProducts, type ImportReport } from '@/lib/actions/admin/import';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Panel } from './ui';

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const run = (dryRun: boolean) => {
    if (!file) return;
    const fd = new FormData();
    fd.set('file', file);
    if (dryRun) fd.set('dryRun', '1');
    start(async () => {
      const res = await importProducts(fd);
      if (!res.ok) return toast(res.error, 'error');
      setReport(res.data!);
      if (!dryRun) {
        toast(`Import tugadi: ${res.data!.created} ta yangi, ${res.data!.updated} ta yangilandi`);
        router.refresh();
      }
    });
  };

  return (
    <Panel title="Fayl yuklash">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center hover:border-brand">
        <FileSpreadsheet className="h-8 w-8 text-brand" />
        <span className="text-sm font-medium">{file ? file.name : '.csv yoki .xlsx faylni tanlang'}</span>
        <span className="text-xs text-muted">5 MB gacha, 5000 qatorgacha</span>
        <input type="file" accept=".csv,.xlsx" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); }} />
      </label>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" disabled={!file} loading={pending} onClick={() => run(true)}>Tekshirish</Button>
        <Button disabled={!file || !report?.dryRun} loading={pending} onClick={() => run(false)}>Import qilish</Button>
      </div>
      {report && (
        <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm">
          <p className="font-semibold">{report.dryRun ? 'Tekshiruv natijasi (hali saqlanmadi)' : 'Import natijasi'}</p>
          <p className="mt-1">Jami: {report.total} · Yangi: <b>{report.created}</b> · Yangilanadi: <b>{report.updated}</b> · Xato: <b className="text-red-600">{report.errors.length}</b></p>
          {report.errors.length > 0 && (
            <ul className="mt-3 max-h-64 space-y-1 overflow-auto text-xs text-red-700">
              {report.errors.slice(0, 200).map((e, i) => <li key={i}>{e.row}-qator: {e.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
