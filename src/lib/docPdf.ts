/**
 * PDF de documentos com o mesmo visual da tela: parte do editor renderizado (com blocos premium,
 * colunas, cartões, QR Codes, capas de vídeo…), em papel claro, com quebras de página entre blocos,
 * links clicáveis e um apêndice de "Links e referências" com QR Code de cada endereço.
 */
import type { Page } from './types';
import { qrPng } from './qr';

const LIGHT_VARS: Record<string, string> = {
  '--bg': '#ffffff', '--panel': '#ffffff', '--panel-2': '#f5f5fa', '--sidebar': '#fafafe', '--text': '#1f2330', '--muted': '#6b7085',
  '--border': '#e4e4ee', '--hover': '#f1f0fb', '--accent-soft': 'rgba(124, 58, 237, .10)', '--shadow': '0 6px 18px rgba(20, 20, 50, .08)',
};
const CHROME = [
  '.block-handle', '.media-bar', '.cols-bar', '.resize-handle', '.media-shield', '.attach-actions', '.ol-tools', '.map-form', '.qr-actions', '.qr-editor',
  '.ProseMirror-gapcursor', '.yt-play', '.suggest', '.tippy-box', '[data-tippy-root]', '.leaflet-control-container', '.editor-tail', '.ph', '.qr-empty-tag',
];

export interface LinkRef { url: string; label: string }

function cleanClone(src: HTMLElement): HTMLElement {
  const c = src.cloneNode(true) as HTMLElement;
  c.removeAttribute('contenteditable');
  c.querySelectorAll('[contenteditable]').forEach((e) => e.removeAttribute('contenteditable'));
  c.querySelectorAll(CHROME.join(',')).forEach((e) => e.remove());
  // parágrafos vazios com texto de ajuda (placeholder) não vão para o papel
  c.querySelectorAll('[data-placeholder]').forEach((e) => { if (!e.textContent?.trim() && !e.querySelector('img,svg,canvas')) e.remove(); else e.removeAttribute('data-placeholder'); });
  c.querySelectorAll('.is-empty, .is-editor-empty').forEach((e) => e.classList.remove('is-empty', 'is-editor-empty'));
  c.querySelectorAll('.ProseMirror-selectednode, .is-selected, .sel').forEach((e) => e.classList.remove('ProseMirror-selectednode', 'is-selected', 'sel'));
  // inputs (legendas, campos) viram texto
  c.querySelectorAll('input, textarea').forEach((i) => {
    const el = i as HTMLInputElement;
    if (el.type === 'checkbox' || el.type === 'radio') return;
    const span = document.createElement('span');
    span.className = el.className + ' pdf-input';
    span.textContent = el.value;
    if (!el.value) span.style.display = 'none';
    el.replaceWith(span);
  });
  return c;
}

/** YouTube, áudio e vídeo: capa/cartão com link (o PDF não toca mídia). */
function replaceMedia(live: HTMLElement, clone: HTMLElement, links: LinkRef[]) {
  const livePlayers = Array.from(live.querySelectorAll('.yt-player'));
  clone.querySelectorAll('.yt-player').forEach((el, i) => {
    const iframe = el.querySelector('iframe');
    const src = iframe?.getAttribute('src') || '';
    const img = el.querySelector('img');
    const id = (src.match(/(?:embed\/|\/yt\/)([\w-]{11})/) || img?.getAttribute('src')?.match(/vi\/([\w-]{11})/) || livePlayers[i]?.querySelector('img')?.getAttribute('src')?.match(/vi\/([\w-]{11})/) || [])[1];
    if (!id) return;
    const url = `https://www.youtube.com/watch?v=${id}`;
    const title = el.querySelector('.yt-title span:last-child')?.textContent || 'YouTube';
    const a = document.createElement('a');
    a.href = url;
    a.className = 'yt-player pdf-yt';
    a.innerHTML = `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" crossorigin="anonymous" alt=""><div class="yt-shade"></div><div class="yt-title"><span class="yt-logo">▶</span><span></span></div><div class="pdf-play">▶</div>`;
    a.querySelector('.yt-title span:last-child')!.textContent = title;
    el.replaceWith(a);
    links.push({ url, label: `▶ ${title}` });
  });
  clone.querySelectorAll('audio, video').forEach((m) => {
    const card = document.createElement('div');
    card.className = 'pdf-media-card';
    const name = m.closest('.cv-audio, .audio-card, .media-node')?.querySelector('b, .audio-name, figcaption')?.textContent || '';
    card.textContent = (m.tagName === 'AUDIO' ? '🎙️ ' : '🎬 ') + (name || (m.tagName === 'AUDIO' ? 'Áudio' : 'Vídeo')) + ' — disponível no app';
    m.replaceWith(card);
  });
  clone.querySelectorAll('iframe').forEach((f) => f.remove());
}

export function collectLinks(root: HTMLElement, links: LinkRef[]) {
  // QR Codes com link viram áreas clicáveis
  root.querySelectorAll('[data-href]').forEach((el) => {
    const url = el.getAttribute('data-href') || '';
    const target = (el.querySelector('.qr-canvas') as HTMLElement) || (el as HTMLElement);
    const a = document.createElement('a');
    a.href = url;
    a.className = 'pdf-qr-link';
    target.replaceWith(a);
    a.appendChild(target);
    const label = el.getAttribute('data-label') || url;
    if (!links.some((l) => l.url === url)) links.push({ url, label: '▣ ' + label });
  });
  root.querySelectorAll('a[href]').forEach((a) => {
    const url = (a as HTMLAnchorElement).getAttribute('href') || '';
    if (!/^(https?:|mailto:|tel:)/.test(url)) return;
    const label = (a.textContent || '').trim().slice(0, 90) || url;
    if (!links.some((l) => l.url === url)) links.push({ url, label });
  });
}

export async function linksAppendix(links: LinkRef[], title: string): Promise<HTMLElement | null> {
  const ext = links.filter((l, i, arr) => /^https?:/.test(l.url) && arr.findIndex((x) => x.url === l.url) === i).slice(0, 40);
  if (!ext.length) return null;
  const sec = document.createElement('section');
  sec.className = 'pdf-links';
  sec.innerHTML = `<h2>🔗 ${title}</h2><div class="pdf-links-grid"></div>`;
  const grid = sec.querySelector('.pdf-links-grid')!;
  for (const l of ext) {
    const png = await qrPng(l.url, { fg: '#1f2330', bg: '#ffffff', dots: 'rounded', corners: 'extra-rounded' }, 220).catch(() => '');
    const item = document.createElement('a');
    item.href = l.url;
    item.className = 'pdf-link-item';
    item.innerHTML = `${png ? `<img src="${png}" alt="">` : ''}<div><b></b><small></small></div>`;
    item.querySelector('b')!.textContent = l.label;
    item.querySelector('small')!.textContent = l.url;
    grid.appendChild(item);
  }
  return sec;
}

export async function exportDocPdf(page: Page, live: HTMLElement, opts: { linksTitle: string; pageLabel: string; iconText: string; withQr?: boolean }): Promise<ArrayBuffer> {
  const [{ jsPDF }, html2canvas] = await Promise.all([import('jspdf'), import('html2canvas-pro').then((m) => m.default)]);
  const editor = live.querySelector('.ProseMirror') as HTMLElement | null;
  if (!editor) throw new Error('editor');
  const WIDTH = 780;
  const host = document.createElement('div');
  host.className = 'pdf-doc page-content';
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${WIDTH}px;padding:40px 48px;background:#fff;color:#1f2330;z-index:-1`;
  for (const [k, v] of Object.entries(LIGHT_VARS)) host.style.setProperty(k, v);
  host.setAttribute('data-theme', 'light');
  const head = document.createElement('header');
  head.className = 'pdf-head';
  head.innerHTML = `<h1></h1>`;
  head.querySelector('h1')!.textContent = `${opts.iconText}${page.title || ''}`;
  if (page.tags?.length) { const tg = document.createElement('div'); tg.className = 'pdf-tags'; tg.textContent = page.tags.map((t) => '#' + t).join('  '); head.appendChild(tg); }
  host.appendChild(head);
  const links: LinkRef[] = [];
  const clone = cleanClone(editor);
  replaceMedia(editor, clone, links);
  host.appendChild(clone);
  document.body.appendChild(host);
  try {
    collectLinks(clone, links);
    if (opts.withQr !== false) {
      const app = await linksAppendix(links, opts.linksTitle);
      if (app) host.appendChild(app);
    }
    await Promise.all(Array.from(host.querySelectorAll('img')).map((img) => (img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r))))));
    await new Promise((r) => setTimeout(r, 80));
    const base = host.getBoundingClientRect();
    // limites para cortar a página entre blocos (cabeçalho, cada bloco de 1º nível e cada item do apêndice)
    const blocks = [head, ...Array.from(clone.children), ...Array.from(host.querySelectorAll('.pdf-links, .pdf-link-item:nth-child(n+3):nth-child(odd)'))] as HTMLElement[];
    const cuts = blocks.map((b) => b.getBoundingClientRect().top - base.top).filter((y) => y > 0);
    const anchors = Array.from(host.querySelectorAll('a[href]')).map((a) => {
      const r = a.getBoundingClientRect();
      return { url: a.getAttribute('href') || '', x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    }).filter((a) => /^(https?:|mailto:|tel:)/.test(a.url) && a.w > 0 && a.h > 0);
    const SCALE = 2;
    const { flattenColors } = await import('./exporters');
    const canvas = await html2canvas(host, { scale: SCALE, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: WIDTH + 200, onclone: (doc) => flattenColors(doc) });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const margin = 24, footer = 22;
    const s = (pw - margin * 2) / canvas.width; // pt por pixel do canvas
    const pageH = Math.floor((ph - margin * 2 - footer) / s);
    const cutPx = cuts.map((y) => Math.round(y * SCALE)).sort((a, b) => a - b);
    const slices: [number, number][] = [];
    for (let y = 0; y < canvas.height;) {
      let end = Math.min(canvas.height, y + pageH);
      if (end < canvas.height) {
        const best = cutPx.filter((c) => c > y + pageH * 0.45 && c <= end).pop();
        if (best) end = best;
      }
      slices.push([y, end]);
      y = end;
    }
    slices.forEach(([y0, y1], i) => {
      if (i) pdf.addPage();
      const part = document.createElement('canvas');
      part.width = canvas.width;
      part.height = y1 - y0;
      part.getContext('2d')!.drawImage(canvas, 0, y0, canvas.width, y1 - y0, 0, 0, canvas.width, y1 - y0);
      pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, pw - margin * 2, (y1 - y0) * s);
      // links clicáveis nesta página
      for (const a of anchors) {
        const top = a.y * SCALE, bottom = (a.y + a.h) * SCALE;
        if (bottom <= y0 || top >= y1) continue;
        const yy = Math.max(top, y0), hh = Math.min(bottom, y1) - yy;
        pdf.link(margin + a.x * SCALE * s, margin + (yy - y0) * s, a.w * SCALE * s, hh * s, { url: a.url });
      }
      pdf.setFontSize(8);
      pdf.setTextColor(140, 140, 160);
      pdf.text(page.title || '', margin, ph - margin + 4);
      pdf.text(`${opts.pageLabel} ${i + 1} / ${slices.length}`, pw - margin, ph - margin + 4, { align: 'right' });
    });
    pdf.setProperties({ title: page.title, creator: 'GCP-Neuro Notas' });
    return pdf.output('arraybuffer');
  } finally {
    host.remove();
  }
}
