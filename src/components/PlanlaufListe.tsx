/**
 * Übersicht der laufenden Planläufe eines Projekts.
 *
 * Dieselbe Darstellung wird auf der Startseite und im Projekt verwendet.
 * Einträge eines Planpakets stehen unter einer aufklappbaren Paketzeile; das
 * Paket selbst hat keinen Planlauf und darum auch keinen Erledigt-Haken.
 */
import { Fragment, useState } from 'react';
import { abbruchHinweis, aktuellerSchritt, ampelFuerSchritt, fortschritt, type Ampel } from '../domain/engine';
import { formatDate, relativeLabel } from '../lib/dates';
import {
  INDEX_LABEL,
  SCHRITT_EINGANG,
  hatEigenenPlanlauf,
  istEingangPLM,
  type PlanDocument,
  type PlanRun,
  type Project,
  type RunStep,
} from '../domain/types';
import { useStore } from '../store/store';
import { AmpelBadge, AngekuendigtBadge, DocKindIcon, RunStatusBadge } from './common';
import { EmailDialog } from './EmailDialog';
import { ErledigtButton, useSchrittStatus } from './SchrittStatus';
import { EmptyState, Progress } from './ui';
import { Icon } from './icons';

interface Eintrag {
  run: PlanRun;
  doc: PlanDocument | undefined;
  step: RunStep | undefined;
}

/** Spalten, nach denen sich die Liste sortieren lässt. */
type SortFeld = 'titel' | 'gewerk' | 'schritt' | 'zustaendig' | 'fortschritt' | 'status';

/** Spalten mit Filter in der Überschrift. */
export type FilterFeld = 'gewerk' | 'zustaendig' | 'status';

/**
 * Filter, die in den Spaltenüberschriften angeboten werden. Gefiltert wird
 * außerhalb der Liste – hier steht nur die Bedienung.
 */
export interface SpaltenFilter {
  werte: Record<FilterFeld, string>;
  setzen: (feld: FilterFeld, wert: string) => void;
  optionen: Record<FilterFeld, { value: string; label: string }[]>;
}

/** Dringlichkeit als Zahl – überfällige Läufe stehen vorn. */
const STATUS_RANG: Record<string, number> = {
  ueberfaellig: 0,
  faellig: 1,
  geplant: 2,
  angekuendigt: 3,
  neutral: 4,
  abgeschlossen: 5,
  abgebrochen: 6,
};

export function PlanlaufListe({
  project,
  runs,
  alleRuns,
  ebene = 2,
  unterplaene = true,
  spaltenFilter,
  oeffneLauf,
}: {
  project: Project;
  /** Anzuzeigende Planläufe des Projekts. */
  runs: PlanRun[];
  /** Alle Läufe des Projekts – Grundlage für den Stand der Planpakete. */
  alleRuns?: PlanRun[];
  /**
   * Gliederungstiefe: 1 = nur die Planpakete, 2 = mit ihren Plänen und
   * Planverzeichnissen.
   */
  ebene?: 1 | 2;
  /**
   * Zeigt unter jedem Planverzeichnis die Pläne, die darin mitlaufen.
   * Ist sie abgeschaltet, bleiben diese Pläne ausgeblendet.
   */
  unterplaene?: boolean;
  /** Auswahl je Spalte; ohne Angabe bleibt die Überschrift ohne Filter. */
  spaltenFilter?: SpaltenFilter;
  oeffneLauf: (runId: string) => void;
}) {
  const { data } = useStore();
  const { setzeStatus, nachweisDialog } = useSchrittStatus();
  const [mail, setMail] = useState<{ run: PlanRun; step: RunStep } | null>(null);
  /** Zeilen, die von Hand abweichend auf- bzw. zugeklappt sind. */
  const [abweichend, setAbweichend] = useState<string[]>([]);
  /** Sortierung; ohne Angabe gilt die vorgegebene Reihenfolge. */
  const [sortFeld, setSortFeld] = useState<SortFeld | null>(null);
  const [absteigend, setAbsteigend] = useState(false);
  /**
   * Offene Filterauswahl samt Position. Das Menü liegt fest im Fenster, weil
   * Karte und Tabelle ihren Inhalt beschneiden.
   */
  const [filterOffen, setFilterOffen] = useState<{ feld: FilterFeld; x: number; y: number } | null>(null);
  const [zuletzt, setZuletzt] = useState(`${ebene}-${unterplaene}`);

  // Beim Umschalten der Gliederung gilt wieder die einheitliche Darstellung.
  if (zuletzt !== `${ebene}-${unterplaene}`) {
    setZuletzt(`${ebene}-${unterplaene}`);
    setAbweichend([]);
  }

  /** Paketzeilen folgen der Ebene, einzelne Abweichungen stechen. */
  const istOffen = (id: string) => (ebene >= 2) !== abweichend.includes(id);

  const eintraege: Eintrag[] = runs.map((run) => {
    const doc = data.documents.find((d) => d.id === run.documentId);
    return { run, doc, step: aktuellerSchritt(run) };
  });

  /** Maßgebliches Paket – bei Plänen eines Verzeichnisses dessen Paket. */
  const paketVon = (doc: PlanDocument | undefined): string | null => {
    if (!doc) return null;
    if (doc.kind === 'plan' && doc.parentId) {
      const eltern = data.documents.find((d) => d.id === doc.parentId);
      if (eltern) return eltern.paketId;
    }
    return doc.paketId;
  };

  // Einträge eines Planpakets stehen unter ihrer Paketzeile
  const pakete = data.documents.filter(
    (d) => d.kind === 'paket' && eintraege.some((e) => paketVon(e.doc) === d.id),
  );
  const ohnePaket = eintraege.filter((e) => !pakete.some((p) => p.id === paketVon(e.doc)));

  const klappen = (id: string) =>
    setAbweichend((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  /**
   * Stand eines Planpakets: Planpakete laufen selbst nicht, ihr Fortschritt
   * und Status ergeben sich aus den enthaltenen Plänen und Verzeichnissen.
   */
  const paketStand = (paketId: string) => {
    // Nur Einträge mit eigenem Planlauf; Pläne eines Verzeichnisses laufen
    // in dessen Lauf mit und dürfen nicht doppelt zählen.
    const zugehoerig = data.documents.filter(
      (d) => d.kind !== 'paket' && paketVon(d) === paketId && hatEigenenPlanlauf(d),
    );
    const basis = alleRuns ?? runs;
    // Je Eintrag zählt ein Lauf: der laufende, sonst der abgeschlossene.
    // Abgebrochene Läufe (etwa ein Vorgänger vor einem neuen Index) bleiben
    // außen vor – sonst zöge ihr Stand den Fortschritt des Pakets herunter.
    const laufendZuerst = (r: PlanRun) => (r.status === 'laufend' ? 0 : 1);
    const laeufe = zugehoerig
      .map((d) =>
        basis
          .filter((r) => r.documentId === d.id && r.status !== 'abgebrochen')
          .sort((a, b) => laufendZuerst(a) - laufendZuerst(b))[0],
      )
      .filter((r): r is PlanRun => Boolean(r));
    if (laeufe.length === 0) {
      return { pct: 0, status: null as PlanRun['status'] | null, ampel: null as Ampel | null };
    }
    const pct = Math.round(laeufe.reduce((sum, r) => sum + fortschritt(r), 0) / laeufe.length);
    const status: PlanRun['status'] = laeufe.some((r) => r.status === 'laufend')
      ? 'laufend'
      : 'abgeschlossen';
    // Dringlichkeit des Pakets: der kritischste Schritt seiner laufenden Einträge
    const rang: Ampel[] = ['ueberfaellig', 'faellig', 'geplant', 'neutral'];
    const ampeln = laeufe
      .filter((r) => r.status === 'laufend')
      .map((r) => {
        const step = aktuellerSchritt(r);
        return step ? ampelFuerSchritt(step, project.settings.erinnerungVorlaufTage) : 'neutral';
      });
    const ampel = rang.find((a) => ampeln.includes(a)) ?? null;
    return { pct, status, ampel };
  };

  /** Sortierschlüssel eines Eintrags je Spalte. */
  const schluessel = (e: Eintrag, feld: SortFeld): string | number => {
    switch (feld) {
      case 'gewerk':
        return e.doc?.gewerk?.toLowerCase() ?? '';
      case 'schritt':
        // Nach Soll-Termin: was zuerst ansteht, steht oben
        return e.step?.sollDatum ?? '9999-99-99';
      case 'zustaendig': {
        const kontakt = data.contacts.find((c) => c.id === e.step?.contactId);
        return `${e.step?.roleName ?? ''} ${kontakt ? kontakt.nachname : ''}`.trim().toLowerCase();
      }
      case 'fortschritt':
        return fortschritt(e.run);
      case 'status': {
        if (e.run.status !== 'laufend') return STATUS_RANG[e.run.status];
        if (e.step && istEingangPLM(e.step.name)) return STATUS_RANG.angekuendigt;
        const ampel = e.step ? ampelFuerSchritt(e.step, project.settings.erinnerungVorlaufTage) : 'neutral';
        return STATUS_RANG[ampel] ?? 9;
      }
      default:
        return `${e.doc?.nummer ?? ''} ${e.doc?.titel ?? e.run.name}`.toLowerCase();
    }
  };

  const vergleich = (a: string | number, b: string | number) =>
    (typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), 'de', { numeric: true })) * (absteigend ? -1 : 1);

  /** Sortiert eine Gruppe von Einträgen nach der gewählten Spalte. */
  const sortieren = (liste: Eintrag[]) =>
    sortFeld ? [...liste].sort((a, b) => vergleich(schluessel(a, sortFeld), schluessel(b, sortFeld))) : liste;

  const spalteWaehlen = (feld: SortFeld) => {
    if (feld === sortFeld) {
      // dritter Klick hebt die Sortierung wieder auf
      if (absteigend) {
        setSortFeld(null);
        setAbsteigend(false);
      } else setAbsteigend(true);
    } else {
      setSortFeld(feld);
      setAbsteigend(false);
    }
  };

  /**
   * Spaltenüberschrift: Klick auf die Bezeichnung sortiert, der Trichter
   * daneben öffnet die Auswahl der Spalte. Der gewählte Wert steht
   * anschließend in der Überschrift.
   */
  const Kopf = ({
    feld,
    children,
    klasse = '',
    titel,
    stil,
    filter,
  }: {
    feld: SortFeld;
    children: React.ReactNode;
    klasse?: string;
    titel?: string;
    stil?: React.CSSProperties;
    filter?: FilterFeld;
  }) => {
    const optionen = filter && spaltenFilter ? spaltenFilter.optionen[filter] : null;
    const wert = filter && spaltenFilter ? spaltenFilter.werte[filter] : '';
    const gewaehlt = optionen?.find((o) => o.value === wert);
    const offen = filter !== undefined && filterOffen?.feld === filter;
    return (
      <th className={`${klasse} ${gewaehlt ? 'gefiltert' : ''}`} style={stil}>
        <span className="th-inhalt">
          <button type="button" className="sort-btn" onClick={() => spalteWaehlen(feld)} title={titel}>
            {children}
            {gewaehlt ? <span className="th-wert">{gewaehlt.label}</span> : null}
            <span className={`sort-pfeil ${sortFeld === feld ? 'aktiv' : ''}`}>
              {sortFeld === feld ? (absteigend ? '▾' : '▴') : '▴'}
            </span>
          </button>
          {optionen && optionen.length > 0 ? (
            <button
              type="button"
              className={`filter-btn ${gewaehlt ? 'aktiv' : ''} ${offen ? 'offen' : ''}`}
              title={gewaehlt ? `Filter: ${gewaehlt.label}` : 'Filtern'}
              aria-label="Spalte filtern"
              onClick={(e) => {
                if (offen) {
                  setFilterOffen(null);
                  return;
                }
                const platz = e.currentTarget.getBoundingClientRect();
                setFilterOffen({
                  feld: filter!,
                  // Nach rechts hinaus stehende Menüs klappen nach links auf
                  x: Math.min(platz.left, window.innerWidth - 200),
                  y: platz.bottom + 6,
                });
              }}
            >
              <Icon name="filter" size={11} />
            </button>
          ) : null}
        </span>

        {offen && optionen ? (
          <>
            <div className="filter-schatten" onClick={() => setFilterOffen(null)} />
            <div className="filter-menu" style={{ top: filterOffen!.y, left: filterOffen!.x }}>
              <button
                type="button"
                className={wert === '' ? 'aktiv' : ''}
                onClick={() => {
                  spaltenFilter!.setzen(filter!, '');
                  setFilterOffen(null);
                }}
              >
                Alle
              </button>
              {optionen.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={wert === o.value ? 'aktiv' : ''}
                  onClick={() => {
                    spaltenFilter!.setzen(filter!, o.value);
                    setFilterOffen(null);
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </th>
    );
  };

  /**
   * Die Paketzeilen folgen derselben Sortierung, soweit sie auf ein Paket
   * anwendbar ist – Schritt und Zuständigkeit gibt es je Paket nicht.
   */
  const paketeSortiert = !sortFeld
    ? pakete
    : [...pakete].sort((a, b) => {
        const wert = (p: PlanDocument): string | number => {
          if (sortFeld === 'gewerk') return p.gewerk.toLowerCase();
          if (sortFeld === 'fortschritt') return paketStand(p.id).pct;
          if (sortFeld === 'status') {
            const stand = paketStand(p.id);
            if (stand.status && stand.status !== 'laufend') return STATUS_RANG[stand.status];
            return STATUS_RANG[stand.ampel ?? 'neutral'] ?? 9;
          }
          return `${p.nummer} ${p.titel}`.toLowerCase();
        };
        return vergleich(wert(a), wert(b));
      });

  if (eintraege.length === 0) {
    return (
      <EmptyState icon="kette" titel="Kein Planlauf aktiv" text="Starten Sie einen Planlauf für einen Eintrag." />
    );
  }

  const zeile = ({ run, doc, step: offenerSchritt }: Eintrag, eingerueckt = false) => {
    // Ein abgebrochener Lauf ist abgeschlossene Vergangenheit: kein aktueller
    // Schritt, kein Fortschritt und nichts mehr zu erledigen.
    const abgebrochen = run.status === 'abgebrochen';
    const step = abgebrochen ? undefined : offenerSchritt;
    // Farbe der Zeile: angekündigt (gelb) bzw. abgeschlossen (grün)
    const wartetAufEingang = Boolean(step && istEingangPLM(step.name));
    const fertig = run.status === 'abgeschlossen';
    const ampel = step ? ampelFuerSchritt(step, project.settings.erinnerungVorlaufTage) : 'erledigt';
    const pct = fortschritt(run);
    const kontakt = data.contacts.find((c) => c.id === step?.contactId);
    // Pläne eines Planverzeichnisses laufen in dessen Lauf mit; sie lassen
    // sich unter dem Verzeichnis aufklappen.
    const plaene =
      unterplaene && doc?.kind === 'verzeichnis'
        ? data.documents.filter((d) => d.parentId === doc.id)
        : [];
    // Die Pläne eines Verzeichnisses hängen an der eigenen Schaltfläche
    const aufgeklappt = doc ? !abweichend.includes(doc.id) : false;
    const einzug = eingerueckt ? 46 : 14;
    return (
      <Fragment key={run.id}>
      <tr
        className={`clickable ${abgebrochen ? 'zeile-verworfen' : ''} ${
          fertig ? 'zeile-fertig' : wartetAufEingang ? 'zeile-eingang' : ''
        }`}
        onClick={() => oeffneLauf(run.id)}
        title={
          abgebrochen
            ? 'Abgebrochener Planlauf – nur noch zum Nachschlagen'
            : wartetAufEingang
              ? `Angekündigt – „${SCHRITT_EINGANG}“ steht noch aus`
              : undefined
        }
      >
        <td style={{ paddingLeft: einzug }}>
          <span className="row" style={{ gap: 9 }}>
            {plaene.length > 0 ? (
              <button
                type="button"
                className={`chev-btn ${aufgeklappt ? 'offen' : ''}`}
                title={aufgeklappt ? 'Pläne ausblenden' : 'Pläne anzeigen'}
                aria-label="Pläne des Verzeichnisses anzeigen"
                onClick={(e) => {
                  e.stopPropagation();
                  klappen(doc!.id);
                }}
              >
                <Icon name="chevron" size={13} />
              </button>
            ) : null}
            {doc ? <DocKindIcon kind={doc.kind} /> : null}
            <span style={{ minWidth: 0 }}>
              <span className="num">
                {doc?.nummer}
                {doc?.index ? ` · ${INDEX_LABEL[doc.kind]} ${doc.index}` : ''}
              </span>
              <div>
                <strong>{doc?.titel ?? run.name}</strong>
                {plaene.length > 0 ? (
                  <span className="small tertiary">
                    {' '}
                    · {plaene.length} {plaene.length === 1 ? 'Plan' : 'Pläne'}
                  </span>
                ) : null}
              </div>
            </span>
          </span>
        </td>
        <td className="small muted">{doc?.gewerk || '–'}</td>
        {abgebrochen ? (
          <td className="small tertiary" colSpan={3}>
            <div>Abgebrochen{run.abbruchDatum ? ` am ${formatDate(run.abbruchDatum)}` : ''}</div>
            <span className="small">{abbruchHinweis(run, doc?.kind ?? 'plan')}</span>
          </td>
        ) : (
          <>
            <td className="small">
              {step ? (
                <>
                  <div>{step.name}</div>
                  <span className="tertiary small">{relativeLabel(step.sollDatum)}</span>
                </>
              ) : (
                <span className="tertiary">–</span>
              )}
            </td>
            <td className="small col-optional">
              {step ? (
                <>
                  <div>{step.roleName || '–'}</div>
                  <span className="tertiary small">
                    {kontakt ? `${kontakt.vorname} ${kontakt.nachname}` : 'keine Person'}
                  </span>
                </>
              ) : (
                <span className="tertiary">–</span>
              )}
            </td>
            <td className="col-optional">
              <span className="row" style={{ gap: 8 }}>
                <Progress wert={pct} ton={ampel === 'ueberfaellig' ? 'red' : ''} />
                <span className="small tertiary">{pct}%</span>
              </span>
            </td>
          </>
        )}
        <td>
          {run.status !== 'laufend' ? (
            <RunStatusBadge status={run.status} />
          ) : wartetAufEingang ? (
            <AngekuendigtBadge />
          ) : (
            <AmpelBadge ampel={ampel} />
          )}
        </td>
        <td className="actions">
          {step ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                title="Vorbereitete E-Mail an die zuständige Person"
                aria-label="Erinnerung vorbereiten"
                onClick={(e) => {
                  e.stopPropagation();
                  setMail({ run, step });
                }}
              >
                <Icon name="mail" size={13} />
              </button>{' '}
              <ErledigtButton run={run} step={step} onErledigen={(r, sch) => setzeStatus(r, sch, 'erledigt')} />
            </>
          ) : null}
        </td>
      </tr>

      {aufgeklappt
        ? plaene.map((plan) => (
            <tr key={plan.id} className="unterzeile">
              <td style={{ paddingLeft: einzug + 32 }}>
                <span className="row" style={{ gap: 9 }}>
                  <DocKindIcon kind={plan.kind} />
                  <span style={{ minWidth: 0 }}>
                    <span className="num">
                      {plan.nummer}
                      {plan.index ? ` · ${INDEX_LABEL[plan.kind]} ${plan.index}` : ''}
                    </span>
                    <div className="small">{plan.titel}</div>
                  </span>
                </span>
              </td>
              <td className="small muted">{plan.gewerk || '–'}</td>
              <td className="small tertiary" colSpan={2}>
                läuft im Planlauf des Verzeichnisses mit
              </td>
              <td className="col-optional" />
              <td />
              <td className="actions" />
            </tr>
          ))
        : null}
      </Fragment>
    );
  };

  return (
    <>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <Kopf feld="titel">Plan / Planverzeichnis</Kopf>
              <Kopf feld="gewerk" filter="gewerk">
                Gewerk
              </Kopf>
              <Kopf feld="schritt" titel="Nach Soll-Termin des nächsten Schritts sortieren">
                Nächster Schritt
              </Kopf>
              <Kopf feld="zustaendig" klasse="col-optional" filter="zustaendig">
                Zuständig
              </Kopf>
              <Kopf feld="fortschritt" klasse="col-optional" stil={{ width: 140 }}>
                Fortschritt
              </Kopf>
              <Kopf feld="status" titel="Überfällige zuerst" filter="status">
                Status
              </Kopf>
              <th className="actions" />
            </tr>
          </thead>
          <tbody>
            {paketeSortiert.map((paket) => {
              const inhalt = sortieren(eintraege.filter((e) => paketVon(e.doc) === paket.id));
              const aufgeklappt = istOffen(paket.id);
              const stand = paketStand(paket.id);
              return (
                <Fragment key={paket.id}>
                  <tr className="paket-zeile">
                    <td>
                      <button
                        type="button"
                        className={`gruppe-btn ${aufgeklappt ? 'offen' : ''}`}
                        onClick={() => klappen(paket.id)}
                        title={aufgeklappt ? 'Einträge ausblenden' : 'Einträge anzeigen'}
                      >
                        <span className="chev">
                          <Icon name="chevron" size={13} />
                        </span>
                        <DocKindIcon kind="paket" />
                        <span style={{ minWidth: 0 }}>
                          {paket.nummer ? <span className="num">{paket.nummer}</span> : null}
                          <div>
                            <strong>{paket.titel}</strong>
                          </div>
                        </span>
                      </button>
                    </td>
                    <td className="small muted">{paket.gewerk || '–'}</td>
                    <td className="small tertiary" colSpan={2}>
                      Planpaket · {inhalt.length} {inhalt.length === 1 ? 'laufender Eintrag' : 'laufende Einträge'}
                    </td>
                    <td className="col-optional">
                      <span className="row" style={{ gap: 8 }}>
                        <Progress wert={stand.pct} />
                        <span className="small tertiary">{stand.pct}%</span>
                      </span>
                    </td>
                    <td>
                      {stand.status === 'laufend' && stand.ampel ? (
                        <AmpelBadge ampel={stand.ampel} />
                      ) : stand.status ? (
                        <RunStatusBadge status={stand.status} />
                      ) : null}
                    </td>
                    <td className="actions" />
                  </tr>
                  {aufgeklappt ? inhalt.map((e) => zeile(e, true)) : null}
                </Fragment>
              );
            })}

            {ohnePaket.length > 0 && pakete.length > 0 ? (
              <tr className="paket-zeile ohne-paket">
                <td colSpan={7}>
                  <button
                    type="button"
                    className={`gruppe-btn ${istOffen('ohne-paket') ? 'offen' : ''}`}
                    onClick={() => klappen('ohne-paket')}
                  >
                    <span className="chev">
                      <Icon name="chevron" size={13} />
                    </span>
                    <span className="small muted">
                      Ohne Planpaket · {ohnePaket.length} {ohnePaket.length === 1 ? 'Eintrag' : 'Einträge'}
                    </span>
                  </button>
                </td>
              </tr>
            ) : null}
            {pakete.length === 0 || istOffen('ohne-paket')
              ? sortieren(ohnePaket).map((e) => zeile(e, pakete.length > 0))
              : null}
          </tbody>
        </table>
      </div>

      {mail ? (
        <EmailDialog project={project} run={mail.run} step={mail.step} onClose={() => setMail(null)} />
      ) : null}
      {nachweisDialog}
    </>
  );
}
