import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store/store';
import { ToastProvider } from './components/toast';
import { registriereServiceWorker } from './lib/pwa';
import './styles/global.css';

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
