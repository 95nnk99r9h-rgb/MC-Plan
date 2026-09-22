/**
 * Planpakete eines Projekts.
 *
 * Ein Planpaket bündelt Pläne und Planverzeichnisse zu einer Gruppe – etwa
 * je Bauwerk oder Bauabschnitt. Es ist ein reines Ordnungsmerkmal: Planläufe,
 * Fristen und Workflows bleiben davon unberührt.
 */
import { Fragment, useState } from 'react';
import { DOCUMENT_KIND_LABEL, INDEX_LABEL, type PlanDocument, type Project } from '../../domain/types';
import { gewerkeFuerProjekt } from '../../domain/engine';
import { useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { DocKindIcon } from '../../components/common';
import {
  Badge,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Search,
  Select,
  TextArea,
  TextInput,
} from '../../components/ui';
import { Icon } from '../../components/icons';

export function Planpakete({ project }: { project: Project }) {
  const { data, updateDocument } = useStore();
  const toast = useToast();
  const [suche, setSuche] = useState('');
  const [dialog, setDialog] = useState<{ paket?: PlanDocument } | null>(null);
  const [offen, setOffen] = useState<string[]>([]);

  const alle = data.documents.filter((d) => d.projectId === project.id);
  const pakete = alle
    .filter((d) => d.kind === 'paket')
    .filter((d) => [d.nummer, d.titel, d.gewerk].join(' ').toLowerCase().includes(suche.toLowerCase()))
    .sort((a, b) => (a.titel || a.nummer).localeCompare(b.titel || b.nummer, 'de', { numeric: true }));

  /** Einträge eines Pakets – Pläne und Planverzeichnisse. */
  const inhalt = (paketId: string) =>
    alle
      .filter((d) => d.kind !== 'paket' && d.paketId === paketId)
      .sort((a, b) => a.nummer.localeCompare(b.nummer, 'de', { numeric: true }));

  const ohnePaket = alle.filter((d) => d.kind !== 'paket' && !d.paketId);

  const klappen = (id: string) =>
    setOffen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  const zuweisen = (docId: string, paketId: string | null) => {
    updateDocument(docId, { paketId });
    const paket = pakete.find((p) => p.id === paketId);
    toast(paketId ? `Eintrag zu „${paket?.titel ?? 'Paket'}“ hinzugefügt.` : 'Eintrag aus dem Paket entfernt.');
  };

  return (
    <div className="stack">
      <div className="row-between wrap">
        <Search value={suche} onChange={setSuche} placeholder="Paketname, Gewerk …" />
        <button type="button" className="btn btn-primary" onClick={() => setDialog({})}>
          <Icon name="plus" size={14} /> Neues Planpaket
        </button>
      </div>

      <Card>
        <CardHeader
          titel="Planpakete"
          sub="Bündeln Pläne und Planverzeichnisse – ohne Einfluss auf Planläufe und Fristen"
        />
        {pakete.length === 0 ? (
          <EmptyState
            icon="paket"
            titel="Noch keine Planpakete"
            text="Legen Sie ein Paket an und ordnen Sie ihm Pläne oder Planverzeichnisse zu."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setDialog({})}>
                <Icon name="plus" size={14} /> Neues Planpaket
              </button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Planpaket</th>
                  <th className="col-optional">Gewerk</th>
                  <th>Inhalt</th>
                  <th className="col-optional">Bemerkung</th>
                  <th className="actions" />
                </tr>
              </thead>
              <tbody>
                {pakete.map((paket) => {
                  const eintraege = inhalt(paket.id);
                  const aufgeklappt = offen.includes(paket.id);
                  return (
                    <Fragment key={paket.id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            className={`gruppe-btn ${aufgeklappt ? 'offen' : ''}`}
                            onClick={() => klappen(paket.id)}
                            title={aufgeklappt ? 'Inhalt ausblenden' : 'Inhalt anzeigen'}
                          >
                            <span className="chev">
                              <Icon name="chevron" size={13} />
                            </span>
                            <DocKindIcon kind="paket" />
                            <span style={{ minWidth: 0 }}>
                              {paket.nummer ? <span className="num">{paket.nummer}</span> : null}
                              <div>
                                <strong>{paket.titel}</strong>
                              </div>
                            </span>
                          </button>
                        </td>
                        <td className="small muted col-optional">{paket.gewerk || '–'}</td>
                        <td className="small">
                          {eintraege.length === 0 ? (
                            <span className="tertiary">noch nichts zugeordnet</span>
                          ) : (
                            `${eintraege.length} Eintrag/Einträge`
                          )}
                        </td>
                        <td className="small muted col-optional truncate">{paket.bemerkung || '–'}</td>
                        <td className="actions">
                          <button
                            type="button"
                            className="btn-icon"
                            aria-label="Planpaket bearbeiten"
                            title="Planpaket bearbeiten"
                            onClick={() => setDialog({ paket })}
                          >
                            <Icon name="bearbeiten" size={15} />
                          </button>
                        </td>
                      </tr>

                      {aufgeklappt ? (
                        <>
                          {eintraege.map((d) => (
                            <tr key={d.id} className="unterzeile">
                              <td style={{ paddingLeft: 46 }}>
                                <span className="row" style={{ gap: 9 }}>
                                  <DocKindIcon kind={d.kind} />
                                  <span style={{ minWidth: 0 }}>
                                    <span className="num">
                                      {d.nummer}
                                      {d.index ? ` · ${INDEX_LABEL[d.kind]} ${d.index}` : ''}
                                    </span>
                                    <div className="small">{d.titel}</div>
                                  </span>
                                </span>
                              </td>
                              <td className="small muted col-optional">{d.gewerk || '–'}</td>
                              <td className="small">
                                <Badge>{DOCUMENT_KIND_LABEL[d.kind]}</Badge>
                              </td>
                              <td className="small muted col-optional">
                                {d.bemerkung || d.planungsphase || '–'}
                              </td>
                              <td className="actions">
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => zuweisen(d.id, null)}
                                  title="Aus dem Planpaket entfernen"
                                >
                                  Entfernen
                                </button>
                              </td>
                            </tr>
                          ))}
                          <tr className="unterzeile">
                            <td colSpan={5} style={{ paddingLeft: 46 }}>
                              {ohnePaket.length === 0 ? (
                                <span className="small tertiary">
                                  Alle Pläne und Verzeichnisse sind bereits einem Paket zugeordnet.
                                </span>
                              ) : (
                                <span className="row wrap" style={{ gap: 8 }}>
                                  <span className="small muted">Hinzufügen:</span>
                                  <Select
                                    value=""
                                    onChange={(v) => v && zuweisen(v, paket.id)}
                                    placeholder="– Plan oder Planverzeichnis –"
                                    options={ohnePaket.map((d) => ({
                                      value: d.id,
                                      label: `${DOCUMENT_KIND_LABEL[d.kind]} ${d.nummer} · ${d.titel}`,
                                    }))}
                                  />
                                </span>
                              )}
                            </td>
                          </tr>
                        </>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog ? (
        <PaketDialog project={project} paket={dialog.paket} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PaketDialog({
  project,
  paket,
  onClose,
}: {
  project: Project;
  paket?: PlanDocument;
  onClose: () => void;
}) {
  const { data, addDocument, updateDocument, deleteDocument } = useStore();
  const toast = useToast();
  const [loeschen, setLoeschen] = useState(false);
  const [form, setForm] = useState({
    nummer: paket?.nummer ?? '',
    titel: paket?.titel ?? '',
    gewerk: paket?.gewerk ?? '',
    planungsphase: paket?.planungsphase ?? '',
    bemerkung: paket?.bemerkung ?? '',
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const speichern = () => {
    if (!form.titel.trim()) {
      toast('Bitte einen Namen für das Planpaket angeben.');
      return;
    }
    if (paket) {
      updateDocument(paket.id, form);
      toast('Planpaket gespeichert.');
    } else {
      addDocument({
        ...form,
        projectId: project.id,
        kind: 'paket',
        parentId: null,
        paketId: null,
        index: '',
        eingangSoll: null,
        datum: null,
      });
      toast('Planpaket angelegt.');
    }
    onClose();
  };

  return (
    <>
      <Modal
        titel={paket ? 'Planpaket bearbeiten' : 'Neues Planpaket'}
        sub="Ordnungsmerkmal ohne Einfluss auf Planläufe"
        onClose={onClose}
        footer={
          <>
            {paket ? (
              <button type="button" className="btn btn-danger" onClick={() => setLoeschen(true)}>
                <Icon name="loeschen" size={14} /> Löschen
              </button>
            ) : null}
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>
              Abbrechen
            </button>
            <button type="button" className="btn btn-primary" onClick={speichern}>
              Speichern
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Name Planpaket" full>
            <TextInput value={form.titel} onChange={(v) => set('titel', v)} placeholder="z.B. Eisenbahnüberführung Nordkanal" />
          </Field>
          <Field label="Kurzzeichen" hint="optional, z.B. PP-Nordkanal">
            <TextInput value={form.nummer} onChange={(v) => set('nummer', v)} />
          </Field>
          <Field label="Gewerk" hint="Auswahl oder freie Eingabe">
            <input
              className="input"
              list="paket-gewerke"
              value={form.gewerk}
              onChange={(e) => set('gewerk', e.target.value)}
              placeholder="KIB, VA, OLA …"
            />
            <datalist id="paket-gewerke">
              {gewerkeFuerProjekt(data, project.id).map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          <Field label="Bemerkung" full>
            <TextArea value={form.bemerkung} onChange={(v) => set('bemerkung', v)} rows={2} />
          </Field>
        </div>
      </Modal>

      {loeschen && paket ? (
        <ConfirmDialog
          titel="Planpaket löschen?"
          text={`„${paket.titel}“ wird gelöscht. Die enthaltenen Pläne und Planverzeichnisse bleiben mit ihren Planläufen erhalten – sie sind dann keinem Paket mehr zugeordnet.`}
          onConfirm={() => {
            deleteDocument(paket.id);
            toast('Planpaket gelöscht.');
            onClose();
          }}
          onClose={() => setLoeschen(false)}
        />
      ) : null}
    </>
  );
}
