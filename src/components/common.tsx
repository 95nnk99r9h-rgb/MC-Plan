/** Fachliche Anzeige-Bausteine, die in mehreren Ansichten gebraucht werden. */
import { AMPEL_LABEL, type Ampel } from '../domain/engine';
import { formatDate, relativeLabel } from '../lib/dates';
import {
  DOCUMENT_KIND_LABEL,
  RUN_STATUS_LABEL,
  STEP_TYPE_LABEL,
  type DocumentKind,
  type ISODate,
  type Role,
  type RunStatus,
  type StepType,
} from '../domain/types';
import { Badge } from './ui';
import { Icon } from './icons';

const AMPEL_TON: Record<Ampel, '' | 'green' | 'orange' | 'red' | 'blue'> = {
  erledigt: 'green',
  ueberfaellig: 'red',
  faellig: 'orange',
  geplant: 'blue',
  neutral: '',
};

export function AmpelBadge({ ampel }: { ampel: Ampel }) {
  return <Badge ton={AMPEL_TON[ampel]}>{AMPEL_LABEL[ampel]}</Badge>;
}

/** Der Plan ist angekündigt: Der Eingang beim Planlaufmanagement steht aus. */
export function AngekuendigtBadge() {
  return <Badge ton="gelb">Angekündigt</Badge>;
}

export function AmpelPunkt({ ampel }: { ampel: Ampel }) {
  return <span className={`dot ${AMPEL_TON[ampel] || ''}`} title={AMPEL_LABEL[ampel]} />;
}

const RUN_STATUS_TON: Record<RunStatus, '' | 'green' | 'orange' | 'red' | 'blue'> = {
  laufend: 'blue',
  abgeschlossen: 'green',
  // Ein Abbruch ist kein Fehler, sondern erledigte Vergangenheit – daher grau
  abgebrochen: '',
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Badge ton={RUN_STATUS_TON[status]}>{RUN_STATUS_LABEL[status]}</Badge>;
}

const KIND_ICON: Record<DocumentKind, string> = {
  plan: 'plan',
  paket: 'paket',
  verzeichnis: 'verzeichnis',
};

export function DocKindIcon({ kind }: { kind: DocumentKind }) {
  return (
    <span className="tertiary" title={DOCUMENT_KIND_LABEL[kind]} style={{ display: 'flex' }}>
      <Icon name={KIND_ICON[kind]} size={16} />
    </span>
  );
}

export function StepTypBadge({ typ }: { typ: StepType }) {
  const ton = typ === 'entscheidung' ? 'purple' : typ === 'sonstiges' ? 'blue' : '';
  return <Badge ton={ton}>{STEP_TYPE_LABEL[typ]}</Badge>;
}

export function RollenChips({ roles }: { roles: Role[] }) {
  if (roles.length === 0) return <span className="tertiary small">keine Funktion</span>;
  return (
    <span className="row wrap" style={{ gap: 5 }}>
      {roles.map((r) => (
        <span key={r.id} className="role-chip" style={{ color: r.farbe }}>
          {r.name}
        </span>
      ))}
    </span>
  );
}

export function Termin({ soll, ist }: { soll: ISODate | null; ist: ISODate | null }) {
  return (
    <span className="small">
      <span className="muted">Soll </span>
      <b>{formatDate(soll)}</b>
      {ist ? (
        <>
          <span className="muted"> · Ist </span>
          <b>{formatDate(ist)}</b>
        </>
      ) : (
        <span className="tertiary"> · {relativeLabel(soll)}</span>
      )}
    </span>
  );
}
