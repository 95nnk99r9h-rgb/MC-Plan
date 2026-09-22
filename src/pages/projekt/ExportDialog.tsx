/**
 * Export eines Projekts als Excel-Arbeitsmappe oder PDF (über den Druckdialog).
 *
 * Kurzfassung: aktueller Stand, nächster Schritt und Verantwortliche.
 * Langfassung: zusätzlich alle durchlaufenen und ausstehenden Schritte.
 */
import { useState } from 'react';
import {
  UMFANG_LABEL,
  exportDateiname,
  exportHtml,
  kurzZeilen,
  langZeilen,
  type ExportUmfang,
} from '../../domain/export';
import { DOCUMENT_KIND_LABEL, type DocumentKind, type ID, type Project } from '../../domain/types';
import { druckeHtml } from '../../lib/print';
import { dateiLaden, xlsxErzeugen } from '../../lib/xlsx';
import { useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { Callout, Field, Modal, Segmented } from '../../components/ui';
import { Icon } from '../../components/icons';

export function ExportDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const { data } = useStore();
  const toast = useToast();

  const dokumente = data.documents
    .filter((d) => d.projectId === project.id)
    .sort((a, b) => a.nummer.localeCompare(b.nummer, 'de', { numeric: true }));

  const [umfang, setUmfang] = useState<ExportUmfang>('kurz');
  const [arten, setArten] = useState<DocumentKind[]>(['paket', 'plan', 'verzeichnis']);
  const [auswahl, setAuswahl] = useState<ID[]>(dokumente.map((d) => d.id));

  const sichtbar = dokumente.filter((d) => arten.includes(d.kind));
  const gewaehlt = sichtbar.filter((d) => auswahl.includes(d.id));

  const artUmschalten = (kind: DocumentKind) => {
    const neu = arten.includes(kind) ? arten.filter((a) => a !== kind) : [...arten, kind];
    setArten(neu);
    // Einträge neu sichtbarer Arten automatisch mitnehmen
    setAuswahl((alt) => [
      ...alt,
      ...dokumente.filter((d) => neu.includes(d.kind) && !alt.includes(d.id)).map((d) => d.id),
    ]);
  };

  const alleUmschalten = () =>
    setAuswahl(gewaehlt.length === sichtbar.length ? [] : sichtbar.map((d) => d.id));

  const ids = gewaehlt.map((d) => d.id);

  const alsExcel = () => {
    if (ids.length === 0) {
      toast('Bitte mindestens einen Eintrag auswählen.');
      return;
    }
    const zeilen = umfang === 'kurz' ? kurzZeilen(data, project, ids) : langZeilen(data, project, ids);
    const blob = xlsxErzeugen([{ name: UMFANG_LABEL[umfang], zeilen }]);
    dateiLaden(blob, `${exportDateiname(project, umfang)}.xlsx`);
    toast('Excel-Datei wurde erzeugt.');
    onClose();
  };

  const alsPdf = () => {
    if (ids.length === 0) {
      toast('Bitte mindestens einen Eintrag auswählen.');
      return;
    }
    druckeHtml(exportDateiname(project, umfang), exportHtml(data, project, ids, umfang));
    toast('Druckdialog geöffnet – dort „Als PDF sichern“ wählen.');
  };

  return (
    <Modal
      titel="Projekt exportieren"
      sub={`${project.nummer} · ${project.name}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-outline" onClick={alsPdf} disabled={ids.length === 0}>
            <Icon name="export" size={14} /> PDF
          </button>
          <button type="button" className="btn btn-primary" onClick={alsExcel} disabled={ids.length === 0}>
            <Icon name="export" size={14} /> Excel
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <Field label="Umfang">
          <Segmented<ExportUmfang>
            value={umfang}
            onChange={setUmfang}
            options={[
              { value: 'kurz', label: 'Kurzfassung' },
              { value: 'lang', label: 'Langfassung' },
            ]}
          />
          <span className="hint">
            {umfang === 'kurz'
              ? 'Je Eintrag: aktueller Stand, nächster Schritt und Verantwortliche.'
              : 'Je Eintrag: alle bereits durchlaufenen und alle ausstehenden Schritte mit Verantwortlichen.'}
          </span>
        </Field>

        <Field label="Arten">
          <div className="row wrap" style={{ gap: 6 }}>
            {(Object.keys(DOCUMENT_KIND_LABEL) as DocumentKind[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`antwort-chip ${arten.includes(k) ? 'gewaehlt' : ''}`}
                onClick={() => artUmschalten(k)}
              >
                {DOCUMENT_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </Field>

        <div>
          <div className="row-between" style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
              Einträge ({gewaehlt.length} von {sichtbar.length})
            </label>
            <button type="button" className="btn btn-sm btn-ghost" onClick={alleUmschalten}>
              {gewaehlt.length === sichtbar.length ? 'Keinen' : 'Alle'} auswählen
            </button>
          </div>

          {sichtbar.length === 0 ? (
            <Callout ton="warn" icon="!">
              Für die gewählten Arten gibt es keine Einträge.
            </Callout>
          ) : (
            <div className="card" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {sichtbar.map((d) => (
                <label className="list-row clickable" key={d.id} style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={auswahl.includes(d.id)}
                    onChange={() =>
                      setAuswahl((alt) => (alt.includes(d.id) ? alt.filter((x) => x !== d.id) : [...alt, d.id]))
                    }
                    style={{ width: 15, height: 15, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="num">{d.nummer}</span> <strong>{d.titel}</strong>
                    <div className="small tertiary">
                      {DOCUMENT_KIND_LABEL[d.kind]}
                      {d.gewerk ? ` · ${d.gewerk}` : ''}
                      {d.planungsphase ? ` · ${d.planungsphase}` : ''}
                    </div>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <p className="small tertiary">
          Excel wird als .xlsx-Datei heruntergeladen. Für PDF öffnet sich der Druckdialog des Browsers – dort
          „Als PDF sichern“ (bzw. „Microsoft Print to PDF“) wählen.
        </p>
      </div>
    </Modal>
  );
}
