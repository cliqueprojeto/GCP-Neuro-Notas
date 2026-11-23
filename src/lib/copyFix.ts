/**
 * Copiar para Word/Docs/e-mail: mantém a formatação, mas troca as cores de texto claras
 * (as dos temas escuros) por preto e tira fundos escuros. Assim o texto colado fica legível
 * em papel branco, mesmo copiando com um tema escuro ativo. Cores escolhidas pelo usuário
 * (vermelho, azul…) continuam como estão.
 */
let probe: CanvasRenderingContext2D | null = null;

function rgbOf(v: string): [number, number, number, number] | null {
  if (!v || /var\(|currentcolor|inherit|transparent|initial|unset/i.test(v)) return /transparent/i.test(v) ? [0, 0, 0, 0] : null;
  probe ||= document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  probe.fillStyle = '#010203';
  probe.fillStyle = v.trim();
  const s = String(probe.fillStyle);
  if (s === '#010203' && !/#010203/i.test(v)) return null;
  if (s.startsWith('#')) return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
  const m = s.match(/[\d.]+/g);
  return m ? [+m[0], +m[1], +m[2], m[3] != null ? +m[3] : 1] : null;
}

function lum([r, g, b]: number[]) {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Limpa um trecho de HTML copiado (exportado para testes). */
export function paperSafeHtml(html: string): string {
  const box = document.createElement('div');
  box.innerHTML = html;
  box.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const st = el.style;
    if (st) {
      const c = st.getPropertyValue('color');
      if (c) {
        const rgb = rgbOf(c);
        if (!rgb || lum(rgb) > 0.55) st.setProperty('color', '#000000');
      }
      for (const prop of ['background-color', 'background']) {
        const bg = st.getPropertyValue(prop);
        if (!bg) continue;
        const rgb = rgbOf(bg);
        if (!rgb || (rgb[3] > 0 && lum(rgb) < 0.2)) st.removeProperty(prop);
      }
      for (const p of ['-webkit-text-fill-color', 'caret-color', 'text-shadow']) st.removeProperty(p);
      if (!st.cssText) el.removeAttribute('style');
    }
    if (el.tagName === 'FONT' && el.getAttribute('color')) {
      const rgb = rgbOf(el.getAttribute('color')!);
      if (!rgb || lum(rgb) > 0.55) el.setAttribute('color', '#000000');
    }
  });
  return box.innerHTML;
}

function inField(n: Node | null) {
  const el = n instanceof HTMLElement ? n : n?.parentElement;
  return !!el?.closest('input, textarea, select, [contenteditable="plaintext-only"]');
}

function onCopy(e: ClipboardEvent) {
  const dt = e.clipboardData;
  if (!dt) return;
  const set = dt.getData('text/html');
  if (set) {
    // O editor já preparou o HTML: só deixa as cores próprias para papel.
    dt.setData('text/html', paperSafeHtml(set));
    return;
  }
  if (e.type === 'cut' || e.defaultPrevented) return;
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount || inField(document.activeElement) || inField(sel.anchorNode)) return;
  // Cópia comum do navegador (tabelas, listas, leitura): monta o HTML sem as cores do tema.
  const box = document.createElement('div');
  for (let i = 0; i < sel.rangeCount; i++) box.appendChild(sel.getRangeAt(i).cloneContents());
  box.querySelectorAll('button, svg, input[type="checkbox"]').forEach((n) => n.remove());
  dt.setData('text/html', `<div style="color:#000000">${paperSafeHtml(box.innerHTML)}</div>`);
  dt.setData('text/plain', sel.toString());
  e.preventDefault();
}

export function installCopyFix() {
  document.addEventListener('copy', onCopy);
  document.addEventListener('cut', onCopy);
}
