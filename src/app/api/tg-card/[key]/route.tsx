import { ImageResponse } from 'next/og';
import { getSettings } from '@/lib/data/public';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { COUPON_THEMES, cleanDesign } from '@/lib/coupon-design';
import { CUSTOMER_MSG_BY_KEY, isCustomerMsgKey, type CardIcon } from '@/lib/telegram/customer-messages';

// Bot xabarlari uchun standart rasm (kartochka): har bir holat oʻz rangi va yozuvi bilan.
// Telegram rasmni shu manzildan oʻzi yuklab oladi. Ichida maxfiy narsa yoʻq: kupon kodi rasmda chiqmaydi.

export const runtime = 'nodejs';
const W = 1200;
const H = 750;

// Standart shriftda ʻ yoʻq boʻlishi mumkin — oddiy apostrofga almashtiriladi.
const plain = (s: string) => s.replace(/[ʻʼ‘’]/g, "'");
const num = (v: number) => new Intl.NumberFormat('ru-RU').format(v).replace(/\s/g, ' ');

const ICONS: Record<CardIcon, string[]> = {
  cart: ['M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6', 'M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', 'M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z'],
  check: ['M22 11.1V12a10 10 0 1 1-5.9-9.1', 'm9 11 3 3L22 4'],
  box: ['M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z', 'm3.3 7 8.7 5 8.7-5', 'M12 22V12'],
  truck: ['M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2', 'M15 18H9', 'M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14', 'M17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  gift: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7Z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z'],
  x: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'm15 9-6 6', 'm9 9 6 6'],
  undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  card: ['M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', 'M2 10h20', 'M6 15h4'],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  ticket: ['M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z', 'M13 5v2', 'M13 17v2', 'M13 11v2'],
};

function Icon({ name, color, size }: { name: CardIcon; color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/** Orqa fondagi nurlar (Laylak kupon rasmidagidek). */
function Rays({ color }: { color: string }) {
  const rays = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const b = a + Math.PI / 36;
    const R = 1400;
    const cx = W / 2; const cy = H / 2;
    return `M${cx} ${cy} L${cx + R * Math.cos(a)} ${cy + R * Math.sin(a)} L${cx + R * Math.cos(b)} ${cy + R * Math.sin(b)} Z`;
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', top: 0, left: 0 }}>
      {rays.map((d, i) => <path key={i} d={d} fill={color} />)}
    </svg>
  );
}

// Qalin shrift (Inter 800/600). Google Fonts oddiy soʻrovga TTF beradi; olinmasa standart shrift ishlaydi.
type FontDef = { name: string; data: ArrayBuffer; weight: 500 | 600 | 800; style: 'normal' };
let fontsCache: Promise<FontDef[]> | null = null;
let serifCache: Promise<FontDef[]> | null = null;
async function fontOf(weight: 500 | 600 | 800, family = 'Inter'): Promise<FontDef> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`, { cache: 'force-cache' })).text();
  const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) throw new Error('font');
  return { name: family, data: await (await fetch(url, { cache: 'force-cache' })).arrayBuffer(), weight, style: 'normal' as const };
}
function fonts() {
  fontsCache ??= Promise.all([fontOf(600), fontOf(800)]).catch(() => { fontsCache = null; return []; });
  return fontsCache;
}
/** Heaven uslubi: Playfair Display (sarlavha) + Inter (mayda yozuv). */
function serifFonts() {
  serifCache ??= Promise.all([fontOf(500, 'Playfair Display'), fontOf(600, 'Playfair Display'), fontOf(600)]).catch(() => { serifCache = null; return []; });
  return serifCache;
}

async function brandInfo() {
  try {
    const b = (await getSettings()).brand as { name?: string; look?: string; tagline?: string };
    return { name: plain(b.name || 'Dokon'), look: b.look ?? 'classic', tagline: plain(b.tagline ?? '') };
  } catch { return { name: 'Dokon', look: 'classic', tagline: '' }; }
}
async function brandName() { return (await brandInfo()).name; }

// Heaven uslubi (bannerlar bilan bir xil): zaytun-yashil fon, mayda don, fil suyagi rangli ingichka chiziqlar va serif yozuv.
const IVORY = '#ebe2c6';
const HEAVEN_TONE: Partial<Record<CardIcon, [string, string]>> = {
  x: ['#5a4a3c', '#1f1a15'],      // bekor qilindi — iliq jigarrang
  undo: ['#4d4a3a', '#1c1b14'],   // qaytarildi
  card: ['#3f4d3a', '#161d14'],
  truck: ['#3b5146', '#141f19'],
  pin: ['#55603f', '#20261a'],
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'D';

function Sparkle({ x, y, r, o }: { x: number; y: number; r: number; o: number }) {
  return (
    <svg width={r * 2} height={r * 2} viewBox="-10 -10 20 20" style={{ position: 'absolute', left: x - r, top: y - r }}>
      <path d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" fill={IVORY} fillOpacity={o} />
    </svg>
  );
}

async function heavenCard(origin: string, brand: string, tagline: string, art: { title: string; subtitle: string; icon: CardIcon }) {
  const [a, b] = HEAVEN_TONE[art.icon] ?? ['#4a5b42', '#1c251a'];
  const cx = 880; const cy = 375;
  return new ImageResponse(
    <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: `radial-gradient(circle at 70% 40%, ${a} 0%, ${b} 85%)` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${origin}/brand/noise.png`} width={W} height={H} alt="" style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} />
      {/* ikki qavat halqa ichida holat belgisi */}
      <div style={{ position: 'absolute', left: cx - 200, top: cy - 200, width: 400, height: 400, borderRadius: 400, border: `2px solid rgba(235,226,198,0.55)`, display: 'flex' }} />
      <div style={{ position: 'absolute', left: cx - 176, top: cy - 176, width: 352, height: 352, borderRadius: 352, border: `1.5px solid rgba(235,226,198,0.22)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={art.icon} color={IVORY} size={150} />
      </div>
      <Sparkle x={cx + 170} y={cy - 170} r={22} o={0.9} />
      <Sparkle x={cx - 190} y={cy + 150} r={12} o={0.5} />
      <Sparkle x={cx + 215} y={cy + 95} r={9} o={0.45} />
      <div style={{ position: 'absolute', left: 80, top: 72, bottom: 72, width: 560, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 64, border: `1.5px solid rgba(235,226,198,0.7)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display', fontWeight: 600, fontSize: 26, color: IVORY, letterSpacing: 1 }}>{initials(brand)}</div>
          <span style={{ marginLeft: 20, fontFamily: 'Playfair Display', fontWeight: 500, fontSize: 28, color: IVORY, letterSpacing: 6 }}>{brand.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 56, height: 2, background: 'rgba(235,226,198,0.6)', marginBottom: 30, display: 'flex' }} />
          {plain(art.title).split('\n').map((line, i) => (
            <span key={i} style={{ fontFamily: 'Playfair Display', fontWeight: 600, fontSize: 70, color: IVORY, lineHeight: 1.08, letterSpacing: 1 }}>
              {line.charAt(0) + line.slice(1).toLowerCase()}
            </span>
          ))}
          {art.subtitle && <span style={{ marginTop: 26, fontFamily: 'Inter', fontWeight: 600, fontSize: 28, color: 'rgba(235,226,198,0.78)' }}>{plain(art.subtitle)}</span>}
        </div>
        <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 18, color: 'rgba(235,226,198,0.55)', letterSpacing: 7 }}>{tagline.toUpperCase()}</span>
      </div>
    </div>,
    { width: W, height: H, fonts: await serifFonts(), headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}

async function couponCard(id: string | null) {
  let theme: (typeof COUPON_THEMES)[keyof typeof COUPON_THEMES] = COUPON_THEMES.red;
  let badge = '';
  let value = '';
  let unit = '';
  if (id && /^[0-9a-f-]{36}$/i.test(id) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data } = await getServiceSupabase().from('coupons').select('discount_type, value, design').eq('id', id).maybeSingle();
    if (data) {
      const d = cleanDesign(data.design);
      theme = COUPON_THEMES[d.theme];
      badge = d.badge;
      value = data.discount_type === 'percent' ? String(data.value) : num(Number(data.value));
      unit = data.discount_type === 'percent' ? '%' : "so'm";
    }
  }
  const brand = (await brandName()).toUpperCase();
  const [m1, m2] = theme.main;
  const [s1, s2] = theme.stub;
  return new ImageResponse(
    <div style={{ fontFamily: 'Inter', width: W, height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', background: `radial-gradient(circle at 50% 50%, ${m1} 0%, ${m2} 75%)` }}>
      <Rays color="rgba(255,255,255,0.07)" />
      <div style={{ display: 'flex', fontSize: badge ? 190 : 150, fontWeight: 800, color: theme.pill, letterSpacing: -4, lineHeight: 1, textShadow: '0 8px 0 rgba(0,0,0,0.18)' }}>
        {badge || (value ? `${value}${unit === '%' ? '%' : ''}` : 'KUPON')}
      </div>
      <div style={{ display: 'flex', marginTop: 48, height: 220, borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ width: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${s1}, ${s2})`, color: theme.stubInk, fontSize: 56, fontWeight: 800, lineHeight: 1 }}>
          {badge ? badge.split(/[.\s]/).filter(Boolean).slice(0, 2).map((p, i) => <span key={i}>{p}</span>) : <Icon name="ticket" color={theme.stubInk} size={96} />}
        </div>
        <div style={{ width: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${m1}, ${m2})`, borderLeft: `4px dashed ${s2}` }}>
          <span style={{ fontSize: 44, fontWeight: 700, color: '#ffffff', letterSpacing: 8 }}>KUPON</span>
          {value && <span style={{ fontSize: 56, fontWeight: 800, color: theme.pill, marginTop: 6 }}>{`${value} ${unit}`}</span>}
          <span style={{ fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 8, letterSpacing: 4 }}>{brand}</span>
        </div>
      </div>
    </div>,
    { width: W, height: H, fonts: await fonts(), headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isCustomerMsgKey(key)) return new Response('Not found', { status: 404 });
  if (key === 'coupon') return couponCard(new URL(request.url).searchParams.get('c'));

  const art = CUSTOMER_MSG_BY_KEY[key].art;
  const { name: brand, look, tagline } = await brandInfo();
  const url = new URL(request.url);
  const style = url.searchParams.get('look') ?? look;
  if (style === 'heaven') {
    const card = await heavenCard(url.origin, brand, tagline, art);
    return url.searchParams.has('jpg') ? toJpeg(card) : card;
  }
  const png = new ImageResponse(
    <div style={{ fontFamily: 'Inter', width: W, height: H, display: 'flex', position: 'relative', background: `linear-gradient(135deg, ${art.from} 0%, ${art.to} 100%)`, padding: 72 }}>
      <div style={{ position: 'absolute', right: -160, top: -160, width: 620, height: 620, borderRadius: 620, background: 'rgba(255,255,255,0.08)', display: 'flex' }} />
      <div style={{ position: 'absolute', right: 120, bottom: -220, width: 440, height: 440, borderRadius: 440, background: 'rgba(255,255,255,0.06)', display: 'flex' }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingRight: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: 2 }}>
          <div style={{ width: 18, height: 18, borderRadius: 18, background: '#ffffff', marginRight: 16, display: 'flex' }} />
          {brand.toUpperCase()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {plain(art.title).split('\n').map((line, i) => (
            <span key={i} style={{ fontSize: 84, fontWeight: 800, color: '#ffffff', lineHeight: 1.04, letterSpacing: -2 }}>{line}</span>
          ))}
          {art.subtitle && <span style={{ marginTop: 28, fontSize: 38, color: 'rgba(255,255,255,0.85)' }}>{plain(art.subtitle)}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 340, height: 340, alignSelf: 'center', borderRadius: 80, background: 'rgba(255,255,255,0.16)', border: '2px solid rgba(255,255,255,0.35)' }}>
        <Icon name={art.icon} color="#ffffff" size={190} />
      </div>
    </div>,
    { width: W, height: H, fonts: await fonts(), headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
  // Ulashiladigan (inline) xabarlarda Telegram JPEG kutadi
  return new URL(request.url).searchParams.has('jpg') ? toJpeg(png) : png;
}

async function toJpeg(png: Response): Promise<Response> {
  try {
    const sharp = (await import('sharp')).default;
    const buf = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 88 }).toBuffer();
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
  } catch (e) {
    console.error('tg-card jpeg', e);
    return png;
  }
}
