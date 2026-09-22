/**
 * Detailansicht eines Planlaufs: Workflow als Verlauf, Soll-/Ist-Termine,
 * Entscheidungen mit Antwortmöglichkeiten und die Erinnerungsfunktion.
 */
import { useState } from 'react';
import {
  aktuellerSchritt,
  ampelFuerSchritt,
  kontaktFuerRolleUndGewerk,
  massgeblicheAntwort,
  nichtImPfad,
  verlaufDerKette,
  type Ampel,
} from '../../domain/engine';
import { formatDate, tageLabel, today } from '../../lib/dates';
import {
  INDEX_LABEL,
  NACHWEIS_LABEL,
  STEP_STATUS_LABEL,
  STEP_TYPE_LABEL,
  istPrueferRolle,
  type AbbruchArt,
  type Nachweis,
  type PlanDocument,
  type PlanRun,
  type Project,
  type RunStep,
  type StepStatus,
  type StepType,
} from '../../domain/types';
import { newId, useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { AmpelBadge, RunStatusBadge, StepTypBadge } from '../../components/common';
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  Field,
  Modal,
  Select,
  TextArea,
  TextInput,
} from '../../components/ui';
import { EmailDialog } from '../../components/EmailDialog';
import { useSchrittStatus } from '../../components/SchrittStatus';
import { Icon } from '../../components/icons';

export function PlanlaufDetail({
  project,
  run,
  onZurueck,
  oeffneLauf,
}: {
  project: Project;
  run: PlanRun;
  onZurueck: () => void;
  /** Öffnet einen anderen Planlauf – etwa den Nachfolger nach einem Abbruch. */
  oeffneLauf?: (runId: string) => void;
}) {
  const { data, updateRun, updateStep, updateDocument, deleteRun, addRun, abbrechenRun } = useStore();
  const toast = useToast();
  const [mailStep, setMailStep] = useState<RunStep | null>(null);
  const [bearbeiten, setBearbeiten] = useState<RunStep | null>(null);
  const [neuerSchritt, setNeuerSchritt] = useState(false);
  const [laufLoeschen, setLaufLoeschen] = useState(false);
  const [abbrechen, setAbbrechen] = useState(false);
  const { setzeStatus: statusSetzen, nachweisDialog } = useSchrittStatus();
  const [aufgeklappt, setAufgeklappt] = useState<string[]>([]);

  const doc = data.documents.find((d) => d.id === run.documentId);
  const { schritte: verlauf, rueckSprungZu } = verlaufDerKette(run.steps);
  const abseits = nichtImPfad(run.steps);
  const aktiv = aktuellerSchritt(run);
  const vorlauf = project.settings.erinnerungVorlaufTage;
  const abweichungen = run.steps.filter((s) => s.abweichung).length;
  const beendet = run.status !== 'laufend';

  /** Klappt einen erledigten oder künftigen Schritt auf bzw. wieder zu. */
  const klappen = (stepId: string) =>
    setAufgeklappt((a) => (a.includes(stepId) ? a.filter((x) => x !== stepId) : [...a, stepId]));

  /** Setzt den Status eines Schritts; die Ablauflogik liegt in `abschluss.ts`. */
  const setzeStatus = (step: RunStep, status: StepStatus) => statusSetzen(run, step, status);

  /**
   * Fügt einen Schritt hinter einem Schritt des Verlaufs ein und verkettet ihn:
   * Der neue Schritt übernimmt den bisherigen Nachfolger, der Vorgänger zeigt
   * auf den neuen Schritt. So bleibt der Verlauf lückenlos.
   */
  const schrittEinfuegen = (werte: SchrittWerte, nachStepId: string | null) => {
    const neu: RunStep = {
      id: newId('rs'),
      name: werte.name,
      typ: werte.typ,
      roleName: werte.roleName,
      contactId: werte.contactId,
      contactManuell: werte.contactManuell,
      fristTage: werte.fristTage,
      bemerkung: werte.bemerkung,
      sollManuell: false,
      sollDatum: null,
      istDatum: null,
      status: 'offen',
      abweichung: true,
      letzteErinnerung: null,
      antworten: [],
      naechster: null,
      gewaehlteAntwortId: null,
      durchlauf: 1,
      nachweis: werte.nachweis,
      nachweisNummer: null,
      mailFrage: false,
      mailVorlageId: null,
    };

    if (!nachStepId) {
      updateRun(run.id, { steps: [neu, ...run.steps] });
      return;
    }

    const index = run.steps.findIndex((s) => s.id === nachStepId);
    const vorgaenger = run.steps[index];
    const steps = [...run.steps];

    if (vorgaenger.typ === 'entscheidung' && vorgaenger.antworten.length > 0) {
      // Hinter einer Entscheidung bestimmt die maßgebliche Antwort den Verlauf.
      const antwort = massgeblicheAntwort(vorgaenger)!;
      neu.naechster = antwort.ziel ?? run.steps[index + 1]?.id ?? 'ende';
      steps[index] = {
        ...vorgaenger,
        antworten: vorgaenger.antworten.map((a) => (a.id === antwort.id ? { ...a, ziel: neu.id } : a)),
        abweichung: true,
      };
    } else {
      neu.naechster = vorgaenger.naechster ?? run.steps[index + 1]?.id ?? 'ende';
      steps[index] = { ...vorgaenger, naechster: neu.id, abweichung: true };
    }

    steps.splice(index + 1, 0, neu);
    updateRun(run.id, { steps });
  };

  const waehleAntwort = (step: RunStep, antwortId: string) => {
    updateStep(run.id, step.id, { gewaehlteAntwortId: antwortId });
  };

  return (
    <div className="stack">
      <div className="row-between wrap">
        <button type="button" className="btn btn-ghost" onClick={onZurueck}>
          <Icon name="zurueck" size={14} /> Übersicht
        </button>
        <div className="row">
          {run.status === 'laufend' ? (
            <button type="button" className="btn btn-outline" onClick={() => setAbbrechen(true)}>
              Planlauf abbrechen
            </button>
          ) : null}
          <button type="button" className="btn btn-danger" onClick={() => setLaufLoeschen(true)}>
            <Icon name="loeschen" size={14} /> Lauf löschen
          </button>
        </div>
      </div>

      {run.status === 'abgebrochen' ? (
        <Callout ton="error" icon="!">
          <strong>Planlauf abgebrochen{run.abbruchDatum ? ` am ${formatDate(run.abbruchDatum)}` : ''}.</strong>
          <div>{run.abbruchGrund || 'Ohne Begründung.'}</div>
        </Callout>
      ) : null}

      <Card>
        <CardHeader
          titel={doc ? `${doc.nummer} · ${doc.titel}` : run.name}
          sub={
            <>
              {doc
                ? `${doc.nummer} · ${doc.titel}${
                    doc.index ? ` (${INDEX_LABEL[doc.kind]} ${doc.index})` : ''
                  }`
                : 'ohne Plan'}{' '}
              · Start{' '}
              {formatDate(run.start)} · Vorlage: {run.templateName}
            </>
          }
          actions={<RunStatusBadge status={run.status} />}
        />
        {abweichungen > 0 || run.bemerkung ? (
          <div className="card-pad">
            {abweichungen > 0 ? (
              <Callout ton="warn" icon="!">
                {abweichungen} Schritt(e) weichen vom Standard-Workflow ab. Änderungen wirken nur in diesem
                Planlauf.
              </Callout>
            ) : null}
            {run.bemerkung ? <p className="small muted" style={{ marginTop: 10 }}>{run.bemerkung}</p> : null}
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          titel="Prozessschritte"
          sub="Soll-Termine ergeben sich aus den Fristen; Ist-Termine dokumentieren die Erledigung"
          actions={
            !beendet ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setNeuerSchritt(true)}>
                <Icon name="plus" size={13} /> Schritt einfügen
              </button>
            ) : null
          }
        />
        {verlauf.map((step, i) => {
          const ampel: Ampel = ampelFuerSchritt(step, vorlauf);
          const kontakt = data.contacts.find((c) => c.id === step.contactId);
          const istAktiv = step.id === aktiv?.id;
          const erledigt = step.status === 'erledigt' || step.status === 'uebersprungen';
          // Erledigte und künftige Schritte bleiben auf Titel und Nummer
          // reduziert; per Klick auf den Titel lassen sie sich aufklappen.
          const dauerhaftOffen = istAktiv && !beendet;
          const details = dauerhaftOffen || aufgeklappt.includes(step.id);
          return (
            <div
              className={`step-row mit-aktion ${dauerhaftOffen ? 'aktiv' : ''} ${details ? '' : 'kompakt'}`}
              key={step.id}
            >
              <div className="step-marker">
                <div
                  className={`step-num ${
                    ampel === 'erledigt' ? 'done' : ampel === 'ueberfaellig' ? 'late' : istAktiv ? 'current' : ''
                  }`}
                >
                  {erledigt ? <Icon name="check" size={12} strokeWidth={2.4} /> : i + 1}
                </div>
                {i < verlauf.length - 1 ? <div className="step-line" /> : null}
              </div>

              <div className="step-body">
                <div className="step-title">
                  {dauerhaftOffen ? (
                    <strong>{step.name}</strong>
                  ) : (
                    <button
                      type="button"
                      className={`step-aufklappen ${details ? 'offen' : ''}`}
                      onClick={() => klappen(step.id)}
                      title={details ? 'Details ausblenden' : 'Details anzeigen'}
                    >
                      <strong>{step.name}</strong>
                      <span className="chev">
                        <Icon name="chevron" size={13} />
                      </span>
                    </button>
                  )}
                  {details ? (
                    <>
                      <StepTypBadge typ={step.typ} />
                      {step.status === 'uebersprungen' ? <Badge>Übersprungen</Badge> : <AmpelBadge ampel={ampel} />}
                      {step.abweichung ? <Badge ton="orange">Abweichung</Badge> : null}
                      {(step.durchlauf ?? 1) > 1 ? <Badge ton="purple">{step.durchlauf}. Durchlauf</Badge> : null}
                    </>
                  ) : null}
                </div>

                {details ? (
                  <>
                    <div className="step-meta">
                      <span>
                        Verantwortlich: <b>{step.roleName || '–'}</b>
                      </span>
                      <span>
                        Person: <b>{kontakt ? `${kontakt.vorname} ${kontakt.nachname}` : 'nicht zugeordnet'}</b>
                      </span>
                      <span>
                        {i === 0 && doc?.eingangSoll ? (
                          <>
                            Frist: <b>Eingang laut Eintrag</b>
                          </>
                        ) : (
                          <>
                            Frist: <b>{tageLabel(step.fristTage)}</b>
                          </>
                        )}
                      </span>
                      <span>
                        Soll: <b>{formatDate(step.sollDatum)}</b>
                        {step.sollManuell ? ' (fest)' : ''}
                      </span>
                      <span>
                        Ist: <b>{formatDate(step.istDatum)}</b>
                      </span>
                      {step.nachweisNummer ? (
                        <span>
                          {NACHWEIS_LABEL[step.nachweis]} <b>{step.nachweisNummer}</b>
                        </span>
                      ) : step.nachweis !== 'keine' ? (
                        <span className="tertiary">{NACHWEIS_LABEL[step.nachweis]} wird beim Erledigen erfasst</span>
                      ) : null}
                    </div>

                    {step.typ === 'entscheidung' && step.antworten.length > 0 ? (
                      <div className="row wrap" style={{ gap: 6 }}>
                        <span className="small muted">Antwort:</span>
                        {step.antworten.map((a) => {
                          const gewaehlt = massgeblicheAntwort(step)?.id === a.id;
                          const gesetzt = step.gewaehlteAntwortId === a.id;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              className={`antwort-chip ${gewaehlt ? 'gewaehlt' : ''}`}
                              onClick={() => waehleAntwort(step, a.id)}
                              disabled={beendet || !istAktiv}
                              title={
                                a.ziel === 'ende'
                                  ? 'beendet den Planlauf'
                                  : a.ziel
                                    ? `weiter mit „${run.steps.find((s) => s.id === a.ziel)?.name ?? '?'}“`
                                    : 'weiter mit dem nächsten Schritt'
                              }
                            >
                              {a.text}
                              {gesetzt ? ' ✓' : ''}
                            </button>
                          );
                        })}
                        {!step.gewaehlteAntwortId ? (
                          <span className="small tertiary">(Vorschau: erste Möglichkeit)</span>
                        ) : null}
                      </div>
                    ) : null}

                    {step.bemerkung ? <p className="small tertiary">{step.bemerkung}</p> : null}

                    {dauerhaftOffen ? (
                      <div className="step-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => setzeStatus(step, 'erledigt')}
                        >
                          <Icon name="check" size={13} /> Erledigt
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setzeStatus(step, 'uebersprungen')}>
                          Überspringen
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setMailStep(step)}
                          title="Vorbereitete E-Mail an die zuständige Person"
                        >
                          <Icon name="mail" size={13} /> Erinnern
                        </button>
                        {step.letzteErinnerung ? (
                          <span className="small tertiary">
                            erinnert am {new Date(step.letzteErinnerung).toLocaleDateString('de-DE')}
                          </span>
                        ) : null}
                      </div>
                    ) : !beendet && erledigt ? (
                      <div className="step-actions">
                        <button type="button" className="btn btn-sm" onClick={() => setzeStatus(step, 'laufend')}>
                          Wieder öffnen
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>

              {!beendet ? (
                <button
                  type="button"
                  className="btn-icon step-anpassen"
                  title="Schritt anpassen"
                  aria-label="Schritt anpassen"
                  onClick={() => setBearbeiten(step)}
                >
                  <Icon name="bearbeiten" size={15} />
                </button>
              ) : null}
            </div>
          );
        })}

        {rueckSprungZu ? (
          <div className="step-row">
            <div className="step-marker">
              <div className="step-num" title="Rücksprung">↺</div>
            </div>
            <div className="step-body">
              <div className="step-title">
                <strong>Rücksprung zu „{rueckSprungZu.name}“</strong>
                <Badge ton="purple">Schleife</Badge>
              </div>
              <p className="small muted">
                Die gewählte Antwort führt zurück. Sobald die Entscheidung erledigt wird, beginnt ab diesem
                Schritt ein weiterer Durchlauf.
              </p>
            </div>
          </div>
        ) : null}

        {abseits.length > 0 ? (
          <div className="card-pad" style={{ borderTop: '1px solid var(--separator)' }}>
            <div className="small muted" style={{ marginBottom: 6 }}>
              Nicht im aktuellen Verlauf – werden bei anderer Entscheidung durchlaufen:
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              {abseits.map((s) => (
                <span key={s.id} className="badge">
                  {s.name}
                  {s.roleName ? ` · ${s.roleName}` : ''}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {mailStep ? (
        <EmailDialog project={project} run={run} step={mailStep} onClose={() => setMailStep(null)} />
      ) : null}

      {bearbeiten ? (
        <SchrittDialog project={project} run={run} step={bearbeiten} onClose={() => setBearbeiten(null)} />
      ) : null}

      {neuerSchritt ? (
        <SchrittDialog
          project={project}
          run={run}
          verlauf={verlauf}
          onClose={() => setNeuerSchritt(false)}
          onAnlegen={(werte, nachStepId) => {
            schrittEinfuegen(werte, nachStepId);
            toast('Schritt eingefügt – als Abweichung markiert.');
          }}
        />
      ) : null}

      {nachweisDialog}

      {abbrechen ? (
        <AbbruchDialog
          run={run}
          doc={doc}
          onClose={() => setAbbrechen(false)}
          onAbbrechen={(grund, art, neuerIndex) => {
            abbrechenRun(run.id, grund, art, neuerIndex || null);
            if (art === 'neuer_index' && doc) {
              // Eintrag auf den neuen Index heben und den Lauf von vorn beginnen
              updateDocument(doc.id, { index: neuerIndex });
              const neueSchritte: RunStep[] = run.steps.map((s) => ({
                ...s,
                id: newId('rs'),
                status: 'offen',
                istDatum: null,
                nachweisNummer: null,
                gewaehlteAntwortId: null,
                durchlauf: 1,
                sollDatum: null,
              }));
              // Verweise (Antwortziele, Nachfolger) auf die neuen IDs umbiegen
              const idMap = new Map(run.steps.map((s, i) => [s.id, neueSchritte[i].id]));
              const verdrahtet = neueSchritte.map((s) => ({
                ...s,
                naechster:
                  s.naechster === 'ende' || s.naechster === null ? s.naechster : (idMap.get(s.naechster) ?? null),
                antworten: s.antworten.map((a) => ({
                  ...a,
                  id: newId('ant'),
                  ziel: a.ziel === 'ende' || a.ziel === null ? a.ziel : (idMap.get(a.ziel) ?? null),
                })),
              }));
              verdrahtet[0] = { ...verdrahtet[0], status: 'laufend' };

              const neuerLauf = addRun({
                projectId: run.projectId,
                documentId: run.documentId,
                templateId: run.templateId,
                templateName: run.templateName,
                name: `Planlauf ${doc.nummer} ${INDEX_LABEL[doc.kind]} ${neuerIndex}`,
                index: neuerIndex,
                start: today(),
                status: 'laufend',
                abbruchGrund: null,
                abbruchDatum: null,
                abbruchArt: null,
                abbruchNeuerIndex: null,
                steps: verdrahtet,
                bemerkung: `Nachfolger von „${run.name}“ (${grund})`,
              });
              toast(`Neuer Planlauf mit ${INDEX_LABEL[doc.kind]} ${neuerIndex} gestartet.`);
              oeffneLauf?.(neuerLauf);
              return;
            }
            toast('Planlauf abgebrochen – er bleibt in der Projektansicht sichtbar.');
          }}
        />
      ) : null}

      {laufLoeschen ? (
        <ConfirmDialog
          titel="Planlauf löschen?"
          text={`„${run.name}“ wird mit allen Terminen dauerhaft gelöscht.`}
          onConfirm={() => {
            deleteRun(run.id);
            toast('Planlauf gelöscht.');
            onZurueck();
          }}
          onClose={() => setLaufLoeschen(false)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AbbruchDialog({
  run,
  doc,
  onClose,
  onAbbrechen,
}: {
  run: PlanRun;
  doc: PlanDocument | undefined;
  onClose: () => void;
  onAbbrechen: (grund: string, art: AbbruchArt, neuerIndex: string) => void;
}) {
  const toast = useToast();
  const [grund, setGrund] = useState('');
  const [art, setArt] = useState<AbbruchArt>('ersatzlos');
  const [neuerIndex, setNeuerIndex] = useState('');

  const indexBezeichnung = doc ? INDEX_LABEL[doc.kind] : 'Index';

  return (
    <Modal
      titel="Planlauf abbrechen"
      sub={run.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Zurück
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ background: 'var(--red)' }}
            onClick={() => {
              if (!grund.trim()) {
                toast('Bitte einen Grund angeben.');
                return;
              }
              if (art === 'neuer_index' && !neuerIndex.trim()) {
                toast(`Bitte ${indexBezeichnung} angeben.`);
                return;
              }
              onAbbrechen(grund.trim(), art, neuerIndex.trim());
              onClose();
            }}
          >
            {art === 'neuer_index' ? 'Abbrechen und neu starten' : 'Planlauf abbrechen'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <Field label="Art des Abbruchs">
          <div className="stack" style={{ gap: 8 }}>
            <label className="checkbox">
              <input
                type="radio"
                name="abbruchart"
                checked={art === 'ersatzlos'}
                onChange={() => setArt('ersatzlos')}
              />
              Ersatzlos – der Eintrag wird nicht weiterverfolgt
            </label>
            <label className="checkbox">
              <input
                type="radio"
                name="abbruchart"
                checked={art === 'neuer_index'}
                onChange={() => setArt('neuer_index')}
              />
              {doc?.kind === 'verzeichnis' ? 'Neue Ausgabe' : 'Neuer Index'} – der Planlauf beginnt damit von vorn
            </label>
          </div>
        </Field>

        {art === 'neuer_index' ? (
          <Field
            label={`${indexBezeichnung} des neuen Planlaufs`}
            hint={`Der Eintrag erhält ${indexBezeichnung} „${neuerIndex || '…'}“; der Planlauf wird mit denselben Schritten neu begonnen.`}
          >
            <TextInput
              value={neuerIndex}
              onChange={setNeuerIndex}
              autoFocus
              placeholder={doc?.kind === 'verzeichnis' ? 'z.B. 03' : 'z.B. D'}
            />
          </Field>
        ) : (
          <Callout icon="i">
            Der Lauf bleibt ausgegraut in der Projektansicht mit dem Grund sichtbar. In den übergeordneten
            Ansichten (Übersicht, Fristen) erscheint er nicht mehr.
          </Callout>
        )}

        <Field label="Grund des Abbruchs" hint="wird in der Projektübersicht und im Export angezeigt">
          <TextArea
            value={grund}
            onChange={setGrund}
            rows={3}
            placeholder={
              art === 'neuer_index'
                ? 'z.B. Planinhalt geändert, Neuvorlage erforderlich'
                : 'z.B. Planinhalt entfällt, Leistung neu beauftragt'
            }
          />
        </Field>
      </div>
    </Modal>
  );
}

type SchrittWerte = {
  name: string;
  typ: StepType;
  roleName: string;
  contactId: string | null;
  /** Person von Hand gewählt – sie bleibt trotz neuer Besetzung stehen. */
  contactManuell: boolean;
  fristTage: number;
  bemerkung: string;
  nachweis: Nachweis;
};

function SchrittDialog({
  project,
  run,
  step,
  verlauf,
  onClose,
  onAnlegen,
}: {
  project: Project;
  run: PlanRun;
  step?: RunStep;
  onClose: () => void;
  onAnlegen?: (werte: SchrittWerte, nachStepId: string | null) => void;
  /** Schritte des aktuellen Verlaufs – Grundlage der Einfügeposition. */
  verlauf?: RunStep[];
}) {
  const { data, updateStep } = useStore();
  const toast = useToast();
  const rollen = data.roles.filter((r) => r.projectId === project.id);
  const kontakte = data.contacts.filter((c) => c.projectId === project.id);

  const [form, setForm] = useState({
    name: step?.name ?? '',
    typ: step?.typ ?? ('aufgabe' as StepType),
    roleName: step?.roleName ?? '',
    contactId: step?.contactId ?? null,
    contactManuell: step?.contactManuell ?? false,
    fristTage: step?.fristTage ?? 5,
    sollManuell: step?.sollManuell ?? false,
    sollDatum: step?.sollDatum ?? today(),
    istDatum: step?.istDatum ?? '',
    status: step?.status ?? ('offen' as StepStatus),
    bemerkung: step?.bemerkung ?? '',
    nachweis: step?.nachweis ?? ('keine' as Nachweis),
  });

  // Wer die Funktion im Projekt ausfüllt – Grundlage der automatischen Zuordnung
  const gewerk = data.documents.find((d) => d.id === run.documentId)?.gewerk ?? '';
  const automatischId = kontaktFuerRolleUndGewerk(kontakte, rollen, form.roleName, gewerk);
  const automatischKontakt = kontakte.find((c) => c.id === automatischId);
  const automatisch = automatischKontakt
    ? `${automatischKontakt.vorname} ${automatischKontakt.nachname}`
    : '';

  // Einfügeposition: hinter welchem Schritt des Verlaufs der neue Schritt steht
  const [nachStepId, setNachStepId] = useState<string>(() => verlauf?.[verlauf.length - 1]?.id ?? '');

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  /** Prüfende Rollen verlangen regelmäßig einen Prüfbericht. */
  const rolleWechseln = (roleName: string) =>
    setForm((f) => ({
      ...f,
      roleName,
      nachweis: f.nachweis === 'keine' && istPrueferRolle(roleName) ? 'pruefbericht' : f.nachweis,
    }));

  const speichern = () => {
    if (!form.name.trim()) {
      toast('Bitte einen Namen angeben.');
      return;
    }
    if (step) {
      const veraendert =
        form.name !== step.name ||
        form.fristTage !== step.fristTage ||
        form.roleName !== step.roleName ||
        form.typ !== step.typ ||
        form.sollManuell !== step.sollManuell;
      updateStep(run.id, step.id, {
        name: form.name,
        typ: form.typ,
        roleName: form.roleName,
        contactId: form.contactId,
        contactManuell: form.contactManuell,
        fristTage: Number(form.fristTage) || 0,
        sollManuell: form.sollManuell,
        sollDatum: form.sollManuell ? form.sollDatum : step.sollDatum,
        istDatum: form.istDatum || null,
        status: form.status,
        bemerkung: form.bemerkung,
        nachweis: form.nachweis,
        abweichung: step.abweichung || veraendert,
      });
      toast('Schritt angepasst.');
    } else {
      onAnlegen?.(
        {
          name: form.name,
          typ: form.typ,
          roleName: form.roleName,
          contactId: form.contactId,
          contactManuell: form.contactManuell,
          fristTage: Number(form.fristTage) || 0,
          bemerkung: form.bemerkung,
          nachweis: form.nachweis,
        },
        nachStepId || null,
      );
    }
    onClose();
  };

  return (
    <Modal
      titel={step ? 'Schritt anpassen' : 'Schritt einfügen'}
      sub="Änderungen gelten nur für diesen Planlauf (individuelle Abweichung)"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={speichern}>
            Speichern
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Bezeichnung" full>
          <TextInput value={form.name} onChange={(v) => set('name', v)} />
        </Field>
        <Field label="Art">
          <Select
            value={form.typ}
            onChange={(v) => set('typ', v as StepType)}
            options={Object.entries(STEP_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="Verantwortlicher" hint="Prüfer werden hier ergänzt (z.B. Erdungsprüfer)">
          <Select
            value={form.roleName}
            onChange={rolleWechseln}
            placeholder="– keine Funktion –"
            options={rollen.map((r) => ({ value: r.name, label: r.name }))}
          />
        </Field>
        <Field label="Nachweis bei Abschluss" hint="wird beim Erledigen abgefragt">
          <Select
            value={form.nachweis}
            onChange={(v) => set('nachweis', v as Nachweis)}
            options={Object.entries(NACHWEIS_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        {!step ? (
          <Field label="Einfügen nach" full hint="Der Schritt wird in den laufenden Verlauf eingehängt.">
            <Select
              value={nachStepId}
              onChange={setNachStepId}
              options={[
                { value: '', label: '– an den Anfang –' },
                ...(verlauf ?? []).map((s, i) => ({ value: s.id, label: `${i + 1}. ${s.name}` })),
              ]}
            />
          </Field>
        ) : null}
        <Field
          label="Zuständige Person"
          hint={
            form.contactManuell
              ? 'Von Hand gewählt – eine andere Besetzung der Funktion wirkt hier nicht.'
              : automatisch
                ? `Laut Rollen & Funktionen: ${automatisch}`
                : 'Diese Funktion ist im Projekt nicht besetzt – die Person wird übernommen, sobald sie eingetragen ist.'
          }
        >
          <Select
            value={form.contactManuell ? (form.contactId ?? '') : ''}
            onChange={(v) =>
              setForm((f) => ({ ...f, contactId: v || null, contactManuell: Boolean(v) }))
            }
            placeholder="– nach Besetzung der Funktion –"
            options={kontakte.map((c) => ({ value: c.id, label: `${c.vorname} ${c.nachname} (${c.firma})` }))}
          />
        </Field>
        <Field label="Frist in Tagen" hint="ab Soll-Termin des Vorgängers">
          <TextInput
            value={String(form.fristTage)}
            onChange={(v) => set('fristTage', Number(v.replace(/\D/g, '')) || 0)}
            inputMode="numeric"
          />
        </Field>
        {step ? (
          <>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(v) => set('status', v as StepStatus)}
                options={Object.entries(STEP_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Ist-Termin" hint="leer = noch nicht erledigt">
              <TextInput value={form.istDatum} onChange={(v) => set('istDatum', v)} type="date" />
            </Field>
            <Field label="Soll-Termin festsetzen" full hint="Überschreibt die Fristenrechnung ab diesem Schritt.">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.sollManuell}
                  onChange={(e) => set('sollManuell', e.target.checked)}
                />
                Soll-Termin manuell vorgeben
              </label>
              {form.sollManuell ? (
                <div style={{ marginTop: 8 }}>
                  <TextInput value={form.sollDatum ?? ''} onChange={(v) => set('sollDatum', v)} type="date" />
                </div>
              ) : null}
            </Field>
          </>
        ) : null}
        <Field label="Bemerkung" full>
          <TextArea value={form.bemerkung} onChange={(v) => set('bemerkung', v)} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}
