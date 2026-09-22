/**
 * Lokale Persistenz des Bereichs „Baubetriebsplanung“ unter einem eigenen
 * Schlüssel. Der Bestand des Planlaufmanagements wird dabei weder gelesen noch
 * geschrieben.
 */

export type Farbmodus = 'standard' | 'kontrast';

export interface BaubetriebEinstellungen {
  farbmodus: Farbmodus;
}

export interface BaubetriebDaten {
  version: number;
  einstellungen: BaubetriebEinstellungen;
}

const KEY = 'baubetrieb-planung.data.v1';

export const DATEN_VERSION = 1;

export function leereDaten(): BaubetriebDaten {
  return { version: DATEN_VERSION, einstellungen: { farbmodus: 'standard' } };
}

export function ladeDaten(): BaubetriebDaten {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return leereDaten();
    const daten = JSON.parse(roh) as Partial<BaubetriebDaten>;
    return {
      version: DATEN_VERSION,
      einstellungen: {
        farbmodus: daten.einstellungen?.farbmodus === 'kontrast' ? 'kontrast' : 'standard',
      },
    };
  } catch {
    return leereDaten();
  }
}

export function speichereDaten(daten: BaubetriebDaten): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(daten));
  } catch (err) {
    console.warn('Daten konnten nicht lokal gespeichert werden:', err);
  }
}
