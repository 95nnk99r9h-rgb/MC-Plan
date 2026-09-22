/**
 * Datenbestand des Bereichs „Baubetriebsplanung“. Vorerst enthält er nur die
 * Einstellungen des Bereichs; der Aufbau entspricht dem des
 * Planlaufmanagements, ist davon aber vollständig getrennt.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ladeDaten, speichereDaten, type BaubetriebDaten, type BaubetriebEinstellungen } from './storage';

interface StoreValue {
  data: BaubetriebDaten;
  setEinstellungen: (e: Partial<BaubetriebEinstellungen>) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BaubetriebDaten>(() => ladeDaten());

  useEffect(() => {
    speichereDaten(data);
  }, [data]);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      setEinstellungen: (e) =>
        setData((alt) => ({ ...alt, einstellungen: { ...alt.einstellungen, ...e } })),
    }),
    [data],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore muss innerhalb des StoreProvider verwendet werden.');
  return ctx;
}
