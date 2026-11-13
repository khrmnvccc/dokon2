import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Sessiyani yangilash va himoyalangan bo'limlarga kirishni tekshirish.
// Admin huquqi bu yerda emas, /admin layout va har bir server action ichida bazadan tekshiriladi.
const hostOf = (u?: string) => { try { return u ? new URL(u).host : ''; } catch { return ''; } };
const ADMIN_URL = (process.env.NEXT_PUBLIC_ADMIN_URL ?? '').replace(/\/$/, '');
const ADMIN_HOST = hostOf(ADMIN_URL);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const SITE_HOST = hostOf(SITE_URL);
// Admin manzilida ochiq yoʻllar: panel, kirish sahifalari, API va Next fayllari. Qolgani doʻkonga yuboriladi.
const ADMIN_SIDE = /^\/(admin|login|forgot-password|reset-password|auth|api)(\/|$)/;

/**
 * Alohida admin sayt: NEXT_PUBLIC_ADMIN_URL berilsa, admin panel faqat oʻsha manzilda ochiladi,
 * doʻkon manzilidagi /admin unga yoʻnaltiriladi. Berilmasa — hammasi bitta manzilda (avvalgidek).
 */
function routeByHost(request: NextRequest): NextResponse | null {
  if (!ADMIN_HOST || !SITE_HOST || ADMIN_HOST === SITE_HOST) return null;
  const host = request.headers.get('host') ?? '';
  const { pathname, search } = request.nextUrl;
  if (host === ADMIN_HOST) {
    if (pathname === '/' || pathname === '/account') return NextResponse.redirect(`${ADMIN_URL}/admin`);
    if (!ADMIN_SIDE.test(pathname)) return NextResponse.redirect(`${SITE_URL}${pathname}${search}`);
  } else if (host === SITE_HOST && /^\/admin(\/|$)/.test(pathname)) {
    return NextResponse.redirect(`${ADMIN_URL}${pathname}${search}`);
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const routed = routeByHost(request);
  if (routed) return routed;
  // Admin layout "Oynalar" tekshiruvi uchun joriy yo'l (foydalanuvchi bergan qiymat ishonchli emas — ustidan yoziladi).
  request.headers.set('x-pathname', request.nextUrl.pathname);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && (path.startsWith('/admin') || path.startsWith('/account'))) {
    // Admin manzilida kirish sahifasi ham admin manzilida qoladi (cookie har manzilda alohida).
    if (ADMIN_HOST && request.headers.get('host') === ADMIN_HOST) {
      return NextResponse.redirect(`${ADMIN_URL}/login?next=${encodeURIComponent(path)}`);
    }
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|demo/|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)'],
};
