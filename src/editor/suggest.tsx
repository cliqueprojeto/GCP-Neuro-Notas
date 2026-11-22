import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';

export interface SuggestItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  group?: string;
  tone?: string;
  run: (props: SuggestionProps<SuggestItem>) => void;
}

interface ListProps {
  items: SuggestItem[];
  command: (item: SuggestItem) => void;
  empty: string;
}

export interface ListHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

export const SuggestList = forwardRef<ListHandle, ListProps>(({ items, command, empty }, ref) => {
  const [sel, setSel] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setSel(0), [items]);
  useEffect(() => {
    box.current?.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);
  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown') return setSel((s) => (s + 1) % Math.max(items.length, 1)), true;
      if (e.key === 'ArrowUp') return setSel((s) => (s - 1 + items.length) % Math.max(items.length, 1)), true;
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (items[sel]) command(items[sel]);
        return true;
      }
      return false;
    },
  }));
  let lastGroup = '';
  return (
    <div className="suggest" ref={box}>
      {!items.length && <div className="suggest-empty">{empty}</div>}
      {items.map((it, i) => {
        const header = it.group && it.group !== lastGroup ? it.group : '';
        lastGroup = it.group || lastGroup;
        return (
          <div key={it.id}>
            {header && <div className="suggest-group">{header}</div>}
            <button className={'suggest-item' + (i === sel ? ' is-selected' : '')} onMouseEnter={() => setSel(i)} onMouseDown={(e) => (e.preventDefault(), command(it))}>
              <span className={'suggest-icon' + (it.tone ? ' tone tone-' + it.tone : '')}>{it.icon}</span>
              <span className="suggest-text">
                <b>{it.title}</b>
                {it.subtitle && <small>{it.subtitle}</small>}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
});

/** Renderizador genérico de popups de sugestão (comando "/" e links "[["). */
export function suggestRender(empty: () => string): SuggestionOptions<SuggestItem>['render'] {
  return () => {
    let r: ReactRenderer<ListHandle, ListProps> | null = null;
    let el: HTMLDivElement | null = null;
    const place = (props: SuggestionProps<SuggestItem>) => {
      const rect = props.clientRect?.();
      if (!rect || !el) return;
      const h = Math.min(el.offsetHeight || 320, 360);
      const below = rect.bottom + 6 + h < window.innerHeight;
      el.style.left = Math.min(rect.left, window.innerWidth - 330) + 'px';
      el.style.top = (below ? rect.bottom + 6 : Math.max(8, rect.top - h - 6)) + 'px';
    };
    return {
      onStart: (props) => {
        r = new ReactRenderer(SuggestList, { props: { items: props.items, command: props.command, empty: empty() }, editor: props.editor });
        el = document.createElement('div');
        el.className = 'suggest-wrap';
        el.appendChild(r.element);
        document.body.appendChild(el);
        requestAnimationFrame(() => place(props));
      },
      onUpdate: (props) => {
        r?.updateProps({ items: props.items, command: props.command, empty: empty() });
        // Com espaços na busca e nada encontrado, some e deixa o texto seguir normalmente.
        if (el) el.style.display = !props.items.length && /\s/.test(props.query) ? 'none' : '';
        requestAnimationFrame(() => place(props));
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          el?.remove();
          return true;
        }
        if (el?.style.display === 'none') return false;
        return r?.ref?.onKeyDown(props.event) ?? false;
      },
      onExit: () => {
        el?.remove();
        r?.destroy();
        el = null;
        r = null;
      },
    };
  };
}
