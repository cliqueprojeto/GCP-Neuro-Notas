import { Component, type ReactNode } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { useT } from '../i18n';
import { useUi } from '../store/ui';

/**
 * Se uma tela quebrar, mostra um aviso no lugar dela em vez de deixar o app inteiro em branco.
 * O menu lateral continua funcionando e os dados não são afetados.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('[tela]', error);
  }
  render() {
    if (this.state.error) return <Fallback error={this.state.error} retry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}

function Fallback({ error, retry }: { error: Error; retry: () => void }) {
  const t = useT();
  return (
    <div className="crash-box">
      <AlertTriangle size={28} />
      <h2>{t('crash.title')}</h2>
      <p className="muted">{t('crash.text')}</p>
      <code className="small">{String(error?.message || error).slice(0, 300)}</code>
      <div className="row">
        <button className="btn primary" onClick={retry}><RotateCcw size={15} /> {t('crash.retry')}</button>
        <button className="btn ghost" onClick={() => (retry(), useUi.getState().go({ name: 'home' }))}><Home size={15} /> {t('nav.home')}</button>
      </div>
    </div>
  );
}
