import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getRawSettings } from '@/lib/data/public';
import { formatPrice } from '@/lib/format';
import { notify, getTelegram } from '@/lib/telegram/server';
import { MONTHS, periodStats, sendDailyReport } from '@/lib/telegram/events';
import { lowStockList } from './stock';
import { tashkentNow } from './util';

// Avtomatik hisobotlar (Hisobotlar → Avtomatik hisobot): kunlik — belgilangan soatda,
// haftalik — dushanba, oylik — oyning 1-kuni. Har biri kuniga bir marta (app_meta 'report_state').

const db = () => getServiceSupabase();
const money = (n: number) => formatPrice(n, 'soʻm');
const DAY = 86_400_000;

type State = { daily?: string; weekly?: string; monthly?: string };
async function readState(): Promise<State> {
  const { data } = await db().from('app_meta').select('value').eq('key', 'report_state').maybeSingle();
  return (data?.value && typeof data.value === 'object' ? data.value : {}) as State;
}
async function writeState(s: State) {
  await db().from('app_meta').upsert({ key: 'report_state', value: s, updated_at: new Date().toISOString() });
}

/** Toshkent kuni boshlanishi (UTC sanasi). */
const dayStart = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - 5 * 3600_000);

const pct = (cur: number, prev: number) => {
  if (!prev) return cur ? 'yangi savdo' : '';
  const p = Math.round(((cur - prev) / prev) * 100);
  return `${p > 0 ? '+' : ''}${p}%`;
};

async function sendPeriod(store: string, label: string, start: Date, end: Date, prevStart: Date, topCount: number) {
  const [st, prev] = await Promise.all([periodStats(start, end, Math.max(topCount, 1)), periodStats(prevStart, start, 0)]);
  await notify('periodReport', {
    dokon: store, davr: label, jami: money(st.total), soni: st.count,
    ortacha: st.count ? money(Math.round(st.total / st.count)) : '', foyda: st.profit ? money(st.profit) : '',
    ozgarish: pct(st.total, prev.total), bekor: `${st.cancelled} ta`, top: topCount ? st.top.join('\n') : '',
  }, { personalOnly: true });
}

/** Kechki hisobot bugun hali yuborilmagan boʻlsa (va vaqti kelgan boʻlsa) — yuboradi. */
export async function dailyReportIfDue(force = false) {
  const settings = await getRawSettings();
  const cfg = settings.reports_auto;
  const t = tashkentNow();
  if (!cfg.daily || (!force && t.hour < cfg.daily_hour)) return false;
  const state = await readState();
  if (state.daily === t.date) return false;
  if (!(await getTelegram())?.chatId) return false;
  const low = settings.stock_alerts.in_daily_report ? await lowStockList(10) : { total: 0, lines: [] };
  if (low.total > low.lines.length) low.lines.push(`… jami ${low.total} ta`);
  const ok = await sendDailyReport(settings.brand.name || settings.store.name, { topCount: cfg.top_count, lowStock: low.lines });
  if (ok) await writeState({ ...(await readState()), daily: t.date });
  return ok;
}

export async function runScheduledReports() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { skipped: true };
  const out: Record<string, boolean> = {};
  out.daily = await dailyReportIfDue();
  const settings = await getRawSettings();
  const cfg = settings.reports_auto;
  const t = tashkentNow();
  if (t.hour < cfg.daily_hour || !(await getTelegram())?.chatId) return out;
  const store = settings.brand.name || settings.store.name;
  const state = await readState();
  const y = t.local.getUTCFullYear(); const m = t.local.getUTCMonth(); const d = t.local.getUTCDate();
  // Haftalik: dushanba kuni — oʻtgan hafta (dushanba–yakshanba)
  if (cfg.weekly && t.dow === 1 && state.weekly !== t.date) {
    const end = dayStart(y, m, d);
    const start = new Date(end.getTime() - 7 * DAY);
    const last = new Date(end.getTime() - DAY + 5 * 3600_000);
    const first = new Date(start.getTime() + 5 * 3600_000);
    await sendPeriod(store, `Hafta: ${first.getUTCDate()}-${MONTHS[first.getUTCMonth()]} — ${last.getUTCDate()}-${MONTHS[last.getUTCMonth()]}`, start, end, new Date(start.getTime() - 7 * DAY), cfg.top_count);
    state.weekly = t.date; out.weekly = true;
  }
  // Oylik: oyning 1-kuni — oʻtgan oy
  if (cfg.monthly && d === 1 && state.monthly !== t.date) {
    const end = dayStart(y, m, 1);
    const start = dayStart(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1);
    const prevStart = dayStart(m <= 1 ? y - 1 : y, (m + 10) % 12, 1);
    const lm = m === 0 ? 11 : m - 1;
    const name = MONTHS[lm];
    await sendPeriod(store, `${name[0].toUpperCase()}${name.slice(1)}, ${m === 0 ? y - 1 : y}`, start, end, prevStart, cfg.top_count);
    state.monthly = t.date; out.monthly = true;
  }
  if (out.weekly || out.monthly) await writeState({ ...(await readState()), weekly: state.weekly, monthly: state.monthly });
  return out;
}
