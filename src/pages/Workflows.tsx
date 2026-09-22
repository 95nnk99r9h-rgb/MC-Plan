/**
 * Verwaltung der Workflow-Vorlagen: Standard-Workflows und projektspezifische
 * Varianten. Ein Schritt ist eine Aufgabe, eine Entscheidung oder Sonstiges;
 * Entscheidungen bestimmen über ihre Antworten den weiteren Verlauf.
 */
import { useState } from 'react';
import { pfad, templateDauer } from '../domain/engine';
import {
  NACHWEIS_LABEL,
  STANDARD_ANTWORTEN,
  STEP_TYPE_LABEL,
  istPrueferRolle,
  type Antwort,
  type Nachweis,
  type ProcessTemplate,
  type ProcessTemplateStep,
  type StepType,
} from '../domain/types';
import { newId, useStore } from '../store/store';
import { useToast } from '../components/toast';
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  TextArea,
  TextInput,
} from '../components/ui';
import { Icon } from '../components/icons';

export function Workflows({ projectId }: { projectId?: string }) {
  const { data, addTemplate, deleteTemplate } = useStore();
  const toast = useToast();
  const [editor, setEditor] = useState<{ template?: ProcessTemplate } | null>(null);
  const [loeschen, setLoeschen] = useState<ProcessTemplate | null>(null);

  const vorlagen = data.templates.filter((t) => (projectId ? t.projectId === null || t.projectId === projectId : true));
  const standard = vorlagen.filter((t) => t.projectId === null);
  const eigene = vorlagen.filter((t) => t.projectId !== null);

  const duplizieren = (t: ProcessTemplate) => {
    const idMap = new Map(t.steps.map((s) => [s.id, newId('ts')]));
    addTemplate({
      ...t,
      id: newId('tpl'),
      projectId: projectId ?? null,
      name: `${t.name} (Kopie)`,
      herkunft: 'manuell',
      steps: t.steps.map((s) => ({
        ...s,
        id: idMap.get(s.id)!,
        antworten: s.antworten.map((a) => ({
          ...a,
          id: newId('ant'),
          ziel: a.ziel === 'ende' || a.ziel === null ? a.ziel : (idMap.get(a.ziel) ?? null),
        })),
      })),
    });
    toast('Workflow dupliziert – jetzt individuell anpassbar.');
  };

  const liste = (titel: string, eintraege: ProcessTemplate[], sub: string) => (
    <Card>
      <CardHeader titel={titel} sub={sub} />
      {eintraege.length === 0 ? (
        <EmptyState icon="kette" titel="Keine Workflow" text="Legen Sie eine Kette an oder duplizieren Sie einen Standard-Workflow." />
      ) : (
        eintraege.map((t) => {
          const entscheidungen = t.steps.filter((s) => s.typ === 'entscheidung').length;
          return (
            <div className="list-row" key={t.id}>
              <span className="tertiary" style={{ display: 'flex' }}>
                <Icon name="kette" size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <strong>{t.name}</strong>
                  {t.projectId === null ? <Badge>Standard</Badge> : <Badge ton="blue">Projektvariante</Badge>}
                  {entscheidungen > 0 ? <Badge ton="purple">{entscheidungen} Entscheidung(en)</Badge> : null}
                </div>
                <div className="small tertiary truncate">
                  {t.steps.length} Schritte · {templateDauer(t)} Tage im Standardverlauf
                  {t.beschreibung ? ` · ${t.beschreibung}` : ''}
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditor({ template: t })}>
                Öffnen
              </button>
              <button type="button" className="btn btn-sm" onClick={() => duplizieren(t)}>
                <Icon name="kopieren" size={13} /> Duplizieren
              </button>
              {t.projectId !== null ? (
                <button type="button" className="btn-icon" onClick={() => setLoeschen(t)} aria-label="Löschen">
                  <Icon name="loeschen" size={15} />
                </button>
              ) : null}
            </div>
          );
        })
      )}
    </Card>
  );

  return (
    <div className="stack">
      <div className="row-between wrap">
        <p className="muted small" style={{ maxWidth: 640 }}>
          Standard-Workflows gelten projektübergreifend. Für Abweichungen duplizieren Sie eine Kette als Projektvariante –
          einzelne Planläufe lassen sich zusätzlich individuell anpassen.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setEditor({})}>
          <Icon name="plus" size={14} /> Neue Kette
        </button>
      </div>

      {liste('Standard-Workflows', standard, 'Projektübergreifend verfügbar')}
      {liste(projectId ? 'Projektvarianten' : 'Projektspezifische Ketten', eigene, 'Nur im jeweiligen Projekt wählbar')}

      {editor ? (
        <KettenEditor template={editor.template} projectId={projectId ?? null} onClose={() => setEditor(null)} />
      ) : null}
      {loeschen ? (
        <ConfirmDialog
          titel="Workflow löschen?"
          text={`„${loeschen.name}“ wird gelöscht. Bereits gestartete Planläufe bleiben unverändert.`}
          onConfirm={() => {
            deleteTemplate(loeschen.id);
            toast('Workflow gelöscht.');
          }}
          onClose={() => setLoeschen(null)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

/** Legt einen neuen Schritt an – Entscheidungen mit zwei Standardantworten. */
export function neuerSchritt(typ: StepType = 'aufgabe'): ProcessTemplateStep {
  return {
    id: newId('ts'),
    name: '',
    typ,
    roleName: '',
    fristTage: typ === 'entscheidung' ? 0 : 5,
    beschreibung: '',
    antworten: typ === 'entscheidung' ? standardAntworten() : [],
    naechster: null,
    nachweis: 'keine',
    mailFrage: false,
    mailVorlageId: null,
  };
}

export function standardAntworten(): Antwort[] {
  return STANDARD_ANTWORTEN.map((text) => ({ id: newId('ant'), text, ziel: null }));
}

function KettenEditor({
  template,
  projectId,
  onClose,
}: {
  template?: ProcessTemplate;
  projectId: string | null;
  onClose: () => void;
}) {
  const { data, addTemplate, updateTemplate } = useStore();
  const toast = useToast();
  const rollen = [...new Set(data.roles.map((r) => r.name))].sort((a, b) => a.localeCompare(b, 'de'));

  const [name, setName] = useState(template?.name ?? '');
  const [beschreibung, setBeschreibung] = useState(template?.beschreibung ?? '');
  const [steps, setSteps] = useState<ProcessTemplateStep[]>(
    template?.steps.map((s) => ({ ...s, antworten: s.antworten.map((a) => ({ ...a })) })) ?? [neuerSchritt()],
  );

  const istStandard = template !== undefined && template.projectId === null;

  const speichern = () => {
    if (!name.trim()) {
      toast('Bitte einen Namen angeben.');
      return;
    }
    if (steps.some((s) => !s.name.trim())) {
      toast('Bitte jeden Schritt benennen.');
      return;
    }
    const bereinigt = steps.map((s) => ({
      ...s,
      antworten:
        s.typ === 'entscheidung'
          ? s.antworten.map((a, i) => ({ ...a, text: a.text.trim() || STANDARD_ANTWORTEN[i] || `Antwort ${i + 1}` }))
          : [],
    }));
    if (template) {
      updateTemplate(template.id, { name, beschreibung, steps: bereinigt });
      toast('Workflow gespeichert.');
    } else {
      addTemplate({ projectId, name, beschreibung, herkunft: 'manuell', steps: bereinigt });
      toast('Workflow angelegt.');
    }
    onClose();
  };

  return (
    <Modal
      titel={template ? 'Workflow bearbeiten' : 'Neue Workflow'}
      sub={`${steps.length} Schritte · ${pfad(steps).reduce((s, x) => s + x.fristTage, 0)} Tage im Standardverlauf`}
      wide
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
      <div className="stack" style={{ gap: 16 }}>
        {istStandard ? (
          <Callout icon="i">
            Dies ist eine projektübergreifende Standard-Workflow. Änderungen wirken sich auf alle künftigen Planläufe aus –
            für einmalige Abweichungen besser duplizieren.
          </Callout>
        ) : null}

        <div className="form-grid">
          <Field label="Name" full>
            <TextInput value={name} onChange={setName} placeholder="z.B. Planlauf Ausführungsplanung" />
          </Field>
          <Field label="Beschreibung" full>
            <TextArea value={beschreibung} onChange={setBeschreibung} rows={2} />
          </Field>
        </div>

        <SchrittListe steps={steps} setSteps={setSteps} rollen={rollen} />
      </div>
    </Modal>
  );
}

/**
 * Bearbeitbare Schrittliste – wird im Ketteneditor und beim Start eines
 * Planlaufs verwendet.
 */
export function SchrittListe({
  steps,
  setSteps,
  rollen,
}: {
  steps: ProcessTemplateStep[];
  setSteps: (s: ProcessTemplateStep[]) => void;
  rollen: string[];
}) {
  const { data } = useStore();
  const mailVorlagen = data.emailVorlagen;

  const setStep = (id: string, patch: Partial<ProcessTemplateStep>) =>
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const verschieben = (idx: number, richtung: -1 | 1) => {
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= steps.length) return;
    const neu = [...steps];
    [neu[idx], neu[ziel]] = [neu[ziel], neu[idx]];
    setSteps(neu);
  };

  /** Prüfende Rollen verlangen regelmäßig einen Prüfbericht. */
  const rolleWechseln = (step: ProcessTemplateStep, roleName: string) =>
    setStep(step.id, {
      roleName,
      nachweis:
        step.nachweis === 'keine' && istPrueferRolle(roleName) ? 'pruefbericht' : step.nachweis,
    });

  const typWechseln = (step: ProcessTemplateStep, typ: StepType) =>
    setStep(step.id, {
      typ,
      antworten: typ === 'entscheidung' ? (step.antworten.length ? step.antworten : standardAntworten()) : [],
      fristTage: typ === 'entscheidung' ? 0 : step.fristTage,
    });

  const setAntwort = (step: ProcessTemplateStep, antwortId: string, patch: Partial<Antwort>) =>
    setStep(step.id, { antworten: step.antworten.map((a) => (a.id === antwortId ? { ...a, ...patch } : a)) });

  return (
    <div className="stack" style={{ gap: 10 }}>
      {steps.map((step, i) => (
        <div className="card" key={step.id}>
          <div className="card-pad" style={{ padding: '12px 14px' }}>
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <span className="step-num" style={{ marginTop: 6 }}>{i + 1}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="form-grid" style={{ gap: 10 }}>
                  <Field label="Bezeichnung" full>
                    <TextInput
                      value={step.name}
                      onChange={(v) => setStep(step.id, { name: v })}
                      placeholder={step.typ === 'entscheidung' ? 'z.B. Prüfung ohne Mängel?' : 'z.B. Planerstellung'}
                    />
                  </Field>
                  <Field label="Art">
                    <select
                      className="select"
                      value={step.typ}
                      onChange={(e) => typWechseln(step, e.target.value as StepType)}
                    >
                      {Object.entries(STEP_TYPE_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Verantwortlicher">
                    <input
                      className="input"
                      value={step.roleName}
                      list="rollen-liste"
                      placeholder="Rolle, z.B. PLM"
                      onChange={(e) => rolleWechseln(step, e.target.value)}
                    />
                  </Field>
                  <Field label="Frist (Tage)">
                    <input
                      className="input"
                      value={step.fristTage}
                      inputMode="numeric"
                      onChange={(e) => setStep(step.id, { fristTage: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                    />
                  </Field>
                  <Field label="Nachweis bei Abschluss" hint="wird beim Erledigen abgefragt">
                    <select
                      className="select"
                      value={step.nachweis}
                      onChange={(e) => setStep(step.id, { nachweis: e.target.value as Nachweis })}
                    >
                      {Object.entries(NACHWEIS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {step.typ !== 'entscheidung' ? (
                    <Field label="Weiter mit">
                      <select
                        className="select"
                        value={step.naechster ?? ''}
                        onChange={(e) =>
                          setStep(step.id, {
                            naechster: e.target.value === '' ? null : (e.target.value as ProcessTemplateStep['naechster']),
                          })
                        }
                      >
                        <option value="">nächstem Schritt</option>
                        {steps
                          .filter((z) => z.id !== step.id)
                          .map((z, zi) => (
                            <option key={z.id} value={z.id}>
                              {zi + 1}. {z.name || 'ohne Namen'}
                            </option>
                          ))}
                        <option value="ende">Planlauf beenden</option>
                      </select>
                    </Field>
                  ) : null}

                  <Field
                    label="E-Mail nach Abschluss"
                    full
                    hint="Fragt nach dem Erledigen, ob die für den nächsten Schritt zuständige Person informiert werden soll."
                  >
                    <div className="row wrap" style={{ gap: 10 }}>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={step.mailFrage}
                          onChange={(e) => setStep(step.id, { mailFrage: e.target.checked })}
                        />
                        Nach einer E-Mail fragen
                      </label>
                      {step.mailFrage ? (
                        <select
                          className="select"
                          style={{ flex: '1 1 220px' }}
                          value={step.mailVorlageId ?? ''}
                          onChange={(e) => setStep(step.id, { mailVorlageId: e.target.value || null })}
                        >
                          <option value="">Vorlage automatisch wählen</option>
                          {mailVorlagen.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </Field>
                </div>

                {step.typ === 'entscheidung' ? (
                  <div style={{ marginTop: 12 }}>
                    <div className="small muted" style={{ marginBottom: 6 }}>
                      Antwortmöglichkeiten – je Antwort legt „weiter mit“ den nächsten Schritt fest.
                    </div>
                    <div className="stack" style={{ gap: 6 }}>
                      {step.antworten.map((a, ai) => (
                        <div className="row wrap" key={a.id} style={{ gap: 6 }}>
                          <input
                            className="input"
                            style={{ flex: '1 1 150px' }}
                            value={a.text}
                            placeholder={STANDARD_ANTWORTEN[ai] ?? `Antwort ${ai + 1}`}
                            onChange={(e) => setAntwort(step, a.id, { text: e.target.value })}
                          />
                          <select
                            className="select"
                            style={{ flex: '1 1 190px' }}
                            value={a.ziel ?? ''}
                            onChange={(e) =>
                              setAntwort(step, a.id, {
                                ziel: e.target.value === '' ? null : (e.target.value as Antwort['ziel']),
                              })
                            }
                          >
                            <option value="">weiter mit: nächstem Schritt</option>
                            {steps
                              .filter((z) => z.id !== step.id)
                              .map((z, zi) => (
                                <option key={z.id} value={z.id}>
                                  weiter mit: {zi + 1}. {z.name || 'ohne Namen'}
                                </option>
                              ))}
                            <option value="ende">Planlauf beenden</option>
                          </select>
                          <button
                            type="button"
                            className="btn-icon"
                            aria-label="Antwort entfernen"
                            disabled={step.antworten.length <= 1}
                            onClick={() =>
                              setStep(step.id, { antworten: step.antworten.filter((x) => x.id !== a.id) })
                            }
                          >
                            <Icon name="loeschen" size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      style={{ marginTop: 8 }}
                      onClick={() =>
                        setStep(step.id, {
                          antworten: [...step.antworten, { id: newId('ant'), text: '', ziel: null }],
                        })
                      }
                    >
                      <Icon name="plus" size={13} /> Antwortmöglichkeit
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="row" style={{ gap: 2 }}>
                <button type="button" className="btn-icon" onClick={() => verschieben(i, -1)} disabled={i === 0} aria-label="Nach oben">
                  <Icon name="hoch" size={14} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => verschieben(i, 1)}
                  disabled={i === steps.length - 1}
                  aria-label="Nach unten"
                >
                  <Icon name="runter" size={14} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setSteps(steps.filter((x) => x.id !== step.id))}
                  aria-label="Schritt entfernen"
                >
                  <Icon name="loeschen" size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <datalist id="rollen-liste">
        {rollen.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <div className="row">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setSteps([...steps, neuerSchritt()])}>
          <Icon name="plus" size={13} /> Aufgabe
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setSteps([...steps, neuerSchritt('entscheidung')])}
        >
          <Icon name="plus" size={13} /> Entscheidung
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setSteps([...steps, neuerSchritt('sonstiges')])}
        >
          <Icon name="plus" size={13} /> Sonstiges
        </button>
      </div>
    </div>
  );
}
