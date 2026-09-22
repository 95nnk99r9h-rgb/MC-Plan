/**
 * Fachliches Datenmodell des Planlauf-Managements.
 *
 * Die Struktur ist bewusst so geschnitten, dass sie später 1:1 auf
 * relationale Tabellen abgebildet werden kann (jede Entität hat eine
 * eigene ID, Referenzen laufen ausschließlich über IDs).
 */

export type ID = string;

/** ISO-Datum ohne Zeitanteil, z.B. "2026-03-14". */
export type ISODate = string;

/** Aktuelle Fassung des Datenbestands – steuert die Migration beim Laden. */
export const DATEN_VERSION = 11;

/**
 * Fassung der mitgelieferten Stammdaten (Funktionen und Standard-Prozess-
 * ketten). Wird sie erhöht, übernimmt ein vorhandener Bestand beim nächsten
 * Laden die neuen Stammdaten – eigene Rollen, Varianten und laufende Planläufe
 * bleiben dabei unangetastet.
 */
export const STAMMDATEN_VERSION = 4;

/* ------------------------------------------------------------------ */
/* Bearbeiter                                                          */
/* ------------------------------------------------------------------ */

/** Farbdarstellung der Oberfläche. */
export type Farbmodus = 'standard' | 'kontrast';

/**
 * Angemeldete Person. Alle Bearbeiter sehen alle Projekte; die angemeldete
 * Person füllt in ihren Projekten stets die Funktion Planlaufmanagement aus –
 * Schritte dieser Funktion gelten daher als eigene To-Dos.
 */
export interface Bearbeiter {
  name: string;
  /**
   * Nach dem Erledigen eines eigenen Schritts fragen, ob die für den
   * nächsten Schritt zuständige Person per E-Mail informiert werden soll.
   */
  mailNachfrage: boolean;
  /**
   * „kontrast“ stellt die Oberfläche mit Farben dar, die auch bei einer
   * Rot-Grün-Sehschwäche unterscheidbar sind, und erhöht die Kontraste.
   */
  farbmodus: Farbmodus;
}

/** Name der angemeldeten Person, solange es keine Anmeldung gibt. */
export const STANDARD_BEARBEITER = 'Max Mustermann';

/** Die eigene Rolle in allen Projekten (Kürzel: PLM). */
export const EIGENE_ROLLE = 'Planlaufmanagement';

/** Erster Schritt der mitgelieferten Workflows: der Plan geht beim PLM ein. */
export const SCHRITT_EINGANG = 'Eingang PLM';

/** Prüft, ob ein Schritt der Eingang beim Planlaufmanagement ist. */
export function istEingangPLM(schrittName: string): boolean {
  return schrittName.trim().toLowerCase() === SCHRITT_EINGANG.toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Projekt                                                             */
/* ------------------------------------------------------------------ */

export type ProjectStatus = 'aktiv' | 'pausiert' | 'abgeschlossen';

export interface Project {
  id: ID;
  nummer: string;
  name: string;
  status: ProjectStatus;
  /** Markierte Projekte erscheinen in der Übersicht und in der Seitenleiste. */
  markiert: boolean;
  beschreibung: string;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  /** Vorlaufzeit in Tagen, ab der eine Frist als "fällig" gemeldet wird. */
  erinnerungVorlaufTage: number;
  /** Fristen in Arbeitstagen (Mo–Fr) statt Kalendertagen rechnen. */
  fristenInArbeitstagen: boolean;
  /** Projektbezogene Feiertage, die bei Arbeitstagen übersprungen werden. */
  feiertage: ISODate[];
  /** Absender, der in der Vorlage als {{absender}} eingesetzt wird. */
  absenderName: string;
  absenderEmail: string;
}

export interface EmailTemplate {
  id: ID;
  name: string;
  /** Anlass, für den die Vorlage vorgeschlagen wird. */
  anlass: EmailAnlass;
  betreff: string;
  text: string;
}

export type EmailAnlass = 'erinnerung' | 'ueberfaellig' | 'freigabe' | 'uebergabe' | 'allgemein';

export const EMAIL_ANLASS_LABEL: Record<EmailAnlass, string> = {
  erinnerung: 'Erinnerung (Frist läuft)',
  ueberfaellig: 'Mahnung (überfällig)',
  freigabe: 'Freigabe erteilt',
  uebergabe: 'Übergabe / Versand',
  allgemein: 'Allgemein',
};

/* ------------------------------------------------------------------ */
/* Rollen & Funktionen                                                 */
/* ------------------------------------------------------------------ */

/**
 * Projektübergreifend gepflegte Rolle. Beim Anlegen eines Projekts werden
 * diese Rollen als Projektfunktionen übernommen.
 */
export interface StandardRolle {
  id: ID;
  name: string;
  kuerzel: string;
  farbe: string;
  beschreibung: string;
  /**
   * Gewerk, zu dem die Funktion gehört. Jedes Gewerk hat eigene Funktionen:
   * „Fachplaner OLA“ und „Fachplaner KIB“ sind zwei verschiedene Funktionen.
   * `null` steht für übergreifende Funktionen, die einmal besetzt werden.
   */
  gewerk: string | null;
}

/** Übergreifende Funktionen gelten für alle Gewerke. */
export const UEBERGREIFEND = 'Übergreifend';

export function istUebergreifend(funktion: { gewerk: string | null }): boolean {
  return funktion.gewerk === null;
}

/**
 * Kürzel aus einer Bezeichnung: Anfangsbuchstaben der Wörter, bei einem
 * einzelnen Wort dessen erste drei Buchstaben.
 */
export function kuerzelAus(name: string): string {
  const woerter = name.trim().split(/\s+/).filter(Boolean);
  if (woerter.length === 0) return '';
  const roh = woerter.length > 1 ? woerter.map((w) => w[0]).join('') : woerter[0].slice(0, 3);
  return roh.slice(0, 4).toUpperCase();
}

/** Vollständige Bezeichnung einer Funktion inklusive Gewerk. */
export function funktionsName(funktion: { name: string; gewerk: string | null }): string {
  return funktion.gewerk ? `${funktion.name} ${funktion.gewerk}` : funktion.name;
}

/** Frei definierbare Projektrolle, z.B. "PLM" oder "Prüfstatiker". */
export interface Role {
  id: ID;
  projectId: ID;
  name: string;
  kuerzel: string;
  farbe: string;
  beschreibung: string;
  /** Gewerk der Funktion; null = übergreifend (siehe StandardRolle). */
  gewerk: string | null;
}

/**
 * Besetzung einer Rolle durch eine Person. Bei Rollen mit Gewerkbezug gilt die
 * Zuordnung für ein bestimmtes Gewerk, sonst (gewerk = null) für alle.
 */
export interface Zuordnung {
  roleId: ID;
  gewerk: string | null;
}

export interface Contact {
  id: ID;
  projectId: ID;
  anrede: string;
  vorname: string;
  nachname: string;
  firma: string;
  email: string;
  telefon: string;
  /** Straße, PLZ und Ort – mehrzeilig. */
  anschrift: string;
  /** Besetzte Rollen, ggf. je Gewerk. */
  zuordnungen: Zuordnung[];
  notiz: string;
  /**
   * Kontakt der angemeldeten Person. Er wird in jedem markierten Projekt
   * automatisch geführt und besetzt dort das Planlaufmanagement.
   */
  eigen: boolean;
}

/* ------------------------------------------------------------------ */
/* Pläne, Planpakete, Planverzeichnisse                                */
/* ------------------------------------------------------------------ */

export type DocumentKind = 'plan' | 'paket' | 'verzeichnis';

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  plan: 'Plan',
  paket: 'Planpaket',
  verzeichnis: 'Planverzeichnis',
};

/** Bezeichnung des Nummernfelds je Art. */
export const NUMMER_LABEL: Record<DocumentKind, string> = {
  plan: 'Plancodierung',
  paket: 'Name Planpaket',
  verzeichnis: 'Name PlanVZ',
};

/** Bezeichnung des Indexfelds je Art. */
export const INDEX_LABEL: Record<DocumentKind, string> = {
  plan: 'Index',
  paket: 'Index',
  verzeichnis: 'Ausgabe',
};

/**
 * Mitgelieferte Gewerke. Der gepflegte Bestand steht in `AppData.gewerke`;
 * dort lassen sich weitere Gewerke ergänzen.
 */
export const GEWERKE = ['EEA', 'KIB', 'LST', 'OLA', 'OSE', 'TK', 'VA'] as const;

/** Planungsphasen zur Auswahl; freie Eingabe bleibt zusätzlich möglich. */
export const PLANUNGSPHASEN = ['Entwurfsplanung', 'Genehmigungsplanung', 'Ausführungsplanung'] as const;

export interface PlanDocument {
  id: ID;
  projectId: ID;
  kind: DocumentKind;
  /**
   * Übergeordnetes Planverzeichnis eines Plans. Pläne eines Verzeichnisses
   * durchlaufen keinen eigenen Planlauf – maßgeblich ist der Lauf des
   * Verzeichnisses. Pläne ohne Verzeichnis sind Einzelpläne mit eigenem Lauf.
   */
  parentId: ID | null;
  /**
   * Planpaket, dem der Eintrag zugeordnet ist. Reines Ordnungsmerkmal ohne
   * Auswirkung auf Planläufe und Fristen.
   */
  paketId: ID | null;
  /** Plancodierung bzw. Name des Pakets / Verzeichnisses. */
  nummer: string;
  titel: string;
  /** Index/Revision – standardmäßig leer. */
  index: string;
  gewerk: string;
  planungsphase: string;
  /** Soll-Termin für den Eingang der Unterlage. */
  eingangSoll: ISODate | null;
  /** Datum der Ausgabe – nur bei Planverzeichnissen geführt. */
  datum: ISODate | null;
  bemerkung: string;
}

/**
 * Einträge mit eigenem Planlauf: Planverzeichnisse und Einzelpläne.
 * Planpakete sind reine Ordnungsmerkmale, Pläne eines Verzeichnisses laufen
 * im Lauf des Verzeichnisses mit.
 */
export function hatEigenenPlanlauf(doc: { kind: DocumentKind; parentId: ID | null }): boolean {
  if (doc.kind === 'paket') return false;
  if (doc.kind === 'verzeichnis') return true;
  return doc.parentId === null;
}

/* ------------------------------------------------------------------ */
/* Workflows                                                       */
/* ------------------------------------------------------------------ */

export type StepType = 'aufgabe' | 'entscheidung' | 'sonstiges';

export const STEP_TYPE_LABEL: Record<StepType, string> = {
  aufgabe: 'Aufgabe',
  entscheidung: 'Entscheidung',
  sonstiges: 'Sonstiges',
};

/**
 * Antwortmöglichkeit einer Entscheidung.
 * `ziel` bestimmt, mit welchem Schritt weitergemacht wird:
 * eine Schritt-ID, `'ende'` für das Ende des Laufs oder `null` für den
 * unmittelbar folgenden Schritt.
 */
export interface Antwort {
  id: ID;
  text: string;
  ziel: ID | 'ende' | null;
}

export const STANDARD_ANTWORTEN = ['Ja', 'Nein'];

/**
 * Nachweis, der bei erfolgreichem Abschluss eines Schritts zu erfassen ist.
 * Die Nummer wird am Schritt dokumentiert und in den Export übernommen.
 */
export type Nachweis = 'keine' | 'freigabe' | 'pruefbericht';

export const NACHWEIS_LABEL: Record<Nachweis, string> = {
  keine: 'kein Nachweis',
  freigabe: 'Freigabe-Nr.',
  pruefbericht: 'Prüfbericht-Nr.',
};

/** Prüfende Rollen verlangen regelmäßig einen Prüfbericht. */
export function istPrueferRolle(roleName: string): boolean {
  return /prüf|pruef/i.test(roleName);
}

export interface ProcessTemplate {
  id: ID;
  /** null = globale Standard-Workflow, sonst projektspezifische Variante. */
  projectId: ID | null;
  name: string;
  beschreibung: string;
  herkunft: 'standard' | 'manuell';
  steps: ProcessTemplateStep[];
}

export interface ProcessTemplateStep {
  id: ID;
  name: string;
  typ: StepType;
  /** Verantwortliche Rolle für diesen Schritt. */
  roleName: string;
  /** Frist in Tagen ab Ende des Vorgängerschritts. */
  fristTage: number;
  beschreibung: string;
  /** Nur bei Entscheidungen gefüllt. */
  antworten: Antwort[];
  /**
   * Nachfolger bei Aufgaben und sonstigen Schritten: eine Schritt-ID,
   * `'ende'` oder `null` für den unmittelbar folgenden Schritt.
   * Bei Entscheidungen bestimmen die Antworten den Verlauf.
   */
  naechster: ID | 'ende' | null;
  /** Bei erfolgreichem Abschluss zu erfassender Nachweis. */
  nachweis: Nachweis;
  /**
   * Nach dem Erledigen fragen, ob die für den nächsten Schritt zuständige
   * Person per E-Mail informiert werden soll.
   */
  mailFrage: boolean;
  /** Vorzuschlagende E-Mail-Vorlage; null = die zum Anlass passende. */
  mailVorlageId: ID | null;
}

/* ------------------------------------------------------------------ */
/* Planlauf = laufende Instanz einer Workflow                      */
/* ------------------------------------------------------------------ */

export type RunStatus = 'laufend' | 'abgeschlossen' | 'abgebrochen';

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  laufend: 'Laufend',
  abgeschlossen: 'Abgeschlossen',
  abgebrochen: 'Abgebrochen',
};

/** Grundform des Abbruchs: ersatzlos oder mit neuem Index bzw. neuer Ausgabe. */
export type AbbruchArt = 'ersatzlos' | 'neuer_index';

export const ABBRUCH_ART_LABEL: Record<AbbruchArt, string> = {
  ersatzlos: 'ersatzlos',
  neuer_index: 'neuer Index / neue Ausgabe',
};

export interface PlanRun {
  id: ID;
  projectId: ID;
  documentId: ID;
  /** Vorlage, aus der der Lauf erzeugt wurde (nur Herkunftsnachweis). */
  templateId: ID | null;
  templateName: string;
  name: string;
  /** Index bzw. Ausgabe, für die dieser Lauf geführt wird. */
  index: string;
  start: ISODate;
  status: RunStatus;
  /** Begründung, falls der Lauf abgebrochen wurde. */
  abbruchGrund: string | null;
  abbruchDatum: ISODate | null;
  abbruchArt: AbbruchArt | null;
  /** Bei „neuer Index“: der Index bzw. die Ausgabe des Nachfolgelaufs. */
  abbruchNeuerIndex: string | null;
  /** Kopie der Schritte – individuelle Abweichungen ändern nur diese Instanz. */
  steps: RunStep[];
  bemerkung: string;
}

export type StepStatus = 'offen' | 'laufend' | 'erledigt' | 'uebersprungen';

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  offen: 'Offen',
  laufend: 'Laufend',
  erledigt: 'Erledigt',
  uebersprungen: 'Übersprungen',
};

export interface RunStep {
  id: ID;
  name: string;
  typ: StepType;
  /** Verantwortliche Rolle. */
  roleName: string;
  /**
   * Konkret zuständige Person. Sie ergibt sich laufend aus
   * der Besetzung der Funktion im Projekt – ändert sich diese, zieht der
   * Planlauf nach.
   */
  contactId: ID | null;
  /**
   * Von Hand gesetzte Person. Sie bleibt stehen, auch wenn die Funktion im
   * Besetzung der Funktion anders lautet.
   */
  contactManuell: boolean;
  fristTage: number;
  /** Berechnetes Soll-Datum; manuell überschreibbar (dann Ketten-Basis). */
  sollDatum: ISODate | null;
  /** true, sobald der Nutzer das Soll-Datum manuell gesetzt hat. */
  sollManuell: boolean;
  istDatum: ISODate | null;
  status: StepStatus;
  /** Kennzeichnet vom Standard abweichende Schritte (individuelle Anpassung). */
  abweichung: boolean;
  bemerkung: string;
  /** Zeitpunkt der letzten versendeten Erinnerung (ISO-Timestamp). */
  letzteErinnerung: string | null;
  /** Antwortmöglichkeiten bei Entscheidungen. */
  antworten: Antwort[];
  /** Gewählte Antwort; ohne Auswahl gilt die erste Möglichkeit. */
  gewaehlteAntwortId: ID | null;
  /** Nachfolger bei Aufgaben (siehe ProcessTemplateStep). */
  naechster: ID | 'ende' | null;
  /** Zählt, zum wievielten Mal der Schritt durchlaufen wird (Rücksprünge). */
  durchlauf: number;
  /** Bei erfolgreichem Abschluss zu erfassender Nachweis. */
  nachweis: Nachweis;
  /** Erfasste Freigabe- bzw. Prüfbericht-Nummer. */
  nachweisNummer: string | null;
  /** Nach dem Erledigen nach einer E-Mail an den nächsten Schritt fragen. */
  mailFrage: boolean;
  /** Vorzuschlagende E-Mail-Vorlage. */
  mailVorlageId: ID | null;
}

/* ------------------------------------------------------------------ */
/* Gesamter lokaler Datenbestand                                       */
/* ------------------------------------------------------------------ */

export interface AppData {
  version: number;
  /** Fassung der übernommenen Stammdaten (siehe STAMMDATEN_VERSION). */
  stammdatenVersion: number;
  bearbeiter: Bearbeiter;
  /** Gepflegte Gewerke – mitgeliefert und selbst ergänzt. */
  gewerke: string[];
  /** Projektübergreifende Funktionen. */
  standardRollen: StandardRolle[];
  /** Projektübergreifende E-Mail-Vorlagen (Reiter „Vorlagen“). */
  emailVorlagen: EmailTemplate[];
  projects: Project[];
  roles: Role[];
  contacts: Contact[];
  documents: PlanDocument[];
  templates: ProcessTemplate[];
  runs: PlanRun[];
}
