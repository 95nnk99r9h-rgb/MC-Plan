# MC Plan – Hinweise für die Arbeit am Code

React 19 + TypeScript + Vite, **ohne Backend**: Alle Daten liegen im `localStorage` des Browsers.
Installierbar als PWA, veröffentlicht über GitHub Pages. Fachliche Beschreibung in `README.md`,
Routen, Meldungen und Setup mit Fundstellen in `docs/INVENTAR.md`.

## Befehle

```bash
npm ci              # Abhängigkeiten
npm run dev         # Entwicklungsserver, Port 5173
npm run typecheck   # tsc --noEmit – vor jedem Commit
npm run build       # tsc -b && vite build → dist/
```

Tests und Linter gibt es nicht; `typecheck` (strict, `noUnusedLocals`, `noUnusedParameters`) und
`build` sind die einzigen Prüfungen. CI (`.github/workflows/pages.yml`) führt `npm run build` bei
jedem Pull Request aus.

## Aufbau

- `src/shell/` – Startbildschirm und Bereichswahl; die erste Wegmarke der Hash-Adresse
  (`#/planlauf/…`, `#/baubetrieb/…`) bestimmt den Bereich.
- `src/bereiche/<bereich>/` – in sich geschlossene Bereiche mit eigenem Store, eigenem
  `localStorage`-Schlüssel, eigenen Einstellungen und eigenem Router. **Bereiche importieren
  nichts voneinander.** Neue Bereiche in `src/shell/bereiche.ts` und `src/shell/Shell.tsx` eintragen.
- `src/shared/` – fachfreie Bausteine (UI, Icons, Datumsrechnung, Excel lesen/schreiben, Druck,
  PWA). Kein Import aus `bereiche/`.
- `src/bereiche/planlauf/` – das eigentliche Planlaufmanagement:
  - `domain/types.ts` Datenmodell (flache Listen in `AppData`, Verweise nur über IDs),
  - `domain/engine.ts` Weg durch die Kette, Soll-Termine, Ampel, To-Dos, Zuständigkeiten,
  - `domain/seed.ts` mitgelieferte Funktionen, Standard-Workflows, E-Mail-Vorlagen, Demodaten,
  - `store/store.tsx` alle Schreibzugriffe, `store/storage.ts` Laden, Speichern, Migration,
  - `lib/router.ts` Hash-Router, `pages/` Ansichten, `components/` fachliche Bausteine.
- `src/bereiche/baubetrieb/` – nur Rahmen (Store mit Einstellungen, Router, Platzhalterseite).

## Regeln

- **Sprache:** Bezeichner, Kommentare, UI-Texte und Commit-Nachrichten auf Deutsch, wie im
  bestehenden Code (`speichereDaten`, `aktuellerSchritt`, …). Fachbegriffe beibehalten: Planlauf,
  Planpaket, Planverzeichnis, Funktion, Gewerk, Besetzung, Workflow (im Code `template`/`ProcessTemplate`).
- **Schreibzugriffe nur über den Store.** Jede Änderung läuft über `mutate()` in
  `store/store.tsx`; danach werden automatisch `eigeneKontakteSichern`,
  `zustaendigkeitenNachziehen` und `recalcRun` für alle Läufe ausgeführt. Neue Aktionen als
  Methode im `StoreValue` ergänzen, nicht an `mutate` vorbei.
- **Datenmodell geändert?** `DATEN_VERSION` in `domain/types.ts` erhöhen und in `migriere()`
  (`store/storage.ts`) fehlende Felder mit Standardwerten ergänzen. `migriere()` hebt jeden
  älteren Stand in einem Schritt auf die aktuelle Fassung – ohne Erhöhung bleibt ein vorhandener
  Bestand unverändert und kann zur Laufzeit abstürzen.
- **Mitgelieferte Stammdaten geändert** (`STANDARD_ROLLEN`, `STANDARD_TEMPLATES` in `seed.ts`)?
  `STAMMDATEN_VERSION` erhöhen, damit vorhandene Bestände sie übernehmen
  (`stammdatenAktualisieren`).
- **IDs** mit `newId(prefix)` aus `store/store.tsx` erzeugen.
- **Keine neuen Laufzeitabhängigkeiten** ohne Rückfrage – Router, Excel-Import/-Export, PDF-Druck
  und Icons sind bewusst selbst geschrieben; Laufzeitabhängigkeiten sind nur `react`/`react-dom`.
- **Neue Route:** Typ `Route` sowie `routeToHash`/`hashToRoute` in `lib/router.ts` erweitern
  und in `App.tsx` rendern. Alte Adressen bleiben per Umleitung gültig.
- **Service Worker:** Ändern sich Hülle oder Symbole, `CACHE` in `public/sw.js` hochzählen.
- **`app/` nicht von Hand bearbeiten** – der Ordner ist der Build, den der Workflow nach jedem
  Push auf `main` dort ablegt (Rückfalllösung, wenn Pages den Quellcode ausliefert). `dist/` ist
  ignoriert.
- **Dokumentation mitpflegen:** Neue oder geänderte Funktionen in `README.md`
  (Funktionsumfang), Routen und Meldungen in `docs/INVENTAR.md` nachtragen.
- Gestaltung über die Design-Tokens in `src/shared/global.css`; Oberfläche muss bis etwa 400 px
  Breite bedienbar bleiben, der Farbmodus `kontrast` muss weiter funktionieren.
