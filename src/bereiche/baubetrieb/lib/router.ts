/**
 * Eigener Hash-Router des Bereichs. Die Wahl des Bereichs trifft die Shell
 * (#/baubetrieb), alles dahinter gehört diesem Router. Vorerst gibt es allein
 * die Startseite – weitere Ansichten kommen als weitere Wegmarken dazu.
 */
import { useEffect, useState } from 'react';

/** Präfix aller Adressen dieses Bereichs. */
export const PREFIX = 'baubetrieb';

export type Route = { view: 'start' };

export function routeToHash(route: Route): string {
  return route.view === 'start' ? `#/${PREFIX}` : `#/${PREFIX}/${route.view}`;
}

export function hashToRoute(): Route {
  // Solange es nur eine Ansicht gibt, führt jede Adresse auf die Startseite.
  return { view: 'start' };
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => hashToRoute());

  useEffect(() => {
    const onHash = () => setRoute(hashToRoute());
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
