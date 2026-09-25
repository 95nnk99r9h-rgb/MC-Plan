/** Anwendungsrahmen: Seitenleiste, Kopfzeile und Auswahl der Ansicht. */
import { useEffect, useState } from 'react';
import { eigeneTodos, offeneFristen } from './domain/engine';
import { exportiereDaten } from './store/storage';
import { useStore } from './store/store';
import { useRoute, type Route } from './lib/router';
import { useToast } from '../../shared/toast';
import { Dashboard, sichtbareProjekte } from './pages/Dashboard';
import { Fristen } from './pages/Fristen';
import { ProjektDetail } from './pages/ProjektDetail';
import { Projekte } from './pages/Projekte';
import { Workflows } from './pages/Workflows';
import { Funktionen } from './pages/Funktionen';
import { Vorlagen } from './pages/Vorlagen';
import { PlanlaufDetail } from './pages/projekt/PlanlaufDetail';
import { Card, ConfirmDialog, EmptyState, Field, Modal, TextInput } from '../../shared/ui';
import { EIGENE_ROLLE, STANDARD_BEARBEITER, type Project } from './domain/types';
import { Icon } from '../../shared/icons';
import { AppIcon, MailaenderLogo } from '../../shared/logos';
import { BereichWechsel } from '../../shell/BereichWechsel';
import type { IconName } from '../../shared/icons';

export function App() {
  const { data, zuruecksetzen } = useStore();
  const toast = useToast();
  const [route, navigate] = useRoute();
  const [menuOffen, setMenuOffen] = useState(false);
  const [zuruecksetzenDialog, setZuruecksetzenDialog] = useState(false);
  const [bearbeiterDialog, setBearbeiterDialog] = useState(false);

  const markierte = sichtbareProjekte(data.projects);
  const markierteIds = markierte.map((p) => p.id);
  const todos = eigeneTodos(data, markierteIds).length;
  const projekt =
    route.view === 'projekt' || route.view === 'planlauf'
      ? data.projects.find((p) => p.id === route.projectId)
      : undefined;
  const lauf = route.view === 'planlauf' ? data.runs.find((r) => r.id === route.runId) : undefined;

  const gehe = (r: Route) => {
    navigate(r);
    setMenuOffen(false);
  };

  const farbmodus = data.bearbeiter.farbmodus ?? 'standard';
  useEffect(() => {
    // Der Farbmodus steuert die Farbtokens der gesamten Oberfläche.
    document.documentElement.dataset.farbmodus = farbmodus;
  }, [farbmodus]);

  const kopf = kopfzeile(route, projekt, lauf?.name);

  return (
    <div className="app">
      <aside className={`sidebar ${menuOffen ? 'open' : ''}`}>
        <button type="button" className="sidebar-brand" onClick={() => gehe({ view: 'dashboard' })} title="Zur Übersicht">
          <AppIcon size={38} />
          <div className="sidebar-brand-text">
            <strong>MC Plan</strong>
            <span>Planlaufmanagement</span>
          </div>
        </button>

        <div className="nav-group-label erste">Planlaufmanagement</div>
        <NavItem
          icon="dashboard"
          label="Übersicht"
          aktiv={route.view === 'dashboard'}
          badge={todos > 0 ? String(todos) : undefined}
          onClick={() => gehe({ view: 'dashboard' })}
        />
        <NavItem icon="projekt" label="Projekte" aktiv={route.view === 'projekte'} onClick={() => gehe({ view: 'projekte' })} />
        <NavItem icon="kette" label="Workflows" aktiv={route.view === 'ketten'} onClick={() => gehe({ view: 'ketten' })} />
        <NavItem icon="person" label="Funktionen" aktiv={route.view === 'rollen'} onClick={() => gehe({ view: 'rollen' })} />
        <NavItem
          icon="kopieren"
          label="Vorlagen"
          aktiv={route.view === 'vorlagen'}
          onClick={() => gehe({ view: 'vorlagen' })}
        />

        <div className="nav-group-label">
          Projekte
          {markierte.length < data.projects.length ? <span className="tertiary"> (markierte)</span> : null}
        </div>
        {markierte.map((p) => {
          const offen = offeneFristen(data, [p.id]).filter((f) => f.ampel === 'ueberfaellig').length;
          return (
            <NavItem
              key={p.id}
              icon="projekt"
              label={p.nummer ? `${p.nummer} ${p.name}` : p.name}
              aktiv={projekt?.id === p.id}
              badge={offen > 0 ? String(offen) : undefined}
              badgeAlarm
              onClick={() => gehe({ view: 'projekt', projectId: p.id, tab: 'uebersicht' })}
            />
          );
        })}

        <div className="sidebar-footer">
          <button type="button" className="bearbeiter" onClick={() => setBearbeiterDialog(true)}>
            <span className="avatar" style={{ width: 26, height: 26 }}>
              {initialen(data.bearbeiter.name)}
            </span>
            <span style={{ minWidth: 0 }}>
              <strong className="truncate">{data.bearbeiter.name}</strong>
            </span>
          </button>
          <div className="row" style={{ gap: 4, margin: '8px 0' }}>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => exportiereDaten(data)}
              title="Gesamten Datenbestand als JSON sichern"
            >
              <Icon name="export" size={12} /> Sicherung
            </button>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setZuruecksetzenDialog(true)}>
              Zurücksetzen
            </button>
          </div>
          Daten werden lokal im Browser gespeichert.
          <BereichWechsel />
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button type="button" className="btn-icon menu-toggle" onClick={() => setMenuOffen((o) => !o)} aria-label="Menü">
            <Icon name="menu" size={18} />
          </button>
          <nav className="breadcrumb" aria-label="Pfad">
            {kopf.pfad.map((teil, i) => (
              <span key={i} className="row" style={{ gap: 0, minWidth: 0 }}>
                {i > 0 ? <span className="trenner">/</span> : null}
                {i === kopf.pfad.length - 1 ? (
                  <strong>{teil.label}</strong>
                ) : teil.route ? (
                  <button type="button" onClick={() => gehe(teil.route!)}>
                    {teil.label}
                  </button>
                ) : (
                  <span>{teil.label}</span>
                )}
              </span>
            ))}
          </nav>
          <div className="topbar-logo">
            <MailaenderLogo height={34} />
          </div>
        </header>

        <div className="content">
          <div className="content-inner">
            <div className="seitenkopf">
              {kopf.eyebrow ? <div className="eyebrow">{kopf.eyebrow}</div> : null}
              <h1>
                {kopf.titel}
                {kopf.punkt ? <span className="punkt">.</span> : null}
              </h1>
              {kopf.sub ? <div className="sub">{kopf.sub}</div> : null}
            </div>
            {route.view === 'dashboard' ? <Dashboard navigate={gehe} /> : null}
            {route.view === 'fristen' ? <Fristen navigate={gehe} /> : null}
            {route.view === 'projekte' ? <Projekte navigate={gehe} /> : null}
            {route.view === 'ketten' ? <Workflows /> : null}
            {route.view === 'rollen' ? <Funktionen /> : null}
            {route.view === 'vorlagen' ? <Vorlagen /> : null}
            {route.view === 'projekt' ? (
              projekt ? (
                <ProjektDetail project={projekt} tab={route.tab} navigate={gehe} />
              ) : (
                <NichtGefunden onZurueck={() => gehe({ view: 'projekte' })} />
              )
            ) : null}
            {route.view === 'planlauf' ? (
              projekt && lauf ? (
                <PlanlaufDetail
                  project={projekt}
                  run={lauf}
                  onZurueck={() => gehe({ view: 'projekt', projectId: projekt.id, tab: 'uebersicht' })}
                  oeffneLauf={(runId) => gehe({ view: 'planlauf', projectId: projekt.id, runId })}
                />
              ) : (
                <NichtGefunden onZurueck={() => gehe({ view: 'projekte' })} />
              )
            ) : null}
          </div>
        </div>
      </main>

      {/* Auf dem Telefon: feste Leiste am unteren Rand statt der Seitenleiste */}
      <nav className="mobile-nav" aria-label="Hauptnavigation">
        <MobilItem icon="dashboard" label="Übersicht" aktiv={route.view === 'dashboard'} onClick={() => gehe({ view: 'dashboard' })} />
        <MobilItem
          icon="projekt"
          label="Projekte"
          aktiv={route.view === 'projekte' || route.view === 'projekt' || route.view === 'planlauf'}
          onClick={() => gehe({ view: 'projekte' })}
        />
        <MobilItem icon="frist" label="Fristen" aktiv={route.view === 'fristen'} onClick={() => gehe({ view: 'fristen' })} />
        <MobilItem icon="menu" label="Mehr" aktiv={menuOffen} onClick={() => setMenuOffen((o) => !o)} />
      </nav>

      {menuOffen ? (
        <div
          className="overlay"
          style={{ background: 'rgba(0,0,0,0.18)', zIndex: 80 }}
          onClick={() => setMenuOffen(false)}
        />
      ) : null}

      {bearbeiterDialog ? <BearbeiterDialog onClose={() => setBearbeiterDialog(false)} /> : null}

      {zuruecksetzenDialog ? (
        <ConfirmDialog
          titel="Daten zurücksetzen?"
          text="Alle lokal gespeicherten Änderungen werden verworfen und der Demodatenbestand wird neu geladen."
          bestaetigenLabel="Zurücksetzen"
          onConfirm={() => {
            zuruecksetzen();
            toast('Demodaten wiederhergestellt.');
            gehe({ view: 'dashboard' });
          }}
          onClose={() => setZuruecksetzenDialog(false)}
        />
      ) : null}
    </div>
  );
}

/** Kürzel der angemeldeten Person für das Namensfeld. */
function initialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return '?';
  if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
  return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase();
}

function BearbeiterDialog({ onClose }: { onClose: () => void }) {
  const { data, setBearbeiter } = useStore();
  const [name, setName] = useState(data.bearbeiter.name);
  const [mailNachfrage, setMailNachfrage] = useState(data.bearbeiter.mailNachfrage ?? true);
  const [kontrast, setKontrast] = useState((data.bearbeiter.farbmodus ?? 'standard') === 'kontrast');

  return (
    <Modal
      titel="Angemeldet als"
      sub="Eigene Angaben und persönliche Einstellungen"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setBearbeiter({
                name: name.trim() || STANDARD_BEARBEITER,
                mailNachfrage,
                farbmodus: kontrast ? 'kontrast' : 'standard',
              });
              onClose();
            }}
          >
            Übernehmen
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field
          label="Name"
          full
          hint={`In markierten Projekten sind Sie automatisch unter „Rollen & Funktionen“ als ${EIGENE_ROLLE} geführt.`}
        >
          <TextInput value={name} onChange={setName} placeholder="Vor- und Nachname" />
        </Field>
        <Field label="E-Mail nach Erledigung" full>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={mailNachfrage}
              onChange={(e) => setMailNachfrage(e.target.checked)}
            />
            Nachfragen zulassen, wenn ein Workflow-Schritt eine E-Mail vorsieht
          </label>
        </Field>
        <Field
          label="Darstellung"
          full
          hint="Farben für eine Rot-Grün-Sehschwäche: Blaugrün, Bernstein und Magenta statt Grün, Orange und Rot – zusätzlich mit stärkeren Kontrasten."
        >
          <label className="checkbox">
            <input type="checkbox" checked={kontrast} onChange={(e) => setKontrast(e.target.checked)} />
            Farbmodus für Rot-Grün-Sehschwäche (hoher Kontrast)
          </label>
        </Field>
      </div>
      <p className="small tertiary" style={{ marginTop: 12 }}>
        Eine Anmeldung je Person ist vorgesehen; bis dahin gilt dieser Name für alle Ansichten. Der Datenbestand
        liegt in dieser Fassung lokal im Browser – ein gemeinsamer Zugriff mehrerer Personen auf denselben Stand
        setzt die Anbindung einer Datenbank voraus.
      </p>
    </Modal>
  );
}

function NavItem({
  icon,
  label,
  aktiv,
  badge,
  badgeAlarm,
  onClick,
}: {
  icon: IconName;
  label: string;
  aktiv: boolean;
  badge?: string;
  badgeAlarm?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`nav-item ${aktiv ? 'active' : ''}`} onClick={onClick} title={label}>
      <span className="nav-icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="nav-label">{label}</span>
      {badge ? <span className={`nav-badge ${badgeAlarm ? 'alert' : ''}`}>{badge}</span> : null}
    </button>
  );
}

function MobilItem({
  icon,
  label,
  aktiv,
  onClick,
}: {
  icon: IconName;
  label: string;
  aktiv: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={aktiv ? 'active' : ''} onClick={onClick}>
      <Icon name={icon} size={20} />
      {label}
    </button>
  );
}

function NichtGefunden({ onZurueck }: { onZurueck: () => void }) {
  return (
    <Card>
      <EmptyState
        icon="projekt"
        titel="Nicht gefunden"
        text="Der aufgerufene Eintrag existiert nicht (mehr)."
        action={
          <button type="button" className="btn btn-primary" onClick={onZurueck}>
            Zu den Projekten
          </button>
        }
      />
    </Card>
  );
}

interface Kopf {
  /** Kleine Zeile über dem Titel. */
  eyebrow?: string;
  titel: string;
  sub?: string;
  /** Titel mit einem Punkt in der Akzentfarbe abschließen (nur feste Seitentitel). */
  punkt?: boolean;
  /** Brotkrümelpfad in der Kopfzeile; der letzte Teil ist die aktuelle Seite. */
  pfad: { label: string; route?: Route }[];
}

const BEREICH = 'Planlaufmanagement';

function kopfzeile(route: Route, projekt?: Project, laufName?: string): Kopf {
  const start = { label: BEREICH, route: { view: 'dashboard' } as Route };
  const projekte = { label: 'Projekte', route: { view: 'projekte' } as Route };
  switch (route.view) {
    case 'dashboard':
      return {
        eyebrow: 'Alles auf einen Blick',
        titel: 'Übersicht',
        punkt: true,
        sub: 'Eigene To-Dos, Fristen und der Stand aller Projekte.',
        pfad: [{ label: BEREICH }, { label: 'Übersicht' }],
      };
    case 'fristen':
      return {
        eyebrow: 'Termine im Blick',
        titel: 'Fristen & Erinnerungen',
        punkt: true,
        sub: 'Anstehende Prozessschritte über alle Projekte.',
        pfad: [start, { label: 'Fristen' }],
      };
    case 'projekte':
      return {
        eyebrow: 'Verwaltung',
        titel: 'Projekte',
        punkt: true,
        sub: 'Projekte anlegen, pflegen und für die Übersicht markieren.',
        pfad: [start, { label: 'Projekte' }],
      };
    case 'ketten':
      return {
        eyebrow: 'Prozessketten',
        titel: 'Workflows',
        punkt: true,
        sub: 'Standard-Workflows und Projektvarianten.',
        pfad: [start, { label: 'Workflows' }],
      };
    case 'rollen':
      return {
        eyebrow: 'Zuständigkeiten',
        titel: 'Funktionen',
        punkt: true,
        sub: 'Projektübergreifend, gegliedert nach Gewerken.',
        pfad: [start, { label: 'Funktionen' }],
      };
    case 'vorlagen':
      return {
        eyebrow: 'Texte & Listen',
        titel: 'Vorlagen',
        punkt: true,
        sub: 'E-Mail-Texte und Excel-Vorlagen für den Upload.',
        pfad: [start, { label: 'Vorlagen' }],
      };
    case 'projekt':
      return {
        eyebrow: projekt?.nummer ? `Projekt ${projekt.nummer}` : 'Projekt',
        titel: projekt?.name ?? 'Projekt',
        sub: 'Projektarbeitsbereich',
        pfad: [start, projekte, { label: projekt?.name ?? 'Projekt' }],
      };
    case 'planlauf':
      return {
        eyebrow: 'Planlauf',
        titel: laufName ?? 'Planlauf',
        sub: projekt?.name,
        pfad: [
          start,
          projekte,
          ...(projekt
            ? [{ label: projekt.name, route: { view: 'projekt', projectId: projekt.id, tab: 'uebersicht' } as Route }]
            : []),
          { label: laufName ?? 'Planlauf' },
        ],
      };
    default:
      return { titel: 'MC Plan', pfad: [{ label: BEREICH }] };
  }
}
