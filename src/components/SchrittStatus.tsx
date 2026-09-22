/**
 * Gemeinsame Schrittaktionen für Planlauf und Übersichtslisten.
 *
 * `useSchrittStatus` kapselt den Statuswechsel samt Erfassung der Freigabe-
 * bzw. Prüfbericht-Nummer. Der zurückgegebene Dialog muss in der jeweiligen
 * Seite gerendert werden; `ErledigtButton` ist der kleine Haken, mit dem sich
 * der anstehende Schritt direkt aus einer Liste heraus erledigen lässt.
 */
import { useState } from 'react';
import { schrittStatusSetzen } from '../domain/abschluss';
import { NACHWEIS_LABEL, type PlanRun, type RunStep, type StepStatus } from '../domain/types';
import { useStore } from '../store/store';
import { useToast } from './toast';
import { ConfirmDialog, Field, Modal, TextInput } from './ui';
import { EmailDialog } from './EmailDialog';
import { Icon } from './icons';

export function useSchrittStatus() {
  const { data, updateRun, updateStep } = useStore();
  const toast = useToast();
  const [nachweisFuer, setNachweisFuer] = useState<{ run: PlanRun; step: RunStep } | null>(null);
  const [frage, setFrage] = useState<{ run: PlanRun; step: RunStep; vorlageId: string | null } | null>(
    null,
  );
  const [mail, setMail] = useState<{ run: PlanRun; step: RunStep; vorlageId: string | null } | null>(
    null,
  );

  const setzeStatus = (run: PlanRun, step: RunStep, status: StepStatus, nachweisNummer?: string) => {
    const ergebnis = schrittStatusSetzen(run, step, status, nachweisNummer);
    if (ergebnis.art === 'nachweis') {
      setNachweisFuer({ run, step: ergebnis.step });
      return;
    }
    ergebnis.aenderungen.forEach((a) =>
      a.art === 'run' ? updateRun(run.id, a.patch) : updateStep(run.id, a.stepId, a.patch),
    );
    toast(ergebnis.meldung);

    // Sieht der Workflow es für diesen Schritt vor, anbieten, die für den
    // nächsten Schritt zuständige Person per E-Mail zu informieren.
    if (
      (data.bearbeiter?.mailNachfrage ?? true) &&
      status === 'erledigt' &&
      step.mailFrage &&
      ergebnis.naechster &&
      ergebnis.naechster.contactId
    ) {
      setFrage({ run, step: ergebnis.naechster, vorlageId: step.mailVorlageId });
    }
  };

  const project = (run: PlanRun) => data.projects.find((p) => p.id === run.projectId);
  const kontakt = (step: RunStep) => data.contacts.find((c) => c.id === step.contactId);

  const nachweisDialog = (
    <>
      {nachweisFuer ? (
        <NachweisDialog
          step={nachweisFuer.step}
          onClose={() => setNachweisFuer(null)}
          onErfassen={(nummer) => setzeStatus(nachweisFuer.run, nachweisFuer.step, 'erledigt', nummer)}
        />
      ) : null}

      {frage ? (
        <ConfirmDialog
          titel="E-Mail schreiben?"
          text={`Der nächste Schritt „${frage.step.name}“ liegt bei ${
            kontakt(frage.step)
              ? `${kontakt(frage.step)!.vorname} ${kontakt(frage.step)!.nachname}`
              : 'der zuständigen Person'
          } (${frage.step.roleName}). Soll dazu eine E-Mail vorbereitet werden?`}
          bestaetigenLabel="E-Mail vorbereiten"
          abbrechenLabel="Nein, danke"
          ton="blau"
          onConfirm={() => setMail(frage)}
          onClose={() => setFrage(null)}
        />
      ) : null}

      {mail && project(mail.run) ? (
        <EmailDialog
          project={project(mail.run)!}
          run={mail.run}
          step={mail.step}
          vorlageId={mail.vorlageId}
          onClose={() => setMail(null)}
        />
      ) : null}
    </>
  );

  return { setzeStatus, nachweisDialog };
}

/** Haken zum direkten Erledigen eines anstehenden Schritts aus einer Liste. */
export function ErledigtButton({
  run,
  step,
  onErledigen,
}: {
  run: PlanRun;
  step: RunStep;
  onErledigen: (run: PlanRun, step: RunStep) => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-haken"
      title={`„${step.name}“ als erledigt vermerken`}
      aria-label="Schritt als erledigt vermerken"
      onClick={(e) => {
        e.stopPropagation();
        onErledigen(run, step);
      }}
    >
      <Icon name="check" size={13} />
    </button>
  );
}

/** Erfasst die Freigabe- bzw. Prüfbericht-Nummer beim Abschluss eines Schritts. */
export function NachweisDialog({
  step,
  onClose,
  onErfassen,
}: {
  step: RunStep;
  onClose: () => void;
  onErfassen: (nummer: string) => void;
}) {
  const toast = useToast();
  const [nummer, setNummer] = useState('');
  const bezeichnung = NACHWEIS_LABEL[step.nachweis];

  const uebernehmen = () => {
    if (!nummer.trim()) {
      toast(`Bitte die ${bezeichnung} angeben.`);
      return;
    }
    onErfassen(nummer.trim());
    onClose();
  };

  return (
    <Modal
      titel={`${bezeichnung} erfassen`}
      sub={`${step.name} – wird am Schritt und im Export dokumentiert`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={uebernehmen}>
            Übernehmen und erledigen
          </button>
        </>
      }
    >
      <Field label={bezeichnung}>
        <TextInput
          value={nummer}
          onChange={setNummer}
          autoFocus
          placeholder={step.nachweis === 'freigabe' ? 'z.B. FG-2026-0147' : 'z.B. PB-2026-0032'}
          onKeyDown={(e) => e.key === 'Enter' && uebernehmen()}
        />
      </Field>
    </Modal>
  );
}
