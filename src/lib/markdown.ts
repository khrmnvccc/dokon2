// Xavfsiz minimal Markdown -> HTML. Avval barcha HTML ekranlanadi, keyin faqat ruxsat etilgan teglar qo'shiladi.
// Admin kiritgan kontentda <script> va boshqa xavfli teglar ishlamaydi.

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^(https?:\/\/|\/(?!\/)|mailto:|tel:|#)/i.test(u)) return u;
  return null;
}

function inline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const href = safeUrl(url.replace(/&amp;/g, '&'));
    if (!href) return label;
    const external = /^https?:/i.test(href);
    return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s;
}

export function markdownToHtml(md: string, opts: { accordion?: boolean } = {}): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];
  let openDetails = false;

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br/>')}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      closeList();
      if (opts.accordion && h[1] === '###') {
        if (openDetails) out.push('</div></details>');
        out.push(`<details class="faq-item"><summary>${inline(h[2])}</summary><div class="faq-body">`);
        openDetails = true;
      } else {
        out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      }
    } else if (ul || ol) {
      flushPara();
      const kind = ul ? 'ul' : 'ol';
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
    } else if (!line.trim()) {
      flushPara();
      closeList();
    } else {
      closeList();
      para.push(line);
    }
  }
  flushPara();
  closeList();
  if (openDetails) out.push('</div></details>');
  return out.join('\n');
}
