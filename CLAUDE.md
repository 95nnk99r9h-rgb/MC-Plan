# MC Plan – Hinweise für die Arbeit am Code

MC Plan ist eine React-19-/TypeScript-/Vite-Anwendung **ohne Server**; alle Daten liegen im
`localStorage` des Browsers. Installierbar als PWA, veröffentlicht über GitHub Pages. Sie besteht
aus zwei getrennten Bereichen: **Planlaufmanagement** (`src/bereiche/planlauf/`) und
**Baubetriebsplanung** (`src/bereiche/baubetrieb/`, noch Platzhalter). Überblick über Aufbau und
Funktionen: `README.md`; belegtes Inventar aller Routen, Aktionen und Meldungen: `docs/INVENTAR.md`.

## Nach jeder Änderung nachziehen

Eine Änderung ist erst fertig, wenn alle betroffenen Dateien zum Code passen:

1. **`README.md`** – Funktionsbeschreibung, Aufbau des Codes, Veröffentlichen.
2. **`docs/INVENTAR.md`** – nur Aussagen, die sich im Code belegen lassen. Vor dem Commit prüfen,
   dass jeder genannte Pfad existiert und jeder zitierte Oberflächentext wörtlich im Code steht.
3. **Weitere relevante Dateien**, insbesondere:
   * Code-Kommentare, die das geänderte Verhalten beschreiben,
   * der Hinweistext in `index.html` (erscheint, wenn der Quellcode statt des Builds ausgeliefert wird),
   * `public/sw.js`: Cache-Namen hochzählen, wenn sich die Hülle ändert (Titel, Symbole, Manifest).

Funktion und Dokumentation werden in getrennten Commits festgehalten.

## Prüfen, bauen, veröffentlichen

```bash
npm ci              # Abhängigkeiten
npm run dev         # Entwicklungsserver, Port 5173
npm run typecheck   # tsc --noEmit – vor jedem Commit
npm run build       # tsc -b && vite build → dist/
```

Tests und Linter gibt es nicht; `typecheck` (strict, `noUnusedLocals`, `noUnusedParameters`) und
`build` sind die einzigen Prüfungen.

`.github/workflows/pages.yml` baut bei jedem Pull Request (nur Prüfung) und bei jedem Push auf
`main`. Auf `main` stellt er den Build über GitHub Pages bereit und legt ihn zusätzlich im Branch
`gh-pages` und im Ordner **`app/`** ab. `app/` ist der eingecheckte Build, auf den die
Wurzel-`index.html` umschaltet, wenn Pages den Zweig selbst ausliefert („Deploy from a branch“).
**`app/` in Feature-Branches nicht von Hand neu bauen** – der Workflow erneuert ihn nach dem Merge;
von Hand gebaute Stände führen nur zu Konflikten zwischen den gehashten Dateinamen. `dist/` ist
ignoriert.

## Aufbau

* `src/shell/` – Startbildschirm und Bereichswahl; die erste Wegmarke der Hash-Adresse
  (`#/planlauf/…`, `#/baubetrieb/…`) bestimmt den Bereich. Ein neuer Bereich braucht einen
  Eintrag in `BereichId`/`BEREICHE` (`src/shell/bereiche.ts`) und in `src/shell/Shell.tsx`.
* `src/bereiche/<bereich>/` – in sich geschlossene Bereiche mit eigenem Store, eigenem
  `localStorage`-Schlüssel, eigenen Einstellungen und eigenem Router.
* `src/shared/` – fachfreie Bausteine (UI, Icons, Datumsrechnung, Excel lesen/schreiben, Druck,
  PWA, `global.css` mit den Design-Tokens).
* `src/bereiche/planlauf/`:
  * `domain/types.ts` Datenmodell (flache Listen in `AppData`, Verweise über IDs – außer: Schritte
    nennen ihre Funktion per `roleName`, Gewerke sind Namen; Umbenennungen müssen diese Stellen
    mitziehen),
  * `domain/engine.ts` Weg durch die Kette, Soll-Termine, Ampel, To-Dos, Zuständigkeiten,
  * `domain/seed.ts` mitgelieferte Funktionen, Standard-Workflows, E-Mail-Vorlagen, Demodaten,
  * `store/store.tsx` alle Schreibzugriffe, `store/storage.ts` Laden, Speichern, Migration,
  * `lib/router.ts` Hash-Router, `pages/` Ansichten, `components/` fachliche Bausteine.

## Randbedingungen

* `src/shared/` enthält nur Bausteine ohne fachlichen Bezug und importiert nichts aus
  `src/bereiche/`. Die Bereiche greifen nicht aufeinander zu.
* **Schreibzugriffe nur über den Store.** Jede Änderung läuft über `mutate()` in
  `store/store.tsx`; danach werden automatisch `eigeneKontakteSichern`,
  `zustaendigkeitenNachziehen` und `recalcRun` für alle Läufe ausgeführt. Neue Aktionen als
  Methode im `StoreValue` ergänzen, nicht an `mutate` vorbei. IDs mit `newId(prefix)`.
* Der localStorage-Schlüssel `planlauf-management.data.v1` bleibt unverändert. Neue Felder am
  Datenmodell sind optional oder werden in `migriere()` (`store/storage.ts`) nachgetragen – dann
  **`DATEN_VERSION`** (`domain/types.ts`) erhöhen: `migriere()` läuft nur, wenn die gespeicherte
  Fassung abweicht, und hebt jeden älteren Stand in einem Schritt auf die aktuelle.
* Mitgelieferte Stammdaten geändert (`STANDARD_ROLLEN`, `STANDARD_TEMPLATES` in `seed.ts`)?
  **`STAMMDATEN_VERSION`** erhöhen, damit vorhandene Bestände sie übernehmen
  (`stammdatenAktualisieren`). Achtung: Das ersetzt alle Standard-Workflows samt Änderungen der
  Nutzer, überschreibt Funktionen gleichen Namens und Gewerks und stellt gelöschte mitgelieferte
  Funktionen (auch in Projekten) wieder her.
* `window.planlaufGestartet` nicht umbenennen – `index.html` und `app/index.html` rufen ihn auf.
* Ob ein Eintrag einen eigenen Planlauf hat, entscheidet allein `hatEigenenPlanlauf`
  (`domain/types.ts`): Planverzeichnisse laufen gebündelt oder mit Plänen einzeln, Pläne lassen
  sich herauslösen und wieder bündeln.
* Neue Route: Typ `Route` sowie `routeToHash`/`hashToRoute` in `lib/router.ts` erweitern und in
  `App.tsx` rendern. Frühere Adressen bleiben per Umleitung gültig.
* Keine neuen Laufzeitabhängigkeiten ohne Rückfrage – Router, Excel-Import/-Export, PDF-Druck und
  Icons sind bewusst selbst geschrieben; Laufzeitabhängigkeiten sind nur `react`/`react-dom`.
* Gestaltung über die Design-Tokens in `src/shared/global.css`; die Oberfläche bleibt bis etwa
  400 px Breite bedienbar, der Farbmodus `kontrast` muss weiter funktionieren.
* Sprache in Oberfläche, Bezeichnern, Kommentaren und Commit-Nachrichten ist Deutsch.

## Hinweise für Prüfungen im Browser

* Der aktuelle Schritt eines Laufs folgt dem Workflow-Pfad (`aktuellerSchritt`), nicht der
  Reihenfolge im Array. Wer Testdaten vorbereitet, muss den Schritt auf dem Pfad ändern.
* Nach dem Schreiben in den `localStorage` die Seite neu laden (`reload`) – ein Wechsel nur im
  Hash lädt nicht neu, und der laufende Store überschreibt die Änderung.
* Hilfsserver über ihre Prozessnummer beenden, nicht mit `pkill -f "<Befehl>"`: Das Muster trifft
  auch die eigene Shell, deren Befehlszeile denselben Text enthält.
