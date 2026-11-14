/**
 * Matnni nusxalash. Telegram ichidagi brauzer (ayniqsa iPhone) navigator.clipboard ni ba'zan bloklaydi —
 * shunda eski usul (yashirin maydon + execCommand) ishlatiladi. Muvaffaqiyatli bo'lsa true.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* pastdagi usulga o'tamiz */ }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  } catch {
    return false;
  }
}
