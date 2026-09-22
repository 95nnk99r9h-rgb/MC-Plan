/** Minimaler Hash-Router – erlaubt Lesezeichen und Vor/Zurück im Browser. */
import { useEffect, useState } from 'react';
import type { ID } from '../domain/types';

export type ProjektTab = 'uebersicht' | 'plaene' | 'pakete' | 'rollen' | 'ketten' | 'einstellungen';

export type Route =
  | { view: 'dashboard' }
  | { view: 'fristen' }
  | { view: 'projekte' }
  | { view: 'ketten' }
  | { view: 'rollen' }
  | { view: 'vorlagen' }
  | { view: 'projekt'; projectId: ID; tab: ProjektTab }
  | { view: 'planlauf'; projectId: ID; runId: ID };

const TABS: ProjektTab[] = ['uebersicht', 'plaene', 'pakete', 'rollen', 'ketten', 'einstellungen'];

/** Frühere Adressen bleiben gültig: „adressbuch“ führt auf „rollen“. */
const ALTE_TABS: Record<string, ProjektTab> = { adressbuch: 'rollen' };

export function routeToHash(r: Route): string {
  switch (r.view) {
    case 'projekt':
      return `#/projekt/${r.projectId}/${r.tab}`;
    case 'planlauf':
      return `#/projekt/${r.projectId}/planlauf/${r.runId}`;
    default:
      return `#/${r.view}`;
  }
}

export function hashToRoute(hash: string): Route {
  const teile = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (teile[0] === 'projekt' && teile[1]) {
    if (teile[2] === 'planlauf' && teile[3]) {
      return { view: 'planlauf', projectId: teile[1], runId: teile[3] };
    }
    // Frühere Adressen mit eigenem Planlauf-Reiter führen auf die Planliste
    const gewaehlt = teile[2] === 'planlaeufe' ? 'plaene' : teile[2];
    const tab = (TABS as string[]).includes(gewaehlt ?? '')
      ? (gewaehlt as ProjektTab)
      : (ALTE_TABS[gewaehlt ?? ''] ?? 'uebersicht');
    return { view: 'projekt', projectId: teile[1], tab };
  }
  if (teile[0] === 'fristen') return { view: 'fristen' };
  if (teile[0] === 'projekte') return { view: 'projekte' };
  if (teile[0] === 'ketten') return { view: 'ketten' };
  if (teile[0] === 'rollen') return { view: 'rollen' };
  if (teile[0] === 'vorlagen') return { view: 'vorlagen' };
  return { view: 'dashboard' };
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => hashToRoute(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(hashToRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    const hash = routeToHash(r);
    if (window.location.hash === hash) setRoute(r);
    else window.location.hash = hash;
  };

  return [route, navigate];
}
