/** Ochiq redirect zaifligidan himoya: faqat sayt ichidagi nisbiy yo'llar */
export function safeNext(next: string | null | undefined, fallback = '/account'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
