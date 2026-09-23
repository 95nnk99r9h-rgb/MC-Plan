/**
 * Planliste: alle Pläne und Planverzeichnisse eines Projekts zum Nachschlagen
 * und Bearbeiten.
 *
 * Die Liste führt die Stammdaten – Art, Bezeichnung, Gewerk, Zugehörigkeit und
 * den Soll-Termin des Eingangs. Der Stand der Planläufe steht in der
 * Projektübersicht, Planpakete werden auf einer eigenen Seite gepflegt.
 */
import { Fragment, useState } from 'react';
import {
  aktuellerSchritt,
  gewerkeFuerProjekt,
  lfdNummern,
  funktionenFuerGewerk,
  kontaktFuerRolleUndGewerk,
  stepsAusTemplate,
} from '../../domain/engine';
import { formatDate, tageLabel, today } from '../../../../shared/dates';
import {
  DOCUMENT_KIND_LABEL,
  INDEX_LABEL,
  NUMMER_LABEL,
  PLANUNGSPHASEN,
  SCHRITT_EINGANG,
  hatEigenenPlanlauf,
  istEingangPLM,
  verzeichnisGebuendelt,
  type DocumentKind,
  type ID,
  type PlanDocument,
  type ProcessTemplateStep,
  type Project,
} from '../../domain/types';
import { newId, useStore } from '../../store/store';
import { useToast } from '../../../../shared/toast';
import { DocKindIcon } from '../../components/common';
import { SchrittListe } from '../Workflows';
import { PlaeneImport } from './PlaeneImport';
import {
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Search,
  Segmented,
  Select,
  TextArea,
  TextInput,
} from '../../../../shared/ui';
import { Icon } from '../../../../shared/icons';

type Filter = 'alle' | 'plan' | 'verzeichnis';

/** Sonderwert der Auswahlfelder: Eintrag direkt neu anlegen. */
const NEU = '__neu__';
type SortFeld = 'lfd' | 'kind' | 'nummer' | 'titel' | 'gewerk' | 'parent' | 'paket' | 'eingangSoll';

export function Plaene({ project, oeffneLauf }: { project: Project; oeffneLauf: (runId: ID) => void }) {
  const { data } = useStore();
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState<Filter>('alle');
  const [sortFeld, setSortFeld] = useState<SortFeld>('lfd');
  const [absteigend, setAbsteigend] = useState(false);
  const [dialog, setDialog] = useState<{ doc?: PlanDocument } | null>(null);
  const [importOffen, setImportOffen] = useState(false);
  /** Zugeklappte Planverzeichnisse – in der Planliste sind sie zunächst offen. */
  const [zugeklappt, setZugeklappt] = useState<string[]>([]);
  // Planpakete werden auf einer eigenen Seite gepflegt
  const alle = data.documents.filter((d) => d.projectId === project.id && d.kind !== 'paket');
  const pakete = data.documents.filter((d) => d.projectId === project.id && d.kind === 'paket');

  const passt = (d: PlanDocument) =>
    (filter === 'alle' || d.kind === filter) &&
    [d.nummer, d.titel, d.gewerk, d.index, d.planungsphase].join(' ').toLowerCase().includes(suche.toLowerCase());

  const gefiltert = alle.filter(passt);

  const nummern = lfdNummern(data.documents.filter((d) => d.projectId === project.id));

  /** Name des übergeordneten Planverzeichnisses bzw. des Planpakets. */
  const verzeichnisName = (d: PlanDocument) =>
    d.kind === 'plan' && d.parentId ? (alle.find((x) => x.id === d.parentId)?.titel ?? '') : '';
  const paketName = (d: PlanDocument) => {
    // Pläne eines Verzeichnisses tragen dessen Planpaket
    const eltern = d.kind === 'plan' && d.parentId ? alle.find((x) => x.id === d.parentId) : undefined;
    const paketId = eltern ? eltern.paketId : d.paketId;
    return pakete.find((p) => p.id === paketId)?.titel ?? '';
  };

  const schluessel = (d: PlanDocument): string => {
    switch (sortFeld) {
      case 'lfd': {
        // Nach laufender Nummer: „1“, „1.1“, „2“ … numerisch sortierbar machen
        const nr = nummern.get(d.id) ?? '999';
        return nr
          .split('.')
          .map((t) => t.padStart(4, '0'))
          .join('.');
      }
      case 'kind':
        return DOCUMENT_KIND_LABEL[d.kind];
      case 'parent':
        return verzeichnisName(d);
      case 'paket':
        return paketName(d);
      case 'eingangSoll':
        return d.eingangSoll ?? '9999-99-99';
      default:
        return d[sortFeld];
    }
  };

  const zeilen = [...gefiltert].sort(
    (a, b) => schluessel(a).localeCompare(schluessel(b), 'de', { numeric: true }) * (absteigend ? -1 : 1),
  );

  /**
   * Pläne eines Planverzeichnisses stehen eingerückt unter ihm und lassen sich
   * am Dreieck zuklappen. Ist das Verzeichnis selbst ausgefiltert, steht der
   * Plan wie bisher für sich in der Liste.
   */
  const kinderVon = (id: string) => zeilen.filter((d) => d.kind === 'plan' && d.parentId === id);
  const obereEbene = zeilen.filter(
    (d) => !(d.kind === 'plan' && d.parentId && zeilen.some((x) => x.id === d.parentId)),
  );
  const klappen = (id: string) =>
    setZugeklappt((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const sortieren = (feld: SortFeld) => {
    if (feld === sortFeld) setAbsteigend((a) => !a);
    else {
      setSortFeld(feld);
      setAbsteigend(false);
    }
  };

  const Kopf = ({ feld, children, klasse = '' }: { feld: SortFeld; children: React.ReactNode; klasse?: string }) => (
    <th className={klasse}>
      <button type="button" className="sort-btn" onClick={() => sortieren(feld)}>
        {children}
        <span className={`sort-pfeil ${sortFeld === feld ? 'aktiv' : ''}`}>
          {sortFeld === feld ? (absteigend ? '▾' : '▴') : '▴'}
        </span>
      </button>
    </th>
  );

  const anzahl = (art: DocumentKind) => alle.filter((d) => d.kind === art).length;

  /**
   * Maßgeblicher Lauf eines Eintrags: der laufende, sonst der abgeschlossene.
   * Pläne eines Planverzeichnisses laufen im Lauf des Verzeichnisses mit.
   */
  const laufVon = (d: PlanDocument) => {
    const id = hatEigenenPlanlauf(d, data.documents) ? d.id : (d.parentId ?? d.id);
    const laeufe = data.runs.filter((r) => r.documentId === id && r.status !== 'abgebrochen');
    return laeufe.find((r) => r.status === 'laufend') ?? laeufe[0];
  };

  /**
   * Der Eingang beim Planlaufmanagement steht noch aus: Der Plan ist
   * angekündigt, aber noch nicht eingegangen – die Zeile wird gelb hinterlegt.
   */
  const wartetAufEingang = (d: PlanDocument) => {
    const lauf = laufVon(d);
    const step = lauf ? aktuellerSchritt(lauf) : undefined;
    return Boolean(step && istEingangPLM(step.name));
  };
  const anzahlEingang = alle.filter(wartetAufEingang).length;

  /** Der maßgebliche Planlauf ist abgeschlossen – die Zeile wird grün hinterlegt. */
  const abgeschlossen = (d: PlanDocument) => laufVon(d)?.status === 'abgeschlossen';

  /**
   * Abgebrochene Läufe eines Eintrags. Wurde ein Lauf durch einen neuen Index
   * ersetzt, steht das als Zusatz in der Liste – ebenso ein ersatzloser
   * Abbruch, solange kein weiterer Lauf gestartet wurde.
   */
  const abbruchZusatz = (d: PlanDocument) => {
    // Ein in Einzelläufe aufgeteilter Verzeichnislauf ist kein Abbruch des Eintrags
    const laeufe = data.runs.filter((r) => r.documentId === d.id && r.abbruchArt !== 'aufgeteilt');
    const ersetzt = [...laeufe]
      .reverse()
      .find((r) => r.status === 'abgebrochen' && r.abbruchArt === 'neuer_index');
    if (ersetzt) {
      const label = INDEX_LABEL[d.kind];
      return {
        text: `${label} ${ersetzt.index || '–'} → ${ersetzt.abbruchNeuerIndex || d.index}`,
        titel: `Planlauf zu ${label} ${ersetzt.index || '–'} abgebrochen${
          ersetzt.abbruchDatum ? ` am ${formatDate(ersetzt.abbruchDatum)}` : ''
        } und durch ${label} ${ersetzt.abbruchNeuerIndex || d.index} ersetzt.`,
      };
    }
    // Nur noch abgebrochene Läufe: der Eintrag wird nicht weiterverfolgt
    if (laeufe.length > 0 && laeufe.every((r) => r.status === 'abgebrochen')) {
      const letzter = laeufe[laeufe.length - 1];
      return {
        text: 'abgebrochen',
        titel: `Planlauf ersatzlos abgebrochen${
          letzter.abbruchDatum ? ` am ${formatDate(letzter.abbruchDatum)}` : ''
        }.${letzter.abbruchGrund ? ` ${letzter.abbruchGrund}` : ''}`,
      };
    }
    return null;
  };

  /** Eine Zeile der Planliste; Pläne eines Verzeichnisses stehen eingerückt. */
  const zeile = (doc: PlanDocument, eingerueckt = false) => {
    const kinder = doc.kind === 'verzeichnis' ? kinderVon(doc.id) : [];
    const offen = !zugeklappt.includes(doc.id);
    return (
      <tr
        key={doc.id}
        className={`clickable ${eingerueckt ? 'unterzeile' : ''} ${
          abgeschlossen(doc) ? 'zeile-fertig' : wartetAufEingang(doc) ? 'zeile-eingang' : ''
        }`}
        onClick={() => setDialog({ doc })}
        title={
          abgeschlossen(doc)
            ? 'Planlauf abgeschlossen'
            : wartetAufEingang(doc)
              ? `Angekündigt – „${SCHRITT_EINGANG}“ steht noch aus`
              : undefined
        }
      >
        <td className="num tertiary">{nummern.get(doc.id) ?? '–'}</td>
        {/* Der Pfeil steht zwischen Nummer und Symbol; Symbol und Titel eines
            untergeordneten Plans rücken gemeinsam ein – wie in der Übersicht. */}
        <td className="small" style={{ paddingLeft: eingerueckt ? 60 : 36 }}>
          <span className="row" style={{ gap: 9 }}>
            {kinder.length > 0 ? (
              <button
                type="button"
                className={`chev-btn chev-vorn ${offen ? 'offen' : ''}`}
                title={offen ? 'Pläne ausblenden' : 'Pläne anzeigen'}
                aria-label="Pläne des Verzeichnisses anzeigen"
                onClick={(e) => {
                  e.stopPropagation();
                  klappen(doc.id);
                }}
              >
                <Icon name="chevron" size={13} />
              </button>
            ) : null}
            <DocKindIcon kind={doc.kind} />
            {DOCUMENT_KIND_LABEL[doc.kind]}
          </span>
        </td>
        <td style={{ paddingLeft: eingerueckt ? 38 : undefined }}>
          <span className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
            <span style={{ minWidth: 0 }}>
              <span className="num">
                {doc.nummer}
                {doc.index ? ` · ${INDEX_LABEL[doc.kind]} ${doc.index}` : ''}
              </span>
              <div>
                <strong>{doc.titel}</strong>
                {kinder.length > 0 ? (
                  <span className="small tertiary">
                    {' '}
                    · {kinder.length} {kinder.length === 1 ? 'Plan' : 'Pläne'}
                  </span>
                ) : null}
                {wartetAufEingang(doc) ? (
                  <span className="badge gelb" style={{ marginLeft: 6 }} title={`„${SCHRITT_EINGANG}“ steht noch aus`}>
                    Angekündigt
                  </span>
                ) : null}
                {doc.kind === 'verzeichnis' && !verzeichnisGebuendelt(doc) ? (
                  <span className="badge zusatz" title="Jeder Plan dieses Verzeichnisses hat einen eigenen Planlauf">
                    Pläne einzeln
                  </span>
                ) : null}
                {doc.kind === 'plan' &&
                doc.parentId &&
                doc.eigenerLauf &&
                verzeichnisGebuendelt(alle.find((x) => x.id === doc.parentId) ?? {}) ? (
                  <span className="badge zusatz" title="Aus dem gebündelten Lauf des Verzeichnisses herausgelöst">
                    eigener Lauf
                  </span>
                ) : null}
                {(() => {
                  const zusatz = abbruchZusatz(doc);
                  return zusatz ? (
                    <span className="badge zusatz" title={zusatz.titel}>
                      {zusatz.text}
                    </span>
                  ) : null;
                })()}
              </div>
            </span>
          </span>
        </td>
        <td className="small muted">{doc.gewerk || '–'}</td>
        <td className="small muted col-optional">{verzeichnisName(doc) || '–'}</td>
        <td className="small muted col-optional">{paketName(doc) || '–'}</td>
        <td className="small">{doc.eingangSoll ? formatDate(doc.eingangSoll) : '–'}</td>
        <td className="actions">
          <button
            type="button"
            className="btn-icon"
            aria-label="Eintrag bearbeiten"
            title="Stammdaten bearbeiten"
            onClick={(e) => {
              e.stopPropagation();
              setDialog({ doc });
            }}
          >
            <Icon name="bearbeiten" size={15} />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="stack">
      <div className="row-between wrap">
        <div className="row wrap">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'alle', label: `Alle (${alle.length})` },
              { value: 'plan', label: 'Pläne' },
              { value: 'verzeichnis', label: 'Verzeichnisse' },
            ]}
          />
          <Search value={suche} onChange={setSuche} placeholder="Nummer, Titel, Gewerk …" />
        </div>
        <div className="row">
          <button type="button" className="btn btn-outline" onClick={() => setImportOffen(true)}>
            <Icon name="importieren" size={14} /> Excel-Import
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setDialog({})}>
            <Icon name="plus" size={14} /> Neuer Eintrag
          </button>
        </div>
      </div>

      <Card>
        <CardHeader
          titel="Planliste"
          sub={`${anzahl('plan')} Pläne · ${anzahl('verzeichnis')} Planverzeichnisse${
            anzahlEingang > 0 ? ` · ${anzahlEingang} vor dem Eingang beim PLM` : ''
          } · Spaltenüberschrift klicken zum Sortieren`}
        />
        {zeilen.length === 0 ? (
          <EmptyState
            icon="plan"
            titel="Noch keine Einträge"
            text="Mit einem neuen Eintrag startet zugleich sein Planlauf."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setDialog({})}>
                <Icon name="plus" size={14} /> Neuer Eintrag
              </button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <Kopf feld="lfd">Nr.</Kopf>
                  <Kopf feld="kind">Art</Kopf>
                  <Kopf feld="nummer">Bezeichnung / Titel</Kopf>
                  <Kopf feld="gewerk">Gewerk</Kopf>
                  <Kopf feld="parent" klasse="col-optional">Planverzeichnis</Kopf>
                  <Kopf feld="paket" klasse="col-optional">Planpaket</Kopf>
                  <Kopf feld="eingangSoll">Eingang Soll</Kopf>
                  <th className="actions" />
                </tr>
              </thead>
              <tbody>
                {obereEbene.map((doc) => (
                  <Fragment key={doc.id}>
                    {zeile(doc)}
                    {doc.kind === 'verzeichnis' && !zugeklappt.includes(doc.id)
                      ? kinderVon(doc.id).map((plan) => zeile(plan, true))
                      : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {importOffen ? <PlaeneImport project={project} onClose={() => setImportOffen(false)} /> : null}

      {dialog ? (
        <PlanDialog
          project={project}
          doc={dialog.doc}
          onClose={() => setDialog(null)}
          onLaufGestartet={oeffneLauf}
        />
      ) : null}
    </div>
  );
}

/**
 * Anlage und Pflege eines Eintrags. Beim Anlegen – und bei Einträgen ohne
 * Planlauf – gehört die Workflow dazu, sodass Eintrag und Planlauf
 * gemeinsam entstehen.
 */
function PlanDialog({
  project,
  doc,
  onClose,
  onLaufGestartet,
}: {
  project: Project;
  doc?: PlanDocument;
  onClose: () => void;
  onLaufGestartet: (runId: ID) => void;
}) {
  const { data, addDocument, updateDocument, deleteDocument, addRun, planHerausloesen, verzeichnisAufteilen } =
    useStore();
  const toast = useToast();
  const [loeschen, setLoeschen] = useState(false);
  const [nachtrag, setNachtrag] = useState<'herausloesen' | 'aufteilen' | null>(null);

  const vorlagen = data.templates.filter((t) => t.projectId === null || t.projectId === project.id);
  const kontakte = data.contacts.filter((c) => c.projectId === project.id);
  const rollen = data.roles.filter((r) => r.projectId === project.id);
  const vorhandenerLauf = doc ? data.runs.find((r) => r.documentId === doc.id) : undefined;

  const [form, setForm] = useState({
    kind: doc?.kind ?? ('plan' as DocumentKind),
    parentId: doc?.parentId ?? (null as ID | null),
    paketId: doc?.paketId ?? (null as ID | null),
    nummer: doc?.nummer ?? '',
    titel: doc?.titel ?? '',
    index: doc?.index ?? '',
    gewerk: doc?.gewerk ?? '',
    planungsphase: doc?.planungsphase ?? '',
    eingangSoll: doc?.eingangSoll ?? '',
    datum: doc?.datum ?? '',
    bemerkung: doc?.bemerkung ?? '',
    planlaufModus: doc?.planlaufModus ?? 'gebuendelt',
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  /** Planverzeichnisse des Projekts – mögliche „Eltern“ eines Plans. */
  const moeglicheEltern = data.documents.filter(
    (d) => d.projectId === project.id && d.id !== doc?.id && d.kind === 'verzeichnis',
  );

  // Plan eines Verzeichnisses: gehört automatisch zu dessen Planpaket
  const untergeordnet = form.kind === 'plan' && form.parentId !== null;
  const eltern = moeglicheEltern.find((d) => d.id === form.parentId);
  /** Eigener, nicht abgebrochener Lauf – den behält ein Plan auch beim Verschieben. */
  const eigenerAktiverLauf = doc
    ? data.runs.find((r) => r.documentId === doc.id && r.status !== 'abgebrochen')
    : undefined;
  // Ein Plan läuft im Lauf seines Verzeichnisses mit, wenn dieses gebündelt ist
  // und der Plan nicht herausgelöst wurde.
  const laeuftMit =
    untergeordnet &&
    !eigenerAktiverLauf &&
    !doc?.eigenerLauf &&
    (eltern ? verzeichnisGebuendelt(eltern) : true);
  // Ein Verzeichnis mit einzeln laufenden Plänen ordnet nur – ohne eigenen Lauf.
  const verzeichnisEinzeln = form.kind === 'verzeichnis' && form.planlaufModus === 'einzeln';
  const braucheLauf = !vorhandenerLauf && !laeuftMit && !verzeichnisEinzeln;

  // Die Wahl gebündelt/einzeln ist frei, solange weder das Verzeichnis noch
  // seine Pläne einen Lauf haben. Danach geht es nur noch Richtung „einzeln“.
  const planIds = doc ? data.documents.filter((d) => d.parentId === doc.id).map((d) => d.id) : [];
  const modusGesperrt = Boolean(
    doc && data.runs.some((r) => r.documentId === doc.id || planIds.includes(r.documentId)),
  );
  /** Laufender gebündelter Lauf dieses Verzeichnisses – lässt sich aufteilen. */
  const buendelLauf =
    doc?.kind === 'verzeichnis' && verzeichnisGebuendelt(doc)
      ? data.runs.find((r) => r.documentId === doc.id && r.status === 'laufend')
      : undefined;
  /** Laufender Lauf des Verzeichnisses, aus dem sich dieser Plan herauslösen lässt. */
  const elternLauf =
    doc && laeuftMit && eltern
      ? data.runs.find((r) => r.documentId === eltern.id && r.status === 'laufend')
      : undefined;
  const ohneEigenenLauf = planIds.filter(
    (id) => !data.runs.some((r) => r.documentId === id && r.status !== 'abgebrochen'),
  ).length;
  const pakete = data.documents.filter((d) => d.projectId === project.id && d.kind === 'paket');

  // Pläne eines Verzeichnisses gehören automatisch zu dessen Planpaket
  const elternPaket = moeglicheEltern.find((d) => d.id === form.parentId)?.paketId ?? null;
  const wirksamesPaket = untergeordnet ? elternPaket : form.paketId;

  /** Anlage eines Planverzeichnisses bzw. Planpakets direkt aus der Auswahl. */
  const [schnell, setSchnell] = useState<'verzeichnis' | 'paket' | null>(null);

  const schnellAnlegen = (art: 'verzeichnis' | 'paket', titel: string, nummer: string) => {
    const id = addDocument({
      projectId: project.id,
      kind: art,
      parentId: null,
      paketId: art === 'verzeichnis' ? form.paketId : null,
      nummer,
      titel,
      index: '',
      gewerk: form.gewerk,
      planungsphase: art === 'verzeichnis' ? form.planungsphase : '',
      eingangSoll: null,
      datum: null,
      bemerkung: '',
    });
    if (art === 'verzeichnis') set('parentId', id);
    else set('paketId', id);
    toast(
      art === 'verzeichnis'
        ? 'Planverzeichnis angelegt – der Planlauf lässt sich über den Eintrag starten.'
        : 'Planpaket angelegt.',
    );
  };

  /** Bearbeitbare Kopie der Vorlagenschritte. */
  const kopie = (id: string): ProcessTemplateStep[] => {
    const t = vorlagen.find((v) => v.id === id);
    if (!t) return [];
    const idMap = new Map(t.steps.map((s) => [s.id, newId('ts')]));
    return t.steps.map((s) => ({
      ...s,
      id: idMap.get(s.id)!,
      antworten: s.antworten.map((a) => ({
        ...a,
        id: newId('ant'),
        ziel: a.ziel === 'ende' || a.ziel === null ? a.ziel : (idMap.get(a.ziel) ?? null),
      })),
    }));
  };

  const [templateId, setTemplateId] = useState(vorlagen[0]?.id ?? '');
  const [steps, setSteps] = useState<ProcessTemplateStep[]>(() => kopie(vorlagen[0]?.id ?? ''));
  const [start, setStart] = useState(today());

  const vorlageWechseln = (id: string) => {
    setTemplateId(id);
    setSteps(kopie(id));
  };

  /**
   * Besetzung einer Rolle: Bei Rollen mit Gewerkbezug zählt die Zuordnung für
   * das Gewerk des Eintrags, sonst die gewerkübergreifende Zuordnung.
   */
  const kontaktFuerRolle = (roleName: string): ID | null =>
    kontaktFuerRolleUndGewerk(kontakte, rollen, roleName, form.gewerk);

  const speichern = () => {
    if (!form.titel.trim()) {
      toast('Bitte einen Titel angeben.');
      return;
    }
    const werte = {
      ...form,
      eingangSoll: form.eingangSoll || null,
      datum: form.kind === 'verzeichnis' ? form.datum || null : null,
      parentId: form.kind === 'plan' ? form.parentId : null,
      paketId: wirksamesPaket,
      planlaufModus: form.kind === 'verzeichnis' ? form.planlaufModus : undefined,
      // Ein Plan, der schon einen eigenen Lauf hat, behält ihn – auch wenn er
      // in ein gebündeltes Verzeichnis verschoben wird.
      eigenerLauf:
        form.kind === 'plan' && form.parentId !== null && (doc?.eigenerLauf || Boolean(eigenerAktiverLauf))
          ? true
          : undefined,
    };

    // Ohne eigenen Planlauf – etwa Pläne eines Verzeichnisses – bleibt es bei
    // den Stammdaten.
    if (!braucheLauf) {
      if (doc) {
        updateDocument(doc.id, werte);
        toast('Eintrag aktualisiert.');
      } else {
        addDocument({ ...werte, projectId: project.id });
        toast(
          laeuftMit
            ? 'Plan angelegt – er läuft im Planlauf des Verzeichnisses mit.'
            : verzeichnisEinzeln
              ? 'Planverzeichnis angelegt – seine Pläne erhalten ihre Planläufe einzeln.'
              : 'Eintrag angelegt.',
        );
      }
      onClose();
      return;
    }

    if (steps.length === 0 || steps.some((s) => !s.name.trim())) {
      toast('Bitte jeden Schritt der Workflow benennen.');
      return;
    }

    const documentId = doc ? doc.id : addDocument({ ...werte, projectId: project.id });
    if (doc) updateDocument(doc.id, werte);

    const template = vorlagen.find((t) => t.id === templateId);
    const runSteps = stepsAusTemplate(
      { id: templateId, projectId: null, name: '', beschreibung: '', herkunft: 'manuell', steps },
      kontaktFuerRolle,
      () => newId('rs'),
    );
    const original = template?.steps ?? [];
    const markiert = runSteps.map((s, i) => {
      const vorlage = original[i];
      const abweichend =
        !vorlage ||
        original.length !== runSteps.length ||
        vorlage.name !== s.name ||
        vorlage.fristTage !== s.fristTage ||
        vorlage.roleName !== s.roleName ||
        vorlage.typ !== s.typ;
      return abweichend ? { ...s, abweichung: true } : s;
    });

    const runId = addRun({
      projectId: project.id,
      documentId,
      templateId: template?.id ?? null,
      templateName: template?.name ?? 'Individuelle Kette',
      name: `Planlauf ${form.nummer || form.titel}${
        form.index ? ` ${INDEX_LABEL[form.kind]} ${form.index}` : ''
      }`,
      index: form.index,
      start,
      status: 'laufend',
      abbruchGrund: null,
      abbruchDatum: null,
      abbruchArt: null,
      abbruchNeuerIndex: null,
      steps: markiert,
      bemerkung: '',
    });

    const ohneKontakt = markiert.filter((s) => !s.contactId).length;
    toast(
      ohneKontakt > 0
        ? `Eintrag angelegt und Planlauf gestartet – ${ohneKontakt} Schritt(e) noch ohne Person.`
        : 'Eintrag angelegt und Planlauf gestartet.',
    );
    onClose();
    onLaufGestartet(runId);
  };

  const dauer = steps.reduce((s, x) => s + x.fristTage, 0);

  return (
    <>
      <Modal
        titel={doc ? `${DOCUMENT_KIND_LABEL[doc.kind]} bearbeiten` : 'Neuer Eintrag'}
        sub={
          doc
            ? doc.nummer + (braucheLauf ? ' · Planlauf noch nicht gestartet' : '')
            : 'Stammdaten und Workflow – der Planlauf startet mit dem Eintrag'
        }
        wide={braucheLauf}
        onClose={onClose}
        footer={
          <>
            {doc ? (
              <button type="button" className="btn btn-danger" onClick={() => setLoeschen(true)}>
                <Icon name="loeschen" size={14} /> Löschen
              </button>
            ) : null}
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>
              Abbrechen
            </button>
            <button type="button" className="btn btn-primary" onClick={speichern}>
              {braucheLauf ? (doc ? 'Planlauf starten' : 'Anlegen und Planlauf starten') : 'Speichern'}
            </button>
          </>
        }
      >
        <div className="stack" style={{ gap: 16 }}>
          <div className="form-grid">
            <Field label="Art">
              <Select
                value={form.kind}
                onChange={(v) => {
                  set('kind', v as DocumentKind);
                  if (v !== 'plan') set('parentId', null);
                }}
                options={[
                  { value: 'plan', label: DOCUMENT_KIND_LABEL.plan },
                  { value: 'verzeichnis', label: DOCUMENT_KIND_LABEL.verzeichnis },
                ]}
              />
            </Field>
            {form.kind === 'plan' ? (
              <Field
                label="Planverzeichnis"
                hint="Ob die Pläne im Lauf des Verzeichnisses mitlaufen oder einzeln, legt das Verzeichnis fest; ohne Verzeichnis erhält der Plan einen eigenen Lauf."
              >
                <Select
                  value={form.parentId ?? ''}
                  onChange={(v) => (v === NEU ? setSchnell('verzeichnis') : set('parentId', v || null))}
                  placeholder="– Einzelplan –"
                  options={[
                    ...moeglicheEltern.map((d) => ({ value: d.id, label: `${d.nummer} · ${d.titel}` })),
                    { value: NEU, label: '+ Neues Planverzeichnis anlegen …' },
                  ]}
                />
              </Field>
            ) : null}
            <Field
              label="Planpaket"
              hint={
                untergeordnet
                  ? 'Ergibt sich aus dem Planverzeichnis'
                  : 'Ordnungsmerkmal ohne Einfluss auf den Planlauf'
              }
            >
              {untergeordnet ? (
                <input
                  className="input"
                  readOnly
                  value={pakete.find((p) => p.id === elternPaket)?.titel ?? 'keinem Paket zugeordnet'}
                />
              ) : (
                <Select
                  value={form.paketId ?? ''}
                  onChange={(v) => (v === NEU ? setSchnell('paket') : set('paketId', v || null))}
                  placeholder="– keinem Paket zugeordnet –"
                  options={[
                    ...pakete.map((d) => ({ value: d.id, label: d.titel || d.nummer })),
                    { value: NEU, label: '+ Neues Planpaket anlegen …' },
                  ]}
                />
              )}
            </Field>
            <Field label={NUMMER_LABEL[form.kind]}>
              <TextInput
                value={form.nummer}
                onChange={(v) => set('nummer', v)}
                placeholder={form.kind === 'plan' ? 'NK-KIB-EÜ-001' : 'Bezeichnung'}
              />
            </Field>
            <Field label={INDEX_LABEL[form.kind]} hint="bleibt leer, solange nichts vergeben ist">
              <TextInput value={form.index} onChange={(v) => set('index', v)} placeholder="ohne" />
            </Field>
            <Field label="Titel" full>
              <TextInput value={form.titel} onChange={(v) => set('titel', v)} />
            </Field>
            <Field label="Gewerk" hint="Auswahl oder freie Eingabe">
              <input
                className="input"
                list="gewerke-liste"
                value={form.gewerk}
                onChange={(e) => set('gewerk', e.target.value)}
                placeholder="KIB, VA, OLA …"
              />
              <datalist id="gewerke-liste">
                {gewerkeFuerProjekt(data, project.id).map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </Field>
            <Field label="Planungsphase" hint="Auswahl oder freie Eingabe">
              <input
                className="input"
                list="phasen-liste"
                value={form.planungsphase}
                onChange={(e) => set('planungsphase', e.target.value)}
                placeholder="Ausführungsplanung …"
              />
              <datalist id="phasen-liste">
                {PLANUNGSPHASEN.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Eingang Soll" hint="Soll-Termin des ersten Prozessschritts">
              <TextInput value={form.eingangSoll} onChange={(v) => set('eingangSoll', v)} type="date" />
            </Field>
            {form.kind === 'verzeichnis' ? (
              <Field label="Datum der Ausgabe">
                <TextInput value={form.datum} onChange={(v) => set('datum', v)} type="date" />
              </Field>
            ) : null}
            {form.kind === 'verzeichnis' ? (
              <Field
                label="Planlauf"
                full
                hint={
                  modusGesperrt
                    ? verzeichnisEinzeln
                      ? 'Die Pläne laufen bereits einzeln – eine Rückkehr zur Bündelung ist nicht vorgesehen.'
                      : 'Es bestehen bereits Planläufe. Die Pläne lassen sich nur noch nachträglich einzeln weiterführen.'
                    : 'Ohne Haken durchläuft das Verzeichnis den Planlauf gebündelt, seine Pläne laufen mit.'
                }
              >
                <div className="row wrap" style={{ gap: 12 }}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={verzeichnisEinzeln}
                      disabled={modusGesperrt}
                      onChange={(e) => set('planlaufModus', e.target.checked ? 'einzeln' : 'gebuendelt')}
                    />
                    Pläne einzeln durch den Planlauf führen
                  </label>
                  {buendelLauf && planIds.length > 0 ? (
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setNachtrag('aufteilen')}>
                      Alle Pläne einzeln weiterführen …
                    </button>
                  ) : null}
                </div>
              </Field>
            ) : null}
            <Field label="Bemerkung" full>
              <TextArea value={form.bemerkung} onChange={(v) => set('bemerkung', v)} rows={2} />
            </Field>
          </div>

          {braucheLauf ? (
            <>
              <div className="divider" />
              <div className="form-grid">
                <Field label="Workflow" full hint={vorlagen.find((t) => t.id === templateId)?.beschreibung}>
                  <Select
                    value={templateId}
                    onChange={vorlageWechseln}
                    options={vorlagen.map((t) => ({ value: t.id, label: `${t.name} (${t.steps.length} Schritte)` }))}
                  />
                </Field>
                <Field label="Start des Planlaufs">
                  <TextInput value={start} onChange={setStart} type="date" />
                </Field>
              </div>

              <div>
                <div className="row-between wrap" style={{ marginBottom: 8 }}>
                  <h3>Schritte dieses Planlaufs</h3>
                  <span className="small tertiary">
                    {steps.length} Schritte · {tageLabel(dauer)}
                    {project.settings.fristenInArbeitstagen ? ' (Arbeitstage)' : ''}
                  </span>
                </div>
                <p className="small muted" style={{ marginBottom: 10 }}>
                  Schritte lassen sich hier hinzufügen, ändern oder entfernen. Die Workflow selbst bleibt davon
                  unberührt.
                </p>
                <SchrittListe steps={steps} setSteps={setSteps} rollen={funktionenFuerGewerk(rollen, form.gewerk)} />
              </div>
            </>
          ) : verzeichnisEinzeln ? (
            <Callout icon="i">
              Die Pläne dieses Verzeichnisses durchlaufen den Planlauf einzeln; das Verzeichnis selbst ordnet sie
              nur. Den Planlauf eines Plans startest du über den Plan.
            </Callout>
          ) : laeuftMit ? (
            <Callout icon="i">
              <div className="row-between wrap" style={{ gap: 10 }}>
                <span>
                  Dieser Plan läuft im Planlauf des Verzeichnisses mit
                  {elternLauf ? ` („${elternLauf.name}“)` : ''}.
                </span>
                {elternLauf ? (
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setNachtrag('herausloesen')}>
                    Aus dem Verzeichnislauf herauslösen …
                  </button>
                ) : null}
              </div>
            </Callout>
          ) : (
            <Callout icon="i">
              Für diesen Eintrag läuft bereits der Planlauf „{vorhandenerLauf?.name}“. Die Schritte werden dort
              gepflegt.
            </Callout>
          )}
        </div>
      </Modal>

      {schnell ? (
        <SchnellDialog
          art={schnell}
          onClose={() => setSchnell(null)}
          onAnlegen={(titel, nummer) => schnellAnlegen(schnell, titel, nummer)}
        />
      ) : null}

      {nachtrag === 'herausloesen' && doc && elternLauf ? (
        <ConfirmDialog
          titel="Plan herauslösen?"
          text={`„${doc.titel}“ erhält einen eigenen Planlauf und übernimmt dazu den Stand von „${elternLauf.name}“ – erledigte Schritte bleiben erledigt. Der Lauf des Verzeichnisses geht für die übrigen Pläne weiter.`}
          bestaetigenLabel="Herauslösen"
          onConfirm={() => {
            const runId = planHerausloesen(doc.id);
            if (!runId) return;
            toast('Plan herausgelöst – er läuft jetzt einzeln weiter.');
            onClose();
            onLaufGestartet(runId);
          }}
          onClose={() => setNachtrag(null)}
        />
      ) : null}

      {nachtrag === 'aufteilen' && doc && buendelLauf ? (
        <ConfirmDialog
          titel="Alle Pläne einzeln weiterführen?"
          text={`${ohneEigenenLauf === 1 ? 'Ein Plan erhält' : `${ohneEigenenLauf} Pläne erhalten`} einen eigenen Planlauf mit dem Stand von „${buendelLauf.name}“. Der gebündelte Lauf endet, das Verzeichnis ordnet die Pläne danach nur noch. Das lässt sich nicht rückgängig machen.`}
          bestaetigenLabel="Einzeln weiterführen"
          onConfirm={() => {
            const anzahl = verzeichnisAufteilen(doc.id);
            toast(
              anzahl === 1 ? 'Ein Plan läuft jetzt einzeln weiter.' : `${anzahl} Pläne laufen jetzt einzeln weiter.`,
            );
            onClose();
          }}
          onClose={() => setNachtrag(null)}
        />
      ) : null}

      {loeschen && doc ? (
        <ConfirmDialog
          titel="Eintrag löschen?"
          text={`„${doc.titel}“ wird mit seinem Planlauf gelöscht. Zugeordnete Pläne bleiben erhalten.`}
          onConfirm={() => {
            deleteDocument(doc.id);
            toast('Eintrag gelöscht.');
            onClose();
          }}
          onClose={() => setLoeschen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Kleiner Dialog, um aus der Auswahl heraus ein Planverzeichnis oder ein
 * Planpaket anzulegen, ohne den Eintrag zu verlassen.
 */
function SchnellDialog({
  art,
  onClose,
  onAnlegen,
}: {
  art: 'verzeichnis' | 'paket';
  onClose: () => void;
  onAnlegen: (titel: string, nummer: string) => void;
}) {
  const toast = useToast();
  const [titel, setTitel] = useState('');
  const [nummer, setNummer] = useState('');

  const speichern = () => {
    if (!titel.trim()) {
      toast('Bitte eine Bezeichnung angeben.');
      return;
    }
    onAnlegen(titel.trim(), nummer.trim());
    onClose();
  };

  return (
    <Modal
      titel={art === 'verzeichnis' ? 'Neues Planverzeichnis' : 'Neues Planpaket'}
      sub={
        art === 'verzeichnis'
          ? 'Wird angelegt und dem Plan übergeordnet; der Planlauf lässt sich später starten.'
          : 'Wird angelegt und dem Eintrag zugeordnet.'
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={speichern}>
            Anlegen
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={art === 'verzeichnis' ? NUMMER_LABEL.verzeichnis : NUMMER_LABEL.paket} full>
          <TextInput
            value={titel}
            onChange={setTitel}
            autoFocus
            placeholder={art === 'verzeichnis' ? 'Planverzeichnis Überbau' : 'Eisenbahnüberführung Nordkanal'}
            onKeyDown={(e) => e.key === 'Enter' && speichern()}
          />
        </Field>
        <Field label="Kurzzeichen" full hint="optional">
          <TextInput
            value={nummer}
            onChange={setNummer}
            placeholder={art === 'verzeichnis' ? 'NK-KIB-PV-001' : 'PP-Nordkanal'}
          />
        </Field>
      </div>
    </Modal>
  );
}
