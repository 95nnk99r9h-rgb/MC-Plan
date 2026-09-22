/**
 * Projektbezogene Auswertungen für den Export als Excel-Arbeitsmappe oder PDF
 * (über den Druckdialog).
 *
 * Kurzfassung: je Eintrag der aktuelle Stand, der nächste Schritt und die
 * Verantwortlichen. Langfassung: zusätzlich alle bereits durchlaufenen und
 * alle ausstehenden Schritte.
 */
import { formatDate, today } from '../lib/dates';
import { html } from '../lib/print';
import type { Zelle } from '../lib/xlsx';
import { AMPEL_LABEL, aktuellerSchritt, ampelFuerSchritt, fortschritt, istAktiv, pfad } from './engine';
import {
  DOCUMENT_KIND_LABEL,
  INDEX_LABEL,
  NACHWEIS_LABEL,
  RUN_STATUS_LABEL,
  STEP_STATUS_LABEL,
  STEP_TYPE_LABEL,
  type AppData,
  type ID,
  type PlanDocument,
  type PlanRun,
  type Project,
  type RunStep,
} from './types';

export type ExportUmfang = 'kurz' | 'lang';

export const UMFANG_LABEL: Record<ExportUmfang, string> = {
  kurz: 'Kurzfassung',
  lang: 'Langfassung',
};

const KURZ_KOPF = [
  'Art',
  'Plancodierung',
  'Titel',
  'Index / Ausgabe',
  'Gewerk',
  'Planungsphase',
  'Eingang Soll',
  'Planlauf',
  'Fortschritt',
  'Aktueller Stand',
  'Nächster Schritt',
  'Verantwortlich',
  'Person',
  'Soll-Termin',
  'Nachweise',
  'Status',
];

const LANG_KOPF = [
  'Plancodierung',
  'Titel',
  'Planlauf',
  'Nr.',
  'Prozessschritt',
  'Art',
  'Status',
  'Verantwortlich',
  'Person',
  'Frist (Tage)',
  'Soll',
  'Ist',
  'Nachweis',
  'Bemerkung',
];

interface Zeile {
  doc: PlanDocument;
  run: PlanRun | undefined;
}

/** Der jeweils jüngste Planlauf eines Eintrags (abgebrochene zuletzt). */
function laufZuDokument(data: AppData, docId: ID): PlanRun | undefined {
  const laeufe = data.runs.filter((r) => r.documentId === docId);
  return laeufe.find(istAktiv) ?? laeufe.find((r) => r.status === 'abgeschlossen') ?? laeufe[0];
}

function person(data: AppData, step: RunStep | undefined): string {
  const kontakt = data.contacts.find((c) => c.id === step?.contactId);
  return kontakt ? `${kontakt.vorname} ${kontakt.nachname}${kontakt.firma ? `, ${kontakt.firma}` : ''}` : '';
}

/** Letzter abgeschlossener Schritt – „aktueller Stand“. */
function letzterErledigter(run: PlanRun | undefined): RunStep | undefined {
  if (!run) return undefined;
  const erledigt = pfad(run.steps).filter((s) => s.status === 'erledigt' || s.status === 'uebersprungen');
  return erledigt[erledigt.length - 1];
}

function zeilen(data: AppData, docIds: ID[]): Zeile[] {
  return docIds
    .map((id) => data.documents.find((d) => d.id === id))
    .filter((d): d is PlanDocument => Boolean(d))
    .map((doc) => ({ doc, run: laufZuDokument(data, doc.id) }));
}

/* ------------------------------ Excel ----------------------------- */

export function kurzZeilen(data: AppData, project: Project, docIds: ID[]): Zelle[][] {
  const vorlauf = project.settings.erinnerungVorlaufTage;
  return [
    KURZ_KOPF,
    ...zeilen(data, docIds).map(({ doc, run }) => {
      const naechster = run && istAktiv(run) ? aktuellerSchritt(run) : undefined;
      const stand = letzterErledigter(run);
      return [
        DOCUMENT_KIND_LABEL[doc.kind],
        doc.nummer,
        doc.titel,
        doc.index,
        doc.gewerk,
        doc.planungsphase,
        doc.eingangSoll ? formatDate(doc.eingangSoll) : '',
        run ? run.name : 'kein Planlauf',
        run ? `${fortschritt(run)} %` : '',
        stand ? `${stand.name}${stand.istDatum ? ` (${formatDate(stand.istDatum)})` : ''}` : 'noch nicht begonnen',
        naechster ? naechster.name : run ? RUN_STATUS_LABEL[run.status] : 'ausstehend',
        naechster?.roleName ?? '',
        person(data, naechster),
        naechster?.sollDatum ? formatDate(naechster.sollDatum) : '',
        run
          ? pfad(run.steps)
              .filter((s) => s.nachweisNummer)
              .map((s) => `${NACHWEIS_LABEL[s.nachweis]} ${s.nachweisNummer}`)
              .join('; ')
          : '',
        run
          ? run.status === 'abgebrochen'
            ? `Abgebrochen – ${run.abbruchGrund ?? ''}`
            : naechster
              ? AMPEL_LABEL[ampelFuerSchritt(naechster, vorlauf)]
              : RUN_STATUS_LABEL[run.status]
          : 'Ausstehend',
      ];
    }),
  ];
}

export function langZeilen(data: AppData, project: Project, docIds: ID[]): Zelle[][] {
  const vorlauf = project.settings.erinnerungVorlaufTage;
  const ausgabe: Zelle[][] = [LANG_KOPF];

  for (const { doc, run } of zeilen(data, docIds)) {
    if (!run) {
      ausgabe.push([doc.nummer, doc.titel, 'kein Planlauf gestartet', '', '', '', 'Ausstehend', '', '', '', '', '', '', '']);
      continue;
    }
    pfad(run.steps).forEach((step, i) => {
      const ampel = ampelFuerSchritt(step, vorlauf);
      const antwort = step.antworten.find((a) => a.id === step.gewaehlteAntwortId);
      ausgabe.push([
        doc.nummer,
        doc.titel,
        run.name,
        i + 1,
        step.name,
        STEP_TYPE_LABEL[step.typ],
        step.status === 'erledigt' || step.status === 'uebersprungen'
          ? STEP_STATUS_LABEL[step.status]
          : AMPEL_LABEL[ampel],
        step.roleName,
        person(data, step),
        step.fristTage,
        step.sollDatum ? formatDate(step.sollDatum) : '',
        step.istDatum ? formatDate(step.istDatum) : '',
        step.nachweisNummer ? `${NACHWEIS_LABEL[step.nachweis]} ${step.nachweisNummer}` : '',
        [antwort ? `Antwort: ${antwort.text}` : '', step.bemerkung].filter(Boolean).join(' · '),
      ]);
    });
    if (run.status === 'abgebrochen') {
      ausgabe.push([doc.nummer, doc.titel, run.name, '', 'Planlauf abgebrochen', '', 'Abgebrochen', '', '', '', run.abbruchDatum ? formatDate(run.abbruchDatum) : '', '', '', run.abbruchGrund ?? '']);
    }
  }
  return ausgabe;
}

/* ------------------------------- PDF ------------------------------ */

export function exportHtml(
  data: AppData,
  project: Project,
  docIds: ID[],
  umfang: ExportUmfang,
): string {
  const vorlauf = project.settings.erinnerungVorlaufTage;
  const kopf = `<div class="kopf">
    <h1>${html(project.nummer)} · ${html(project.name)}</h1>
    <div class="meta">Planlauf-Übersicht – ${UMFANG_LABEL[umfang]} ·
      Stand: ${formatDate(today())} · ${docIds.length} Einträge</div>
  </div>`;

  const fuss = `<p class="fuss">Erzeugt mit Planlauf-Management am ${formatDate(today())}. Soll-Termine ergeben sich aus den hinterlegten Fristen${project.settings.fristenInArbeitstagen ? ' (Arbeitstage)' : ''}.</p>`;

  if (umfang === 'kurz') {
    const [kopfzeile, ...daten] = kurzZeilen(data, project, docIds);
    return `${kopf}<table><thead><tr>${kopfzeile
      .map((z) => `<th>${html(String(z))}</th>`)
      .join('')}</tr></thead><tbody>${daten
      .map(
        (zeile) =>
          `<tr>${zeile
            .map((z, i) => {
              const text = html(z === null || z === undefined ? '' : String(z));
              const klasse =
                i === 14 && String(z).startsWith('Überfällig')
                  ? ' class="ueberfaellig"'
                  : i === 6 || i === 13
                    ? ' class="num"'
                    : '';
              return `<td${klasse}>${text}</td>`;
            })
            .join('')}</tr>`,
      )
      .join('')}</tbody></table>${fuss}`;
  }

  // Langfassung: je Eintrag ein Abschnitt mit allen Schritten
  const abschnitte = zeilen(data, docIds)
    .map(({ doc, run }) => {
      const titel = `<h2>${html(DOCUMENT_KIND_LABEL[doc.kind])} ${html(doc.nummer)} – ${html(doc.titel)}${doc.index ? ` (${INDEX_LABEL[doc.kind]} ${html(doc.index)})` : ''}</h2>`;
      const meta = `<div class="meta grau">Gewerk: ${html(doc.gewerk || '–')} · ${html(doc.planungsphase || 'ohne Phase')} ·
        Eingang Soll: ${doc.eingangSoll ? formatDate(doc.eingangSoll) : '–'} ·
        ${run ? `Planlauf „${html(run.name)}“ (${html(RUN_STATUS_LABEL[run.status])}, ${fortschritt(run)} %)` : 'kein Planlauf gestartet'}</div>`;

      if (!run) return `${titel}${meta}`;

      const zeilenHtml = pfad(run.steps)
        .map((step, i) => {
          const ampel = ampelFuerSchritt(step, vorlauf);
          const erledigt = step.status === 'erledigt' || step.status === 'uebersprungen';
          const status = erledigt ? STEP_STATUS_LABEL[step.status] : AMPEL_LABEL[ampel];
          const antwort = step.antworten.find((a) => a.id === step.gewaehlteAntwortId);
          return `<tr>
            <td class="num">${i + 1}</td>
            <td>${html(step.name)}${antwort ? ` <span class="grau">→ ${html(antwort.text)}</span>` : ''}</td>
            <td class="${erledigt ? 'erledigt' : ampel === 'ueberfaellig' ? 'ueberfaellig' : ''}">${html(status)}</td>
            <td>${html(step.roleName)}</td>
            <td>${html(person(data, step))}</td>
            <td class="num">${step.fristTage}</td>
            <td class="num">${step.sollDatum ? formatDate(step.sollDatum) : '–'}</td>
            <td class="num">${step.istDatum ? formatDate(step.istDatum) : '–'}</td>
            <td>${step.nachweisNummer ? `${html(NACHWEIS_LABEL[step.nachweis])} ${html(step.nachweisNummer)}` : '–'}</td>
            <td class="grau">${html(step.bemerkung)}</td>
          </tr>`;
        })
        .join('');

      const abbruch =
        run.status === 'abgebrochen'
          ? `<p class="meta ueberfaellig">Planlauf abgebrochen am ${run.abbruchDatum ? formatDate(run.abbruchDatum) : '–'}: ${html(run.abbruchGrund ?? '')}</p>`
          : '';

      return `${titel}${meta}<table><thead><tr>
        <th>Nr.</th><th>Prozessschritt</th><th>Status</th><th>Verantwortlich</th><th>Person</th>
        <th>Frist</th><th>Soll</th><th>Ist</th><th>Nachweis</th><th>Bemerkung</th>
      </tr></thead><tbody>${zeilenHtml}</tbody></table>${abbruch}`;
    })
    .join('');

  return `${kopf}${abschnitte}${fuss}`;
}

/** Dateiname ohne Erweiterung. */
export function exportDateiname(project: Project, umfang: ExportUmfang): string {
  const sauber = `${project.nummer}-${project.name}`.replace(/[^\wäöüÄÖÜß -]/g, '').trim().replace(/\s+/g, '-');
  return `Planlauf-${UMFANG_LABEL[umfang]}-${sauber}-${today()}`;
}
