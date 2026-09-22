/**
 * Aufbereitung vorgefertigter E-Mails aus den Projektvorlagen.
 * Platzhalter werden im Format {{schluessel}} ersetzt.
 */
import { formatDate, relativeLabel, today } from '../lib/dates';
import type { AppData, Contact, EmailTemplate, PlanRun, Project, RunStep } from './types';

export interface Platzhalter {
  schluessel: string;
  beschreibung: string;
}

export const PLATZHALTER: Platzhalter[] = [
  { schluessel: 'anrede', beschreibung: 'Anrede-Zeile, z.B. „Sehr geehrte Frau Berger,“' },
  { schluessel: 'empfaenger', beschreibung: 'Vor- und Nachname des Empfängers' },
  { schluessel: 'empfaenger.firma', beschreibung: 'Firma des Empfängers' },
  { schluessel: 'empfaenger.anschrift', beschreibung: 'Anschrift des Empfängers (einzeilig)' },
  { schluessel: 'rolle', beschreibung: 'Funktion im Prozessschritt' },
  { schluessel: 'projekt', beschreibung: 'Projektname' },
  { schluessel: 'projekt.nummer', beschreibung: 'Projektnummer' },
  { schluessel: 'plan', beschreibung: 'Titel von Plan / Paket / Verzeichnis' },
  { schluessel: 'plan.nummer', beschreibung: 'Plannummer' },
  { schluessel: 'plan.index', beschreibung: 'Planindex' },
  { schluessel: 'plan.gewerk', beschreibung: 'Gewerk des Plans' },
  { schluessel: 'plan.phase', beschreibung: 'Planungsphase' },
  { schluessel: 'planlauf', beschreibung: 'Bezeichnung des Planlaufs' },
  { schluessel: 'schritt', beschreibung: 'Name des Prozessschritts' },
  { schluessel: 'soll', beschreibung: 'Soll-Termin, z.B. 14.03.2026' },
  { schluessel: 'frist', beschreibung: 'Relative Frist, z.B. „in 3 Tagen“' },
  { schluessel: 'verzug', beschreibung: 'Anzahl Tage Verzug (0 falls im Plan)' },
  { schluessel: 'heute', beschreibung: 'Heutiges Datum' },
  { schluessel: 'absender', beschreibung: 'Absendername aus den Projekteinstellungen' },
];

export interface MailKontext {
  project: Project;
  run: PlanRun;
  step: RunStep;
  contact: Contact | null;
  data: AppData;
}

export function werteFuerKontext(ctx: MailKontext): Record<string, string> {
  const { project, run, step, contact, data } = ctx;
  const doc = data.documents.find((d) => d.id === run.documentId);
  const verzug = step.sollDatum
    ? Math.max(0, -Math.round((new Date(step.sollDatum).getTime() - new Date(today()).getTime()) / 86_400_000))
    : 0;
  return {
    anrede: anredeZeile(contact),
    empfaenger: contact ? `${contact.vorname} ${contact.nachname}`.trim() : '',
    'empfaenger.firma': contact?.firma ?? '',
    'empfaenger.anschrift': (contact?.anschrift ?? '').replace(/\s*\n\s*/g, ', '),
    rolle: step.roleName,
    projekt: project.name,
    'projekt.nummer': project.nummer,
    plan: doc?.titel ?? '',
    'plan.nummer': doc?.nummer ?? '',
    'plan.index': doc?.index ?? '',
    'plan.gewerk': doc?.gewerk ?? '',
    'plan.phase': doc?.planungsphase ?? '',
    planlauf: run.name,
    schritt: step.name,
    soll: formatDate(step.sollDatum),
    frist: relativeLabel(step.sollDatum),
    verzug: String(verzug),
    heute: formatDate(today()),
    absender: project.settings.absenderName,
  };
}

/** Bildet die Anredezeile aus der bei der Person hinterlegten Anrede. */
function anredeZeile(contact: Contact | null): string {
  if (!contact) return 'Guten Tag,';
  const anrede = contact.anrede.trim().toLowerCase();
  const name = contact.nachname.trim();
  if (!name) return 'Guten Tag,';
  if (anrede.startsWith('herr')) return `Sehr geehrter Herr ${name},`;
  if (anrede.startsWith('frau')) return `Sehr geehrte Frau ${name},`;
  return `Guten Tag ${contact.vorname} ${name},`.replace(/\s+/g, ' ');
}

export function fuelleVorlage(text: string, werte: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => werte[key] ?? `{{${key}}}`);
}

export interface VorbereiteteMail {
  an: string;
  betreff: string;
  text: string;
  /** Öffnet das lokal eingerichtete Outlook (bzw. das Standard-Mailprogramm). */
  mailto: string;
  /** Öffnet ein neues Fenster in Outlook im Web. */
  outlookWeb: string;
}

export function mailVorbereiten(template: EmailTemplate, ctx: MailKontext): VorbereiteteMail {
  const werte = werteFuerKontext(ctx);
  const betreff = fuelleVorlage(template.betreff, werte);
  const text = fuelleVorlage(template.text, werte);
  const an = ctx.contact?.email ?? '';
  return { an, betreff, text, ...mailLinks(an, betreff, text) };
}

/** Baut die Verknüpfungen für Outlook (lokal) und Outlook im Web. */
export function mailLinks(an: string, betreff: string, text: string) {
  return {
    mailto: `mailto:${encodeURIComponent(an)}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`,
    outlookWeb:
      'https://outlook.office.com/mail/deeplink/compose?' +
      `to=${encodeURIComponent(an)}&subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`,
  };
}

/** Wählt die zum Ampelstatus passende Vorlage vor. */
export function vorlageVorschlagen(
  templates: EmailTemplate[],
  ueberfaellig: boolean,
): EmailTemplate | undefined {
  const anlass = ueberfaellig ? 'ueberfaellig' : 'erinnerung';
  return templates.find((t) => t.anlass === anlass) ?? templates[0];
}
