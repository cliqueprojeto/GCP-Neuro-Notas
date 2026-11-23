import { useRef, useState } from 'react';
import { Check, Pipette, Plus, X } from 'lucide-react';
import { useT } from '../i18n';
import { useVault } from '../store/vault';
import { toast } from '../store/ui';
import { Popover } from './ui';

const MAX_SAVED = 30;

/** Aceita #rgb, #rrggbb, rrggbb e rgb(r,g,b); devolve #rrggbb ou null. */
export function normalizeHex(v: string): string | null {
  const s = v.trim().toLowerCase();
  const rgb = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (rgb) return '#' + rgb.slice(1, 4).map((n) => Math.min(255, +n).toString(16).padStart(2, '0')).join('');
  const h = s.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(h)) return '#' + h.split('').map((c) => c + c).join('');
  if (/^[0-9a-f]{6}$/.test(h)) return '#' + h;
  return null;
}

export function useDesignerColors() {
  const colors = useVault((v) => v.settings.designerColors) || [];
  const save = (c: string) =>
    useVault.getState().updateSettings((s) => ((s.designerColors = [c, ...(s.designerColors || []).filter((x) => x !== c)].slice(0, MAX_SAVED)), s));
  const remove = (c: string) => useVault.getState().updateSettings((s) => ((s.designerColors = (s.designerColors || []).filter((x) => x !== c)), s));
  return { colors, save, remove };
}

/** Conta-gotas: usa o do sistema quando existe; senão, pega a cor de qualquer ponto da janela do app. */
export async function pickScreenColor(): Promise<string | null> {
  const ED = (window as any).EyeDropper;
  if (ED) {
    try {
      const r = await new ED().open();
      return normalizeHex(r.sRGBHex);
    } catch {
      return null;
    }
  }
  return pickInAppColor();
}

async function pickInAppColor(): Promise<string | null> {
  const html2canvas = (await import('html2canvas-pro')).default;
  const shot = await html2canvas(document.body, { useCORS: true, logging: false, backgroundColor: null, scale: 1, width: innerWidth, height: innerHeight, x: scrollX, y: scrollY, ignoreElements: (el) => el.classList?.contains('popover') });
  const ctx = shot.getContext('2d', { willReadFrequently: true })!;
  const sx = shot.width / innerWidth, sy = shot.height / innerHeight;
  const at = (x: number, y: number) => {
    const d = ctx.getImageData(Math.floor(x * sx), Math.floor(y * sy), 1, 1).data;
    return '#' + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join('');
  };
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.className = 'eyedrop-layer';
    const chip = document.createElement('div');
    chip.className = 'eyedrop-chip';
    layer.appendChild(chip);
    document.body.appendChild(layer);
    const done = (c: string | null) => (layer.remove(), removeEventListener('keydown', key, true), resolve(c));
    const key = (e: KeyboardEvent) => e.key === 'Escape' && (e.preventDefault(), done(null));
    addEventListener('keydown', key, true);
    layer.addEventListener('pointermove', (e) => {
      const c = at(e.clientX, e.clientY);
      chip.style.background = c;
      chip.textContent = c;
      chip.style.left = Math.min(e.clientX + 18, innerWidth - 110) + 'px';
      chip.style.top = Math.min(e.clientY + 18, innerHeight - 40) + 'px';
    });
    layer.addEventListener('pointerup', (e) => (e.preventDefault(), done(at(e.clientX, e.clientY))));
  });
}

/**
 * Cores salvas na paleta do designer + botão "+" (código da cor, seletor e conta-gotas).
 * Use ao lado das cores prontas de qualquer seletor.
 */
export function CustomColors({ value, onPick, small, noAdd }: { value?: string; onPick: (c: string) => void; small?: boolean; noAdd?: boolean }) {
  const t = useT();
  const { colors, save, remove } = useDesignerColors();
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value && normalizeHex(value) ? normalizeHex(value)! : '#7c3aed');
  const [text, setText] = useState(hex);
  const cur = normalizeHex(text);
  const setBoth = (c: string) => (setHex(c), setText(c));
  const dot = 'color-dot' + (small ? ' sm' : '');
  const keep = (e: React.MouseEvent) => e.preventDefault();

  const drop = async () => {
    setOpen(false);
    await new Promise((r) => setTimeout(r, 120));
    const c = await pickScreenColor();
    if (c) {
      setBoth(c);
      onPick(c);
      save(c);
      toast(t('color.saved', { c }), 'success');
    }
  };

  return (
    <>
      {colors.map((c) => (
        <button key={c} className={dot + (value === c ? ' on' : '')} style={{ background: c }} title={c} onMouseDown={keep} onClick={() => onPick(c)} />
      ))}
      {!noAdd && (<>
      <button ref={btn} className={dot + ' color-more'} title={t('color.custom')} aria-label={t('color.custom')} onMouseDown={keep} onClick={() => setOpen(!open)}>
        <Plus size={small ? 11 : 13} />
      </button>
      <Popover anchor={btn.current} open={open} onClose={() => setOpen(false)}>
        <div className="color-panel" onMouseDown={(e) => (e.target as HTMLElement).tagName !== 'INPUT' && e.preventDefault()}>
          <div className="color-panel-head">{t('color.custom')}</div>
          <div className="color-panel-row">
            <input type="color" className="color-input big" value={cur || hex} onChange={(e) => setBoth(e.target.value)} />
            <input className="input mono" value={text} spellCheck={false} maxLength={22} placeholder="#RRGGBB" onChange={(e) => (setText(e.target.value), normalizeHex(e.target.value) && setHex(normalizeHex(e.target.value)!))} onKeyDown={(e) => e.key === 'Enter' && cur && (onPick(cur), setOpen(false))} />
            <button className="icon-btn boxed" title={t('color.eyedropper')} onClick={drop}><Pipette size={16} /></button>
          </div>
          <div className="color-panel-row">
            <button className="btn sm" disabled={!cur} onClick={() => cur && (save(cur), toast(t('color.saved', { c: cur }), 'success'))}><Plus size={14} /> {t('color.save')}</button>
            <button className="btn primary sm" disabled={!cur} onClick={() => cur && (onPick(cur), setOpen(false))}><Check size={14} /> {t('color.apply')}</button>
          </div>
          {colors.length > 0 && (
            <>
              <div className="color-panel-head">{t('color.palette')}</div>
              <div className="color-panel-saved">
                {colors.map((c) => (
                  <span key={c} className="saved-color">
                    <button className="color-dot" style={{ background: c }} title={c} onClick={() => setBoth(c)} />
                    <button className="saved-x" title={t('common.delete')} onClick={() => remove(c)}><X size={10} /></button>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </Popover>
      </>)}
    </>
  );
}
