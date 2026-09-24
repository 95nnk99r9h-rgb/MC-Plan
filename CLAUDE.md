# MC Plan – Hinweise für die Arbeit am Code

MC Plan ist eine React-/Vite-Anwendung ohne Server; alle Daten liegen im `localStorage` des
Browsers. Sie besteht aus zwei getrennten Bereichen: **Planlaufmanagement** (`src/bereiche/planlauf/`)
und **Baubetriebsplanung** (`src/bereiche/baubetrieb/`, noch Platzhalter). Überblick über Aufbau und
Funktionen: `README.md`; belegtes Inventar aller Routen, Aktionen und Meldungen: `docs/INVENTAR.md`.

## Nach jeder Änderung nachziehen

Eine Änderung ist erst fertig, wenn alle betroffenen Dateien zum Code passen:

1. **`README.md`** – Funktionsbeschreibung, Aufbau des Codes, Veröffentlichen.
2. **`docs/INVENTAR.md`** – nur Aussagen, die sich im Code belegen lassen. Vor dem Commit prüfen,
   dass jeder genannte Pfad existiert und jeder zitierte Oberflächentext wörtlich im Code steht.
3. **Weitere relevante Dateien**, insbesondere:
   * Code-Kommentare, die das geänderte Verhalten beschreiben,
   * der Hinweistext in `index.html` (erscheint, wenn der Quellcode statt des Builds ausgeliefert wird),
   * `public/sw.js`: Cache-Namen hochzählen, wenn sich die Hülle ändert (Titel, Symbole, Manifest),
   * **`app/`**: der eingecheckte Build, den GitHub Pages ausliefert (siehe unten).

Funktion und Dokumentation werden in getrennten Commits festgehalten.

## Prüfen und bauen

```bash
npm run typecheck
npm run build
rm -rf app && cp -r dist app   # nach jeder Änderung an src/, index.html oder public/
```

Es gibt **keinen** GitHub-Actions-Workflow. GitHub Pages liefert den Zweig mit „Deploy from a
branch“ aus; die Wurzel-`index.html` springt auf `app/`. Ohne neu gebautes `app/` zeigt Pages den
alten Stand.

## Randbedingungen

* `src/shared/` enthält nur Bausteine ohne fachlichen Bezug und importiert nichts aus
  `src/bereiche/`. Die Bereiche greifen nicht aufeinander zu.
* Der localStorage-Schlüssel `planlauf-management.data.v1` bleibt unverändert; neue Felder am
  Datenmodell sind optional oder werden in `migriere()` (`store/storage.ts`) nachgetragen.
* `window.planlaufGestartet` nicht umbenennen – `index.html` und `app/index.html` rufen ihn auf.
* Ob ein Eintrag einen eigenen Planlauf hat, entscheidet allein `hatEigenenPlanlauf`
  (`domain/types.ts`): Planverzeichnisse laufen gebündelt oder mit Plänen einzeln, Pläne lassen
  sich herauslösen und wieder bündeln.
* Sprache in Oberfläche, Kommentaren und Commit-Nachrichten ist Deutsch.

## Hinweise für Prüfungen im Browser

* Der aktuelle Schritt eines Laufs folgt dem Workflow-Pfad (`aktuellerSchritt`), nicht der
  Reihenfolge im Array. Wer Testdaten vorbereitet, muss den Schritt auf dem Pfad ändern.
* Nach dem Schreiben in den `localStorage` die Seite neu laden (`reload`) – ein Wechsel nur im
  Hash lädt nicht neu, und der laufende Store überschreibt die Änderung.
* Hilfsserver über ihre Prozessnummer beenden, nicht mit `pkill -f "<Befehl>"`: Das Muster trifft
  auch die eigene Shell, deren Befehlszeile denselben Text enthält.
