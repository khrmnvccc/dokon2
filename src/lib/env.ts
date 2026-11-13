// Ommaviy (brauzerga chiqadigan) muhit o'zgaruvchilari.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
/** Admin panelning alohida manzili (masalan https://dokon2-admin.vercel.app). Berilmasa — doʻkon manzili. */
export const ADMIN_URL = (process.env.NEXT_PUBLIC_ADMIN_URL || SITE_URL).replace(/\/$/, '');
export const ADMIN_HOST = (() => { try { return process.env.NEXT_PUBLIC_ADMIN_URL ? new URL(process.env.NEXT_PUBLIC_ADMIN_URL).host : ''; } catch { return ''; } })();
