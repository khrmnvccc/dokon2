'use client';

import { useEffect, useRef, useState } from 'react';
import type { QuoteResult } from '@/lib/pricing';
import type { CartItem } from '@/components/providers';

/** Savatcha narxini serverdan olish (narxlar bazadan hisoblanadi). */
export function useQuote(items: CartItem[], ready: boolean, couponCode: string | null, shippingMethodId: string | null) {
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const key = JSON.stringify([items, couponCode, shippingMethodId]);

  useEffect(() => {
    if (!ready) return;
    if (!items.length) {
      setQuote(null);
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/cart/quote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items, couponCode, shippingMethodId }),
        });
        const data = await res.json();
        if (id !== seq.current) return;
        if (!res.ok) setError(data.error ?? 'Narxni hisoblab bo‘lmadi');
        else {
          setQuote(data);
          setError(null);
        }
      } catch {
        if (id === seq.current) setError('Internet aloqasini tekshiring');
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  return { quote, loading, error };
}
