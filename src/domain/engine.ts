/**
 * Planlauf-Logik: Weg durch die Workflow bestimmen, Soll-Termine aus
 * Fristen rechnen, Ampelstatus vergeben und offene Aufgaben einsammeln.
 */
import { addDays, diffDays, today } from '../lib/dates';
import {
  EIGENE_ROLLE,
  INDEX_LABEL,
  STANDARD_BEARBEITER,
  hatEigenenPlanlauf,
  type DocumentKind,
  type Antwort,
  type AppData,
  type Contact,
  type Role,
  type ID,
  type ISODate,
  type PlanDocument,
  type PlanRun,
  type ProcessTemplate,
  type ProcessTemplateStep,
  type Project,
  type RunStep,
} from './types';

export type Ampel = 'erledigt' | 'ueberfaellig' | 'faellig' | 'geplant' | 'neutral';

export const AMPEL_LABEL: Record<Ampel, string> = {
  erledigt: 'Erledigt',
  ueberfaellig: 'Überfällig',
  faellig: 'Fällig',
  geplant: 'Im Plan',
  neutral: 'Ohne Termin',
};

/* ------------------------------------------------------------------ */
/* Weg durch die Kette                                                 */
/* ------------------------------------------------------------------ */

/** Die Antwort, die den weiteren Verlauf bestimmt (ohne Auswahl: die erste). */
export function massgeblicheAntwort(step: { antworten: Antwort[]; gewaehlteAntwortId?: ID | null }): Antwort | undefined {
  if (step.antworten.length === 0) return undefined;
  const gewaehlt = step.antworten.find((a) => a.id === step.gewaehlteAntwortId);
  return gewaehlt ?? step.antworten[0];
}

/**
 * Der Nachfolger eines Schritts: bei Entscheidungen das Ziel der maßgeblichen
 * Antwort, sonst der hinterlegte Nachfolger. `null` heißt „nächster Schritt“.
 */
export function zielVonSchritt(step: ProcessTemplateStep | RunStep): ID | 'ende' | null {
  if (step.typ === 'entscheidung' && step.antworten.length > 0) {
    return massgeblicheAntwort(step)?.ziel ?? null;
  }
  return step.naechster ?? null;
}

/** Ergebnis der Ablaufverfolgung durch eine Kette. */
export interface Verlauf<T> {
  /** Die durchlaufenen Schritte in ihrer Reihenfolge. */
  schritte: T[];
  /**
   * Schritt, zu dem am Ende zurückgesprungen wird (Schleife, z.B. Überarbeitung).
   * Der Ablauf wird an dieser Stelle erneut aufgenommen.
   */
  rueckSprungZu: T | null;
  /** true, wenn der Ablauf durch eine Antwort ausdrücklich beendet wird. */
  beendet: boolean;
}

/**
 * Verfolgt den Ablauf durch die Kette.
 *
 * Schritte werden der Reihe nach abgearbeitet; eine Entscheidung springt
 * gemäß der maßgeblichen Antwort zu einem anderen Schritt, zum Ende oder
 * (ohne Ziel) zum unmittelbar folgenden Schritt. Führt eine Antwort zu einem
 * bereits durchlaufenen Schritt zurück, endet der Ablauf nicht – der Schritt
 * wird als Rücksprungziel gemeldet, damit die Schleife sichtbar bleibt und die
 * Verfolgung nicht endlos läuft.
 */
export function verlaufDerKette<T extends ProcessTemplateStep | RunStep>(steps: T[]): Verlauf<T> {
  const schritte: T[] = [];
  const besucht = new Set<ID>();
  let index = 0;

  while (index >= 0 && index < steps.length) {
    const step = steps[index];
    besucht.add(step.id);
    schritte.push(step);

    const ziel = zielVonSchritt(step);
    if (ziel === 'ende') return { schritte, rueckSprungZu: null, beendet: true };
    if (ziel) {
      const zielIndex = steps.findIndex((s) => s.id === ziel);
      if (zielIndex < 0) break;
      if (besucht.has(steps[zielIndex].id)) {
        return { schritte, rueckSprungZu: steps[zielIndex], beendet: false };
      }
      index = zielIndex;
      continue;
    }
    index += 1;
  }
  return { schritte, rueckSprungZu: null, beendet: false };
}

/** Reihenfolge der tatsächlich durchlaufenen Schritte. */
export function pfad<T extends ProcessTemplateStep | RunStep>(steps: T[]): T[] {
  return verlaufDerKette(steps).schritte;
}

/** Schritte, die im aktuellen Verlauf nicht durchlaufen werden. */
export function nichtImPfad<T extends ProcessTemplateStep | RunStep>(steps: T[]): T[] {
  const drin = new Set(pfad(steps).map((s) => s.id));
  return steps.filter((s) => !drin.has(s.id));
}

/* ------------------------------------------------------------------ */
/* Termine                                                             */
/* ------------------------------------------------------------------ */

/**
 * Rechnet die Soll-Termine der Schrittkette neu durch.
 *
 * Regel: Soll = Soll des Vorgängers + Frist des Schritts. Ein manuell
 * gesetztes Soll-Datum bleibt erhalten und wird zur neuen Basis für alle
 * folgenden Schritte. Schritte außerhalb des aktuellen Verlaufs erhalten
 * keinen Termin.
 */
export function recalcSollDaten(
  steps: RunStep[],
  start: ISODate,
  arbeitstage: boolean,
  feiertage: ISODate[],
  /**
   * Soll-Termin für den Eingang der Unterlage. Ist er hinterlegt, hat der
   * erste Schritt keine Frist, sondern genau dieses Datum; die folgenden
   * Fristen rechnen von dort weiter.
   */
  eingangSoll: ISODate | null = null,
): RunStep[] {
  const reihenfolge = pfad(steps);
  const termine = new Map<ID, ISODate>();
  let basis = start;

  for (const [i, step] of reihenfolge.entries()) {
    if (step.sollManuell && step.sollDatum) {
      basis = step.sollDatum;
      termine.set(step.id, step.sollDatum);
      continue;
    }
    if (i === 0 && eingangSoll) {
      basis = eingangSoll;
      termine.set(step.id, eingangSoll);
      continue;
    }
    const soll = addDays(basis, step.fristTage, arbeitstage, feiertage);
    basis = soll;
    termine.set(step.id, soll);
  }

  return steps.map((step) => {
    const soll = termine.get(step.id) ?? null;
    return soll === step.sollDatum ? step : { ...step, sollDatum: soll };
  });
}

/** Rechnet einen kompletten Lauf mit den Projekteinstellungen durch. */
export function recalcRun(
  run: PlanRun,
  project: Project | undefined,
  doc?: { eingangSoll: ISODate | null },
): PlanRun {
  const arbeitstage = project?.settings.fristenInArbeitstagen ?? true;
  const feiertage = project?.settings.feiertage ?? [];
  return {
    ...run,
    steps: recalcSollDaten(run.steps, run.start, arbeitstage, feiertage, doc?.eingangSoll ?? null),
  };
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export function ampelFuerSchritt(step: RunStep, vorlaufTage: number): Ampel {
  if (step.status === 'erledigt' || step.status === 'uebersprungen') return 'erledigt';
  if (!step.sollDatum) return 'neutral';
  const delta = diffDays(today(), step.sollDatum);
  if (delta < 0) return 'ueberfaellig';
  if (delta <= vorlaufTage) return 'faellig';
  return 'geplant';
}

const offenerSchritt = (s: RunStep) => s.status !== 'erledigt' && s.status !== 'uebersprungen';

/** Der erste nicht erledigte Schritt im aktuellen Verlauf. */
export function aktuellerSchritt(run: PlanRun): RunStep | undefined {
  return pfad(run.steps).find(offenerSchritt);
}

export function fortschritt(run: PlanRun): number {
  const reihenfolge = pfad(run.steps);
  if (reihenfolge.length === 0) return 0;
  const fertig = reihenfolge.filter((s) => !offenerSchritt(s)).length;
  return Math.round((fertig / reihenfolge.length) * 100);
}

/** Verzug des Laufs in Tagen (>0 = überfällig), bezogen auf den aktuellen Schritt. */
export function verzugTage(run: PlanRun): number {
  const step = aktuellerSchritt(run);
  if (!step?.sollDatum) return 0;
  const delta = diffDays(today(), step.sollDatum);
  return delta < 0 ? Math.abs(delta) : 0;
}

/**
 * Hinweis zu einem abgebrochenen Lauf: ersatzlos beendet oder durch einen
 * neuen Index bzw. eine neue Ausgabe ersetzt.
 */
export function abbruchHinweis(run: PlanRun, kind: DocumentKind = 'plan'): string {
  if (run.status !== 'abgebrochen') return '';
  if (run.abbruchArt !== 'neuer_index') return 'ersatzlos abgebrochen';
  const label = INDEX_LABEL[kind];
  return run.abbruchNeuerIndex ? `ersetzt durch ${label} ${run.abbruchNeuerIndex}` : `ersetzt durch neuen ${label}`;
}

/** Läuft noch und ist nicht abgebrochen. */
export function istAktiv(run: PlanRun): boolean {
  return run.status === 'laufend';
}

/* ------------------------------------------------------------------ */
/* Auswertungen                                                        */
/* ------------------------------------------------------------------ */

export interface FristEintrag {
  run: PlanRun;
  step: RunStep;
  project: Project;
  ampel: Ampel;
  tageBisSoll: number;
}

/**
 * Alle offenen Schritte des aktuellen Verlaufs, sortiert nach Dringlichkeit.
 * Abgebrochene und abgeschlossene Läufe bleiben außen vor.
 */
export function offeneFristen(data: AppData, projectIds?: ID[]): FristEintrag[] {
  const eintraege: FristEintrag[] = [];
  for (const run of eigenstaendigeLaeufe(data.documents, data.runs)) {
    if (projectIds && !projectIds.includes(run.projectId)) continue;
    if (!istAktiv(run)) continue;
    const project = data.projects.find((p) => p.id === run.projectId);
    if (!project) continue;
    // Nur der jeweils anstehende Schritt ist offen – kommende Schritte
    // erscheinen erst, wenn sie an der Reihe sind.
    const step = aktuellerSchritt(run);
    if (!step) continue;
    const ampel = ampelFuerSchritt(step, project.settings.erinnerungVorlaufTage);
    if (ampel === 'erledigt') continue;
    eintraege.push({
      run,
      step,
      project,
      ampel,
      tageBisSoll: step.sollDatum ? diffDays(today(), step.sollDatum) : 9999,
    });
  }
  return eintraege.sort((a, b) => a.tageBisSoll - b.tageBisSoll);
}

/**
 * Anstehende Schritte im eigenen Verantwortungsbereich (Rolle des Bearbeiters).
 * Berücksichtigt werden der jeweils aktuelle Schritt eines Laufs sowie bereits
 * laufende Schritte – nicht dagegen Schritte, die erst später an die Reihe kommen.
 */
export function eigeneTodos(data: AppData, projectIds?: ID[]): FristEintrag[] {
  const rolle = EIGENE_ROLLE.toLowerCase();
  return offeneFristen(data, projectIds).filter((f) => f.step.roleName.trim().toLowerCase() === rolle);
}

/**
 * Ermittelt die Person, die eine Rolle für ein bestimmtes Gewerk ausfüllt.
 * Rollen ohne Gewerkbezug sind einmal für alle Gewerke besetzt.
 */
export function kontaktFuerRolleUndGewerk(
  kontakte: Contact[],
  rollen: Role[],
  roleName: string,
  gewerk: string,
): ID | null {
  const gleich = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const passende = rollen.filter((r) => gleich(r.name, roleName));
  // Funktion des Gewerks; ersatzweise die übergreifende Funktion gleichen Namens
  const rolle = passende.find((r) => r.gewerk === gewerk) ?? passende.find((r) => r.gewerk === null);
  if (!rolle) return null;
  return kontakte.find((c) => c.zuordnungen.some((z) => z.roleId === rolle.id))?.id ?? null;
}

/**
 * Eigenständig geführte Planläufe.
 *
 * Pläne eines Planverzeichnisses laufen im Lauf des Verzeichnisses mit. Haben
 * sie – etwa weil sie erst später zugeordnet wurden – noch einen eigenen Lauf,
 * bleibt dieser erhalten, zählt aber nicht mehr als eigenständiger Planlauf.
 */
export function eigenstaendigeLaeufe(documents: PlanDocument[], runs: PlanRun[]): PlanRun[] {
  return runs.filter((r) => {
    const doc = documents.find((d) => d.id === r.documentId);
    return !doc || hatEigenenPlanlauf(doc);
  });
}

/**
 * Laufende Nummerierung der Pläne und Planverzeichnisse eines Projekts.
 *
 * Planverzeichnisse und Einzelpläne werden in der Reihenfolge ihrer Anlage
 * fortlaufend nummeriert; die Pläne eines Verzeichnisses erhalten dessen
 * Nummer mit angehängtem Zähler (3.1, 3.2 …). Planpakete bleiben ohne Nummer.
 * Gelöschte Einträge geben ihre Nummer wieder frei, da stets neu durchgezählt
 * wird; abgebrochene Einträge behalten sie, weil der Eintrag bestehen bleibt.
 */
export function lfdNummern(documents: PlanDocument[]): Map<ID, string> {
  const nummern = new Map<ID, string>();
  const eintraege = documents.filter((d) => d.kind !== 'paket');
  const istKind = (d: PlanDocument) =>
    d.kind === 'plan' && d.parentId !== null && eintraege.some((x) => x.id === d.parentId);

  let zaehler = 0;
  for (const d of eintraege) {
    if (!istKind(d)) nummern.set(d.id, String(++zaehler));
  }

  const unterZaehler = new Map<ID, number>();
  for (const d of eintraege) {
    if (!istKind(d)) continue;
    const eltern = nummern.get(d.parentId!);
    if (!eltern) continue;
    const n = (unterZaehler.get(d.parentId!) ?? 0) + 1;
    unterZaehler.set(d.parentId!, n);
    nummern.set(d.id, `${eltern}.${n}`);
  }
  return nummern;
}

/** Erzeugt aus einer Vorlage die Schritte eines neuen Laufs. */
export function stepsAusTemplate(
  template: ProcessTemplate,
  contactFuerRolle: (roleName: string) => ID | null,
  newId: () => string,
): RunStep[] {
  // Schritt-IDs werden neu vergeben; Antwortziele müssen mitgezogen werden.
  const idMap = new Map<ID, ID>();
  template.steps.forEach((s) => idMap.set(s.id, newId()));

  return template.steps.map((s) => ({
    id: idMap.get(s.id)!,
    name: s.name,
    typ: s.typ,
    roleName: s.roleName,
    contactId: contactFuerRolle(s.roleName),
    contactManuell: false,
    fristTage: s.fristTage,
    sollDatum: null,
    sollManuell: false,
    istDatum: null,
    status: 'offen' as const,
    abweichung: false,
    bemerkung: s.beschreibung,
    letzteErinnerung: null,
    antworten: s.antworten.map((a) => ({
      id: newId(),
      text: a.text,
      ziel: a.ziel === 'ende' || a.ziel === null ? a.ziel : (idMap.get(a.ziel) ?? null),
    })),
    naechster: s.naechster === 'ende' || s.naechster === null ? s.naechster : (idMap.get(s.naechster) ?? null),
    gewaehlteAntwortId: null,
    durchlauf: 1,
    nachweis: s.nachweis,
    nachweisNummer: null,
    mailFrage: s.mailFrage,
    mailVorlageId: s.mailVorlageId,
  }));
}

/**
 * Bereitet einen Rücksprung vor: Das Ziel und alle Schritte, die im Verlauf
 * dahinter liegen (einschließlich der auslösenden Entscheidung), werden für
 * einen weiteren Durchlauf geöffnet. Bereits erfasste Ist-Termine der
 * betroffenen Schritte entfallen, der Durchlaufzähler wird erhöht.
 */
export function rueckSprungAnwenden(steps: RunStep[], entscheidungId: ID, zielId: ID): RunStep[] {
  const reihenfolge = pfad(steps);
  const vonIndex = reihenfolge.findIndex((s) => s.id === zielId);
  const bisIndex = reihenfolge.findIndex((s) => s.id === entscheidungId);
  if (vonIndex < 0 || bisIndex < 0 || vonIndex > bisIndex) return steps;

  const betroffen = new Set(reihenfolge.slice(vonIndex, bisIndex + 1).map((s) => s.id));
  return steps.map((s) => {
    if (!betroffen.has(s.id)) return s;
    return {
      ...s,
      status: s.id === zielId ? ('laufend' as const) : ('offen' as const),
      istDatum: null,
      durchlauf: (s.durchlauf ?? 1) + 1,
      // Die Entscheidung wird im neuen Durchlauf erneut beantwortet.
      gewaehlteAntwortId: s.typ === 'entscheidung' ? null : s.gewaehlteAntwortId,
    };
  });
}

/** Gesamtdauer einer Vorlage entlang des Standardverlaufs. */
export function templateDauer(template: ProcessTemplate): number {
  return pfad(template.steps).reduce((sum, s) => sum + s.fristTage, 0);
}

/**
 * Gewerke, die in einem Projekt zur Auswahl stehen: die gepflegten Stammdaten
 * und zusätzlich jedes Gewerk, für das das Projekt eine Funktion führt. So
 * passen Planliste, Planläufe und „Rollen & Funktionen“ immer zusammen.
 */
export function gewerkeFuerProjekt(
  data: Pick<AppData, 'gewerke' | 'roles'>,
  projectId: ID,
): string[] {
  const ausRollen = data.roles
    .filter((r) => r.projectId === projectId)
    .map((r) => r.gewerk)
    .filter((g): g is string => Boolean(g));
  return [...new Set([...data.gewerke, ...ausRollen])].sort((a, b) => a.localeCompare(b, 'de'));
}

/* ------------------------------------------------------------------ */
/* Eigener Kontakt in den markierten Projekten                         */
/* ------------------------------------------------------------------ */

/** Zerlegt den angezeigten Namen in Vor- und Nachname. */
function namensTeile(name: string): { vorname: string; nachname: string } {
  const teile = name.trim().split(/\s+/);
  if (teile.length < 2) return { vorname: teile[0] ?? '', nachname: '' };
  return { vorname: teile.slice(0, -1).join(' '), nachname: teile[teile.length - 1] };
}

/**
 * Führt die angemeldete Person in jedem markierten Projekt und
 * besetzt dort das Planlaufmanagement.
 *
 * Markiert jemand ein Projekt („meine Projekte“), ist er dort immer der
 * Zuständige des Planlaufmanagements – auch wenn er dort noch nicht
 * geführt wurde. Der Eintrag wird deshalb bei jeder Änderung angelegt bzw.
 * nachgezogen, die Funktion bei anderen Kontakten desselben Projekts
 * entfernt und die zugehörigen Schritte laufender Planläufe umgehängt.
 */
export function eigeneKontakteSichern(daten: AppData, neueId: (prefix: string) => string): AppData {
  const { vorname, nachname } = namensTeile(daten.bearbeiter?.name || STANDARD_BEARBEITER);
  let contacts = daten.contacts;
  let geaendert = false;

  for (const projekt of daten.projects.filter((p) => p.markiert)) {
    const rolle = daten.roles.find(
      (r) => r.projectId === projekt.id && r.name === EIGENE_ROLLE && r.gewerk === null,
    );
    const vorhanden = contacts.find((c) => c.projectId === projekt.id && c.eigen);

    // Eintrag anlegen oder Namen und Funktion nachziehen
    let eigenerId: ID;
    if (!vorhanden) {
      eigenerId = neueId('con');
      contacts = [
        {
          id: eigenerId,
          projectId: projekt.id,
          anrede: '',
          vorname,
          nachname,
          firma: EIGENE_ROLLE,
          email: '',
          telefon: '',
          anschrift: '',
          zuordnungen: rolle ? [{ roleId: rolle.id, gewerk: null }] : [],
          notiz: '',
          eigen: true,
        },
        ...contacts,
      ];
      geaendert = true;
    } else {
      eigenerId = vorhanden.id;
      const fehlt = rolle ? !vorhanden.zuordnungen.some((z) => z.roleId === rolle.id) : false;
      if (vorhanden.vorname !== vorname || vorhanden.nachname !== nachname || fehlt) {
        contacts = contacts.map((c) =>
          c.id === eigenerId
            ? {
                ...c,
                vorname,
                nachname,
                zuordnungen: fehlt ? [...c.zuordnungen, { roleId: rolle!.id, gewerk: null }] : c.zuordnungen,
              }
            : c,
        );
        geaendert = true;
      }
    }

    // Das Planlaufmanagement ist in diesem Projekt allein Sache der eigenen Person
    if (rolle) {
      const doppelt = contacts.some(
        (c) => c.projectId === projekt.id && c.id !== eigenerId && c.zuordnungen.some((z) => z.roleId === rolle.id),
      );
      if (doppelt) {
        contacts = contacts.map((c) =>
          c.projectId === projekt.id && c.id !== eigenerId
            ? { ...c, zuordnungen: c.zuordnungen.filter((z) => z.roleId !== rolle.id) }
            : c,
        );
        geaendert = true;
      }
    }

  }

  return geaendert ? { ...daten, contacts } : daten;
}

/**
 * Zieht die Zuständigkeiten laufender Planläufe aus der Besetzung nach.
 *
 * Ein Schritt nennt eine Funktion; wer sie ausfüllt, steht unter Rollen &
 * Funktionen des Projekts. Wird eine Person erst später eingetragen oder wechselt sie
 * während des Projekts, gilt die neue Besetzung sofort – auch für bereits
 * gestartete Planläufe. Von Hand gesetzte Personen (`contactManuell`) und
 * abgeschlossene Schritte bleiben unangetastet: sie halten fest, wer den
 * Schritt tatsächlich bearbeitet hat.
 */
export function zustaendigkeitenNachziehen(daten: AppData): AppData {
  let geaendert = false;

  const runs = daten.runs.map((run) => {
    if (run.status !== 'laufend') return run;
    const kontakte = daten.contacts.filter((c) => c.projectId === run.projectId);
    const rollen = daten.roles.filter((r) => r.projectId === run.projectId);
    const gewerk = daten.documents.find((d) => d.id === run.documentId)?.gewerk ?? '';

    let laufGeaendert = false;
    const steps = run.steps.map((step) => {
      if (step.contactManuell || step.status === 'erledigt') return step;
      const contactId = kontaktFuerRolleUndGewerk(kontakte, rollen, step.roleName, gewerk);
      if (contactId === step.contactId) return step;
      laufGeaendert = true;
      return { ...step, contactId };
    });
    if (!laufGeaendert) return run;
    geaendert = true;
    return { ...run, steps };
  });

  return geaendert ? { ...daten, runs } : daten;
}
