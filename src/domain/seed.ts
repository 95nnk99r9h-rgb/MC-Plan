/**
 * Stammdaten und Demodatenbestand.
 *
 * Funktionen, Gewerke und die drei Workflows (VVBau) entsprechen der
 * vorgegebenen Aufstellung. Die Fristen sind dort nicht hinterlegt und daher
 * als Erfahrungswerte vorbelegt – sie lassen sich je Kette und je Planlauf
 * anpassen.
 */
import { addDays, today } from '../lib/dates';
import { recalcSollDaten } from './engine';
import {
  DATEN_VERSION,
  EIGENE_ROLLE,
  STAMMDATEN_VERSION,
  STANDARD_BEARBEITER,
  type AppData,
  type Antwort,
  type EmailTemplate,
  type ID,
  type Nachweis,
  type ProcessTemplate,
  type ProcessTemplateStep,
  GEWERKE,
  type StandardRolle,
  type StepType,
} from './types';

const heute = today();

/* ------------------------------------------------------------------ */
/* Funktionen                                                      */
/* ------------------------------------------------------------------ */

/** Rolle „Planer“ in den Workflows – je Gewerk besetzt. */
export const ROLLE_PLANER = 'Fachplaner';
export const ROLLE_BVB = 'Bauvorlageberechtiger';
export const ROLLE_PL = 'Projektleitung';
export const ROLLE_PSV = 'Fachtechnischer Prüfer';

/**
 * Vorlage einer Funktion. `jeGewerk` bedeutet: die Funktion wird für jedes
 * Gewerk einzeln geführt und besetzt – „Fachplaner OLA“ ist damit eine andere
 * Funktion als „Fachplaner KIB“. Sonst gilt die Funktion übergreifend.
 */
interface RollenVorlage {
  id: string;
  name: string;
  kuerzel: string;
  farbe: string;
  beschreibung: string;
  jeGewerk: boolean;
}

const ROLLEN_VORLAGEN: RollenVorlage[] = [
  { id: 'srol-plm', name: EIGENE_ROLLE, kuerzel: 'PLM', farbe: '#24456e', beschreibung: 'Eigene Bearbeitung', jeGewerk: false },
  { id: 'srol-pl', name: ROLLE_PL, kuerzel: 'PL', farbe: '#5856d6', beschreibung: '', jeGewerk: false },
  { id: 'srol-fp', name: ROLLE_PLANER, kuerzel: 'FP', farbe: '#ff9500', beschreibung: 'Fachplanung des Gewerks', jeGewerk: true },
  { id: 'srol-fs', name: 'Fachspezialist', kuerzel: 'FS', farbe: '#c77700', beschreibung: '', jeGewerk: true },
  { id: 'srol-bvb', name: ROLLE_BVB, kuerzel: 'BVB', farbe: '#ff3b30', beschreibung: 'Freigabeberechtigt', jeGewerk: true },
  { id: 'srol-an', name: 'Bau AN', kuerzel: 'AN', farbe: '#af52de', beschreibung: '', jeGewerk: true },
  { id: 'srol-buew', name: 'Bauüberwachung', kuerzel: 'BÜW', farbe: '#00a0a0', beschreibung: '', jeGewerk: true },
  { id: 'srol-psv', name: ROLLE_PSV, kuerzel: 'PSV', farbe: '#34c759', beschreibung: 'Planprüfer des Gewerks', jeGewerk: true },
  { id: 'srol-prst', name: 'Prüfstatiker', kuerzel: 'PrSt', farbe: '#248a3d', beschreibung: '', jeGewerk: true },
  { id: 'srol-vep', name: 'Vermessungsprüfer', kuerzel: 'VeP', farbe: '#2a9d8f', beschreibung: '', jeGewerk: true },
  { id: 'srol-erp', name: 'Erdungsprüfer', kuerzel: 'ErP', farbe: '#457b9d', beschreibung: '', jeGewerk: true },
  { id: 'srol-stp', name: 'Schweißtechnischer Prüfer', kuerzel: 'StP', farbe: '#6d597a', beschreibung: '', jeGewerk: true },
  { id: 'srol-kop', name: 'Korrosionsschutzprüfer', kuerzel: 'KoP', farbe: '#b56576', beschreibung: '', jeGewerk: true },
  { id: 'srol-ggp', name: 'Gleisgeometrie Prüfer', kuerzel: 'GgP', farbe: '#e07a5f', beschreibung: '', jeGewerk: true },
  { id: 'srol-gtp', name: 'Geotechnischer Prüfer', kuerzel: 'GtP', farbe: '#8a5a44', beschreibung: '', jeGewerk: true },
];

/** Funktionen je Gewerk: aus jeder Vorlage entsteht eine Funktion pro Gewerk. */
export const STANDARD_ROLLEN: StandardRolle[] = ROLLEN_VORLAGEN.flatMap((v) => {
  const { jeGewerk, id, ...rest } = v;
  return jeGewerk
    ? GEWERKE.map((g) => ({ ...rest, id: `${id}-${g.toLowerCase()}`, gewerk: g as string | null }))
    : [{ ...rest, id, gewerk: null }];
});

/* ------------------------------------------------------------------ */
/* Workflows (VVBau)                                               */
/* ------------------------------------------------------------------ */

interface RohSchritt {
  /** Code laut Aufstellung, dient als Sprungziel. */
  code: string;
  name: string;
  typ: StepType;
  rolle: string;
  frist: number;
  nachweis?: Nachweis;
  /** Nachfolger bei Aufgaben; fehlt er, folgt der nächste Schritt der Liste. */
  next?: string | 'ende';
  /** Sprungziele der beiden Antworten einer Entscheidung. */
  ja?: string | 'ende';
  nein?: string | 'ende';
}

/** Baut aus der Aufstellung eine Workflow mit eindeutigen IDs. */
function kette(id: string, name: string, beschreibung: string, roh: RohSchritt[]): ProcessTemplate {
  const sid = (code: string | undefined): ID | 'ende' | null => {
    if (code === undefined) return null;
    if (code === 'ende') return 'ende';
    return `${id}-${code}`;
  };

  const steps: ProcessTemplateStep[] = roh.map((r) => {
    const antworten: Antwort[] =
      r.typ === 'entscheidung'
        ? [
            { id: `${id}-${r.code}-ja`, text: 'Ja', ziel: sid(r.ja) },
            { id: `${id}-${r.code}-nein`, text: 'Nein', ziel: sid(r.nein) },
          ]
        : [];
    return {
      id: `${id}-${r.code}`,
      name: r.name,
      typ: r.typ,
      roleName: r.rolle,
      fristTage: r.frist,
      beschreibung: '',
      antworten,
      naechster: r.typ === 'entscheidung' ? null : sid(r.next),
      nachweis: r.nachweis ?? 'keine',
      // Nachfrage nach einer E-Mail wird je Schritt im Workflow gesetzt
      mailFrage: false,
      mailVorlageId: null,
    };
  });

  return { id, projectId: null, name, beschreibung, herkunft: 'standard', steps };
}

/** Fristen als Erfahrungswerte – in der Aufstellung nicht vorgegeben. */
const F = {
  planerstellung: 10,
  formalePruefung: 3,
  weiterleitung: 1,
  bvbFreigabe: 10,
  fachpruefung: 15,
  genehmigung: 5,
  versand: 1,
  plotEinreichen: 1,
  plotAbholen: 3,
};

export const STANDARD_TEMPLATES: ProcessTemplate[] = [
  kette('tpl-vvbau-ohne', 'VVBau ohne Prüfstatik', 'Regelablauf ohne fachtechnische Prüfung.', [
    { code: '1', name: 'Eingang PLM', typ: 'aufgabe', rolle: ROLLE_PLANER, frist: F.planerstellung },
    { code: '2', name: 'Formale Prüfung', typ: 'entscheidung', rolle: EIGENE_ROLLE, frist: F.formalePruefung, ja: '3.1', nein: '3.2' },
    { code: '3.1', name: 'PLM an BVB zur Freigabe', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung, next: '4.1' },
    { code: '3.2', name: 'Rückmeldung an Planer', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung },
    { code: '4.1', name: 'BVB-Freigabe', typ: 'entscheidung', rolle: ROLLE_BVB, frist: F.bvbFreigabe, nachweis: 'freigabe', ja: '5', nein: '3.2' },
    { code: '4.2', name: 'Erneute Vorlage von Planer', typ: 'aufgabe', rolle: ROLLE_PLANER, frist: F.planerstellung, next: '2' },
    { code: '5', name: 'PLM an PL zur Genehmigung', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung },
    { code: '6', name: 'Genehmigung zur Bauausführung', typ: 'aufgabe', rolle: ROLLE_PL, frist: F.genehmigung },
    { code: '7', name: 'Digitaler Versand an Bau AN', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '8', name: 'Digitaler Versand an BVB', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '9', name: 'Digitaler Versand an BÜW', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '10', name: 'Plotauftrag einreichen', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.plotEinreichen },
    { code: '11', name: 'Plotauftrag abholen', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.plotAbholen },
    { code: '12', name: 'Postversand an Bau AN', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '13', name: 'Postversand an BÜW', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand, next: 'ende' },
  ]),

  kette('tpl-vvbau-mit', 'VVBau mit Prüfstatik', 'Ablauf mit fachtechnischer Prüfung vor der Freigabe.', [
    { code: '1', name: 'Eingang PLM', typ: 'aufgabe', rolle: ROLLE_PLANER, frist: F.planerstellung },
    { code: '2', name: 'Formale Prüfung', typ: 'entscheidung', rolle: EIGENE_ROLLE, frist: F.formalePruefung, ja: '3.1', nein: '3.2' },
    { code: '3.1', name: 'PLM an BVB zur Freigabe zur fachtechnischen Prüfung', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung, next: '4.1' },
    { code: '3.2', name: 'Rückmeldung an Planer', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung },
    { code: '4.1', name: 'BVB-Freigabe zur fachtechnischen Prüfung', typ: 'entscheidung', rolle: ROLLE_BVB, frist: F.bvbFreigabe, ja: '5', nein: '3.2' },
    { code: '4.2', name: 'Erneute Vorlage von Planer', typ: 'aufgabe', rolle: ROLLE_PLANER, frist: F.planerstellung, next: '2' },
    { code: '5', name: 'PLM an Fachprüfer', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung },
    { code: '6', name: 'Fachprüfung', typ: 'entscheidung', rolle: ROLLE_PSV, frist: F.fachpruefung, nachweis: 'pruefbericht', ja: '7', nein: '3.2' },
    { code: '7', name: 'PLM an BVB zur Freigabe', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung },
    { code: '8', name: 'BVB-Freigabe', typ: 'entscheidung', rolle: ROLLE_BVB, frist: F.bvbFreigabe, nachweis: 'freigabe', ja: '9', nein: '3.2' },
    { code: '9', name: 'PLM an PL zur Genehmigung', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung },
    { code: '10', name: 'Genehmigung zur Bauausführung', typ: 'aufgabe', rolle: ROLLE_PL, frist: F.genehmigung },
    { code: '11', name: 'Digitaler Versand an Bau AN', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '12', name: 'Digitaler Versand an BVB', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '13', name: 'Digitaler Versand an BÜW', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '14', name: 'Plotauftrag einreichen', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.plotEinreichen },
    { code: '15', name: 'Plotauftrag abholen', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.plotAbholen },
    { code: '16', name: 'Postversand an Bau AN', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '17', name: 'Postversand an BÜW', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand, next: 'ende' },
  ]),

  kette('tpl-vvbau-ste', 'VVBau STE', 'Ablauf mit Planprüfung durch den fachtechnischen Prüfer.', [
    { code: '1', name: 'Eingang PLM', typ: 'aufgabe', rolle: ROLLE_PLANER, frist: F.planerstellung },
    { code: '2', name: 'Formale Prüfung', typ: 'entscheidung', rolle: EIGENE_ROLLE, frist: F.formalePruefung, ja: '3.1', nein: '3.2' },
    { code: '3.1', name: 'PLM an Planprüfer', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung, next: '4.1' },
    { code: '3.2', name: 'Rückmeldung an Planer', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung },
    { code: '4.1', name: 'Fachprüfung', typ: 'entscheidung', rolle: ROLLE_PSV, frist: F.fachpruefung, nachweis: 'pruefbericht', ja: '5', nein: '3.2' },
    { code: '4.2', name: 'Erneute Vorlage von Planer', typ: 'aufgabe', rolle: ROLLE_PLANER, frist: F.planerstellung, next: '2' },
    { code: '5', name: 'PLM an BVB zur Freigabe', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung },
    { code: '6', name: 'BVB-Freigabe', typ: 'entscheidung', rolle: ROLLE_BVB, frist: F.bvbFreigabe, nachweis: 'freigabe', ja: '7', nein: '3.2' },
    { code: '7', name: 'PLM an PL zur Genehmigung', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.weiterleitung },
    { code: '8', name: 'Genehmigung zur Bauausführung', typ: 'aufgabe', rolle: ROLLE_PL, frist: F.genehmigung },
    { code: '9', name: 'Digitaler Versand an Bau AN', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '10', name: 'Digitaler Versand an BVB', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '11', name: 'Digitaler Versand an BÜW', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '12', name: 'Plotauftrag einreichen', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.plotEinreichen },
    { code: '13', name: 'Plotauftrag abholen', typ: 'aufgabe', rolle: EIGENE_ROLLE, frist: F.plotAbholen },
    { code: '14', name: 'Postversand an Bau AN', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand },
    { code: '15', name: 'Postversand an BÜW', typ: 'sonstiges', rolle: EIGENE_ROLLE, frist: F.versand, next: 'ende' },
  ]),
];

/* ------------------------------------------------------------------ */
/* E-Mail-Vorlagen                                                     */
/* ------------------------------------------------------------------ */

export function standardVorlagen(): EmailTemplate[] {
  return [
    {
      id: 'mail-erinnerung',
      name: 'Freundliche Erinnerung',
      anlass: 'erinnerung',
      betreff: '[{{projekt.nummer}}] Erinnerung: {{schritt}} – {{plan.nummer}} (fällig {{soll}})',
      text: `{{anrede}}

im Projekt „{{projekt}}“ ({{projekt.nummer}}) steht der Prozessschritt „{{schritt}}“ für den Planlauf „{{planlauf}}“ aus.

  Plan:        {{plan.nummer}} – {{plan}}
  Gewerk:      {{plan.gewerk}}
  Ihre Rolle:  {{rolle}}
  Soll-Termin: {{soll}} ({{frist}})

Bitte geben Sie uns bis zum genannten Termin eine kurze Rückmeldung, damit der weitere Planlauf eingehalten werden kann.

Vielen Dank und freundliche Grüße
{{absender}}`,
    },
    {
      id: 'mail-ueberfaellig',
      name: 'Mahnung bei Fristüberschreitung',
      anlass: 'ueberfaellig',
      betreff: '[{{projekt.nummer}}] Überfällig seit {{verzug}} Tagen: {{schritt}} – {{plan.nummer}}',
      text: `{{anrede}}

der Prozessschritt „{{schritt}}“ im Projekt „{{projekt}}“ ({{projekt.nummer}}) ist seit {{verzug}} Tagen überfällig.

  Plan:        {{plan.nummer}} – {{plan}}
  Gewerk:      {{plan.gewerk}}
  Ihre Rolle:  {{rolle}}
  Soll-Termin: {{soll}}

Da der weitere Planlauf hiervon abhängt, bitten wir um Erledigung bis spätestens Ende dieser Woche oder um eine kurze Information, bis wann mit der Rückmeldung zu rechnen ist.

Mit freundlichen Grüßen
{{absender}}`,
    },
    {
      id: 'mail-freigabe',
      name: 'Freigabe erteilt',
      anlass: 'freigabe',
      betreff: '[{{projekt.nummer}}] Freigabe: {{plan.nummer}} – {{plan}}',
      text: `{{anrede}}

der Plan {{plan.nummer}} – {{plan}} wurde am {{heute}} freigegeben und kann der Bauausführung zugrunde gelegt werden.

Mit freundlichen Grüßen
{{absender}}`,
    },
    {
      id: 'mail-uebergabe',
      name: 'Versand / Übergabe',
      anlass: 'uebergabe',
      betreff: '[{{projekt.nummer}}] Planversand: {{plan.nummer}} – {{plan}}',
      text: `{{anrede}}

anbei erhalten Sie den Plan {{plan.nummer}} – {{plan}} aus dem Planlauf „{{planlauf}}“ zur weiteren Bearbeitung.

Wir bitten um Rückmeldung bis zum {{soll}}.

Mit freundlichen Grüßen
{{absender}}`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Demodaten                                                           */
/* ------------------------------------------------------------------ */

/** Legt die Funktionen als Projektfunktionen an. */
function projektRollen(projectId: string) {
  return STANDARD_ROLLEN.map((r) => ({
    id: `rol-${projectId}-${r.id.replace('srol-', '')}`,
    projectId,
    name: r.name,
    kuerzel: r.kuerzel,
    farbe: r.farbe,
    beschreibung: r.beschreibung,
    gewerk: r.gewerk,
  }));
}

export function seedData(): AppData {
  const rollen = projektRollen('prj-1');
  /** Funktion eines Gewerks (bzw. die übergreifende Funktion) im Projekt. */
  const rolle = (kuerzel: string, gewerk: string | null = null) =>
    rollen.find((r) => r.kuerzel === kuerzel && r.gewerk === gewerk)!.id;

  const data: AppData = {
    version: DATEN_VERSION,
    stammdatenVersion: STAMMDATEN_VERSION,
    bearbeiter: { name: STANDARD_BEARBEITER, mailNachfrage: true, farbmodus: 'standard' },
    gewerke: [...GEWERKE],
    standardRollen: STANDARD_ROLLEN.map((r) => ({ ...r })),
    emailVorlagen: standardVorlagen(),
    projects: [
      {
        id: 'prj-1',
        nummer: '2026-014',
        name: 'Ausbaustrecke Nordkreuz',
        status: 'aktiv',
        markiert: true,
        beschreibung: 'Streckenausbau mit Anpassung von Oberleitung, LST und Verkehrsanlagen.',
        settings: {
          erinnerungVorlaufTage: 5,
          fristenInArbeitstagen: true,
          feiertage: [],
          absenderName: 'Planlaufmanagement Nordkreuz',
          absenderEmail: 'planlauf@example.de',
        },
      },
    ],
    roles: rollen,
    contacts: [
      // Eigener Eintrag: die angemeldete Person führt das Planlaufmanagement
      { id: 'con-plm', projectId: 'prj-1', anrede: '', vorname: 'Max', nachname: 'Mustermann', firma: EIGENE_ROLLE, email: '', telefon: '', anschrift: '', zuordnungen: [{ roleId: rolle('PLM'), gewerk: null }], notiz: '', eigen: true },
      { id: 'con-pl', projectId: 'prj-1', anrede: 'Frau', vorname: 'Sabine', nachname: 'Ortmann', firma: 'Projektleitung', email: 's.ortmann@example.de', telefon: '+49 40 123456-01', anschrift: 'Hafenstraße 12\n20359 Hamburg', zuordnungen: [{ roleId: rolle('PL'), gewerk: null }], notiz: '' , eigen: false },
      { id: 'con-fp-kib', projectId: 'prj-1', anrede: 'Frau', vorname: 'Katrin', nachname: 'Berger', firma: 'Ingenieurbüro Berger', email: 'k.berger@example.de', telefon: '+49 40 998877-12', anschrift: 'Billstraße 88\n20539 Hamburg', zuordnungen: [{ roleId: rolle('FP', 'KIB'), gewerk: 'KIB' }], notiz: 'Fachplanung Ingenieurbau' , eigen: false },
      { id: 'con-fp-lst', projectId: 'prj-1', anrede: 'Herr', vorname: 'Ali', nachname: 'Sarikaya', firma: 'LST Nord Ingenieure', email: 'sarikaya@example.de', telefon: '+49 40 998877-30', anschrift: 'Billstraße 90\n20539 Hamburg', zuordnungen: [{ roleId: rolle('FP', 'LST'), gewerk: 'LST' }], notiz: 'Fachplanung Leit- und Sicherungstechnik' , eigen: false },
      { id: 'con-fp-ola', projectId: 'prj-1', anrede: 'Herr', vorname: 'Piet', nachname: 'Osterkamp', firma: 'Osterkamp Fahrleitungsbau', email: 'p.osterkamp@example.de', telefon: '+49 4101 7788-0', anschrift: 'Industriering 9\n25436 Tornesch', zuordnungen: [{ roleId: rolle('FP', 'OLA'), gewerk: 'OLA' }], notiz: 'Fachplanung Oberleitung' , eigen: false },
      { id: 'con-bvb-kib', projectId: 'prj-1', anrede: 'Herr', vorname: 'Robert', nachname: 'Lindqvist', firma: 'Bauvorlageberechtigung Nord', email: 'r.lindqvist@example.de', telefon: '+49 40 224466-0', anschrift: 'Nordpark 1\n22415 Hamburg', zuordnungen: [{ roleId: rolle('BVB', 'KIB'), gewerk: 'KIB' }], notiz: 'Freigaben nur donnerstags' , eigen: false },
      { id: 'con-bvb-lst', projectId: 'prj-1', anrede: 'Frau', vorname: 'Marlene', nachname: 'Hoffstedt', firma: 'Bauvorlageberechtigung Nord', email: 'm.hoffstedt@example.de', telefon: '+49 40 224466-4', anschrift: 'Nordpark 1\n22415 Hamburg', zuordnungen: [{ roleId: rolle('BVB', 'LST'), gewerk: 'LST' }, { roleId: rolle('BVB', 'OLA'), gewerk: 'OLA' }], notiz: '' , eigen: false },
      { id: 'con-psv-lst', projectId: 'prj-1', anrede: 'Herr', vorname: 'Dietmar', nachname: 'Krause', firma: 'Prüfstelle Krause', email: 'd.krause@example.de', telefon: '+49 4131 309-0', anschrift: 'Am Ochsenmarkt 1\n21335 Lüneburg', zuordnungen: [{ roleId: rolle('PSV', 'LST'), gewerk: 'LST' }], notiz: 'Fachtechnische Prüfung LST' , eigen: false },
      { id: 'con-psv-kib', projectId: 'prj-1', anrede: 'Frau', vorname: 'Yuki', nachname: 'Tanaka', firma: 'Prüfstelle Tanaka', email: 'y.tanaka@example.de', telefon: '+49 40 556677-1', anschrift: 'Alsterdorfer Damm 4\n22297 Hamburg', zuordnungen: [{ roleId: rolle('PSV', 'KIB'), gewerk: 'KIB' }, { roleId: rolle('PrSt', 'KIB'), gewerk: 'KIB' }], notiz: 'Fachtechnische Prüfung und Prüfstatik KIB' , eigen: false },
      { id: 'con-erp', projectId: 'prj-1', anrede: 'Herr', vorname: 'Tobias', nachname: 'Reinhold', firma: 'Prüfstelle Erdung', email: 't.reinhold@example.de', telefon: '+49 40 445566-8', anschrift: 'Wandsbeker Chaussee 3\n22089 Hamburg', zuordnungen: [{ roleId: rolle('ErP', 'OLA'), gewerk: 'OLA' }], notiz: 'Erdungsprüfung' , eigen: false },
      { id: 'con-an', projectId: 'prj-1', anrede: 'Herr', vorname: 'Sven', nachname: 'Dallmann', firma: 'Dallmann Bau GmbH', email: 's.dallmann@example.de', telefon: '+49 4101 5566-0', anschrift: 'Gewerbepark 4\n25469 Halstenbek', zuordnungen: ['KIB', 'LST', 'OLA', 'VA'].map((g) => ({ roleId: rolle('AN', g), gewerk: g })), notiz: '' , eigen: false },
      { id: 'con-buew', projectId: 'prj-1', anrede: 'Frau', vorname: 'Heike', nachname: 'Petersen', firma: 'Bauüberwachung Nord', email: 'h.petersen@example.de', telefon: '+49 40 334455-2', anschrift: 'Nordpark 1\n22415 Hamburg', zuordnungen: ['KIB', 'LST', 'OLA', 'VA'].map((g) => ({ roleId: rolle('BÜW', g), gewerk: g })), notiz: '' , eigen: false },
    ],
    documents: [
      // Planpaket – reines Ordnungsmerkmal, ohne eigenen Planlauf
      { id: 'doc-p1', projectId: 'prj-1', kind: 'paket', parentId: null, paketId: null, nummer: 'PP-Nordkanal', titel: 'Eisenbahnüberführung Nordkanal', index: '', gewerk: 'KIB', planungsphase: 'Ausführungsplanung', eingangSoll: null, datum: null, bemerkung: 'Bündelt die Unterlagen zum Bauwerk' },
      // Planverzeichnis mit eigenem Planlauf; die Pläne laufen darin mit
      { id: 'doc-1', projectId: 'prj-1', kind: 'verzeichnis', parentId: null, paketId: 'doc-p1', nummer: 'NK-KIB-PV-001', titel: 'Planverzeichnis Überbau', index: 'C', gewerk: 'KIB', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, -40), datum: addDays(heute, -45), bemerkung: '' },
      { id: 'doc-1a', projectId: 'prj-1', kind: 'plan', parentId: 'doc-1', paketId: 'doc-p1', nummer: 'NK-KIB-EÜ-001-GR', titel: 'Grundriss Überbau', index: 'C', gewerk: 'KIB', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, -40), datum: null, bemerkung: '' },
      { id: 'doc-1b', projectId: 'prj-1', kind: 'plan', parentId: 'doc-1', paketId: 'doc-p1', nummer: 'NK-KIB-EÜ-001-SC', titel: 'Längsschnitt', index: 'C', gewerk: 'KIB', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, -40), datum: null, bemerkung: '' },
      // Einzelpläne mit eigenem Planlauf
      { id: 'doc-2', projectId: 'prj-1', kind: 'plan', parentId: null, paketId: 'doc-p1', nummer: 'NK-LST-SP-102', titel: 'Signallageplan Bereich Nord', index: 'B', gewerk: 'LST', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, -12), datum: null, bemerkung: '' },
      { id: 'doc-3', projectId: 'prj-1', kind: 'plan', parentId: null, paketId: null, nummer: 'NK-OLA-FL-210', titel: 'Fahrleitungsplan km 12,4 – 13,8', index: '', gewerk: 'OLA', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, 14), datum: null, bemerkung: '' },
      { id: 'doc-4', projectId: 'prj-1', kind: 'verzeichnis', parentId: null, paketId: null, nummer: 'NK-VA-PV-001', titel: 'Planverzeichnis Verkehrsanlagen', index: '02', gewerk: 'VA', planungsphase: 'Entwurfsplanung', eingangSoll: addDays(heute, 30), datum: null, bemerkung: 'noch kein Planlauf gestartet' },
    ],
    templates: STANDARD_TEMPLATES,
    runs: [],
  };

  /* Planläufe aus den Ketten erzeugen – je Gewerk mit eigenen Verantwortlichen */
  const kontaktFuer = (roleKuerzel: string, gewerk: string): ID | null => {
    // Funktion des Gewerks, sonst die übergreifende Funktion
    const roleId =
      rollen.find((r) => r.kuerzel === roleKuerzel && r.gewerk === gewerk)?.id ??
      rollen.find((r) => r.kuerzel === roleKuerzel && r.gewerk === null)?.id;
    const treffer = data.contacts.find((c) => c.zuordnungen.some((z) => z.roleId === roleId));
    return treffer?.id ?? null;
  };

  const laufAus = (
    template: ProcessTemplate,
    runId: string,
    documentId: string,
    gewerk: string,
    start: string,
    erledigtBis: number,
  ) => {
    const kuerzelFuerRolle: Record<string, string> = {
      [EIGENE_ROLLE]: 'PLM',
      [ROLLE_PL]: 'PL',
      [ROLLE_PLANER]: 'FP',
      [ROLLE_BVB]: 'BVB',
      [ROLLE_PSV]: 'PSV',
    };
    const steps = template.steps.map((s, i) => ({
      id: `${runId}-s${i + 1}`,
      name: s.name,
      typ: s.typ,
      roleName: s.roleName,
      contactId: kontaktFuer(kuerzelFuerRolle[s.roleName] ?? 'PLM', gewerk),
      contactManuell: false,
      fristTage: s.fristTage,
      sollDatum: null,
      sollManuell: false,
      istDatum: i < erledigtBis ? addDays(start, (i + 1) * 2) : null,
      status: (i < erledigtBis ? 'erledigt' : i === erledigtBis ? 'laufend' : 'offen') as
        | 'erledigt'
        | 'laufend'
        | 'offen',
      abweichung: false,
      bemerkung: '',
      letzteErinnerung: null,
      antworten: s.antworten.map((a) => ({
        id: `${runId}-${a.id}`,
        text: a.text,
        ziel:
          a.ziel === 'ende' || a.ziel === null
            ? a.ziel
            : `${runId}-s${template.steps.findIndex((x) => x.id === a.ziel) + 1}`,
      })),
      naechster:
        s.naechster === 'ende' || s.naechster === null
          ? s.naechster
          : `${runId}-s${template.steps.findIndex((x) => x.id === s.naechster) + 1}`,
      gewaehlteAntwortId: null,
      durchlauf: 1,
      nachweis: s.nachweis,
      nachweisNummer: null,
      mailFrage: s.mailFrage,
      mailVorlageId: s.mailVorlageId,
    }));

    return {
      id: runId,
      projectId: 'prj-1',
      documentId,
      templateId: template.id,
      templateName: template.name,
      name: `Planlauf ${data.documents.find((d) => d.id === documentId)?.nummer ?? ''}`,
      index: data.documents.find((d) => d.id === documentId)?.index ?? '',
      start,
      status: 'laufend' as const,
      abbruchGrund: null,
      abbruchDatum: null,
      abbruchArt: null,
      abbruchNeuerIndex: null,
      steps,
      bemerkung: '',
    };
  };

  data.runs = [
    laufAus(STANDARD_TEMPLATES[1], 'run-1', 'doc-1', 'KIB', addDays(heute, -45), 5),
    laufAus(STANDARD_TEMPLATES[2], 'run-2', 'doc-2', 'LST', addDays(heute, -18), 3),
    laufAus(STANDARD_TEMPLATES[0], 'run-3', 'doc-3', 'OLA', addDays(heute, -4), 1),
  ];

  data.runs = data.runs.map((run) => {
    const project = data.projects.find((p) => p.id === run.projectId)!;
    return {
      ...run,
      steps: recalcSollDaten(run.steps, run.start, project.settings.fristenInArbeitstagen, project.settings.feiertage),
    };
  });

  return data;
}
