import { useEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { useT } from '../i18n';
import { Modal } from './ui';

/** Pergunta de texto com o visual do app (substitui o window.prompt do sistema). */
interface Ask {
  title: ReactNode;
  label?: string;
  value?: string;
  placeholder?: string;
  password?: boolean;
  okLabel?: string;
  hint?: ReactNode;
  validate?: (v: string) => string | null;
  confirm?: boolean; // sem campo de texto: só confirmar/cancelar
  message?: ReactNode;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (v: string | null) => void;
}

const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }));

export function askText(opts: Omit<Ask, 'resolve'>): Promise<string | null> {
  return new Promise((resolve) => useAsk.setState({ ask: { ...opts, resolve } }));
}

/** Confirmação com o visual do app (substitui o window.confirm do sistema). */
export async function askConfirm(opts: { title: ReactNode; message?: ReactNode; okLabel?: string; cancelLabel?: string; danger?: boolean }): Promise<boolean> {
  const r = await new Promise<string | null>((resolve) => useAsk.setState({ ask: { ...opts, confirm: true, resolve } }));
  return r !== null;
}

export function PromptHost() {
  const t = useT();
  const ask = useAsk((s) => s.ask);
  const [v, setV] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ask) {
      setV(ask.value || '');
      setTimeout(() => input.current?.select(), 30);
    }
  }, [ask]);
  if (!ask) return null;
  const err = ask.validate && v ? ask.validate(v) : null;
  const done = (val: string | null) => {
    useAsk.setState({ ask: null });
    ask.resolve(val);
  };
  return (
    <Modal
      open
      onClose={() => done(null)}
      width={460}
      title={ask.title}
      className="ask-modal"
      footer={
        <>
          <div className="grow" />
          <button className="btn ghost" onClick={() => done(null)}>{ask.cancelLabel || t('common.cancel')}</button>
          <button className={'btn ' + (ask.danger ? 'danger-solid' : 'primary')} disabled={!!err} onClick={() => done(v)}>{ask.okLabel || t('common.done')}</button>
        </>
      }
    >
      {ask.message && <div className="ask-message">{ask.message}</div>}
      {ask.label && <label className="field-label">{ask.label}</label>}
      {!ask.confirm && <input
        ref={input}
        className={'input' + (err ? ' invalid' : '')}
        type={ask.password ? 'password' : 'text'}
        value={v}
        placeholder={ask.placeholder}
        autoFocus
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !err && done(v)}
      />}
      {err ? <p className="error small">{err}</p> : ask.hint ? <div className="muted small ask-hint">{ask.hint}</div> : null}
    </Modal>
  );
}
