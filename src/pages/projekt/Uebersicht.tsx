/** Projektübersicht: Kennzahlen, Fristenlage und letzte Aktivitäten. */
import { useState } from 'react';
import {
  aktuellerSchritt,
  ampelFuerSchritt,
  eigenstaendigeLaeufe,
  fortschritt,
  offeneFristen,
} from '../../domain/engine';
import { istEingangPLM, type Contact, type DocumentKind, type Project } from '../../domain/types';
import type { ProjektTab } from '../../lib/router';
import { useStore } from '../../store/store';
import { Card, CardHeader, EmptyState, Progress, Search, Segmented, Stat } from '../../components/ui';
import { PlanlaufListe } from '../../components/PlanlaufListe';

/** Auswahl der Statusspalte – laufende Läufe nach ihrer Ampel. */
const STATUS_FILTER = [
  { value: 'angekuendigt', label: 'Angekündigt' },
  { value: 'geplant', label: 'Im Plan' },
  { value: 'faellig', label: 'Fällig' },
  { value: 'ueberfaellig', label: 'Überfällig' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
  { value: 'abgebrochen', label: 'Abgebrochen' },
];

export function Uebersicht({
  project,
  gotoTab,
  oeffneLauf,
}: {
  project: Project;
  gotoTab: (t: ProjektTab) => void;
  oeffneLauf: (runId: string) => void;
}) {
  const { data } = useStore();
  // Gliederung der Planlaufliste: Pakete allein oder mit ihren Einträgen;
  // Pläne, die im Lauf ihres Verzeichnisses mitlaufen, sind zunächst aus.
  const [ebene, setEbene] = useState<'1' | '2'>('2');
  const [unterplaene, setUnterplaene] = useState(false);
  // Filter der Planlaufliste
  const [suche, setSuche] = useState('');
  const [gewerkFilter, setGewerkFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const dokumente = data.documents.filter((d) => d.projectId === project.id);
  // Ohne die Läufe von Plänen, die in einem Planverzeichnis mitlaufen
  const laeufe = eigenstaendigeLaeufe(data.documents, data.runs).filter(
    (r) => r.projectId === project.id,
  );
  const aktiv = laeufe.filter((r) => r.status === 'laufend');
  const abgeschlossen = laeufe.filter((r) => r.status === 'abgeschlossen');

  // Wie in der Planliste: je Eintrag der maßgebliche Lauf – der laufende,
  // sonst der abgeschlossene, sonst der abgebrochene.
  const rang = (r: (typeof laeufe)[number]) =>
    r.status === 'laufend' ? 0 : r.status === 'abgeschlossen' ? 1 : 2;
  const massgeblich = [...laeufe]
    .sort((a, b) => rang(a) - rang(b))
    .filter((r, i, alle) => alle.findIndex((x) => x.documentId === r.documentId) === i);
  /**
   * Status eines Laufs als Filterwert – laufende nach ihrer Ampel, solange der
   * Eingang beim Planlaufmanagement aussteht dagegen „angekündigt“.
   */
  const statusVon = (r: (typeof laeufe)[number]) => {
    if (r.status !== 'laufend') return r.status;
    const step = aktuellerSchritt(r);
    if (step && istEingangPLM(step.name)) return 'angekuendigt';
    return step ? ampelFuerSchritt(step, project.settings.erinnerungVorlaufTage) : 'neutral';
  };

  const gefiltert = massgeblich.filter((r) => {
    const doc = data.documents.find((d) => d.id === r.documentId);
    const step = aktuellerSchritt(r);
    const paket = doc?.paketId ? dokumente.find((d) => d.id === doc.paketId) : undefined;
    const text = [doc?.nummer, doc?.titel, doc?.index, r.name, step?.name, paket?.titel]
      .join(' ')
      .toLowerCase();
    return (
      (!suche || text.includes(suche.toLowerCase())) &&
      (!gewerkFilter || (doc?.gewerk ?? '') === gewerkFilter) &&
      (!statusFilter || statusVon(r) === statusFilter) &&
      (!personFilter || step?.contactId === personFilter)
    );
  });

  // Auswahllisten aus dem Bestand des Projekts
  const gewerke = [...new Set(dokumente.map((d) => d.gewerk).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'de'),
  );
  const personenIds = [
    ...new Set(
      massgeblich.map((r) => aktuellerSchritt(r)?.contactId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const personen = personenIds
    .map((id) => data.contacts.find((c) => c.id === id))
    .filter((c): c is Contact => Boolean(c))
    .sort((a, b) => a.nachname.localeCompare(b.nachname, 'de'));

  const filterAktiv = Boolean(suche || gewerkFilter || statusFilter || personFilter);
  const filterLoeschen = () => {
    setSuche('');
    setGewerkFilter('');
    setStatusFilter('');
    setPersonFilter('');
  };

  const fristen = offeneFristen(data, [project.id]);
  const faellig = fristen.filter((f) => f.ampel === 'faellig').length;
  const ueberfaellig = fristen.filter((f) => f.ampel === 'ueberfaellig').length;
  const anzahl = (art: DocumentKind) => dokumente.filter((d) => d.kind === art).length;

  // Gesamtfortschritt: Mittel über alle eigenständigen Läufe ohne abgebrochene
  const gezaehlt = laeufe.filter((r) => r.status !== 'abgebrochen');
  const gesamt = gezaehlt.length
    ? Math.round(gezaehlt.reduce((summe, r) => summe + fortschritt(r), 0) / gezaehlt.length)
    : 0;

  return (
    <div className="stack">
      <Card>
        <div className="kennzahlen">
          <Stat wert={anzahl('paket')} label="Planpakete" onClick={() => gotoTab('pakete')} />
          <Stat wert={anzahl('verzeichnis')} label="Planverzeichnisse" onClick={() => gotoTab('plaene')} />
          <Stat wert={anzahl('plan')} label="Pläne" onClick={() => gotoTab('plaene')} />
          <Stat wert={faellig} label="Fällige Schritte" ton={faellig ? 'orange' : ''} />
          <Stat wert={ueberfaellig} label="Überfällige Schritte" ton={ueberfaellig ? 'red' : 'green'} />
        </div>
        <div className="card-pad row" style={{ gap: 14 }}>
          <span className="small muted" style={{ flex: 'none' }}>
            Gesamtfortschritt der Planläufe
          </span>
          <span style={{ flex: 1 }}>
            <Progress wert={gesamt} ton={gesamt === 100 ? 'green' : ''} />
          </span>
          <b className="small" style={{ flex: 'none', minWidth: 38, textAlign: 'right' }}>{gesamt}%</b>
        </div>
      </Card>

      <Card>
        <CardHeader
          titel="Planläufe"
          sub={
            filterAktiv
              ? `${gefiltert.length} von ${massgeblich.length} Einträgen · Spaltenüberschrift klicken zum Sortieren`
              : `${aktiv.length} laufend · ${abgeschlossen.length} abgeschlossen · Spaltenüberschrift klicken zum Sortieren`
          }
          actions={
            <span className="row wrap" style={{ gap: 10 }}>
              <Search value={suche} onChange={setSuche} placeholder="Nummer, Titel, Schritt …" />
              <Segmented<'1' | '2'>
                value={ebene}
                onChange={setEbene}
                options={[
                  { value: '1', label: 'Planpakete' },
                  { value: '2', label: '+ Pläne & Verzeichnisse' },
                ]}
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={unterplaene}
                  onChange={(e) => setUnterplaene(e.target.checked)}
                />
                Untergeordnete Pläne anzeigen
              </label>
              {filterAktiv ? (
                <button type="button" className="btn btn-sm btn-ghost" onClick={filterLoeschen}>
                  Filter zurücksetzen
                </button>
              ) : null}
            </span>
          }
        />
        {massgeblich.length === 0 ? (
          <EmptyState
            icon="kette"
            titel="Noch kein Planlauf"
            text="Starten Sie einen Lauf für einen Plan oder ein Planverzeichnis."
          />
        ) : gefiltert.length === 0 ? (
          <EmptyState
            icon="suche"
            titel="Kein Eintrag passt zum Filter"
            text="Setzen Sie die Filter zurück, um wieder alle Planläufe zu sehen."
            action={
              <button type="button" className="btn btn-primary" onClick={filterLoeschen}>
                Filter zurücksetzen
              </button>
            }
          />
        ) : (
          <PlanlaufListe
            project={project}
            runs={gefiltert}
            spaltenFilter={{
              werte: { gewerk: gewerkFilter, zustaendig: personFilter, status: statusFilter },
              setzen: (feld, wert) => {
                if (feld === 'gewerk') setGewerkFilter(wert);
                else if (feld === 'zustaendig') setPersonFilter(wert);
                else setStatusFilter(wert);
              },
              optionen: {
                gewerk: gewerke.map((g) => ({ value: g, label: g })),
                zustaendig: personen.map((c) => ({ value: c.id, label: `${c.vorname} ${c.nachname}` })),
                status: STATUS_FILTER,
              },
            }}
            alleRuns={laeufe}
            ebene={Number(ebene) as 1 | 2}
            unterplaene={unterplaene}
            oeffneLauf={oeffneLauf}
          />
        )}
      </Card>
    </div>
  );
}
