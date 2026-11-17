import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getRawSettings } from '@/lib/data/public';
import { getPaymentKeys, type PaymentKeys } from './config';

// Click (SHOP API) va Payme (Merchant API) serverdan-serverga soʻrovlari.
// Buyurtma raqami (number) — Click'da merchant_trans_id, Payme'da account.<maydon>.

const db = () => getServiceSupabase();
const TIMEOUT_MS = 43_200_000; // Payme: 12 soat

interface OrderLite { id: string; number: number; total: number; status: string; payment_status: string; payment_method_id: string | null }

async function orderByNumber(raw: unknown): Promise<OrderLite | null> {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  const { data } = await db().from('orders').select('id, number, total, status, payment_status, payment_method_id').eq('number', n).maybeSingle();
  return data ? { ...data, total: Number(data.total) } as OrderLite : null;
}

const closed = (o: OrderLite) => o.status === 'cancelled' || o.status === 'returned';

interface TxRow {
  id: string; provider: string; ext_id: string; order_id: string; amount: number; state: number; reason: number | null;
  create_time: number; perform_time: number; cancel_time: number; payload: Record<string, unknown> | null;
}
async function txByExt(provider: 'click' | 'payme', extId: string) {
  const { data } = await db().from('payment_transactions').select('*').eq('provider', provider).eq('ext_id', extId).maybeSingle();
  return data ? { ...data, amount: Number(data.amount), create_time: Number(data.create_time), perform_time: Number(data.perform_time), cancel_time: Number(data.cancel_time) } as TxRow : null;
}
async function updateTx(id: string, patch: Partial<TxRow>) {
  const { error } = await db().from('payment_transactions').update(patch).eq('id', id);
  if (error) throw error;
}

/** Toʻlov tushdi: buyurtmani “toʻlandi” qiladi. true — holat oʻzgardi (xabarlar yuborish kerak). */
async function markPaid(orderId: string, provider: 'click' | 'payme') {
  const settings = await getRawSettings();
  const { data, error } = await db().rpc('_online_payment_paid', { p_order: orderId, p_provider: provider, p_auto_confirm: settings.online_payments.auto_confirm });
  if (error) throw error;
  return data === true;
}

export type PaidHook = (orderId: string, provider: 'click' | 'payme') => void;

// =====================================================================
// Payme (JSON-RPC 2.0)
// =====================================================================
const MSG = (uz: string, ru: string, en = uz) => ({ uz, ru, en });
const PAYME_ERR = {
  auth: { code: -32504, message: MSG('Ruxsat yoʻq', 'Недостаточно привилегий', 'Insufficient privileges') },
  method: { code: -32601, message: MSG('Metod topilmadi', 'Метод не найден', 'Method not found') },
  parse: { code: -32700, message: MSG('Soʻrov notoʻgʻri', 'Ошибка разбора', 'Parse error') },
  amount: { code: -31001, message: MSG('Summa notoʻgʻri', 'Неверная сумма', 'Invalid amount') },
  notFound: { code: -31003, message: MSG('Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found') },
  cantCancel: { code: -31007, message: MSG('Buyurtma yetkazilgan, bekor qilib boʻlmaydi', 'Заказ доставлен, отмена невозможна', 'Cannot cancel') },
  cantPerform: { code: -31008, message: MSG('Amalni bajarib boʻlmaydi', 'Невозможно выполнить операцию', 'Cannot perform') },
  order: { code: -31050, message: MSG('Buyurtma topilmadi', 'Заказ не найден', 'Order not found') },
  paid: { code: -31051, message: MSG('Buyurtma allaqachon toʻlangan yoki bekor qilingan', 'Заказ уже оплачен или отменён', 'Order already paid or cancelled') },
  busy: { code: -31052, message: MSG('Buyurtma boʻyicha boshqa toʻlov kutilmoqda', 'Заказ ожидает другую оплату', 'Order is awaiting another payment') },
};
type PaymeError = (typeof PAYME_ERR)[keyof typeof PAYME_ERR];

function paymeAuthorized(keys: PaymentKeys, header: string | null) {
  const key = keys.payme.test_mode ? keys.payme.test_key : keys.payme.key;
  if (!keys.payme.enabled || !key || !header?.startsWith('Basic ')) return false;
  const got = Buffer.from(header.slice(6).trim(), 'base64').toString();
  const want = `Paycom:${key}`;
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function handlePayme(request: Request, onPaid: PaidHook): Promise<unknown> {
  const body = (await request.json().catch(() => null)) as { id?: unknown; method?: string; params?: Record<string, unknown> } | null;
  const id = body?.id ?? null;
  const fail = (e: PaymeError, data?: string) => ({ jsonrpc: '2.0', id, error: { ...e, data } });
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  const keys = await getPaymentKeys();
  if (!paymeAuthorized(keys, request.headers.get('authorization'))) return fail(PAYME_ERR.auth);
  if (!body || typeof body.method !== 'string') return fail(PAYME_ERR.parse);
  const p = body.params ?? {};
  const field = keys.payme.account_field;

  const validate = async (): Promise<{ error: PaymeError; data?: string } | { order: OrderLite }> => {
    const account = (p.account ?? {}) as Record<string, unknown>;
    const order = await orderByNumber(account[field]);
    if (!order) return { error: PAYME_ERR.order, data: field };
    if (order.payment_status === 'paid' || closed(order)) return { error: PAYME_ERR.paid, data: field };
    if (Number(p.amount) !== Math.round(order.total * 100)) return { error: PAYME_ERR.amount };
    return { order };
  };
  const view = (t: TxRow) => ({ transaction: t.id, state: t.state });

  switch (body.method) {
    case 'CheckPerformTransaction': {
      const v = await validate();
      if ('error' in v) return fail(v.error, v.data);
      return ok({ allow: true });
    }
    case 'CreateTransaction': {
      const extId = String(p.id ?? '');
      const existing = await txByExt('payme', extId);
      if (existing) {
        if (existing.state !== 1) return fail(PAYME_ERR.cantPerform);
        if (Date.now() - existing.create_time > TIMEOUT_MS) {
          await updateTx(existing.id, { state: -1, reason: 4, cancel_time: Date.now() });
          return fail(PAYME_ERR.cantPerform);
        }
        return ok({ create_time: existing.create_time, ...view(existing) });
      }
      const v = await validate();
      if ('error' in v) return fail(v.error, v.data);
      const { count } = await db().from('payment_transactions').select('id', { count: 'exact', head: true })
        .eq('provider', 'payme').eq('order_id', v.order.id).eq('state', 1).gt('create_time', Date.now() - TIMEOUT_MS);
      if ((count ?? 0) > 0) return fail(PAYME_ERR.busy, field);
      const now = Date.now();
      const { data, error } = await db().from('payment_transactions').insert({
        provider: 'payme', ext_id: extId, order_id: v.order.id, amount: v.order.total, state: 1, create_time: now,
        payload: { time: Number(p.time) || now, account: p.account ?? {} },
      }).select('*').single();
      if (error || !data) throw error ?? new Error('insert');
      return ok({ create_time: now, transaction: data.id, state: 1 });
    }
    case 'PerformTransaction': {
      const t = await txByExt('payme', String(p.id ?? ''));
      if (!t) return fail(PAYME_ERR.notFound);
      if (t.state === 2) return ok({ perform_time: t.perform_time, ...view(t) });
      if (t.state !== 1) return fail(PAYME_ERR.cantPerform);
      if (Date.now() - t.create_time > TIMEOUT_MS) {
        await updateTx(t.id, { state: -1, reason: 4, cancel_time: Date.now() });
        return fail(PAYME_ERR.cantPerform);
      }
      const now = Date.now();
      if (await markPaid(t.order_id, 'payme')) onPaid(t.order_id, 'payme');
      await updateTx(t.id, { state: 2, perform_time: now });
      return ok({ perform_time: now, transaction: t.id, state: 2 });
    }
    case 'CancelTransaction': {
      const t = await txByExt('payme', String(p.id ?? ''));
      if (!t) return fail(PAYME_ERR.notFound);
      if (t.state < 0) return ok({ cancel_time: t.cancel_time, ...view(t) });
      const reason = Number.isInteger(Number(p.reason)) ? Number(p.reason) : null;
      const now = Date.now();
      if (t.state === 1) {
        await updateTx(t.id, { state: -1, reason, cancel_time: now });
        return ok({ cancel_time: now, transaction: t.id, state: -1 });
      }
      const { data: o } = await db().from('orders').select('status').eq('id', t.order_id).maybeSingle();
      if (o?.status === 'delivered') return fail(PAYME_ERR.cantCancel);
      await updateTx(t.id, { state: -2, reason, cancel_time: now });
      await db().rpc('_online_payment_void', { p_order: t.order_id });
      return ok({ cancel_time: now, transaction: t.id, state: -2 });
    }
    case 'CheckTransaction': {
      const t = await txByExt('payme', String(p.id ?? ''));
      if (!t) return fail(PAYME_ERR.notFound);
      return ok({ create_time: t.create_time, perform_time: t.perform_time, cancel_time: t.cancel_time, transaction: t.id, state: t.state, reason: t.reason });
    }
    case 'GetStatement': {
      const { data } = await db().from('payment_transactions').select('*').eq('provider', 'payme')
        .gte('create_time', Number(p.from) || 0).lte('create_time', Number(p.to) || 0).order('create_time').limit(1000);
      return ok({
        transactions: (data ?? []).map((t) => ({
          id: t.ext_id, time: Number((t.payload as { time?: number } | null)?.time ?? t.create_time), amount: Math.round(Number(t.amount) * 100),
          account: (t.payload as { account?: unknown } | null)?.account ?? {}, create_time: Number(t.create_time), perform_time: Number(t.perform_time),
          cancel_time: Number(t.cancel_time), transaction: t.id, state: t.state, reason: t.reason,
        })),
      });
    }
    case 'SetFiscalData':
      return ok({ success: true });
    default:
      return fail(PAYME_ERR.method);
  }
}

// =====================================================================
// Click (SHOP API: Prepare action=0, Complete action=1)
// =====================================================================
const md5 = (s: string) => createHash('md5').update(s).digest('hex');

export async function handleClick(request: Request, onPaid: PaidHook): Promise<Record<string, unknown>> {
  const form = await request.formData().catch(() => null);
  const f = (k: string) => String(form?.get(k) ?? '');
  const base = { click_trans_id: f('click_trans_id'), merchant_trans_id: f('merchant_trans_id') };
  const err = (error: number, error_note: string) => ({ ...base, error, error_note });
  const keys = await getPaymentKeys();
  const k = keys.click;
  if (!form || !k.enabled || !k.secret_key) return err(-8, 'Error in request from click');

  const action = f('action');
  if (action !== '0' && action !== '1') return err(-3, 'Action not found');
  const prepareId = f('merchant_prepare_id');
  const sign = md5(f('click_trans_id') + f('service_id') + k.secret_key + f('merchant_trans_id') + (action === '1' ? prepareId : '') + f('amount') + action + f('sign_time'));
  const got = f('sign_string').toLowerCase();
  if (got.length !== sign.length || !timingSafeEqual(Buffer.from(got), Buffer.from(sign))) return err(-1, 'SIGN CHECK FAILED!');
  if (f('service_id') !== k.service_id) return err(-8, 'Error in request from click');

  const order = await orderByNumber(f('merchant_trans_id'));
  if (!order) return err(-5, 'User does not exist');
  const amount = Number(f('amount'));
  const amountOk = Number.isFinite(amount) && Math.abs(amount - order.total) < 0.01;

  if (action === '0') {
    if (order.payment_status === 'paid') return err(-4, 'Already paid');
    if (closed(order)) return err(-9, 'Transaction cancelled');
    if (!amountOk) return err(-2, 'Incorrect parameter amount');
    const existing = await txByExt('click', f('click_trans_id'));
    if (!existing) {
      const { error } = await db().from('payment_transactions').insert({
        provider: 'click', ext_id: f('click_trans_id'), order_id: order.id, amount: order.total, state: 1, create_time: Date.now(),
        payload: { click_paydoc_id: f('click_paydoc_id'), sign_time: f('sign_time') },
      });
      if (error) throw error;
    }
    return { ...base, merchant_prepare_id: order.number, error: 0, error_note: 'Success' };
  }

  // Complete
  const t = await txByExt('click', f('click_trans_id'));
  if (!t || String(order.number) !== prepareId || t.order_id !== order.id) return err(-6, 'Transaction does not exist');
  if (t.state === 2) return { ...base, merchant_confirm_id: order.number, error: -4, error_note: 'Already paid' };
  if (t.state < 0) return err(-9, 'Transaction cancelled');
  if (Number(f('error')) < 0) {
    await updateTx(t.id, { state: -1, reason: Number(f('error')), cancel_time: Date.now() });
    return err(-9, 'Transaction cancelled');
  }
  if (!amountOk) return err(-2, 'Incorrect parameter amount');
  if (closed(order)) {
    await updateTx(t.id, { state: -1, reason: -9, cancel_time: Date.now() });
    return err(-9, 'Transaction cancelled');
  }
  if (await markPaid(order.id, 'click')) onPaid(order.id, 'click');
  await updateTx(t.id, { state: 2, perform_time: Date.now() });
  return { ...base, merchant_confirm_id: order.number, error: 0, error_note: 'Success' };
}
