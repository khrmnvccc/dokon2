import Link from 'next/link';

/** Mijoz katagi: ID (qalin), ismi va telefoni; bosilsa — mijoz sahifasi. */
export function PersonCell({ id, clientNo, name, phone }: { id?: string | null; clientNo?: number | null; name?: string | null; phone?: string | null }) {
  const body = (
    <>
      <span className="font-mono font-semibold num">{clientNo ?? '—'}</span>
      <span className="text-ink-2"> · {name || phone || 'Mijoz'}</span>
      {name && phone && <span className="block text-xs text-ink-3 num">{phone}</span>}
    </>
  );
  return id ? <Link href={`/admin/customers/${id}`} className="hover:underline">{body}</Link> : <span>{body}</span>;
}
