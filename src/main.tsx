import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './bereiche/planlauf/App';
import { StoreProvider } from './bereiche/planlauf/store/store';
import { ToastProvider } from './shared/toast';
import { registriereServiceWorker } from './shared/pwa';
import './shared/global.css';

// Dem Notausgang in index.html melden, dass die Anwendung läuft.
declare global {
  interface Window {
    planlaufGestartet?: () => void;
  }
}
window.planlaufGestartet?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
);

registriereServiceWorker();
