/**
 * Statuswechsel eines Prozessschritts – unabhängig von der Oberfläche.
 *
 * Die Funktion beschreibt nur, was geschehen soll (Reihenfolge der
 * Änderungen und die Rückmeldung an die Bearbeiterin); geschrieben wird in
 * der Oberfläche über `useSchrittStatus`. So verhalten sich der Planlauf und
 * die Übersichtslisten – Fristen, Dashboard, Pläne – identisch.
 */
import { massgeblicheAntwort, rueckSprungAnwenden, verlaufDerKette } from './engine';
import { today } from '../lib/dates';
import { STEP_STATUS_LABEL, type PlanRun, type RunStep, type StepStatus } from './types';

/** Eine auszuführende Änderung am Lauf bzw. an einem Schritt. */
export type Aenderung =
  | { art: 'run'; patch: Partial<PlanRun> }
  | { art: 'step'; stepId: string; patch: Partial<RunStep> };

export type Abschluss =
  /** Vor dem Erledigen muss erst die Freigabe- bzw. Prüfbericht-Nr. erfasst werden. */
  | { art: 'nachweis'; step: RunStep }
  | {
      art: 'aenderung';
      aenderungen: Aenderung[];
      meldung: string;
      /** Schritt, der nach dieser Änderung ansteht – Grundlage für eine E-Mail. */
      naechster: RunStep | null;
    };

/**
 * Ein Nachweis wird verlangt, wenn der Schritt erfolgreich abgeschlossen
 * wird: bei Entscheidungen nur bei der ersten (zustimmenden) Antwort.
 */
export function braucheNachweis(step: RunStep, status: StepStatus): boolean {
  if (status !== 'erledigt' || step.nachweis === 'keine' || step.nachweisNummer) return false;
  if (step.typ !== 'entscheidung') return true;
  return massgeblicheAntwort(step)?.id === step.antworten[0]?.id;
}

/**
 * Setzt den Status eines Schritts und rückt den Lauf ggf. weiter. Führt die
 * Antwort einer Entscheidung zu einem bereits durchlaufenen Schritt zurück,
 * beginnt dort ein weiterer Durchlauf.
 */
export function schrittStatusSetzen(
  run: PlanRun,
  step: RunStep,
  status: StepStatus,
  nachweisNummer?: string,
): Abschluss {
  if (braucheNachweis(step, status) && nachweisNummer === undefined) {
    return { art: 'nachweis', step };
  }

  const aenderungen: Aenderung[] = [];
  if (nachweisNummer !== undefined) {
    aenderungen.push({ art: 'step', stepId: step.id, patch: { nachweisNummer } });
    step = { ...step, nachweisNummer };
  }

  const verlauf = verlaufDerKette(run.steps).schritte;

  if (step.typ === 'entscheidung' && status === 'erledigt') {
    const antwort = massgeblicheAntwort(step);
    const ziel = antwort?.ziel && antwort.ziel !== 'ende' ? antwort.ziel : null;
    const zielIndex = ziel ? verlauf.findIndex((s) => s.id === ziel) : -1;
    const zielIstFrueher = zielIndex >= 0 && zielIndex < verlauf.findIndex((s) => s.id === step.id);
    if (zielIstFrueher && ziel) {
      const erledigt = run.steps.map((s) =>
        s.id === step.id
          ? {
              ...s,
              status: 'erledigt' as const,
              istDatum: s.istDatum ?? today(),
              nachweisNummer: step.nachweisNummer,
            }
          : s,
      );
      aenderungen.push({ art: 'run', patch: { steps: rueckSprungAnwenden(erledigt, step.id, ziel) } });
      const zielName = run.steps.find((s) => s.id === ziel)?.name ?? '';
      return {
        art: 'aenderung',
        aenderungen,
        meldung: `Rücksprung zu „${zielName}“ – weiterer Durchlauf gestartet.`,
        naechster: run.steps.find((s) => s.id === ziel) ?? null,
      };
    }
  }

  const patch: Partial<RunStep> = { status };
  if ((status === 'erledigt' || status === 'uebersprungen') && !step.istDatum) patch.istDatum = today();
  if (status === 'offen' || status === 'laufend') patch.istDatum = null;
  aenderungen.push({ art: 'step', stepId: step.id, patch });

  if (status === 'erledigt' || status === 'uebersprungen') {
    const aktualisiert = run.steps.map((s) => (s.id === step.id ? { ...s, ...patch } : s));
    const rest = verlaufDerKette(aktualisiert).schritte.filter(
      (s) => s.status !== 'erledigt' && s.status !== 'uebersprungen',
    );
    if (rest.length === 0) {
      aenderungen.push({ art: 'run', patch: { status: 'abgeschlossen' } });
      return {
        art: 'aenderung',
        aenderungen,
        meldung: 'Alle Schritte erledigt – Planlauf abgeschlossen.',
        naechster: null,
      };
    }
    if (rest[0].status === 'offen') {
      aenderungen.push({ art: 'step', stepId: rest[0].id, patch: { status: 'laufend' } });
    }
    return {
      art: 'aenderung',
      aenderungen,
      meldung: `„${step.name}“: ${STEP_STATUS_LABEL[status]}`,
      naechster: rest[0],
    };
  }

  return {
    art: 'aenderung',
    aenderungen,
    meldung: `„${step.name}“: ${STEP_STATUS_LABEL[status]}`,
    naechster: null,
  };
}
