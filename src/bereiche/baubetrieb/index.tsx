/**
 * Einstiegspunkt des Bereichs „Baubetriebsplanung“. Der Bereich ist angelegt,
 * hat aber noch keinen Inhalt: Rahmen, eigener Datenbestand, eigene
 * Einstellungen und eigener Router stehen, die Fachlichkeit folgt.
 */
import { useEffect } from 'react';
import { Card, EmptyState } from '../../shared/ui';
import { AppIcon, MailaenderLogo } from '../../shared/logos';
import { BereichWechsel } from '../../shell/BereichWechsel';
import { useRoute } from './lib/router';
import { StoreProvider, useStore } from './store/store';

export function BereichBaubetrieb() {
  return (
    <StoreProvider>
      <Platzhalter />
    </StoreProvider>
  );
}

function Platzhalter() {
  const { data, setEinstellungen } = useStore();
  const [route, navigate] = useRoute();

  const farbmodus = data.einstellungen.farbmodus;
  useEffect(() => {
    // Eigene Einstellung dieses Bereichs – unabhängig vom Planlaufmanagement.
    document.documentElement.dataset.farbmodus = farbmodus;
  }, [farbmodus]);

  return (
    <div className="app">
      <aside className="sidebar">
        <button
          type="button"
          className="sidebar-brand"
          onClick={() => navigate({ view: 'start' })}
          title="Zur Übersicht"
        >
          <AppIcon size={38} />
          <div className="sidebar-brand-text">
            <strong>MC Plan</strong>
            <span>Baubetriebsplanung</span>
          </div>
        </button>

        <div className="sidebar-footer">
          <label className="checkbox" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={farbmodus === 'kontrast'}
              onChange={(e) => setEinstellungen({ farbmodus: e.target.checked ? 'kontrast' : 'standard' })}
            />
            Farbmodus für Rot-Grün-Sehschwäche
          </label>
          Daten werden lokal im Browser gespeichert.
          <BereichWechsel />
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h1>Baubetriebsplanung</h1>
            <div className="sub">In Vorbereitung</div>
          </div>
          <div className="topbar-logo">
            <MailaenderLogo height={34} />
          </div>
        </header>

        <div className="content">
          <div className="content-inner">
            {route.view === 'start' ? (
              <Card>
                <EmptyState
                  icon="kalender"
                  titel="Noch ohne Inhalt"
                  text="Dieser Bereich ist angelegt und arbeitet mit eigenem Datenbestand und eigenen Einstellungen. Die Fachlichkeit der Baubetriebsplanung wird hier ergänzt."
                />
              </Card>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
