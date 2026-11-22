import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { icons } from 'lucide-react';

// ------------------------------------------------------------------ Modal

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal ' + className} style={{ width }} role="dialog" aria-modal="true">
        {title && (
          <div className="modal-head">
            <h3>{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// --------------------------------------------------------------- Popover

export function Popover({
  anchor,
  open,
  onClose,
  children,
  align = 'left',
  className = '',
}: {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const el = ref.current;
    const w = el?.offsetWidth || 240;
    const h = el?.offsetHeight || 200;
    let left = align === 'right' ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    setPos({ top, left });
  }, [open, anchor, align]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return;
      // Cliques em listas/menus abertos por cima deste (Select aninhado, menu de contexto, janela) não fecham o pai.
      const t = e.target as HTMLElement;
      if (t.closest?.('.popover, .ctx-back, .modal-back, .suggest-wrap')) {
        const top = t.closest('.popover');
        if (!top || top !== ref.current) return;
      }
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => window.addEventListener('mousedown', down), 0);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
    };
  }, [open, anchor, onClose]);
  if (!open) return null;
  return createPortal(
    <div ref={ref} className={'popover ' + className} style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}>
      {children}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Select

export interface Option<T extends string = string> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className = '',
  placeholder,
}: {
  value: T | undefined;
  options: Option<T>[];
  onChange: (v: T) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const cur = options.find((o) => o.value === value);
  return (
    <>
      <button ref={btn} type="button" className={'select ' + className} onClick={() => setOpen(!open)}>
        {cur?.icon}
        <span className="select-label">{cur ? cur.label : <span className="muted">{placeholder}</span>}</span>
        <ChevronDown size={16} className="select-caret" />
      </button>
      <Popover anchor={btn.current} open={open} onClose={() => setOpen(false)} className="select-pop">
        <div style={{ minWidth: btn.current?.offsetWidth }}>
          {options.map((o) => (
            <button
              key={o.value}
              className={'menu-item' + (o.value === value ? ' active' : '')}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.icon}
              <span className="grow">
                {o.label}
                {o.hint && <small className="menu-hint">{o.hint}</small>}
              </span>
              {o.value === value && <Check size={15} />}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------- Switch

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="switch-row">
      <button type="button" role="switch" aria-checked={checked} className={'switch' + (checked ? ' on' : '')} onClick={() => onChange(!checked)}>
        <span />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}

// ---------------------------------------------------------------- Ícones

/** Ícone de página: emoji, ícone vetorial ("lucide:Nome:#cor") ou imagem. */
export function PageIcon({ icon, size = 18, className = '' }: { icon: string; size?: number; className?: string }) {
  if (!icon) return <span className={'page-icon ' + className} style={{ fontSize: size }}>📄</span>;
  if (icon.startsWith('lucide:')) {
    const [, name, color] = icon.split(':');
    const Cmp = (icons as any)[name];
    if (Cmp) return <Cmp size={size} color={color || 'currentColor'} className={'page-icon ' + className} />;
  }
  if (icon.startsWith('data:')) return <img src={icon} alt="" className={'page-icon ' + className} style={{ width: size, height: size }} />;
  return (
    <span className={'page-icon ' + className} style={{ fontSize: size * 0.95, lineHeight: 1 }}>
      {icon}
    </span>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} />;
}

// ------------------------------------------------------- menu de contexto

export interface MenuEntry {
  label?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  sep?: boolean;
  disabled?: boolean;
  hint?: string;
}

/** Menu do botão direito (ou toque longo), posicionado onde o usuário tocou. */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) });
  }, [x, y]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    window.addEventListener('resize', onClose);
    return () => (window.removeEventListener('keydown', k), window.removeEventListener('resize', onClose));
  }, [onClose]);
  return createPortal(
    <div className="ctx-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onContextMenu={(e) => (e.preventDefault(), onClose())}>
      <div ref={ref} className="ctx-menu menu" style={{ left: pos.x, top: pos.y }} role="menu">
        {items.map((it, i) =>
          it.sep ? (
            <div key={i} className="menu-sep" />
          ) : (
            <button key={i} className={'menu-item' + (it.danger ? ' danger' : '')} disabled={it.disabled} onClick={() => (onClose(), it.onClick?.())}>
              {it.icon} <span className="grow">{it.label}</span> {it.hint && <kbd>{it.hint}</kbd>}
            </button>
          ),
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Toque longo (celular/tablet): chama `cb` após ~480 ms sem arrastar. */
export function longPress(cb: (x: number, y: number) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sx = 0, sy = 0;
  const clear = () => timer && (clearTimeout(timer), (timer = null));
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY;
      clear();
      timer = setTimeout(() => {
        timer = null;
        navigator.vibrate?.(12);
        cb(sx, sy);
      }, 480);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (Math.abs(t.clientX - sx) + Math.abs(t.clientY - sy) > 10) clear();
    },
    onTouchEnd: clear,
    onTouchCancel: clear,
  };
}
