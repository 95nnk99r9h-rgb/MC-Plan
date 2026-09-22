/**
 * Verzeichnis der Bereiche. Jeder Bereich ist in sich geschlossen: eigener
 * Datenbestand, eigene Einstellungen, eigener Router. Hier steht nur, was die
 * Bereichsauswahl anzeigen muss – die Bereiche selbst wissen nichts voneinander.
 */
import type { IconName } from '../shared/icons';

export type BereichId = 'planlauf' | 'baubetrieb';

export interface Bereich {
  id: BereichId;
  titel: string;
  untertitel?: string;
  beschreibung: string;
  icon: IconName;
  /** Bereiche in Vorbereitung zeigen vorerst nur einen Platzhalter. */
  inVorbereitung?: boolean;
}

export const BEREICHE: Bereich[] = [
  {
    id: 'planlauf',
    titel: 'Planlaufmanagement',
    untertitel: 'Projekte, Planläufe und Fristen',
    beschreibung:
      'Planverzeichnisse und Planpakete verwalten, Planläufe nach Workflow abarbeiten und Fristen im Blick behalten.',
    icon: 'plan',
  },
  {
    id: 'baubetrieb',
    titel: 'Baubetriebsplanung',
    beschreibung: 'Dieser Bereich ist angelegt, aber noch ohne Inhalt.',
    icon: 'kalender',
    inVorbereitung: true,
  },
];

export const BEREICH_IDS: BereichId[] = BEREICHE.map((b) => b.id);

export function bereichInfo(id: BereichId): Bereich {
  return BEREICHE.find((b) => b.id === id)!;
}
