import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './lib/fonts';
import { installCopyFix } from './lib/copyFix';
import './styles/app.css';
import './styles/editor.css';
import './styles/features.css';
import './styles/mobile.css';

installCopyFix();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Somente no servidor de desenvolvimento: ganchos para testes automatizados.
if (import.meta.env.DEV) {
  void Promise.all([import('./store/vault'), import('./cloud/cloud'), import('./cloud/autosync')]).then(([v, c, a]) => {
    Object.assign(window, { __vault: v.useVault, __cloud: c, __sync: a });
  });
}
