/**
 * Übersicht der laufenden Planläufe eines Projekts.
 *
 * Dieselbe Darstellung wird auf der Startseite und im Projekt verwendet.
 * Einträge eines Planpakets stehen unter einer aufklappbaren Paketzeile; das
 * Paket selbst hat keinen Planlauf und darum auch keinen Erledigt-Haken.
 */
import { Fragment, useState } from 'react';
import { abbruchHinweis, aktuellerSchritt, ampelFuerSchritt, fortschritt, type Ampel } from '../domain/engine';
import { formatDate, relativeLabel } from '../../../shared/dates';
import {
  INDEX_LABEL,
  SCHRITT_EINGANG,
  hatEigenenPlanlauf,
  istEingangPLM,
  verzeichnisGebuendelt,
  type PlanDocument,
  type PlanRun,
  type Project,
  type RunStep,
} from '../domain/types';
import { useStore } from '../store/store';
import { AmpelBadge, AngekuendigtBadge, DocKindIcon, RunStatusBadge } from './common';
import { BuendelnDialog } from './BuendelnDialog';
import { EmailDialog } from './EmailDialog';
import { ErledigtButton, useSchrittStatus } from './SchrittStatus';
import { ConfirmDialog, EmptyState, Progress } from '../../../shared/ui';
import { useToast } from '../../../shared/toast';
import { Icon } from '../../../shared/icons';

interface Eintrag {
  run: PlanRun;
  doc: PlanDocument | undefined;
  step: RunStep | undefined;
}

/**
 * Ein Eintrag der obersten Ebene einer Gruppe: ein Planlauf – oder ein
 * Planverzeichnis, dessen Pläne einzeln laufen und das sie nur zusammenfasst.
 */
type Knoten =
  | { art: 'lauf'; eintrag: Eintrag }
  | { art: 'klammer'; verzeichnis: PlanDocument; kinder: Eintrag[] };

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
  /** Auswahl je Spalte; ohne Angabe bleibt die Überschrift ohne Filter. */
  spaltenFilter?: SpaltenFilter;
  oeffneLauf: (runId: string) => void;
}) {
  const { data, planHerausloesen } = useStore();
  const toast = useToast();
  const { setzeStatus, nachweisDialog } = useSchrittStatus();
  /** Plan, der aus dem laufenden Lauf seines Verzeichnisses herausgelöst werden soll. */
  const [herausloesen, setHerausloesen] = useState<{ plan: PlanDocument; lauf: PlanRun } | null>(null);
  /** Verzeichnis, dessen einzeln laufende Pläne wieder gebündelt werden sollen. */
  const [buendeln, setBuendeln] = useState<PlanDocument | null>(null);
  const [mail, setMail] = useState<{ run: PlanRun; step: RunStep } | null>(null);
  /** Paketzeilen, die von Hand abweichend auf- bzw. zugeklappt sind. */
  const [abweichend, setAbweichend] = useState<string[]>([]);
  /** Aufgeklappte Planverzeichnisse – zunächst sind alle zugeklappt. */
  const [offeneVerzeichnisse, setOffeneVerzeichnisse] = useState<string[]>([]);
  /** Die abgebrochenen Läufe am Ende der Liste sind zunächst zugeklappt. */
  const [verworfeneOffen, setVerworfeneOffen] = useState(false);
  /** Sortierung; ohne Angabe gilt die vorgegebene Reihenfolge. */
  const [sortFeld, setSortFeld] = useState<SortFeld | null>(null);
  const [absteigend, setAbsteigend] = useState(false);
  /**
   * Offene Filterauswahl samt Position. Das Menü liegt fest im Fenster, weil
   * Karte und Tabelle ihren Inhalt beschneiden.
   */
  const [filterOffen, setFilterOffen] = useState<{ feld: FilterFeld; x: number; y: number } | null>(null);
  const [zuletzt, setZuletzt] = useState(String(ebene));

  // Beim Umschalten der Gliederung gilt wieder die einheitliche Darstellung.
  if (zuletzt !== String(ebene)) {
    setZuletzt(String(ebene));
    setAbweichend([]);
    setOffeneVerzeichnisse([]);
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

  // Abgebrochene Läufe – ersatzlos wie ersetzt – stehen gesammelt am Ende der
  // Liste und nicht mehr zwischen den laufenden Einträgen ihres Pakets.
  const verworfene = eintraege.filter((e) => e.run.status === 'abgebrochen');
  const laufende = eintraege.filter((e) => e.run.status !== 'abgebrochen');

  // Einträge eines Planpakets stehen unter ihrer Paketzeile
  const pakete = data.documents.filter(
    (d) => d.kind === 'paket' && laufende.some((e) => paketVon(e.doc) === d.id),
  );
  const ohnePaket = laufende.filter((e) => !pakete.some((p) => p.id === paketVon(e.doc)));

  const klappen = (id: string) =>
    setAbweichend((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const verzeichnisKlappen = (id: string) =>
    setOffeneVerzeichnisse((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  /**
   * Stand einer Klammer – eines Planpakets oder eines Verzeichnisses mit
   * einzeln laufenden Plänen: Sie laufen selbst nicht, Fortschritt und Status
   * ergeben sich aus den enthaltenen Einträgen mit eigenem Lauf.
   */
  const paketStand = (paketId: string) =>
    standVon(
      data.documents.filter(
        (d) => d.kind !== 'paket' && paketVon(d) === paketId && hatEigenenPlanlauf(d, data.documents),
      ),
    );
  const verzeichnisStand = (verzeichnisId: string) =>
    standVon(
      data.documents.filter(
        (d) => d.kind === 'plan' && d.parentId === verzeichnisId && hatEigenenPlanlauf(d, data.documents),
      ),
    );

  const standVon = (zugehoerig: PlanDocument[]) => {
    // Nur Einträge mit eigenem Planlauf; Pläne, die im Lauf ihres Verzeichnisses
    // mitlaufen, dürfen nicht doppelt zählen.
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
        const ampel = e.step ? ampelFuerSchritt(e.step, project.settings.erinnerungVorlaufTage) : 'neutral';
        // Ein angekündigter Eintrag, dessen Eingang überfällig ist, zählt als
        // überfällig – sonst verschwände die Dringlichkeit hinter „angekündigt“.
        if (ampel === 'ueberfaellig') return STATUS_RANG.ueberfaellig;
        if (e.step && istEingangPLM(e.step.name)) return STATUS_RANG.angekuendigt;
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

  /** Eigener Lauf eines Plans in der angezeigten Liste – sofern vorhanden. */
  const laufDesPlans = (planId: string) => laufende.find((e) => e.doc?.id === planId);

  /**
   * Oberste Ebene einer Gruppe. Pläne mit eigenem Lauf stehen unter ihrem
   * Verzeichnis: unter dessen Zeile, wenn es gebündelt läuft, sonst unter einer
   * Klammerzeile. Ist das Verzeichnis ausgefiltert, steht der Plan für sich.
   */
  const knotenVon = (liste: Eintrag[]): Knoten[] => {
    const mitLauf = new Set(liste.filter((e) => e.doc?.kind === 'verzeichnis').map((e) => e.doc!.id));
    const klammern = new Map<string, Eintrag[]>();
    const knoten: Knoten[] = [];
    for (const e of liste) {
      const elternId = e.doc?.kind === 'plan' ? e.doc.parentId : null;
      if (elternId && mitLauf.has(elternId)) continue;
      const eltern = elternId ? data.documents.find((d) => d.id === elternId) : undefined;
      if (eltern && !verzeichnisGebuendelt(eltern)) {
        // Klammer an der Stelle ihres ersten Plans einreihen
        if (!klammern.has(eltern.id)) {
          klammern.set(eltern.id, []);
          knoten.push({ art: 'klammer', verzeichnis: eltern, kinder: klammern.get(eltern.id)! });
        }
        klammern.get(eltern.id)!.push(e);
        continue;
      }
      knoten.push({ art: 'lauf', eintrag: e });
    }
    if (!sortFeld) return knoten;
    const wert = (k: Knoten): string | number => {
      if (k.art === 'lauf') return schluessel(k.eintrag, sortFeld);
      if (sortFeld === 'titel') return `${k.verzeichnis.nummer} ${k.verzeichnis.titel}`.toLowerCase();
      if (sortFeld === 'gewerk') return k.verzeichnis.gewerk.toLowerCase();
      // Sonst zählt der Plan, der in der gewählten Richtung zuerst käme
      return schluessel(sortieren(k.kinder)[0], sortFeld);
    };
    return [...knoten].sort((a, b) => vergleich(wert(a), wert(b)));
  };

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

  const zeile = ({ run, doc, step: offenerSchritt }: Eintrag, eingerueckt = false, unterVerzeichnis = false) => {
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
      doc?.kind === 'verzeichnis' ? data.documents.filter((d) => d.parentId === doc.id) : [];
    // Die Pläne eines Verzeichnisses hängen an der eigenen Schaltfläche und
    // sind zunächst zugeklappt.
    const aufgeklappt = doc ? offeneVerzeichnisse.includes(doc.id) : false;
    const anzeigeIndex = abgebrochen ? run.index || doc?.index : doc?.index;
    // Position von Symbol und Titel; der Pfeil liegt 29 px davor und braucht
    // darum auch ohne Planpakete etwas Vorlauf.
    // Pläne mit eigenem Lauf unter ihrem Verzeichnis rücken eine Stufe weiter ein.
    const einzug = (eingerueckt ? 46 : 36) + (unterVerzeichnis ? 28 : 0);
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
                className={`chev-btn chev-vorn ${aufgeklappt ? 'offen' : ''}`}
                title={aufgeklappt ? 'Pläne ausblenden' : 'Pläne anzeigen'}
                aria-label="Pläne des Verzeichnisses anzeigen"
                onClick={(e) => {
                  e.stopPropagation();
                  verzeichnisKlappen(doc!.id);
                }}
              >
                <Icon name="chevron" size={13} />
              </button>
            ) : null}
            {doc ? <DocKindIcon kind={doc.kind} /> : null}
            <span style={{ minWidth: 0 }}>
              <span className="num">
                {doc?.nummer}
                {/* Ein abgebrochener Lauf trägt seinen eigenen Index – der
                    Eintrag selbst steht längst auf dem Nachfolgeindex. */}
                {anzeigeIndex && doc ? ` · ${INDEX_LABEL[doc.kind]} ${anzeigeIndex}` : ''}
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
                <Progress wert={pct} />
                <span className="small tertiary">{pct}%</span>
              </span>
            </td>
          </>
        )}
        <td>
          {run.status !== 'laufend' ? (
            <RunStatusBadge status={run.status} />
          ) : wartetAufEingang && ampel !== 'ueberfaellig' ? (
            <AngekuendigtBadge />
          ) : (
            // Ist der Eingang überfällig, zählt die Frist – die Bezeichnung
            // der Zeile bleibt gelb und weist den Eintrag als angekündigt aus.
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
        ? plaene.map((plan) => {
            // Herausgelöst: der Plan zeigt seinen eigenen Stand. Ist sein Lauf
            // ausgefiltert, bleibt die Zeile weg.
            if (hatEigenenPlanlauf(plan, data.documents)) {
              const eigener = laufDesPlans(plan.id);
              return eigener ? zeile(eigener, eingerueckt, true) : null;
            }
            return (
            <tr key={plan.id} className="unterzeile">
              <td style={{ paddingLeft: einzug + 28 }}>
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
              <td className="actions">
                {run.status === 'laufend' ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    title="Eigenen Planlauf mit dem Stand des Verzeichnislaufs starten"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHerausloesen({ plan, lauf: run });
                    }}
                  >
                    Herauslösen …
                  </button>
                ) : null}
              </td>
            </tr>
            );
          })
        : null}
      </Fragment>
    );
  };

  /**
   * Planverzeichnis, dessen Pläne einzeln laufen: Es läuft selbst nicht und
   * fasst seine Pläne zusammen – Fortschritt und Status wie bei einem Paket.
   */
  const klammerZeile = (verzeichnis: PlanDocument, kinder: Eintrag[], eingerueckt: boolean) => {
    const offen = offeneVerzeichnisse.includes(verzeichnis.id);
    const stand = verzeichnisStand(verzeichnis.id);
    const einzug = eingerueckt ? 46 : 36;
    return (
      <Fragment key={`klammer-${verzeichnis.id}`}>
        <tr className="klammer-zeile">
          <td style={{ paddingLeft: einzug }}>
            <span className="row" style={{ gap: 9 }}>
              <button
                type="button"
                className={`chev-btn chev-vorn ${offen ? 'offen' : ''}`}
                title={offen ? 'Pläne ausblenden' : 'Pläne anzeigen'}
                aria-label="Pläne des Verzeichnisses anzeigen"
                onClick={() => verzeichnisKlappen(verzeichnis.id)}
              >
                <Icon name="chevron" size={13} />
              </button>
              <DocKindIcon kind="verzeichnis" />
              <span style={{ minWidth: 0 }}>
                <span className="num">
                  {verzeichnis.nummer}
                  {verzeichnis.index ? ` · ${INDEX_LABEL.verzeichnis} ${verzeichnis.index}` : ''}
                </span>
                <div>
                  <strong>{verzeichnis.titel}</strong>
                  <span className="small tertiary"> · Pläne einzeln</span>
                </div>
              </span>
            </span>
          </td>
          <td className="small muted">{verzeichnis.gewerk || '–'}</td>
          <td className="small tertiary" colSpan={2}>
            {kinder.length} {kinder.length === 1 ? 'laufender Plan' : 'laufende Pläne'}
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
          <td className="actions">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              title="Ausgewählte Pläne wieder in einem gemeinsamen Verzeichnislauf führen"
              onClick={() => setBuendeln(verzeichnis)}
            >
              Bündeln …
            </button>
          </td>
        </tr>
        {offen ? sortieren(kinder).map((k) => zeile(k, eingerueckt, true)) : null}
      </Fragment>
    );
  };

  /** Rendert die oberste Ebene einer Gruppe. */
  const knotenZeilen = (liste: Eintrag[], eingerueckt: boolean) =>
    knotenVon(liste).map((k) =>
      k.art === 'lauf' ? zeile(k.eintrag, eingerueckt) : klammerZeile(k.verzeichnis, k.kinder, eingerueckt),
    );

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
              const inhalt = sortieren(laufende.filter((e) => paketVon(e.doc) === paket.id));
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
                  {aufgeklappt ? knotenZeilen(inhalt, true) : null}
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
              ? knotenZeilen(ohnePaket, pakete.length > 0)
              : null}

            {verworfene.length > 0 ? (
              <tr className="paket-zeile ohne-paket">
                <td colSpan={7}>
                  <button
                    type="button"
                    className={`gruppe-btn ${verworfeneOffen ? 'offen' : ''}`}
                    onClick={() => setVerworfeneOffen((o) => !o)}
                    title={verworfeneOffen ? 'Abgebrochene ausblenden' : 'Abgebrochene anzeigen'}
                  >
                    <span className="chev">
                      <Icon name="chevron" size={13} />
                    </span>
                    <span className="small muted">
                      Abgebrochen · {verworfene.length}{' '}
                      {verworfene.length === 1 ? 'Planlauf' : 'Planläufe'}
                    </span>
                  </button>
                </td>
              </tr>
            ) : null}
            {verworfeneOffen ? sortieren(verworfene).map((e) => zeile(e, pakete.length > 0)) : null}
          </tbody>
        </table>
      </div>

      {mail ? (
        <EmailDialog project={project} run={mail.run} step={mail.step} onClose={() => setMail(null)} />
      ) : null}
      {nachweisDialog}
      {buendeln ? <BuendelnDialog verzeichnis={buendeln} onClose={() => setBuendeln(null)} /> : null}
      {herausloesen ? (
        <ConfirmDialog
          titel="Plan herauslösen?"
          text={`„${herausloesen.plan.titel}“ erhält einen eigenen Planlauf und übernimmt dazu den Stand von „${herausloesen.lauf.name}“ – erledigte Schritte bleiben erledigt. Der Lauf des Verzeichnisses geht für die übrigen Pläne weiter.`}
          bestaetigenLabel="Herauslösen"
          onConfirm={() => {
            if (planHerausloesen(herausloesen.plan.id)) toast('Plan herausgelöst – er läuft jetzt einzeln weiter.');
          }}
          onClose={() => setHerausloesen(null)}
        />
      ) : null}
    </>
  );
}
