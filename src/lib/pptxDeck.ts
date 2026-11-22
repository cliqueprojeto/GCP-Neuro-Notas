/**
 * PowerPoint ⇄ Quadro.
 * Exportar: cada moldura vira um slide 16:9 com formas nativas editáveis, fundo do tema,
 * transições e animações de entrada equivalentes (injetadas no XML do slide).
 * Importar: lê o .pptx (JSZip) e recria slides como molduras, preservando posição, tamanho,
 * cores, fontes, negrito/itálico, alinhamento, imagens, fundos, transições e animações.
 */
import type { CanvasData, CanvasEdge, CanvasNode, Page } from './types';
import { autoSlides, edgeGeomOf, strokePathOf } from '../canvas/CanvasView';
import { dashArray, themeOf, wigglePath } from '../canvas/backgrounds';
import { saveBinaryFile } from './platform';
import { uid } from './crypto';

const SW = 13.333, SH = 7.5; // polegadas (16:9)
const hex = (c?: string, fb = '1F2937') => {
  if (!c) return fb;
  let h = c.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return /^[0-9a-f]{6}/i.test(h) ? h.slice(0, 6).toUpperCase() : fb;
};
const lum = (c: string) => { const n = parseInt(hex(c), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const b64 = (buf: ArrayBuffer) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const noPrefix = (d: string) => d.replace(/^data:/, '');

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
async function svgToPng(svg: string, w: number, h: number, scale = 2): Promise<string | null> {
  try {
    const img = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } catch { return null; }
}

/** Fundo do slide: imagem (preencher/ajustar com ponto de foco e véu) ou tema com degradê. */
async function slideBackground(data: CanvasData): Promise<{ color?: string; data?: string }> {
  const bg = data.bg;
  const th = themeOf(bg);
  const W = 1600, H = 900;
  if (bg?.image) {
    try {
      const img = await loadImg(bg.image);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d')!;
      g.fillStyle = th.base || '#000'; g.fillRect(0, 0, W, H);
      const fit = bg.fit || 'cover';
      const s = fit === 'contain' ? Math.min(W / img.width, H / img.height) : Math.max(W / img.width, H / img.height);
      const dw = img.width * s, dh = img.height * s;
      const fx = (bg.focusX ?? 50) / 100, fy = (bg.focusY ?? 50) / 100;
      if (fit === 'tile') { const tw = 360, thh = (img.height / img.width) * tw; for (let y = 0; y < H; y += thh) for (let x = 0; x < W; x += tw) g.drawImage(img, x, y, tw, thh); }
      else g.drawImage(img, (W - dw) * fx, (H - dh) * fy, dw, dh);
      const dim = bg.dim ?? 0.25;
      if (dim > 0) { g.fillStyle = (bg.imageDark ?? true) ? `rgba(4,6,18,${dim})` : `rgba(255,255,255,${dim})`; g.fillRect(0, 0, W, H); }
      return { data: noPrefix(c.toDataURL('image/jpeg', 0.9)) };
    } catch { /* cai no tema */ }
  }
  if (th.layer) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;background:${th.layer.replace(/"/g, "'")}"></div></foreignObject></svg>`;
    const png = await svgToPng(svg, W, H, 1);
    if (png && png.length > 2000) {
      try {
        const img = await loadImg(png);
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        c.getContext('2d')!.drawImage(img, 0, 0);
        return { data: noPrefix(c.toDataURL('image/jpeg', 0.88)) };
      } catch { return { data: noPrefix(png) }; }
    }
  }
  return { color: hex(th.base || '#FFFFFF', 'FFFFFF') };
}

interface Anim { name: string; kind: 'fade' | 'up' | 'left' | 'zoom' | 'wipe'; dir?: 'l' | 'r' | 'u' | 'd'; delay: number; dur: number }

/** XML de animações de entrada (todas automáticas, no tempo do Quadro). */
function timingXml(anims: { spid: number; a: Anim }[]): string {
  if (!anims.length) return '';
  let id = 3;
  const tgt = (spid: number) => `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`;
  const set = (spid: number) => `<p:set><p:cBhvr><p:cTn id="${id++}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${tgt(spid)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`;
  const anim = (spid: number, dur: number, attr: string, from: string, to: string) =>
    `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${id++}" dur="${dur}" fill="hold"/>${tgt(spid)}<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav></p:tavLst></p:anim>`;
  const effect = (spid: number, dur: number, filter: string) => `<p:animEffect transition="in" filter="${filter}"><p:cBhvr><p:cTn id="${id++}" dur="${dur}"/>${tgt(spid)}</p:cBhvr></p:animEffect>`;
  const items = anims.sort((x, y) => x.a.delay - y.a.delay).map(({ spid, a }, i) => {
    const dur = Math.round(a.dur * 1000), delay = Math.round(a.delay * 1000);
    const cid = id++;
    let body = set(spid), preset = 10, sub = 0;
    if (a.kind === 'fade') body += effect(spid, dur, 'fade');
    else if (a.kind === 'up') { preset = 42; body += effect(spid, dur, 'fade') + anim(spid, dur, 'ppt_y', '#ppt_y+0.1', '#ppt_y'); }
    else if (a.kind === 'left') { preset = 2; sub = 2; body += anim(spid, dur, 'ppt_x', '#ppt_x+0.15', '#ppt_x') + effect(spid, dur, 'fade'); }
    else if (a.kind === 'zoom') { preset = 53; sub = 16; body += anim(spid, dur, 'ppt_w', '0', '#ppt_w') + anim(spid, dur, 'ppt_h', '0', '#ppt_h') + effect(spid, dur, 'fade'); }
    else { preset = 22; sub = { l: 8, r: 2, u: 1, d: 4 }[a.dir || 'l']; body += effect(spid, dur, `wipe(${{ l: 'left', r: 'right', u: 'up', d: 'down' }[a.dir || 'l']})`); }
    return `<p:par><p:cTn id="${cid}" presetID="${preset}" presetClass="entr" presetSubtype="${sub}" fill="hold" nodeType="${i === 0 ? 'afterEffect' : 'withEffect'}"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst></p:cTn></p:par>`;
  });
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="${id++}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="${id++}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${items.join('')}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}
function transitionXml(tr: string, dur: number): string {
  if (tr === 'none') return '';
  const spd = dur < 0.8 ? 'fast' : dur < 1.4 ? 'med' : 'slow';
  if (tr === 'fade') return `<p:transition spd="${spd}"><p:fade/></p:transition>`;
  if (tr === 'smooth' || tr === 'slide') return `<p:transition spd="${spd}"><p:push dir="l"/></p:transition>`;
  return `<p:transition spd="${spd}"><p:zoom dir="in"/></p:transition>`;
}

const ANIM_KIND: Record<string, Anim['kind']> = { fade: 'fade', 'slide-up': 'up', 'slide-left': 'left', zoom: 'zoom', pop: 'zoom', spin: 'zoom', pulse: 'fade', float: 'up', wiggle: 'fade' };

export async function exportDeckPptx(page: Page, overviewLabel = 'Overview') {
  const data = page.canvas;
  if (!data) return null;
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'GCP-Neuro Notas';
  pptx.title = page.title || 'Apresentação';
  const realFrames = data.nodes.filter((n) => n.kind === 'frame');
  const frames = realFrames.length ? realFrames : autoSlides(data.nodes, data.edges, overviewLabel);
  const bg = await slideBackground(data);
  const darkTheme = data.bg?.image ? data.bg.imageDark ?? true : themeOf(data.bg).dark;
  const defInk = darkTheme ? 'EEF0FF' : '1F2433';
  const deckTr = data.present?.transition || 'fly', deckDur = data.present?.duration || 1.1;
  const slideMeta: { tr: string; dur: number; anims: Anim[] }[] = [];
  const S = pptx.ShapeType;

  for (const f of frames) {
    const slide = pptx.addSlide();
    slide.background = bg.data ? { data: bg.data } : { color: bg.color };
    const s = Math.min(SW / f.w, SH / f.h), ox = (SW - f.w * s) / 2, oy = (SH - f.h * s) / 2;
    const X = (x: number) => ox + (x - f.x) * s, Y = (y: number) => oy + (y - f.y) * s;
    const inF = (n: CanvasNode) => { const cx = n.x + n.w / 2, cy = n.y + n.h / 2; return cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h; };
    const onSlide = (n: CanvasNode) => n.kind !== 'frame' && (n.slides?.length ? n.slides.includes(f.id) : inF(n));
    const nodes = data.nodes.filter(onSlide);
    const anims: Anim[] = [];
    let order = 0;
    const pt = (px: number) => Math.max(6, Math.round(px * s * 72 * 10) / 10);
    const addAnim = (name: string, n: CanvasNode) => {
      if (!n.anim || n.anim === 'none') return;
      anims.push({ name, kind: ANIM_KIND[n.anim] || 'fade', delay: n.animDelay ?? 0.25 + order * 0.14, dur: n.animDur || 0.7 });
      order++;
    };
    if (f.text && !f.hideTitle && !realFrames.length) { /* slides automáticos: sem título fixo */ }

    for (const n of nodes) {
      const name = `gcp-${n.id}`;
      const box = { x: X(n.x), y: Y(n.y), w: Math.max(0.05, n.w * s), h: Math.max(0.05, n.h * s) };
      const link = n.link && n.link.type === 'url' && n.link.target ? { url: n.link.target } : n.link?.type === 'email' && n.link.target ? { url: 'mailto:' + n.link.target } : undefined;
      const txtOpts = (def: number, color: string) => ({
        fontSize: pt(n.fontSize || def), color, bold: !!n.bold || n.kind === 'shape', italic: !!n.italic, fontFace: n.font || 'Calibri',
        align: (n.align || (n.kind === 'shape' || n.kind === 'button' ? 'center' : 'left')) as any, valign: (n.kind === 'note' || n.kind === 'text' ? 'top' : 'middle') as any,
        margin: n.kind === 'note' ? 10 * s * 72 / 72 : 4, ...(link ? { hyperlink: link } : {}),
      });
      if (n.kind === 'text') {
        slide.addText(n.text || '', { ...box, ...txtOpts(22, hex(n.color, defInk)), objectName: name, fit: 'none' } as any);
      } else if (n.kind === 'note') {
        const ink = n.textColor ? hex(n.textColor) : lum(n.color) < 0.58 ? 'F1F5F9' : '1F2937';
        slide.addText(n.text || '', { ...box, ...txtOpts(15, ink), shape: S.rect, fill: { color: hex(n.color, 'FDE68A'), transparency: n.fill === 'glass' ? 45 : 0 }, shadow: { type: 'outer', blur: 8, offset: 3, angle: 90, color: '000000', opacity: 0.22 }, objectName: name } as any);
      } else if (n.kind === 'shape') {
        const ink = n.textColor ? hex(n.textColor) : lum(n.color) < 0.58 ? 'FFFFFF' : '1F2937';
        const fill = { color: hex(n.color, '8B5CF6'), transparency: n.fill === 'glass' ? 45 : 0 };
        const line = { color: hex(n.color, '8B5CF6'), width: 0.75 };
        let shape: any = S.roundRect, extra: any = { rectRadius: n.corner === 'pill' ? box.h / 2 : n.corner === 'square' ? 0.02 : Math.min(14, n.h / 4) * s };
        if (n.shape === 'ellipse') (shape = S.ellipse), (extra = {});
        else if (n.shape === 'diamond') (shape = S.diamond), (extra = {});
        else if (n.shape === 'triangle') (shape = S.triangle), (extra = {});
        else if (n.shape === 'poly' && n.poly) {
          shape = 'custGeom';
          const pts = n.poly.split(' ').map((q) => q.split(',').map(Number)).map(([px, py]) => ({ x: (px / 100) * box.w, y: (py / 100) * box.h }));
          extra = { points: [...pts, { close: true }] };
        }
        slide.addText(n.text || '', { ...box, ...txtOpts(15, ink), shape, fill, line, ...extra, objectName: name } as any);
      } else if (n.kind === 'button') {
        slide.addText(n.text || '', { ...box, ...txtOpts(15, 'FFFFFF'), bold: true, shape: S.roundRect, rectRadius: box.h / 2, fill: { color: hex(n.color && n.color !== '#ffffff' ? n.color : '#7C3AED') }, objectName: name } as any);
      } else if (n.kind === 'image' && n.src) {
        let src = n.src;
        if (src.startsWith('data:image/svg')) src = (await svgToPng(decodeURIComponent(src.split(',')[1] || ''), n.w, n.h)) || src;
        slide.addImage({ data: noPrefix(src), ...box, objectName: name, ...(link ? { hyperlink: link } : {}) } as any);
      } else if (n.kind === 'draw' && n.points) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n.w}" height="${n.h}" viewBox="0 0 ${n.w} ${n.h}"><path d="${strokePathOf(n.points)}" stroke="${n.color}" stroke-width="${n.stroke || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        const png = await svgToPng(svg, n.w, n.h, 3);
        if (png) slide.addImage({ data: noPrefix(png), ...box, objectName: name } as any);
      } else if (n.kind === 'page' || n.kind === 'chart') {
        slide.addText(n.text || '', { ...box, ...txtOpts(16, '1F2937'), shape: S.roundRect, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'C4B5FD', width: 1 }, objectName: name } as any);
      } else continue;
      addAnim(name, n);
    }

    // conectores: retos viram linhas nativas; curvos/estilizados viram imagem fiel (cada um anima com "revelar")
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of data.edges as CanvasEdge[]) {
      if (!ids.has(e.from) || !ids.has(e.to)) continue;
      const a = nodes.find((n) => n.id === e.from)!, b = nodes.find((n) => n.id === e.to)!;
      const g = edgeGeomOf(e, a, b);
      const ew = e.width || 2, color = e.color || (darkTheme ? '#a3a9d1' : '#64748b');
      const name = `gcp-${e.id}`;
      const arrow = e.arrow || 'end';
      const dash = e.dash || 'solid';
      const dir: Anim['dir'] = Math.abs(g.p2.x - g.p1.x) >= Math.abs(g.p2.y - g.p1.y) ? (g.p2.x >= g.p1.x ? 'l' : 'r') : g.p2.y >= g.p1.y ? 'u' : 'd';
      if ((e.style || 'curve') === 'straight' && ['solid', 'dashed', 'dotted', 'dashdot'].includes(dash)) {
        const x1 = X(g.p1.x), y1 = Y(g.p1.y), x2 = X(g.p2.x), y2 = Y(g.p2.y);
        slide.addShape(S.line, {
          x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(0.01, Math.abs(x2 - x1)), h: Math.max(0.01, Math.abs(y2 - y1)), flipH: x2 < x1, flipV: y2 < y1,
          line: { color: hex(color), width: ew * s * 72 * 0.9, dashType: dash === 'dashed' ? 'dash' : dash === 'dotted' ? 'sysDot' : dash === 'dashdot' ? 'dashDot' : 'solid', endArrowType: arrow !== 'none' ? 'triangle' : undefined, beginArrowType: arrow === 'both' ? 'triangle' : undefined },
          objectName: name,
        } as any);
      } else {
        const pad = 24 + ew * 3;
        const minX = Math.min(g.p1.x, g.p2.x, a.x, b.x) - pad, minY = Math.min(g.p1.y, g.p2.y, a.y, b.y) - pad;
        const maxX = Math.max(g.p1.x, g.p2.x, a.x + a.w, b.x + b.w) + pad, maxY = Math.max(g.p1.y, g.p2.y, a.y + a.h, b.y + b.h) + pad;
        const d = dash === 'zigzag' || dash === 'wave' ? wigglePath(g.d, dash, ew) : g.d;
        const mk = arrow !== 'none' ? `<marker id="m" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="${10 + ew * 2.4}" markerHeight="${10 + ew * 2.4}" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker>` : '';
        const da = dashArray(dash, ew);
        const main = dash === 'double'
          ? `<path d="${g.d}" stroke="${color}" stroke-width="${ew * 2 + 3}" fill="none" ${arrow !== 'none' ? 'marker-end="url(#m)"' : ''}/><path d="${g.d}" stroke="#${bg.color || 'FFFFFF'}" stroke-width="${Math.max(1, ew * 2 - 1)}" fill="none"/>`
          : `<path d="${d}" stroke="${color}" stroke-width="${ew}" fill="none" ${da ? `stroke-dasharray="${da}"` : ''} stroke-linecap="round" ${arrow !== 'none' ? 'marker-end="url(#m)"' : ''} ${arrow === 'both' ? 'marker-start="url(#m)"' : ''} ${dash === 'glow' ? 'style="filter:drop-shadow(0 0 4px ' + color + ')"' : ''}/>`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX - minX}" height="${maxY - minY}" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}"><defs>${mk}</defs>${main}${e.label ? `<text x="${(g.p1.x + g.p2.x) / 2}" y="${(g.p1.y + g.p2.y) / 2 - 8}" text-anchor="middle" font-family="Calibri, sans-serif" font-size="13" font-weight="600" fill="${darkTheme ? '#eef0ff' : '#1f2433'}">${e.label.replace(/[<&]/g, '')}</text>` : ''}</svg>`;
        const png = await svgToPng(svg, maxX - minX, maxY - minY, 2);
        if (png) slide.addImage({ data: noPrefix(png), x: X(minX), y: Y(minY), w: (maxX - minX) * s, h: (maxY - minY) * s, objectName: name } as any);
      }
      if (e.label && (e.style || 'curve') === 'straight' && ['solid', 'dashed', 'dotted', 'dashdot'].includes(dash)) {
        slide.addText(e.label, { x: X((g.p1.x + g.p2.x) / 2) - 1, y: Y((g.p1.y + g.p2.y) / 2) - 0.35, w: 2, h: 0.3, fontSize: pt(13), bold: true, color: defInk, align: 'center' } as any);
      }
      const nd = (n: CanvasNode) => (n.anim && n.anim !== 'none' ? (n.animDelay ?? 0.25) + (n.animDur || 0.7) : 0);
      if (a.anim && a.anim !== 'none' || b.anim && b.anim !== 'none') anims.push({ name, kind: 'wipe', dir, delay: Math.max(nd(a), nd(b)) + 0.1, dur: 0.8 });
    }
    slideMeta.push({ tr: f.slideTr || deckTr, dur: f.slideDur || deckDur, anims });
  }

  // pós-processamento: injeta transições e animações no XML de cada slide
  const raw = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(raw);
  for (let i = 0; i < slideMeta.length; i++) {
    const path = `ppt/slides/slide${i + 1}.xml`;
    const file = zip.file(path);
    if (!file) continue;
    let xml = await file.async('string');
    const ids = new Map<string, number>();
    for (const m of xml.matchAll(/<p:cNvPr id="(\d+)" name="([^"]+)"/g)) ids.set(m[2], +m[1]);
    const anims = slideMeta[i].anims.filter((a) => ids.has(a.name)).map((a) => ({ spid: ids.get(a.name)!, a }));
    const extra = transitionXml(i === 0 ? 'fade' : slideMeta[i].tr, slideMeta[i].dur) + timingXml(anims);
    if (extra) xml = xml.replace(/<\/p:clrMapOvr>|(?=<\/p:sld>)/, (m) => (m ? m + extra : extra));
    zip.file(path, xml);
  }
  const out = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  const name = (page.title || 'apresentacao').replace(/[\\/:*?"<>|]+/g, '').trim() || 'apresentacao';
  return saveBinaryFile(`${name}.pptx`, b64(out), [{ name: 'PowerPoint', extensions: ['pptx'] }]);
}

/* ======================================================================= IMPORTAÇÃO */

const EMU = 914400;
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const kids = (el: Element | null | undefined, ns: string, name: string) => (el ? Array.from(el.children).filter((c) => c.namespaceURI === ns && c.localName === name) : []);
const kid = (el: Element | null | undefined, ns: string, name: string) => kids(el, ns, name)[0] || null;
const desc = (el: Element | null | undefined, ns: string, name: string) => (el ? (el.getElementsByTagNameNS(ns, name)[0] as Element | undefined) || null : null);

interface Ctx { theme: Record<string, string>; zip: any; media: Map<string, string> }
const resolvePath = (base: string, target: string) => {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) seg === '..' ? parts.pop() : seg !== '.' && parts.push(seg);
  return parts.join('/');
};
async function readXml(zip: any, path: string): Promise<Document | null> {
  const f = zip.file(path);
  if (!f) return null;
  return new DOMParser().parseFromString(await f.async('string'), 'application/xml');
}
async function rels(zip: any, path: string): Promise<Map<string, { target: string; type: string }>> {
  const p = path.replace(/([^/]+)$/, '_rels/$1.rels');
  const doc = await readXml(zip, p);
  const m = new Map<string, { target: string; type: string }>();
  if (!doc) return m;
  for (const r of Array.from(doc.getElementsByTagName('Relationship'))) m.set(r.getAttribute('Id')!, { target: resolvePath(path, r.getAttribute('Target')!), type: r.getAttribute('Type') || '' });
  return m;
}
function colorOf(el: Element | null, ctx: Ctx): { color?: string; alpha?: number } {
  if (!el) return {};
  const srgb = kid(el, A, 'srgbClr'), sch = kid(el, A, 'schemeClr'), sys = kid(el, A, 'sysClr'), prst = kid(el, A, 'prstClr');
  const c = srgb || sch || sys || prst;
  if (!c) return {};
  let v = srgb ? srgb.getAttribute('val') : sch ? ctx.theme[sch.getAttribute('val') || ''] : sys ? sys.getAttribute('lastClr') : ({ black: '000000', white: 'FFFFFF', red: 'FF0000', blue: '0000FF', green: '00FF00' } as Record<string, string>)[prst!.getAttribute('val') || ''];
  if (!v) return {};
  let r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
  const mods = Array.from(c.children);
  let alpha = 1;
  for (const m of mods) {
    const val = +(m.getAttribute('val') || 0) / 100000;
    if (m.localName === 'lumMod') (r *= val), (g *= val), (b *= val);
    else if (m.localName === 'lumOff') (r += 255 * val), (g += 255 * val), (b += 255 * val);
    else if (m.localName === 'tint') (r = r + (255 - r) * (1 - val)), (g = g + (255 - g) * (1 - val)), (b = b + (255 - b) * (1 - val));
    else if (m.localName === 'shade') (r *= val), (g *= val), (b *= val);
    else if (m.localName === 'alpha') alpha = val;
  }
  const h = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  v = h(r) + h(g) + h(b);
  return { color: '#' + v, alpha };
}
async function mediaUrl(ctx: Ctx, path: string): Promise<string | null> {
  if (ctx.media.has(path)) return ctx.media.get(path)!;
  const f = ctx.zip.file(path);
  if (!f) return null;
  const ext = (path.split('.').pop() || 'png').toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : ext === 'emf' || ext === 'wmf' ? '' : 'image/png';
  if (!mime) return null;
  const url = `data:${mime};base64,` + (await f.async('base64'));
  ctx.media.set(path, url);
  return url;
}

interface Xf { x: number; y: number; w: number; h: number; rot: number; flipH: boolean; flipV: boolean }
function xfrmOf(spPr: Element | null): Xf | null {
  const x = kid(spPr, A, 'xfrm');
  if (!x) return null;
  const off = kid(x, A, 'off'), ext = kid(x, A, 'ext');
  if (!off || !ext) return null;
  return { x: +off.getAttribute('x')!, y: +off.getAttribute('y')!, w: +ext.getAttribute('cx')!, h: +ext.getAttribute('cy')!, rot: +(x.getAttribute('rot') || 0) / 60000, flipH: x.getAttribute('flipH') === '1', flipV: x.getAttribute('flipV') === '1' };
}
const phKey = (sp: Element) => {
  const ph = desc(kid(kid(sp, P, 'nvSpPr') || kid(sp, P, 'nvPicPr'), P, 'nvPr'), P, 'ph');
  if (!ph) return null;
  return { type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx') || '' };
};

const PRST: Record<string, { shape: CanvasNode['shape']; corner?: CanvasNode['corner']; poly?: string }> = {
  rect: { shape: 'rect', corner: 'square' }, roundRect: { shape: 'rect', corner: 'rounded' }, ellipse: { shape: 'ellipse' }, diamond: { shape: 'diamond' }, triangle: { shape: 'triangle' },
  flowChartTerminator: { shape: 'rect', corner: 'pill' }, flowChartProcess: { shape: 'rect', corner: 'square' }, flowChartDecision: { shape: 'diamond' },
  hexagon: { shape: 'poly', poly: '25,0 75,0 100,50 75,100 25,100 0,50' }, chevron: { shape: 'poly', poly: '0,0 80,0 100,50 80,100 0,100 20,50' },
  homePlate: { shape: 'poly', poly: '0,0 80,0 100,50 80,100 0,100' }, pentagon: { shape: 'poly', poly: '50,0 100,38 81,100 19,100 0,38' },
  trapezoid: { shape: 'poly', poly: '20,0 80,0 100,100 0,100' }, parallelogram: { shape: 'poly', poly: '25,0 100,0 75,100 0,100' },
  rtTriangle: { shape: 'poly', poly: '0,0 100,100 0,100' }, octagon: { shape: 'poly', poly: '30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30' },
  rightArrow: { shape: 'poly', poly: '0,25 65,25 65,0 100,50 65,100 65,75 0,75' }, leftArrow: { shape: 'poly', poly: '100,25 35,25 35,0 0,50 35,100 35,75 100,75' },
  star5: { shape: 'poly', poly: '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35' },
};

interface TextInfo { text: string; size?: number; bold?: boolean; italic?: boolean; color?: string; align?: CanvasNode['align']; font?: string; anchor?: string }
function textOf(txBody: Element | null, ctx: Ctx): TextInfo | null {
  if (!txBody) return null;
  const paras = kids(txBody, A, 'p');
  const lines: string[] = [];
  let size: number | undefined, bold: boolean | undefined, italic: boolean | undefined, color: string | undefined, align: TextInfo['align'], font: string | undefined;
  for (const p of paras) {
    const pPr = kid(p, A, 'pPr');
    if (!align && pPr?.getAttribute('algn')) align = ({ ctr: 'center', r: 'right', l: 'left', just: 'left' } as Record<string, TextInfo['align']>)[pPr.getAttribute('algn')!];
    const bullet = pPr && (kid(pPr, A, 'buChar') || kid(pPr, A, 'buAutoNum')) ? '• ' : '';
    const lvl = +(pPr?.getAttribute('lvl') || 0);
    let line = '';
    for (const r of Array.from(p.children)) {
      if (r.localName === 'r' || r.localName === 'fld') {
        const rPr = kid(r, A, 'rPr');
        if (rPr) {
          if (size === undefined && rPr.getAttribute('sz')) size = +rPr.getAttribute('sz')! / 100;
          if (bold === undefined && rPr.getAttribute('b')) bold = rPr.getAttribute('b') === '1';
          if (italic === undefined && rPr.getAttribute('i')) italic = rPr.getAttribute('i') === '1';
          if (!color) color = colorOf(kid(rPr, A, 'solidFill'), ctx).color;
          if (!font) font = kid(rPr, A, 'latin')?.getAttribute('typeface') || undefined;
        }
        line += kid(r, A, 't')?.textContent || '';
      } else if (r.localName === 'br') line += '\n';
    }
    lines.push(line ? '  '.repeat(lvl) + bullet + line : '');
  }
  const text = lines.join('\n').replace(/\n+$/, '');
  if (font && font.startsWith('+')) font = undefined;
  const bodyPr = kid(txBody, A, 'bodyPr');
  return { text, size, bold, italic, color, align, font, anchor: bodyPr?.getAttribute('anchor') || undefined };
}

interface PhDefaults { xf?: Xf; size?: number }
async function placeholderMap(zip: any, path: string): Promise<Map<string, PhDefaults>> {
  const m = new Map<string, PhDefaults>();
  const doc = await readXml(zip, path);
  if (!doc) return m;
  for (const sp of Array.from(doc.getElementsByTagNameNS(P, 'sp'))) {
    const k = phKey(sp);
    if (!k) continue;
    const xf = xfrmOf(kid(sp, P, 'spPr')) || undefined;
    const sz = desc(kid(sp, P, 'txBody'), A, 'defRPr')?.getAttribute('sz');
    const v = { xf, size: sz ? +sz / 100 : undefined };
    m.set(`${k.type}|${k.idx}`, v);
    if (!m.has(`${k.type}|`)) m.set(`${k.type}|`, v);
    if (k.idx && !m.has(`*|${k.idx}`)) m.set(`*|${k.idx}`, v);
  }
  return m;
}

/** Lê um .pptx e devolve um quadro com uma moldura 16:9 por slide. */
export async function importPptx(buf: ArrayBuffer, labels: { slide: string }): Promise<{ title: string; canvas: CanvasData }> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);
  const pres = await readXml(zip, 'ppt/presentation.xml');
  if (!pres) throw new Error('pptx');
  const sz = pres.getElementsByTagNameNS(P, 'sldSz')[0];
  const cx = +(sz?.getAttribute('cx') || 12192000), cy = +(sz?.getAttribute('cy') || 6858000);
  const presRels = await rels(zip, 'ppt/presentation.xml');
  const slidePaths = Array.from(pres.getElementsByTagNameNS(P, 'sldId')).map((s) => presRels.get(s.getAttributeNS(R, 'id') || s.getAttribute('r:id') || '')?.target).filter(Boolean) as string[];
  // tema (cores)
  const theme: Record<string, string> = {};
  const themeRel = [...presRels.values()].find((r) => r.type.endsWith('/theme'));
  const themeDoc = themeRel ? await readXml(zip, themeRel.target) : null;
  const scheme = themeDoc?.getElementsByTagNameNS(A, 'clrScheme')[0];
  if (scheme) for (const c of Array.from(scheme.children)) { const v = kid(c, A, 'srgbClr')?.getAttribute('val') || kid(c, A, 'sysClr')?.getAttribute('lastClr'); if (v) theme[c.localName] = v; }
  Object.assign(theme, { tx1: theme.dk1, bg1: theme.lt1, tx2: theme.dk2, bg2: theme.lt2 });
  const ctx: Ctx = { theme, zip, media: new Map() };
  const props = await readXml(zip, 'docProps/core.xml');
  const title = props?.getElementsByTagName('dc:title')[0]?.textContent || '';

  const FW = 1280, FH = Math.round((1280 * cy) / cx), GAP = 160;
  const k = FW / cx;
  const nodes: CanvasNode[] = [];
  for (let si = 0; si < slidePaths.length; si++) {
    const path = slidePaths[si];
    const doc = await readXml(zip, path);
    if (!doc) continue;
    const sRels = await rels(zip, path);
    const layoutPath = [...sRels.values()].find((r) => r.type.endsWith('/slideLayout'))?.target;
    const layoutPh = layoutPath ? await placeholderMap(zip, layoutPath) : new Map();
    const masterPath = layoutPath ? [...(await rels(zip, layoutPath)).values()].find((r) => r.type.endsWith('/slideMaster'))?.target : undefined;
    const masterPh = masterPath ? await placeholderMap(zip, masterPath) : new Map();
    const fx = si * (FW + GAP), fy = 0;
    const frame: CanvasNode = { id: uid('n'), kind: 'frame', x: fx, y: fy, w: FW, h: FH, color: '#ffffff', text: `${labels.slide} ${si + 1}`, hideTitle: true };
    nodes.push(frame);
    const spIdToNode = new Map<string, CanvasNode>();

    // fundo (slide → layout → mestre)
    const bgOf = async (d: Document | null, relsMap: Map<string, { target: string; type: string }>) => {
      const bg = d?.getElementsByTagNameNS(P, 'bg')[0];
      const bgPr = kid(bg, P, 'bgPr');
      if (!bgPr) return null;
      const solid = kid(bgPr, A, 'solidFill');
      if (solid) return { color: colorOf(solid, ctx).color };
      const grad = kid(bgPr, A, 'gradFill');
      if (grad) { const g = desc(grad, A, 'gs'); return { color: colorOf(g, ctx).color }; }
      const blip = desc(kid(bgPr, A, 'blipFill'), A, 'blip');
      const rid = blip?.getAttributeNS(R, 'embed');
      if (rid && relsMap.get(rid)) return { image: await mediaUrl(ctx, relsMap.get(rid)!.target) };
      return null;
    };
    let bg = await bgOf(doc, sRels);
    if (!bg && layoutPath) bg = await bgOf(await readXml(zip, layoutPath), await rels(zip, layoutPath));
    if (!bg && masterPath) bg = await bgOf(await readXml(zip, masterPath), await rels(zip, masterPath));
    if (bg?.image) nodes.push({ id: uid('n'), kind: 'image', x: fx, y: fy, w: FW, h: FH, src: bg.image, color: '#ffffff' });
    else if (bg?.color && bg.color.toLowerCase() !== '#ffffff') nodes.push({ id: uid('n'), kind: 'shape', shape: 'rect', corner: 'square', x: fx, y: fy, w: FW, h: FH, color: bg.color, text: '' });

    const walk = async (parent: Element, off: { x: number; y: number; sx: number; sy: number; chx: number; chy: number }) => {
      for (const el of Array.from(parent.children)) {
        if (el.namespaceURI !== P) continue;
        const map = (xf: Xf) => ({ x: fx + ((xf.x - off.chx) * off.sx + off.x) * k, y: fy + ((xf.y - off.chy) * off.sy + off.y) * k, w: xf.w * off.sx * k, h: xf.h * off.sy * k });
        if (el.localName === 'grpSp') {
          const gx = xfrmOf(kid(el, P, 'grpSpPr'));
          const x = kid(kid(el, P, 'grpSpPr'), A, 'xfrm');
          const chOff = kid(x, A, 'chOff'), chExt = kid(x, A, 'chExt');
          if (gx && chOff && chExt) {
            const sx = gx.w / (+chExt.getAttribute('cx')! || gx.w), sy = gx.h / (+chExt.getAttribute('cy')! || gx.h);
            await walk(el, { x: (gx.x - off.chx) * off.sx + off.x, y: (gx.y - off.chy) * off.sy + off.y, sx: sx * off.sx, sy: sy * off.sy, chx: +chOff.getAttribute('x')!, chy: +chOff.getAttribute('y')! });
          } else await walk(el, off);
          continue;
        }
        const nv = kid(el, P, 'nvSpPr') || kid(el, P, 'nvPicPr') || kid(el, P, 'nvCxnSpPr') || kid(el, P, 'nvGraphicFramePr');
        const spid = kid(nv, P, 'cNvPr')?.getAttribute('id') || '';
        const spPr = kid(el, P, 'spPr');
        let xf = xfrmOf(spPr);
        const ph = phKey(el);
        const phDef = ph ? layoutPh.get(`${ph.type}|${ph.idx}`) || layoutPh.get(`*|${ph.idx}`) || layoutPh.get(`${ph.type}|`) || masterPh.get(`${ph.type}|`) || masterPh.get(`${ph.type === 'ctrTitle' ? 'title' : ph.type === 'subTitle' ? 'body' : ph.type}|`) : undefined;
        if (!xf && phDef?.xf) xf = phDef.xf;
        if (el.localName === 'graphicFrame') {
          const gxf = (() => { const x = kid(el, P, 'xfrm'); const o = kid(x, A, 'off'), e = kid(x, A, 'ext'); return o && e ? { x: +o.getAttribute('x')!, y: +o.getAttribute('y')!, w: +e.getAttribute('cx')!, h: +e.getAttribute('cy')!, rot: 0, flipH: false, flipV: false } : null; })();
          const tbl = desc(el, A, 'tbl');
          if (gxf && tbl) {
            const rows = kids(tbl, A, 'tr').map((tr) => kids(tr, A, 'tc').map((tc) => textOf(kid(tc, A, 'txBody'), ctx)?.text.replace(/\n/g, ' ') || ''));
            const b = map(gxf);
            nodes.push({ id: uid('n'), kind: 'note', ...b, color: '#ffffff', text: rows.map((r) => r.join('  |  ')).join('\n'), fontSize: 12 });
          }
          continue;
        }
        if (!xf) continue;
        const b = map(xf);
        if (b.w < 1 && b.h < 1) continue;
        let node: CanvasNode | null = null;
        if (el.localName === 'pic') {
          const blip = desc(kid(el, P, 'blipFill'), A, 'blip');
          const rid = blip?.getAttributeNS(R, 'embed');
          const src = rid && sRels.get(rid) ? await mediaUrl(ctx, sRels.get(rid)!.target) : null;
          if (src) node = { id: uid('n'), kind: 'image', ...b, src, color: '#ffffff' };
        } else if (el.localName === 'cxnSp' || (el.localName === 'sp' && kid(spPr, A, 'prstGeom')?.getAttribute('prst') === 'line')) {
          const ln = kid(spPr, A, 'ln');
          const col = colorOf(kid(ln, A, 'solidFill'), ctx).color || '#64748b';
          const wpx = Math.max(1, (+(ln?.getAttribute('w') || 12700) / 12700) * 1.333 * k * EMU / 96 * 96 / EMU * 1);
          const x1 = xf.flipH ? b.w : 0, y1 = xf.flipV ? b.h : 0, x2 = xf.flipH ? 0 : b.w, y2 = xf.flipV ? 0 : b.h;
          node = { id: uid('n'), kind: 'draw', x: b.x, y: b.y, w: Math.max(2, b.w), h: Math.max(2, b.h), color: col, stroke: Math.min(12, Math.max(1.5, wpx)), points: [x1, y1, x2, y2] };
        } else if (el.localName === 'sp') {
          const prst = kid(spPr, A, 'prstGeom')?.getAttribute('prst') || (kid(spPr, A, 'custGeom') ? 'rect' : '');
          const solid = kid(spPr, A, 'solidFill');
          const grad = kid(spPr, A, 'gradFill');
          const noFill = !!kid(spPr, A, 'noFill');
          const fillC = solid ? colorOf(solid, ctx) : grad ? colorOf(desc(grad, A, 'gs'), ctx) : {};
          const ti = textOf(kid(el, P, 'txBody'), ctx);
          const isTitle = ph && (ph.type === 'title' || ph.type === 'ctrTitle');
          const sizePt = ti?.size || phDef?.size || (isTitle ? 40 : ph ? 20 : 18);
          const fpx = Math.round(sizePt * (96 / 72) * (FW / (cx / EMU * 96)));
          const common = { fontSize: Math.max(8, fpx), bold: ti?.bold ?? (isTitle ? true : undefined), italic: ti?.italic, align: ti?.align, font: ti?.font };
          if (!noFill && fillC.color && prst) {
            const g = PRST[prst] || { shape: 'rect' as const, corner: 'square' as const };
            node = { id: uid('n'), kind: 'shape', ...b, color: fillC.color, shape: g.shape, corner: g.corner, poly: g.poly, text: ti?.text || '', textColor: ti?.color, ...common, align: ti?.align || 'center', fill: fillC.alpha !== undefined && fillC.alpha < 0.8 ? 'glass' : undefined };
          } else if (ti && ti.text.trim()) {
            node = { id: uid('n'), kind: 'text', ...b, color: ti.color || (theme.tx1 ? '#' + theme.tx1 : '#1f2937'), text: ti.text, ...common };
          } else if (prst && !noFill) {
            const ln = kid(spPr, A, 'ln');
            const lc = colorOf(kid(ln, A, 'solidFill'), ctx).color;
            if (lc) { const g = PRST[prst] || { shape: 'rect' as const }; node = { id: uid('n'), kind: 'shape', ...b, color: lc, shape: g.shape, poly: g.poly, corner: g.corner, text: '', fill: 'glass' }; }
          }
        }
        if (node) { nodes.push(node); if (spid) spIdToNode.set(spid, node); }
      }
    };
    const tree = doc.getElementsByTagNameNS(P, 'spTree')[0];
    if (tree) await walk(tree, { x: 0, y: 0, sx: 1, sy: 1, chx: 0, chy: 0 });

    // transição e animações de entrada
    const tr = doc.getElementsByTagNameNS(P, 'transition')[0];
    if (tr) {
      const kind = Array.from(tr.children).find((c) => c.namespaceURI === P || /p14|p15|p159/.test(c.prefix || ''))?.localName || '';
      frame.slideTr = kind === 'fade' ? 'fade' : !kind ? 'none' : kind === 'push' || kind === 'wipe' || kind === 'cover' ? 'smooth' : 'fly';
      const spd = tr.getAttribute('spd');
      frame.slideDur = spd === 'fast' ? 0.6 : spd === 'slow' ? 1.6 : 1.1;
    }
    let order = 0;
    for (const par of Array.from(doc.getElementsByTagNameNS(P, 'cTn')).filter((c) => c.getAttribute('presetClass') === 'entr')) {
      const t = par.getElementsByTagNameNS(P, 'spTgt')[0]?.getAttribute('spid');
      const n = t ? spIdToNode.get(t) : undefined;
      if (!n || n.anim) continue;
      const attrs = Array.from(par.getElementsByTagNameNS(P, 'attrName')).map((a) => a.textContent);
      const filter = par.getElementsByTagNameNS(P, 'animEffect')[0]?.getAttribute('filter') || '';
      n.anim = attrs.includes('ppt_w') ? 'zoom' : attrs.includes('ppt_y') ? 'slide-up' : attrs.includes('ppt_x') ? 'slide-left' : filter.startsWith('wipe') || filter.startsWith('fade') ? 'fade' : 'fade';
      const dur = +(par.getElementsByTagNameNS(P, 'cTn')[1]?.getAttribute('dur') || 500);
      n.animDur = Math.min(3, Math.max(0.2, dur / 1000));
      n.animDelay = 0.25 + order * 0.35;
      order++;
    }
  }
  return { title, canvas: { nodes, edges: [], view: { x: 40, y: 80, zoom: 0.5 }, bg: { theme: 'white', pattern: 'none' }, present: { transition: 'fly', duration: 1.1 } } };
}
