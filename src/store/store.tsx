/**
 * Zentraler Anwendungsstatus. Alle Schreibzugriffe laufen über diesen Store,
 * der den Bestand nach jeder Änderung lokal persistiert und die Soll-Termine
 * betroffener Planläufe neu berechnet.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { eigeneKontakteSichern, recalcRun, zustaendigkeitenNachziehen } from '../domain/engine';
import { seedData } from '../domain/seed';
import { ladeDaten, speichereDaten } from './storage';
import { today } from '../lib/dates';
import type {
  AbbruchArt,
  AppData,
  Bearbeiter,
  Contact,
  ID,
  PlanDocument,
  PlanRun,
  ProcessTemplate,
  EmailTemplate,
  Project,
  Role,
  RunStep,
  StandardRolle,
} from '../domain/types';

export function newId(prefix = 'id'): ID {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

interface StoreValue {
  data: AppData;
  /* Bearbeiter */
  setBearbeiter: (b: Partial<Bearbeiter>) => void;
  /* Gewerke */
  addGewerk: (name: string) => void;
  /** Löscht ein Gewerk samt seiner Funktionen (Stammdaten und Projekte). */
  deleteGewerk: (name: string) => void;
  /* Projekte */
  addProject: (p: Omit<Project, 'id'>) => ID;
  toggleMarkiert: (id: ID) => void;
  updateProject: (id: ID, patch: Partial<Project>) => void;
  deleteProject: (id: ID) => void;
  /* Funktionen (projektübergreifend) */
  addStandardRolle: (r: Omit<StandardRolle, 'id'>) => ID;
  updateStandardRolle: (id: ID, patch: Partial<StandardRolle>) => void;
  deleteStandardRolle: (id: ID) => void;
  /* Projektfunktionen */
  addRole: (r: Omit<Role, 'id'>) => ID;
  updateRole: (id: ID, patch: Partial<Role>) => void;
  deleteRole: (id: ID) => void;
  /* Kontakte */
  addContact: (c: Omit<Contact, 'id'>) => ID;
  updateContact: (id: ID, patch: Partial<Contact>) => void;
  deleteContact: (id: ID) => void;
  /* Dokumente */
  addDocument: (d: Omit<PlanDocument, 'id'>) => ID;
  updateDocument: (id: ID, patch: Partial<PlanDocument>) => void;
  deleteDocument: (id: ID) => void;
  /* E-Mail-Vorlagen (projektübergreifend) */
  setEmailVorlage: (t: EmailTemplate) => void;
  deleteEmailVorlage: (id: ID) => void;
  /* Vorlagen */
  addTemplate: (t: Omit<ProcessTemplate, 'id'> & { id?: ID }) => ID;
  updateTemplate: (id: ID, patch: Partial<ProcessTemplate>) => void;
  deleteTemplate: (id: ID) => void;
  /* Planläufe */
  addRun: (r: Omit<PlanRun, 'id'>) => ID;
  updateRun: (id: ID, patch: Partial<PlanRun>) => void;
  deleteRun: (id: ID) => void;
  updateStep: (runId: ID, stepId: ID, patch: Partial<RunStep>) => void;
  addStep: (runId: ID, step: Omit<RunStep, 'id'>, position?: number) => void;
  /** Bricht einen Lauf mit Begründung ab; er bleibt im Projekt sichtbar. */
  abbrechenRun: (runId: ID, grund: string, art: AbbruchArt, neuerIndex: string | null) => void;
  /* Verwaltung */
  ersetzeDaten: (d: AppData) => void;
  zuruecksetzen: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => ladeDaten());
  const ersterRender = useRef(true);

  useEffect(() => {
    if (ersterRender.current) {
      ersterRender.current = false;
    }
    speichereDaten(data);
  }, [data]);

  /** Änderung anwenden und alle Läufe mit aktuellen Projekteinstellungen durchrechnen. */
  const mutate = useCallback((fn: (d: AppData) => AppData) => {
    setData((alt) => {
      // Die angemeldete Person wird in ihren Projekten stets als
      // Planlaufmanagement geführt – auch nach einem neuen Projekt,
      // einer Markierung oder einer Namensänderung.
      // Zuständigkeiten folgen der Besetzung der Funktionen: neue oder gewechselte
      // Besetzungen greifen sofort auch in laufenden Planläufen.
      const neu = zustaendigkeitenNachziehen(eigeneKontakteSichern(fn(alt), newId));
      return {
        ...neu,
        runs: neu.runs.map((r) =>
          recalcRun(
            r,
            neu.projects.find((p) => p.id === r.projectId),
            neu.documents.find((d) => d.id === r.documentId),
          ),
        ),
      };
    });
  }, []);

  const value = useMemo<StoreValue>(() => {
    const upd = <T extends { id: ID }>(list: T[], id: ID, patch: Partial<T>) =>
      list.map((x) => (x.id === id ? { ...x, ...patch } : x));

    return {
      data,

      setBearbeiter: (b) =>
        mutate((d) => ({ ...d, bearbeiter: { ...d.bearbeiter, ...b } })),

      // Gewerke sind Stammdaten: einmal ergänzt, stehen sie überall zur Auswahl
      deleteGewerk: (name) =>
        mutate((d) => {
          const gleich = (g: string | null) => (g ?? '').trim().toLowerCase() === name.trim().toLowerCase();
          // Funktionen dieses Gewerks entfallen – samt ihrer Besetzung
          const rollenIds = new Set(d.roles.filter((r) => gleich(r.gewerk)).map((r) => r.id));
          return {
            ...d,
            gewerke: d.gewerke.filter((g) => !gleich(g)),
            standardRollen: d.standardRollen.filter((r) => !gleich(r.gewerk)),
            roles: d.roles.filter((r) => !rollenIds.has(r.id)),
            contacts: d.contacts.map((c) =>
              c.zuordnungen.some((z) => rollenIds.has(z.roleId))
                ? { ...c, zuordnungen: c.zuordnungen.filter((z) => !rollenIds.has(z.roleId)) }
                : c,
            ),
          };
        }),

      addGewerk: (name) =>
        mutate((d) =>
          d.gewerke.some((g) => g.trim().toLowerCase() === name.trim().toLowerCase())
            ? d
            : { ...d, gewerke: [...d.gewerke, name.trim()].sort((a, b) => a.localeCompare(b, 'de')) },
        ),

      toggleMarkiert: (id) =>
        mutate((d) => ({
          ...d,
          projects: d.projects.map((p) => (p.id === id ? { ...p, markiert: !p.markiert } : p)),
        })),

      addProject: (p) => {
        const id = newId('prj');
        mutate((d) => ({ ...d, projects: [...d.projects, { ...p, id }] }));
        return id;
      },
      updateProject: (id, patch) => mutate((d) => ({ ...d, projects: upd(d.projects, id, patch) })),
      deleteProject: (id) =>
        mutate((d) => ({
          ...d,
          projects: d.projects.filter((p) => p.id !== id),
          roles: d.roles.filter((r) => r.projectId !== id),
          contacts: d.contacts.filter((c) => c.projectId !== id),
          documents: d.documents.filter((x) => x.projectId !== id),
          runs: d.runs.filter((r) => r.projectId !== id),
          templates: d.templates.filter((t) => t.projectId !== id),
        })),

      addStandardRolle: (r) => {
        const id = newId('srol');
        mutate((d) => ({ ...d, standardRollen: [...d.standardRollen, { ...r, id }] }));
        return id;
      },
      updateStandardRolle: (id, patch) =>
        mutate((d) => ({ ...d, standardRollen: upd(d.standardRollen, id, patch) })),
      deleteStandardRolle: (id) =>
        mutate((d) => ({ ...d, standardRollen: d.standardRollen.filter((r) => r.id !== id) })),

      addRole: (r) => {
        const id = newId('rol');
        mutate((d) => ({ ...d, roles: [...d.roles, { ...r, id }] }));
        return id;
      },
      updateRole: (id, patch) => mutate((d) => ({ ...d, roles: upd(d.roles, id, patch) })),
      deleteRole: (id) =>
        mutate((d) => ({
          ...d,
          roles: d.roles.filter((r) => r.id !== id),
          contacts: d.contacts.map((c) => ({
            ...c,
            zuordnungen: c.zuordnungen.filter((z) => z.roleId !== id),
          })),
        })),

      addContact: (c) => {
        const id = newId('con');
        mutate((d) => ({ ...d, contacts: [...d.contacts, { ...c, id }] }));
        return id;
      },
      updateContact: (id, patch) => mutate((d) => ({ ...d, contacts: upd(d.contacts, id, patch) })),
      deleteContact: (id) =>
        mutate((d) => ({
          ...d,
          contacts: d.contacts.filter((c) => c.id !== id),
          runs: d.runs.map((r) => ({
            ...r,
            steps: r.steps.map((s) => (s.contactId === id ? { ...s, contactId: null } : s)),
          })),
        })),

      addDocument: (doc) => {
        const id = newId('doc');
        mutate((d) => ({ ...d, documents: [...d.documents, { ...doc, id }] }));
        return id;
      },
      updateDocument: (id, patch) => mutate((d) => ({ ...d, documents: upd(d.documents, id, patch) })),
      deleteDocument: (id) =>
        mutate((d) => ({
          ...d,
          documents: d.documents.filter((x) => x.id !== id),
          runs: d.runs.filter((r) => r.documentId !== id),
        })),

      setEmailVorlage: (t) =>
        mutate((d) => ({
          ...d,
          emailVorlagen: d.emailVorlagen.some((x) => x.id === t.id)
            ? d.emailVorlagen.map((x) => (x.id === t.id ? t : x))
            : [...d.emailVorlagen, t],
        })),

      deleteEmailVorlage: (id) =>
        mutate((d) => ({ ...d, emailVorlagen: d.emailVorlagen.filter((x) => x.id !== id) })),

      addTemplate: (t) => {
        const id = t.id ?? newId('tpl');
        mutate((d) => ({ ...d, templates: [...d.templates, { ...t, id } as ProcessTemplate] }));
        return id;
      },
      updateTemplate: (id, patch) => mutate((d) => ({ ...d, templates: upd(d.templates, id, patch) })),
      deleteTemplate: (id) => mutate((d) => ({ ...d, templates: d.templates.filter((t) => t.id !== id) })),

      addRun: (r) => {
        const id = newId('run');
        mutate((d) => ({ ...d, runs: [...d.runs, { ...r, id }] }));
        return id;
      },
      updateRun: (id, patch) => mutate((d) => ({ ...d, runs: upd(d.runs, id, patch) })),
      deleteRun: (id) => mutate((d) => ({ ...d, runs: d.runs.filter((r) => r.id !== id) })),

      updateStep: (runId, stepId, patch) =>
        mutate((d) => ({
          ...d,
          runs: d.runs.map((r) =>
            r.id === runId ? { ...r, steps: r.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) } : r,
          ),
        })),

      addStep: (runId, step, position) =>
        mutate((d) => ({
          ...d,
          runs: d.runs.map((r) => {
            if (r.id !== runId) return r;
            const neu = { ...step, id: newId('rs') };
            const steps = [...r.steps];
            steps.splice(position ?? steps.length, 0, neu);
            return { ...r, steps };
          }),
        })),

      abbrechenRun: (runId, grund, art, neuerIndex) =>
        mutate((d) => ({
          ...d,
          runs: d.runs.map((r) =>
            r.id === runId
              ? {
                  ...r,
                  status: 'abgebrochen' as const,
                  abbruchGrund: grund,
                  abbruchDatum: today(),
                  abbruchArt: art,
                  abbruchNeuerIndex: neuerIndex,
                }
              : r,
          ),
        })),

      ersetzeDaten: (d) => mutate(() => d),
      zuruecksetzen: () => mutate(() => seedData()),
    };
  }, [data, mutate]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore muss innerhalb des StoreProvider verwendet werden.');
  return ctx;
}
