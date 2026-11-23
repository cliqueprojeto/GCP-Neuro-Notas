import { fmtDate } from './dates';
/** Impressão e exportação para PDF, Word (.docx), PowerPoint (.pptx) e Excel (.xlsx). */
import type { Page, Property } from './types';
import { saveBinaryFile } from './platform';
import { pageToHtml } from './transfer';
import { cellText, cellValue, isNumericProp } from '../database/logic';
import { computeWidget } from '../reports/aggregate';
import { CHART_PALETTES } from './themes';
import { useVault } from '../store/vault';
import { docText } from './doc';

const safeName = (p: Page) => (p.title || 'GCP-Notas').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);

function bytesToB64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

const iconText = (p: Page) => (p.icon && !p.icon.startsWith('lucide:') && !p.icon.startsWith('data:') ? p.icon + ' ' : '');

function isNum(prop: Property) {
  return isNumericProp(prop);
}

// ---------------------------------------------------------------- impressão

export async function printPage() {
  // Documento: no fim do papel, a lista de links com QR Code (para quem lê impresso)
  let extra: HTMLElement | null = null;
  const editor = document.querySelector('.page-content .ProseMirror') as HTMLElement | null;
  if (editor) {
    try {
      const { collectLinks, linksAppendix } = await import('./docPdf');
      const links: { url: string; label: string }[] = [];
      editor.querySelectorAll('.yt-player img').forEach((img) => {
        const id = (img.getAttribute('src') || '').match(/vi\/([\w-]{11})/)?.[1];
        if (id) links.push({ url: `https://www.youtube.com/watch?v=${id}`, label: '▶ ' + (img.closest('.yt-player')?.querySelector('.yt-title span:last-child')?.textContent || 'YouTube') });
      });
      editor.querySelectorAll('[data-href]').forEach((el) => links.push({ url: el.getAttribute('data-href') || '', label: '▣ ' + (el.getAttribute('data-label') || el.getAttribute('data-href')) }));
      const tmp = editor.cloneNode(true) as HTMLElement;
      tmp.querySelectorAll('[data-href]').forEach((e) => e.removeAttribute('data-href'));
      collectLinks(tmp, links);
      const lang = (document.documentElement.lang || 'pt').slice(0, 2);
      extra = await linksAppendix(links, lang === 'en' ? 'Links and references' : lang === 'es' ? 'Enlaces y referencias' : 'Links e referências');
      if (extra) (extra.classList.add('print-only'), editor.parentElement?.appendChild(extra));
    } catch { /* imprime sem o apêndice */ }
  }
  document.body.classList.add('printing');
  setTimeout(() => {
    window.print();
    setTimeout(() => (document.body.classList.remove('printing'), extra?.remove()), 500);
  }, 80);
}

// --------------------------------------------------------------------- PDF

export async function exportPdf(page: Page, liveElement?: HTMLElement | null) {
  if (page.type === 'database' && page.db) {
    const { tablePdf } = await import('../database/io');
    const view = page.db.views.find((v) => v.id === page.db!.activeView) || page.db.views[0];
    const props = page.db.properties.filter((p) => !(view?.hidden || []).includes(p.id));
    return tablePdf(page.title || 'GCP-Neuro Notas', props, page.db.rows, '✓');
  }
  // Documento aberto no editor: PDF com o mesmo visual da tela, links clicáveis e QR Codes
  const liveEditor = liveElement?.querySelector('.ProseMirror');
  if (page.type === 'page' && page.mode !== 'edgeless' && liveEditor) {
    const { exportDocPdf } = await import('./docPdf');
    const lang = (document.documentElement.lang || 'pt').slice(0, 2);
    const L = { pt: ['Links e referências', 'Página'], en: ['Links and references', 'Page'], es: ['Enlaces y referencias', 'Página'] }[lang as 'pt'] || ['Links e referências', 'Página'];
    const buf = await exportDocPdf(page, liveElement!, { linksTitle: L[0], pageLabel: L[1], iconText: iconText(page) });
    return saveBinaryFile(`${safeName(page)}.pdf`, bytesToB64(buf), [{ name: 'PDF', extensions: ['pdf'] }]);
  }
  const [{ jsPDF }, html2canvas] = await Promise.all([import('jspdf'), import('html2canvas-pro').then((m) => m.default)]);
  let el: HTMLElement;
  let cleanup = () => {};
  if (page.type === 'page' && page.mode !== 'edgeless') {
    // Documento: renderiza em papel branco, com tipografia de impressão.
    el = document.createElement('div');
    el.className = 'pdf-sheet prose';
    el.innerHTML = `<h1>${iconText(page)}${escape(page.title || '')}</h1>${pageToHtml(page)}`;
    document.body.appendChild(el);
    cleanup = () => el.remove();
  } else {
    el = liveElement || (document.querySelector('.page-content') as HTMLElement);
  }
  try {
    const bg = toRgb(getComputedStyle(el).backgroundColor) || '#ffffff';
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: bg === 'rgba(0, 0, 0, 0)' ? '#ffffff' : bg, useCORS: true, logging: false, onclone: (doc) => flattenColors(doc) });
    const landscape = page.type !== 'page' || page.mode === 'edgeless';
    const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const margin = 28;
    const w = pw - margin * 2;
    const scale = w / canvas.width;
    const sliceH = Math.floor((ph - margin * 2) / scale);
    for (let y = 0, i = 0; y < canvas.height; y += sliceH, i++) {
      const part = document.createElement('canvas');
      part.width = canvas.width;
      part.height = Math.min(sliceH, canvas.height - y);
      part.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, canvas.width, part.height);
      if (i) pdf.addPage();
      pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, w, part.height * scale);
    }
    pdf.setProperties({ title: page.title, creator: 'GCP-Neuro Notas' });
    const b64 = bytesToB64(pdf.output('arraybuffer'));
    return saveBinaryFile(`${safeName(page)}.pdf`, b64, [{ name: 'PDF', extensions: ['pdf'] }]);
  } finally {
    cleanup();
  }
}

// Converte qualquer cor CSS moderna (color-mix, oklch, color(srgb…)) em rgb/hex,
// que todo renderizador entende. O canvas 2D normaliza a cor para nós.
let colorCtx: CanvasRenderingContext2D | null = null;
export function toRgb(c: string): string {
  if (!c) return c;
  colorCtx ||= document.createElement('canvas').getContext('2d');
  if (!colorCtx) return c;
  colorCtx.fillStyle = '#000000';
  colorCtx.fillStyle = c;
  return String(colorCtx.fillStyle);
}
const MODERN = /(color-mix|color|oklch|oklab|lab|lch|hwb)\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g;
const COLOR_PROPS = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'text-decoration-color', 'fill', 'stroke', 'caret-color', 'column-rule-color'];
const COMPLEX_PROPS = ['background-image', 'box-shadow', 'text-shadow'];
export function flattenColors(doc: Document) {
  const win = doc.defaultView || window;
  doc.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const cs = win.getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v && MODERN.test(v)) el.style.setProperty(prop, toRgb(v), 'important');
      MODERN.lastIndex = 0;
    }
    for (const prop of COMPLEX_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v && MODERN.test(v)) el.style.setProperty(prop, v.replace(MODERN, (m) => toRgb(m)), 'important');
      MODERN.lastIndex = 0;
    }
    if (cs.backdropFilter && cs.backdropFilter !== 'none') el.style.setProperty('backdrop-filter', 'none', 'important');
  });
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

// -------------------------------------------------------------------- DOCX

async function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res({ w: i.naturalWidth || 400, h: i.naturalHeight || 300 });
    i.onerror = () => res({ w: 400, h: 300 });
    i.src = src;
  });
}

async function svgToPng(src: string): Promise<string> {
  const { w, h } = await imageSize(src);
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const img = new Image();
  await new Promise((r) => ((img.onload = r), (img.onerror = r), (img.src = src)));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

export async function exportDocx(page: Page) {
  const D = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun, ExternalHyperlink, AlignmentType, ShadingType, BorderStyle } = D;

  const runs = (nodes: any[] = [], extra: any = {}): any[] =>
    nodes.flatMap((n): any[] => {
      if (n.type === 'hardBreak') return [new TextRun({ text: '', break: 1 })];
      if (n.type === 'pageLink') return [new TextRun({ text: n.attrs?.label || '', color: '7C3AED', underline: {} })];
      if (n.type !== 'text') return [];
      const marks = Object.fromEntries((n.marks || []).map((m: any) => [m.type, m.attrs || true]));
      const opts: any = {
        text: n.text,
        bold: !!marks.bold || extra.bold,
        italics: !!marks.italic || extra.italics,
        underline: marks.underline ? {} : undefined,
        strike: !!marks.strike,
        font: marks.code || extra.code ? 'Consolas' : undefined,
        color: marks.textStyle?.color ? marks.textStyle.color.replace('#', '') : extra.color,
        highlight: marks.highlight ? 'yellow' : undefined,
        superScript: !!marks.superscript,
        subScript: !!marks.subscript,
      };
      if (marks.link?.href) return [new ExternalHyperlink({ link: marks.link.href, children: [new TextRun({ ...opts, style: 'Hyperlink' })] })];
      return [new TextRun(opts)];
    });

  const blocks = async (nodes: any[] = [], ctx: { level?: number; ordered?: boolean } = {}): Promise<any[]> => {
    const out: any[] = [];
    for (const n of nodes) {
      const align = n.attrs?.textAlign === 'center' ? AlignmentType.CENTER : n.attrs?.textAlign === 'right' ? AlignmentType.RIGHT : undefined;
      switch (n.type) {
        case 'heading':
          out.push(new Paragraph({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][(n.attrs?.level || 1) - 1], children: runs(n.content), alignment: align }));
          break;
        case 'paragraph':
          if (ctx.level !== undefined) out.push(new Paragraph({ children: runs(n.content), ...(ctx.ordered ? { numbering: { reference: 'num', level: ctx.level } } : { bullet: { level: ctx.level } }) }));
          else out.push(new Paragraph({ children: runs(n.content), alignment: align, spacing: { after: 120 } }));
          break;
        case 'bulletList':
        case 'orderedList':
          for (const li of n.content || []) out.push(...(await blocks(li.content, { level: (ctx.level ?? -1) + 1, ordered: n.type === 'orderedList' })));
          break;
        case 'taskList':
          for (const li of n.content || []) {
            const [first, ...rest] = li.content || [];
            out.push(new Paragraph({ children: [new TextRun({ text: li.attrs?.checked ? '☑ ' : '☐ ' }), ...runs(first?.content)], indent: { left: 360 * ((ctx.level ?? -1) + 1) } }));
            out.push(...(await blocks(rest, ctx)));
          }
          break;
        case 'blockquote':
          for (const c of n.content || []) out.push(new Paragraph({ children: runs(c.content, { italics: true, color: '555555' }), indent: { left: 480 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: '8B5CF6', space: 8 } } }));
          break;
        case 'codeBlock':
          out.push(new Paragraph({ children: runs(n.content, { code: true }), shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' } }));
          break;
        case 'callout':
          out.push(new Paragraph({ children: [new TextRun({ text: (n.attrs?.emoji || '💡') + '  ' }), ...runs(n.content)], shading: { type: ShadingType.CLEAR, fill: 'EEF2FF', color: 'auto' }, spacing: { before: 120, after: 120 } }));
          break;
        case 'toggle':
          out.push(new Paragraph({ children: [new TextRun({ text: '▸ ' + (n.attrs?.summary || ''), bold: true })] }));
          out.push(...(await blocks(n.content, ctx)));
          break;
        case 'horizontalRule':
          out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } }, children: [] }));
          break;
        case 'table': {
          const rows = (n.content || []).map(
            (r: any) =>
              new TableRow({
                children: (r.content || []).map(
                  (c: any) =>
                    new TableCell({
                      children: (c.content || []).map((p: any) => new Paragraph({ children: runs(p.content, { bold: c.type === 'tableHeader' }) })),
                      shading: c.type === 'tableHeader' ? { type: ShadingType.CLEAR, fill: 'EDE9FE', color: 'auto' } : undefined,
                    }),
                ),
              }),
          );
          if (rows.length) out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
          break;
        }
        case 'image': {
          let src: string = n.attrs?.src || '';
          if (!src.startsWith('data:')) break;
          if (src.startsWith('data:image/svg')) src = await svgToPng(src);
          const { w, h } = await imageSize(src);
          const max = 560;
          const sc = Math.min(1, max / w);
          const type = src.startsWith('data:image/png') ? 'png' : src.startsWith('data:image/gif') ? 'gif' : 'jpg';
          out.push(new Paragraph({ children: [new ImageRun({ type, data: Uint8Array.from(atob(src.split(',')[1]), (c) => c.charCodeAt(0)), transformation: { width: Math.round(w * sc), height: Math.round(h * sc) } } as any)] }));
          break;
        }
        case 'qrcode': {
          // QR Code: imagem gerada + legenda + link clicável
          const { qrPayload, qrPng } = await import('./qr');
          const data = qrPayload(n.attrs?.kind || 'link', n.attrs?.fields || {});
          const src: string = n.attrs?.image || (data ? await qrPng(data, { fg: '#141414', bg: '#ffffff', dots: 'rounded', corners: 'extra-rounded', ...(n.attrs?.style || {}) }, 480) : '');
          if (src.startsWith('data:')) {
            const size = Math.min(260, n.attrs?.size || 220);
            const img = new ImageRun({ type: 'png', data: Uint8Array.from(atob(src.split(',')[1]), (c) => c.charCodeAt(0)), transformation: { width: size, height: size } } as any);
            const href = /^(https?:|mailto:|tel:)/.test(data) ? data : '';
            out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [href ? new ExternalHyperlink({ link: href, children: [img] }) : img] }));
          }
          if (n.attrs?.caption) out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: n.attrs.caption, bold: true })] }));
          break;
        }
        case 'youtube': {
          const id = (String(n.attrs?.src || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/) || [])[1];
          if (id) out.push(new Paragraph({ children: [new TextRun({ text: '▶ ' }), new ExternalHyperlink({ link: `https://www.youtube.com/watch?v=${id}`, children: [new TextRun({ text: n.attrs?.caption || `YouTube — https://www.youtube.com/watch?v=${id}`, style: 'Hyperlink' })] })] }));
          break;
        }
        case 'columns': {
          // colunas: cada coluna em sequência, preservando o conteúdo
          for (const col of n.content || []) out.push(...(await blocks(col.content || [])));
          break;
        }
        default: {
          const txt = docText(n).join(' ').trim();
          if (txt) out.push(new Paragraph({ children: [new TextRun({ text: txt })] }));
        }
      }
    }
    return out;
  };

  const children: any[] = [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(iconText(page) + (page.title || ''))] })];
  if (page.type === 'database' && page.db) {
    const props = page.db.properties.filter((p) => p.type !== 'password');
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ tableHeader: true, children: props.map((p) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.name, bold: true })] })], shading: { type: ShadingType.CLEAR, fill: 'EDE9FE', color: 'auto' } })) }),
          ...page.db.rows.map((r) => new TableRow({ children: props.map((p) => new TableCell({ children: [new Paragraph(cellText(p, cellValue(p, r)))] })) })),
        ],
      }),
    );
  } else if (page.type === 'report' && page.report) {
    const pages = useVault.getState().pages;
    for (const w of page.report.widgets) {
      const { data } = computeWidget(w, pages, '—');
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(w.title || pages[w.source]?.title || '')] }));
      children.push(new Table({ width: { size: 70, type: WidthType.PERCENTAGE }, rows: data.map((d) => new TableRow({ children: [new TableCell({ children: [new Paragraph(d.label)] }), new TableCell({ children: [new Paragraph(String(Math.round(d.value * 100) / 100))] })] })) }));
    }
  } else {
    children.push(...(await blocks(page.content?.content || [])));
  }

  const doc = new Document({
    creator: 'GCP-Neuro Notas',
    title: page.title,
    numbering: { config: [{ reference: 'num', levels: [0, 1, 2, 3].map((level) => ({ level, format: 'decimal' as any, text: `%${level + 1}.`, alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })) }] },
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  return saveBinaryFile(`${safeName(page)}.docx`, bytesToB64(await blob.arrayBuffer()), [{ name: 'Word', extensions: ['docx'] }]);
}

// -------------------------------------------------------------------- PPTX

export async function exportPptx(page: Page, dark: boolean) {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'GCP-Neuro Notas';
  pptx.title = page.title;
  const bg = dark ? '0D0F1F' : 'FFFFFF';
  const fg = dark ? 'ECEEFD' : '1F2330';
  const muted = dark ? '9298C4' : '6B7280';
  const accent = '8B5CF6';
  pptx.defineSlideMaster({
    title: 'GCP',
    background: { color: bg },
    objects: [{ rect: { x: 0, y: 7.3, w: '100%', h: 0.2, fill: { color: accent } } }],
    slideNumber: { x: 12.6, y: 6.95, color: muted, fontSize: 10 },
  });
  const cover = pptx.addSlide({ masterName: 'GCP' });
  cover.addShape('rect' as any, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { type: 'solid', color: dark ? '141733' : 'F5F3FF' } as any });
  cover.addText(iconText(page) + (page.title || ''), { x: 0.8, y: 2.6, w: 11.7, h: 1.4, fontSize: 44, bold: true, color: fg, fontFace: 'Calibri' });
  cover.addText(fmtDate(Date.now()), { x: 0.8, y: 4.0, w: 11, h: 0.5, fontSize: 16, color: muted });

  const addTable = (title: string, head: string[], rows: string[][]) => {
    for (let i = 0; i < Math.max(rows.length, 1); i += 12) {
      const s = pptx.addSlide({ masterName: 'GCP' });
      s.addText(title, { x: 0.6, y: 0.35, w: 12, h: 0.7, fontSize: 26, bold: true, color: fg });
      s.addTable(
        [head.map((h) => ({ text: h, options: { bold: true, color: 'FFFFFF', fill: { color: accent } } })), ...rows.slice(i, i + 12).map((r) => r.map((c) => ({ text: c, options: { color: fg } })))] as any,
        { x: 0.6, y: 1.2, w: 12.1, fontSize: 12, border: { type: 'solid', color: dark ? '272B55' : 'E5E7EB', pt: 1 }, autoPage: false },
      );
    }
  };

  if (page.type === 'database' && page.db) {
    const props = page.db.properties.filter((p) => p.type !== 'password').slice(0, 7);
    addTable(page.title, props.map((p) => p.name), page.db.rows.map((r) => props.map((p) => cellText(p, cellValue(p, r)))));
  } else if (page.type === 'report' && page.report) {
    const pages = useVault.getState().pages;
    const pal = CHART_PALETTES.find((p) => p.id === page.report!.palette) || CHART_PALETTES[0];
    for (const w of page.report.widgets) {
      const { data, total, seriesKeys } = computeWidget(w, pages, '—');
      const colors = (w.colors?.length ? w.colors : dark ? pal.dark : pal.light).map((c) => c.replace('#', ''));
      const s = pptx.addSlide({ masterName: 'GCP' });
      s.addText(w.title || pages[w.source]?.title || '', { x: 0.6, y: 0.35, w: 12, h: 0.7, fontSize: 26, bold: true, color: fg });
      if (w.type === 'kpi') {
        s.addText(String(Math.round(total * 100) / 100), { x: 0.6, y: 2.2, w: 12, h: 2, fontSize: 96, bold: true, color: accent, align: 'center' });
        continue;
      }
      if (w.type === 'table' || !data.length) {
        s.addTable(data.map((d) => [{ text: d.label, options: { color: fg } }, { text: String(Math.round(d.value * 100) / 100), options: { color: fg } }]) as any, { x: 2, y: 1.3, w: 9, fontSize: 14 });
        continue;
      }
      const C = pptx.ChartType;
      const type = w.type === 'pie' ? C.pie : w.type === 'donut' ? C.doughnut : w.type === 'line' ? C.line : w.type === 'area' ? C.area : w.type === 'radar' ? C.radar : C.bar;
      const series = seriesKeys.length && ['bar', 'stacked', 'line', 'area'].includes(w.type)
        ? seriesKeys.map((sk) => ({ name: sk.label, labels: data.map((d) => d.label), values: data.map((d) => d.series?.[sk.key] || 0) }))
        : [{ name: w.title || 'Valor', labels: data.map((d) => d.label), values: data.map((d) => d.value) }];
      s.addChart(type, series, {
        x: 0.6, y: 1.2, w: 12.1, h: 5.8,
        barDir: w.type === 'hbar' ? 'bar' : 'col',
        barGrouping: w.type === 'stacked' ? 'stacked' : 'clustered',
        chartColors: colors,
        showLegend: w.showLegend !== false && (series.length > 1 || ['pie', 'donut'].includes(w.type)),
        legendPos: 'b',
        legendColor: muted,
        showValue: !!w.showLabels,
        dataLabelColor: fg,
        catAxisLabelColor: muted,
        valAxisLabelColor: muted,
        valGridLine: { color: dark ? '272B55' : 'E5E7EB', size: 0.5 },
        catGridLine: { style: 'none' },
        holeSize: 58,
      } as any);
    }
  } else {
    // Documento: cada título H1/H2 abre um slide; listas e parágrafos viram tópicos.
    let current: { title: string; lines: { text: string; level: number }[] } | null = null;
    const flush = () => {
      if (!current) return;
      for (let i = 0; i < Math.max(current.lines.length, 1); i += 10) {
        const s = pptx.addSlide({ masterName: 'GCP' });
        s.addText(current.title + (i ? ' (cont.)' : ''), { x: 0.6, y: 0.35, w: 12, h: 0.8, fontSize: 30, bold: true, color: fg });
        const chunk = current.lines.slice(i, i + 10);
        if (chunk.length)
          s.addText(chunk.map((l) => ({ text: l.text, options: { bullet: l.level >= 0 ? { indent: 18 } : false, indentLevel: Math.max(0, l.level), breakLine: true } })) as any, { x: 0.7, y: 1.35, w: 11.9, h: 5.6, fontSize: 18, color: fg, valign: 'top', paraSpaceAfter: 8 });
      }
      current = null;
    };
    const textOf = (n: any) => docText(n).join('').replace(/\s+/g, ' ').trim();
    const walkList = (n: any, level: number) => {
      for (const li of n.content || []) {
        const [first, ...rest] = li.content || [];
        const prefix = n.type === 'taskList' ? (li.attrs?.checked ? '☑ ' : '☐ ') : '';
        if (first) current!.lines.push({ text: prefix + textOf(first), level });
        for (const r of rest) if (['bulletList', 'orderedList', 'taskList'].includes(r.type)) walkList(r, level + 1);
      }
    };
    for (const n of page.content?.content || []) {
      if (n.type === 'heading' && (n.attrs?.level || 1) <= 2) {
        flush();
        current = { title: textOf(n), lines: [] };
        continue;
      }
      if (!current) current = { title: page.title || '', lines: [] };
      if (['bulletList', 'orderedList', 'taskList'].includes(n.type)) walkList(n, 0);
      else if (n.type === 'table') {
        flush();
        const rows = (n.content || []).map((r: any) => (r.content || []).map((c: any) => textOf(c)));
        if (rows.length) addTable(page.title, rows[0], rows.slice(1));
      } else if (n.type === 'image' && n.attrs?.src?.startsWith('data:')) {
        flush();
        const s = pptx.addSlide({ masterName: 'GCP' });
        let src = n.attrs.src;
        if (src.startsWith('data:image/svg')) src = await svgToPng(src);
        const { w, h } = await imageSize(src);
        const sc = Math.min(12 / (w / 96), 6.2 / (h / 96));
        s.addImage({ data: src, x: (13.33 - (w / 96) * sc) / 2, y: 0.6, w: (w / 96) * sc, h: (h / 96) * sc });
      } else {
        const txt = textOf(n);
        if (txt) current.lines.push({ text: n.type === 'heading' ? txt.toUpperCase() : txt, level: -1 });
      }
    }
    flush();
  }
  const out = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  return saveBinaryFile(`${safeName(page)}.pptx`, bytesToB64(out), [{ name: 'PowerPoint', extensions: ['pptx'] }]);
}

// -------------------------------------------------------------------- XLSX

export async function exportXlsx(page: Page) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const sheetName = (s: string, i: number) => (s || `Planilha ${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  if (page.type === 'database' && page.db) {
    const props = page.db.properties;
    const rows = page.db.rows.map((r) =>
      Object.fromEntries(
        props.map((p) => {
          const v = cellValue(p, r);
          if (isNum(p)) return [p.name, v === '' || v == null ? null : Number(v)];
          if (p.type === 'checkbox') return [p.name, !!v];
          if (p.type === 'password') return [p.name, v || ''];
          return [p.name, cellText(p, v)];
        }),
      ),
    );
    const ws = XLSX.utils.json_to_sheet(rows, { header: props.map((p) => p.name) });
    ws['!cols'] = props.map((p) => ({ wch: Math.max(12, p.name.length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName(page.title, 0));
  } else if (page.type === 'report' && page.report) {
    const pages = useVault.getState().pages;
    page.report.widgets.forEach((w, i) => {
      const { data, seriesKeys } = computeWidget(w, pages, '—');
      const rows = data.map((d) => ({ Categoria: d.label, Valor: d.value, ...Object.fromEntries(seriesKeys.map((s) => [s.label, d.series?.[s.key] || 0])) }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName(w.title || pages[w.source]?.title || '', i));
    });
  } else {
    const tables = (page.content?.content || []).filter((n: any) => n.type === 'table');
    tables.forEach((tb: any, i: number) => {
      const aoa = (tb.content || []).map((r: any) => (r.content || []).map((c: any) => {
        const s = docText(c).join('').trim();
        return s !== '' && !isNaN(Number(s.replace(',', '.'))) ? Number(s.replace(',', '.')) : s;
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName(`Tabela ${i + 1}`, i));
    });
    const lines = docText(page.content).join('').split('\n').map((s) => s.trim()).filter(Boolean).map((s) => [s]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[page.title], [], ...lines]), sheetName('Texto', tables.length));
  }
  const out = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  return saveBinaryFile(`${safeName(page)}.xlsx`, out, [{ name: 'Excel', extensions: ['xlsx'] }]);
}
