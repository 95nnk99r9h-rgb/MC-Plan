/**
 * Vorbereitete E-Mail zu einem Prozessschritt: Vorlage wählen, Text prüfen,
 * per E-Mail-Programm öffnen oder in die Zwischenablage kopieren.
 */
import { useMemo, useState } from 'react';
import { EMAIL_ANLASS_LABEL, type PlanRun, type Project, type RunStep } from '../domain/types';
import { mailLinks, mailVorbereiten, vorlageVorschlagen } from '../domain/email';
import { ampelFuerSchritt } from '../domain/engine';
import { useStore } from '../store/store';
import { useToast } from './toast';
import { Callout, Field, Modal, Select, TextArea, TextInput } from './ui';
import { Icon } from './icons';

export function EmailDialog({
  project,
  run,
  step,
  vorlageId,
  onClose,
}: {
  project: Project;
  run: PlanRun;
  step: RunStep;
  /** Im Workflow hinterlegte Vorlage; ohne Angabe wird nach Anlass gewählt. */
  vorlageId?: string | null;
  onClose: () => void;
}) {
  const { data, updateStep } = useStore();
  const toast = useToast();

  const kontakt = data.contacts.find((c) => c.id === step.contactId) ?? null;
  const ueberfaellig = ampelFuerSchritt(step, project.settings.erinnerungVorlaufTage) === 'ueberfaellig';
  const vorlagen = data.emailVorlagen;

  const [templateId, setTemplateId] = useState(() => {
    // Die im Workflow hinterlegte Vorlage hat Vorrang
    const hinterlegt = vorlageId ? vorlagen.find((v) => v.id === vorlageId) : undefined;
    return hinterlegt?.id ?? vorlageVorschlagen(vorlagen, ueberfaellig)?.id ?? vorlagen[0]?.id ?? '';
  });
  const template = vorlagen.find((t) => t.id === templateId) ?? vorlagen[0];

  const vorbereitet = useMemo(
    () => (template ? mailVorbereiten(template, { project, run, step, contact: kontakt, data }) : null),
    [template, project, run, step, kontakt, data],
  );

  const [an, setAn] = useState(vorbereitet?.an ?? '');
  const [betreff, setBetreff] = useState(vorbereitet?.betreff ?? '');
  const [text, setText] = useState(vorbereitet?.text ?? '');
  const [zuletztVorlage, setZuletztVorlage] = useState(templateId);

  // Beim Vorlagenwechsel die Felder neu füllen
  if (zuletztVorlage !== templateId && vorbereitet) {
    setZuletztVorlage(templateId);
    setAn(vorbereitet.an);
    setBetreff(vorbereitet.betreff);
    setText(vorbereitet.text);
  }

  const { mailto, outlookWeb } = mailLinks(an, betreff, text);

  const merkeVersand = () => {
    updateStep(run.id, step.id, { letzteErinnerung: new Date().toISOString() });
  };

  /** Öffnet Outlook auf dem Rechner (Standard-Mailprogramm). */
  const inOutlook = () => {
    window.location.href = mailto;
    merkeVersand();
    toast('Outlook wird mit der vorbereiteten E-Mail geöffnet.');
    onClose();
  };

  /** Öffnet ein neues Fenster in Outlook im Web. */
  const imWeb = () => {
    window.open(outlookWeb, '_blank', 'noopener,noreferrer');
    merkeVersand();
    toast('Outlook im Web wird geöffnet.');
    onClose();
  };

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(`An: ${an}\nBetreff: ${betreff}\n\n${text}`);
      merkeVersand();
      toast('E-Mail in die Zwischenablage kopiert.');
    } catch {
      toast('Kopieren nicht möglich – bitte Text manuell markieren.');
    }
  };

  if (!template) {
    return (
      <Modal titel="Keine E-Mail-Vorlage" onClose={onClose}>
        <Callout ton="warn" icon="!">
          Für dieses Projekt ist noch keine Vorlage hinterlegt. Legen Sie unter{' '}
          <strong>Projekt › Einstellungen › E-Mail-Vorlagen</strong> eine Vorlage an.
        </Callout>
      </Modal>
    );
  }

  return (
    <Modal
      titel="E-Mail für Outlook vorbereiten"
      sub={`${step.name} · ${run.name}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-outline" onClick={kopieren}>
            <Icon name="kopieren" size={14} /> Kopieren
          </button>
          <button type="button" className="btn btn-outline" onClick={imWeb} disabled={!an}>
            Outlook im Web
          </button>
          <button type="button" className="btn btn-primary" onClick={inOutlook} disabled={!an}>
            <Icon name="mail" size={14} /> In Outlook öffnen
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        {!kontakt ? (
          <Callout ton="warn" icon="!">
            Für den Schritt ist keine Person aus „Rollen & Funktionen“ hinterlegt – bitte Empfänger von Hand
            eintragen.
          </Callout>
        ) : null}

        <div className="form-grid">
          <Field label="Vorlage">
            <Select
              value={templateId}
              onChange={setTemplateId}
              options={vorlagen.map((t) => ({
                value: t.id,
                label: `${t.name} · ${EMAIL_ANLASS_LABEL[t.anlass]}`,
              }))}
            />
          </Field>
          <Field label="Empfänger">
            <TextInput value={an} onChange={setAn} type="email" placeholder="name@firma.de" />
          </Field>
          <Field label="Betreff" full>
            <TextInput value={betreff} onChange={setBetreff} />
          </Field>
          <Field label="Nachricht" full>
            <TextArea value={text} onChange={setText} rows={14} />
          </Field>
        </div>

        {step.letzteErinnerung ? (
          <p className="small tertiary">
            Letzte Erinnerung zu diesem Schritt:{' '}
            {new Date(step.letzteErinnerung).toLocaleString('de-DE')}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
