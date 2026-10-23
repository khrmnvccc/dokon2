/** PostgREST .or() filtrlari uchun qidiruv matnini xavfsiz qilish */
export function likeTerm(q: string): string {
  return `%${q.replace(/[%_\\,()*]/g, ' ').trim().slice(0, 80)}%`;
}

export function pageParam(v: string | undefined) {
  return Math.max(1, Math.min(10_000, Number(v) || 1));
}

export function buildHref(base: string, params: Record<string, string | undefined | null>, patch: Record<string, string | number | null>) {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v !== null && v !== undefined && v !== '') merged[k] = String(v);
  const qs = new URLSearchParams(merged).toString();
  return qs ? `${base}?${qs}` : base;
}
