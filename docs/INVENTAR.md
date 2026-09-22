# Inventar der Anwendung

Stand: Analyse des Quellcodes in diesem Repository (Zweig
`claude/planlauf-management-app-5jn9sa`). Es sind ausschließlich Sachverhalte
aufgeführt, die sich im Code belegen lassen; Dateipfade verweisen auf die
jeweilige Fundstelle.

## 1. Zweck der Anwendung

**MC Plan – Planlaufmanagement** verwaltet die Planläufe von Bauprojekten: Zu
jedem Plan bzw. Planverzeichnis wird ein Workflow (Prozesskette) gestartet,
dessen Schritte Soll-Termine, eine zuständige Funktion und eine Person tragen
(`src/domain/engine.ts`, `src/domain/types.ts`). Die Anwendung rechnet aus den
Fristen je Schritt die Soll-Termine, überwacht sie mit einer Ampel (im Plan /
fällig / überfällig) und bereitet Erinnerungen als E-Mail für Outlook vor
(`ampelFuerSchritt`, `src/components/EmailDialog.tsx`). Sie läuft vollständig im
Browser: Der gesamte Bestand liegt in `localStorage`, ein Server wird nicht
angesprochen (`src/store/storage.ts`).

## 2. Routen und Seiten

Adressiert wird über einen Hash-Router ohne Bibliothek
(`src/lib/router.ts`). Unbekannte Adressen führen auf die Übersicht.

### 2.1 Hauptrouten

| Route | Seite | Aktionen |
| --- | --- | --- |
| `#/` bzw. `#/dashboard` | Übersicht (`src/pages/Dashboard.tsx`) | Vier Kacheln: Laufende Planläufe, To-Dos (Planlaufmanagement), Überfällige Schritte, Demnächst fällig – die beiden letzten führen per Klick auf `#/fristen`. Tabelle „Meine To-Dos“ mit Schritt, Gewerk, Projekt, Soll-Termin, Status, Erinnerungs-Mail und Erledigt-Haken. Tabelle „Projekte“ mit Anzahl Pläne/Verzeichnisse, laufenden Planläufen, demnächst fällig, überfällig, Fortschrittsbalken und „Projekt öffnen“. Angezeigt werden markierte Projekte; ohne Markierung alle (`sichtbareProjekte`). |
| `#/fristen` | Fristen & Erinnerungen (`src/pages/Fristen.tsx`) | Alle offenen Schritte über alle Projekte, gegliedert nach Projekt. Filter Alle / Überfällig / Fällig / Im Plan mit Zählern, Suche über Schritt, Planlauf, Projekt, Funktion, Nachname und Firma. Je Zeile: Planlauf öffnen, Erinnerungs-Mail vorbereiten, Schritt als erledigt setzen. Kein Eintrag in der Seitenleiste – erreichbar über die Kacheln der Übersicht. |
| `#/projekte` | Projekte (`src/pages/Projekte.tsx`) | Projektliste mit Suche über Name, Nummer und Beschreibung; Projekt anlegen (übernimmt alle projektübergreifenden Funktionen als Projektfunktionen), bearbeiten, mit ★ markieren bzw. Markierung aufheben, Projekt öffnen. |
| `#/ketten` | Workflows (`src/pages/Workflows.tsx`) | Standard-Workflows und projektspezifische Ketten: neue Kette anlegen, Kette bearbeiten, duplizieren (wird zur manuellen Kette), löschen. Je Schritt: Bezeichnung, Art (Aufgabe / Entscheidung / Sonstiges), Verantwortlicher, Frist in Tagen, Nachweis bei Abschluss, „Weiter mit“, Antworten einer Entscheidung und die Option „E-Mail nach Abschluss“ samt Vorlage. |
| `#/rollen` | Funktionen (`src/pages/Funktionen.tsx`) | Projektübergreifende Funktionen, gegliedert in „Übergreifend“ und je Gewerk. Neue Funktion anlegen (Bezeichnung, Kürzel, Farbe, Gewerk, Beschreibung), vorhandene Funktion eines anderen Gewerks übernehmen, bearbeiten, löschen. Über das **+** an den Reitern entsteht ein Gewerk, über „Gewerk … löschen“ am Seitenende entfällt es. |
| `#/vorlagen` | Vorlagen (`src/pages/Vorlagen.tsx`) | Reiter **E-Mail-Texte**: Vorlagen anlegen, bearbeiten, löschen; Editor mit Bausteinen aus `PLATZHALTER` (`src/domain/email.ts`) und Vorschau mit Beispielwerten; Anlass je Vorlage (Erinnerung, Mahnung, Freigabe, Übergabe, Allgemein). Reiter **Excel-Vorlagen**: Vorlagen „Planliste“ und „Rollen & Funktionen“ als `.xlsx` herunterladen, mit Spaltenerläuterung. |
| `#/projekt/<id>/<reiter>` | Projektarbeitsbereich (`src/pages/ProjektDetail.tsx`) | Reiter siehe 2.2. Frühere Adressen werden umgeleitet: `planlaeufe` → `plaene`, `adressbuch` → `rollen`. |
| `#/projekt/<id>/planlauf/<runId>` | Planlauf (`src/pages/projekt/PlanlaufDetail.tsx`) | Siehe 2.3. |

### 2.2 Reiter im Projekt

| Reiter | Seite | Aktionen |
| --- | --- | --- |
| `uebersicht` | Projektübersicht (`src/pages/projekt/Uebersicht.tsx`) | Kennzahlen (Planpakete, Planverzeichnisse, Pläne, fällige und überfällige Schritte) und Gesamtfortschritt. Liste der Planläufe, gegliedert nach Planpaketen, je Eintrag mit dem offenen Schritt in der Spalte „Nächster Schritt“: Gliederung umschalten („Planpakete“ / „+ Pläne & Verzeichnisse“), Schalter „Untergeordnete Pläne anzeigen“, einzelne Pakete und Verzeichnisse auf- und zuklappen, Suche, Filter in den Spaltenüberschriften (Gewerk, Zuständig, Status – einschließlich „Angekündigt“), Sortierung je Spalte, Erinnerungs-Mail, Erledigt-Haken, Planlauf öffnen. Die Bezeichnung steht gelb, solange „Eingang PLM“ aussteht – diese Läufe tragen den Status „Angekündigt“ und lassen sich danach filtern und sortieren –, und grün, wenn der Lauf abgeschlossen ist. Abgebrochene Läufe stehen ausgegraut ohne Schritt, Fortschritt und Schaltflächen, mit „Abgebrochen am …“ und dem Zusatz *ersatzlos* bzw. *ersetzt durch Index …*. |
| `plaene` | Planliste (`src/pages/projekt/Plaene.tsx`) | Alle Pläne und Planverzeichnisse mit laufender Nummer, Art, Bezeichnung/Titel, Gewerk, zugehörigem Planverzeichnis, Planpaket und Eingang Soll. Filter (Alle / Pläne / Verzeichnisse), Suche, Sortierung je Spalte. Einträge, deren Planlauf noch beim Schritt „Eingang PLM“ steht, tragen eine gelbe Bezeichnung und das Kennzeichen „Angekündigt“; bei abgeschlossenen Läufen steht die Bezeichnung grün. Eintrag anlegen (startet zugleich den Planlauf), bearbeiten, löschen; Planverzeichnis oder Planpaket direkt aus den Auswahlfeldern neu anlegen; Excel-Import (`PlaeneImport.tsx`). Einträge, deren Lauf durch einen neuen Index ersetzt oder ersatzlos abgebrochen wurde, tragen einen grauen Zusatz. |
| `pakete` | Planpakete (`src/pages/projekt/Planpakete.tsx`) | Planpakete anlegen, bearbeiten, löschen; Inhalt aufklappen, Pläne und Planverzeichnisse zuordnen und wieder entfernen. Reines Ordnungsmerkmal ohne Einfluss auf Planläufe. |
| `rollen` | Rollen & Funktionen (`src/pages/projekt/RollenFunktionen.tsx`) | Nach Gewerken gegliedert („Übergreifend“ + je Gewerk, **+** für ein weiteres Gewerk, „Gewerk … löschen“ am Seitenende). Je Funktion die Besetzung mit einer Person samt Adressdaten: Funktion anlegen, bearbeiten, löschen; Besetzung setzen, wechseln, aufheben – von der Funktion aus (Person übernehmen oder neu erfassen) oder über „Person hinzufügen“ von der Person aus (Funktion optional gleich mitwählen). Suche über Funktion, Person und Firma; Personen ohne Funktion in einer eigenen Liste; Excel-Import (`RollenImport.tsx`), der fehlende Gewerke und Funktionen anlegt. |
| `ketten` | Workflows im Projekt (`src/pages/Workflows.tsx` mit `projectId`) | Wie der globale Bereich, zusätzlich mit den Projektvarianten dieses Projekts. |
| `einstellungen` | Einstellungen (`src/pages/projekt/Einstellungen.tsx`) | Projektdaten bearbeiten; Vorlaufzeit für Erinnerungen, Fristenrechnung in Arbeitstagen, Feiertage, Absendername und Absender-E-Mail pflegen; Hinweis auf die projektübergreifenden E-Mail-Texte; **Export** (`ExportDialog.tsx`): Auswahl der Einträge, Kurz- oder Langfassung, Ausgabe als Excel-Datei (`src/lib/xlsx.ts`) oder als PDF über den Druckdialog (`src/lib/print.ts`); Projekt löschen. |

### 2.3 Planlauf

`src/pages/projekt/PlanlaufDetail.tsx`: Kopf mit Stammdaten, Status und
Fortschritt, Verlaufskette und Schrittliste. Aktionen am jeweils anstehenden
Schritt: **Erledigt**, **Überspringen**, **Erinnern** (E-Mail vorbereiten);
abgeschlossene Schritte bieten **Wieder öffnen**, jede Zeile **Anpassen**
(Bezeichnung, Art, Funktion, zuständige Person, Frist, Soll-Termin, Status,
Bemerkung, Nachweis). Weiter: **Schritt einfügen**, Antwort einer Entscheidung
wählen, **Planlauf abbrechen** (ersatzlos oder mit neuem Index bzw. neuer
Ausgabe – dann startet ein Nachfolgelauf) und **Lauf löschen**. Ein
abgebrochener Lauf ist schreibgeschützt: `beendet = run.status !== 'laufend'`
blendet alle Schaltflächen aus. Verlangt ein Schritt einen Nachweis
(`Freigabe-Nr.` oder `Prüfbericht-Nr.`), wird die Nummer beim Erledigen
abgefragt (`src/components/SchrittStatus.tsx`).

### 2.4 Übergreifende Bedienelemente

* **Seitenleiste** (`src/App.tsx`): Navigation (Übersicht, Projekte, Workflows,
  Funktionen, Vorlagen), darunter die markierten Projekte mit vorangestellter
  Projektnummer und der Anzahl überfälliger Schritte.
* **Angemeldet als** (unten links): Name (Vorgabe `STANDARD_BEARBEITER =
  'Max Mustermann'`), Schalter „Nachfragen zulassen, wenn ein Workflow-Schritt
  eine E-Mail vorsieht“ und Schalter „Farbmodus für Rot-Grün-Sehschwäche
  (hoher Kontrast)“.
* **Sicherung**: lädt den gesamten Bestand als JSON herunter
  (`exportiereDaten`). **Zurücksetzen**: verwirft den Bestand und lädt die
  Demodaten (`zuruecksetzen` in `src/store/store.tsx`).
* **E-Mail-Dialog** (`src/components/EmailDialog.tsx`): Vorlage wählen, Betreff
  und Text bearbeiten, „In Outlook öffnen“ (mailto), „Outlook im Web“ oder „In
  die Zwischenablage“.

## 3. Nutzerrollen und Rechte

**Es gibt keine Anmeldung, keine Benutzerverwaltung und keine Rechteprüfung.**
Weder `src/App.tsx` noch der Store (`src/store/store.tsx`) prüfen irgendeine
Berechtigung; jede Person, die die Anwendung im Browser öffnet, kann alles
lesen und ändern. Der Bestand liegt ausschließlich im `localStorage` des
jeweiligen Browsers, wird also ohnehin nicht geteilt.

Der Begriff „Rolle“ hat im Code zwei rein fachliche Bedeutungen:

1. **Bearbeiter** (`Bearbeiter` in `src/domain/types.ts`): Name,
   `mailNachfrage` und `farbmodus`. Die Funktion der angemeldeten Person ist
   stets `EIGENE_ROLLE = 'Planlaufmanagement'`; Schritte dieser Funktion gelten
   als eigene To-Dos (`eigeneTodos` in `src/domain/engine.ts`). In jedem
   markierten Projekt wird die Person automatisch unter „Rollen & Funktionen“
   geführt und besetzt dort das Planlaufmanagement (`eigeneKontakteSichern`).
   Rechte verleiht das nicht.
2. **Funktionen** (`StandardRolle` projektübergreifend, `Role` je Projekt):
   fachliche Zuständigkeiten, die Prozessschritten zugeordnet und im Projekt mit
   Personen besetzt werden (`kontaktFuerRolleUndGewerk`). Mitgeliefert werden 15
   Funktionen (`src/domain/seed.ts`), davon zwei übergreifend
   (Planlaufmanagement, Projektleitung) und dreizehn je Gewerk (Fachplaner,
   Fachspezialist, Bauvorlageberechtiger, Bau AN, Bauüberwachung,
   Fachtechnischer Prüfer, Prüfstatiker, Vermessungsprüfer, Erdungsprüfer,
   Schweißtechnischer Prüfer, Korrosionsschutzprüfer, Gleisgeometrie Prüfer,
   Geotechnischer Prüfer) für die mitgelieferten Gewerke EEA, KIB, LST, OLA,
   OSE, TK und VA. Gewerke und Funktionen lassen sich ergänzen und löschen.

Die Besetzung wirkt sofort: `zustaendigkeitenNachziehen` (`src/domain/engine.ts`)
setzt in laufenden Planläufen die zuständige Person aus der aktuellen Besetzung
– außer bei erledigten Schritten und bei von Hand gewählten Personen
(`contactManuell`).

## 4. Umgebungsvariablen

**Eine `.env.example` existiert in diesem Repository nicht**, ebenso wenig eine
`.env`-Datei oder ein Zugriff auf `process.env` im Anwendungscode. Die
Anwendung benötigt keine Umgebungsvariablen – es gibt keinen Server, keine
Datenbank und keine API-Schlüssel.

Verwendet werden ausschließlich die von Vite bereitgestellten Werte:

| Variable | Bedeutung | Pflicht |
| --- | --- | --- |
| `import.meta.env.BASE_URL` | Basispfad der Auslieferung; wird für den Pfad des Hauslogos verwendet (`src/components/logos.tsx`). Vite setzt ihn aus `base: './'` in `vite.config.ts`. | von Vite gesetzt, keine eigene Pflege |
| `import.meta.env.PROD` | Nur im Produktionsbuild wird der Service Worker registriert (`src/lib/pwa.ts`). | von Vite gesetzt, keine eigene Pflege |

## 5. Setup von Null bis zur laufenden Anwendung

1. **Voraussetzungen**: Node.js (die Veröffentlichung nutzt Node 22, siehe
   `.github/workflows/pages.yml`) und npm. Weitere Werkzeuge sind nicht nötig.
2. **Abhängigkeiten installieren**: `npm install` (bzw. `npm ci` bei
   vorhandener `package-lock.json`). Laufzeitabhängigkeiten sind nur `react`
   und `react-dom`; Vite, TypeScript und die Typpakete sind Entwicklungs-
   abhängigkeiten (`package.json`).
3. **Datenbank**: entfällt. Es gibt keine Datenbank, keinen Server und keine
   Migrationsskripte. Der Bestand liegt unter dem Schlüssel
   `planlauf-management.data.v1` im `localStorage`
   (`src/store/storage.ts`).
4. **Migrationen**: laufen automatisch beim Laden. `DATEN_VERSION = 11` und
   `STAMMDATEN_VERSION = 4` (`src/domain/types.ts`) steuern, ob `migriere()`
   einen älteren Bestand auf die aktuelle Struktur hebt und ob neue Stammdaten
   (Funktionen, Standard-Workflows) übernommen werden. Ohne gespeicherten
   Bestand werden die Demodaten aus `src/domain/seed.ts` geladen.
5. **Entwicklung starten**: `npm run dev` – Vite startet auf Port 5173 und ist
   im Netz erreichbar (`server: { port: 5173, host: true }`).
6. **Prüfen und bauen**: `npm run typecheck` (`tsc --noEmit`) und `npm run
   build` (`tsc -b && vite build`, Ergebnis in `dist/`). `npm run preview`
   liefert den Build lokal aus.
7. **Veröffentlichen**: Der Workflow `.github/workflows/pages.yml` baut bei
   jedem Push auf `main` bzw. den Entwicklungszweig und stellt `dist/` über
   GitHub Pages bereit; zusätzlich wird die gebaute Fassung im Zweig unter
   `app/` abgelegt. Wegen `base: './'` funktioniert die Anwendung auch in
   einem Unterverzeichnis.

## 6. Bekannte Meldungen und ihre Ursachen

### Eingabeprüfungen (als Hinweis eingeblendet)

| Meldung | Fundstelle | Ursache |
| --- | --- | --- |
| „Bitte einen Projektnamen angeben.“ | `src/pages/Projekte.tsx` | Projektname leer. |
| „Bitte einen Titel angeben.“ | `src/pages/projekt/Plaene.tsx` | Titel eines Plans / Planverzeichnisses leer. |
| „Bitte einen Namen für das Planpaket angeben.“ | `src/pages/projekt/Planpakete.tsx` | Name des Planpakets leer. |
| „Bitte die … angeben.“ / „Bitte … angeben.“ | `src/pages/projekt/Plaene.tsx`, `PlanlaufDetail.tsx` | Pflichtfeld einer Schnellanlage bzw. der neue Index beim Abbruch fehlt. |
| „Bitte einen Nachnamen angeben.“ | `src/pages/projekt/RollenFunktionen.tsx` | Besetzung ohne Nachname gespeichert. |
| „Bitte eine Bezeichnung angeben.“ | `Funktionen.tsx`, `RollenFunktionen.tsx`, `GewerkDialog.tsx` | Funktion oder Gewerk ohne Bezeichnung. |
| „„…“ ist bereits angelegt.“ | `src/components/GewerkDialog.tsx` | Gewerk mit diesem Namen existiert schon. |
| „Bitte einen Namen angeben.“ / „Bitte jeden Schritt benennen.“ | `src/pages/Workflows.tsx` | Workflow ohne Namen bzw. Schritt ohne Bezeichnung. |
| „Bitte jeden Schritt der Workflow benennen.“ | `src/pages/projekt/Plaene.tsx` | Beim Start eines Planlaufs ist ein Schritt unbenannt. |
| „Bitte einen Grund angeben.“ | `src/pages/projekt/PlanlaufDetail.tsx` | Abbruch ohne Begründung. |
| „Bitte mindestens einen Eintrag auswählen.“ | `src/pages/projekt/ExportDialog.tsx` | Export ohne Auswahl. |

### Import aus Excel/CSV

| Meldung | Ursache |
| --- | --- |
| „Die Datei enthält keine Datenzeilen.“ | Die Tabelle hat nur eine Kopfzeile oder ist leer (`PlaeneImport.tsx`, `RollenImport.tsx`). |
| „Weder ‚Plancodierung‘ noch ‚Titel‘ gefunden. Gelesene Überschriften: …“ | Die Kopfzeile der Planliste enthält keine der erkannten Schreibweisen (`PLAN_SPALTEN` in `src/domain/importVorlagen.ts`). |
| „Die Spalte ‚Name‘ wurde nicht gefunden. Gelesene Überschriften: …“ | Dasselbe für die Rollenliste (`ROLLEN_SPALTEN`). |
| „Die Datei ist keine gültige Excel-Datei (ZIP-Ende fehlt).“ | `src/lib/xlsxLesen.ts`: Die Datei ist kein ZIP – etwa eine alte `.xls`-Datei. |
| „Die Datei verwendet ein nicht unterstütztes Packverfahren.“ | Der ZIP-Eintrag ist nicht „deflate“ (`methode !== 8`). |
| „Dieser Browser kann keine Excel-Dateien entpacken – bitte die Liste als CSV speichern.“ | `DecompressionStream` fehlt im Browser. |
| „Die Datei konnte nicht gelesen werden.“ | Auffangmeldung für alle übrigen Lesefehler. |
| Hinweise je Zeile: „Eintrag mit dieser Bezeichnung ist bereits vorhanden“, „Planpaket ‚…‘ wird angelegt“, „Workflow ‚…‘ ist nicht hinterlegt“, „Gewerk ‚…‘ wird angelegt“, „Funktion ‚…‘ wird angelegt“, „ersetzt … in dieser Funktion“ | Kein Fehler: Die Vorschau nennt, was beim Übernehmen geschieht. |

### Laufzeit und Technik

| Meldung | Ursache |
| --- | --- |
| „Kopieren nicht möglich – bitte Text manuell markieren.“ | `navigator.clipboard.writeText` wurde abgelehnt (fehlende Berechtigung oder unsicherer Kontext), `src/components/EmailDialog.tsx`. |
| „Druckdialog geöffnet – dort ‚Als PDF sichern‘ wählen.“ | Kein Fehler: Der PDF-Export läuft über den Druckdialog des Browsers (`src/lib/print.ts`). |
| Konsole: „Daten konnten nicht lokal gespeichert werden: …“ | `localStorage.setItem` schlug fehl – Speicher voll oder gesperrt (privates Fenster), `src/store/storage.ts`. |
| Konsole: „Service Worker konnte nicht registriert werden: …“ | Registrierung abgelehnt, etwa ohne HTTPS (`src/lib/pwa.ts`). Die Anwendung läuft weiter, nur der Offline-Betrieb entfällt. |
| Ausnahme: „useStore muss innerhalb des StoreProvider verwendet werden.“ | Entwicklungsfehler: Eine Komponente nutzt `useStore` außerhalb von `StoreProvider` (`src/store/store.tsx`). |
| Seite „Nicht gefunden – Der aufgerufene Eintrag existiert nicht (mehr).“ | Die Adresse nennt ein Projekt oder einen Planlauf, den es nicht (mehr) gibt (`src/App.tsx`). |
| Ein alter Stand erscheint nach einer Aktualisierung | Der Service Worker liefert aus dem Cache `mc-plan-v2` (`public/sw.js`); erst ein neuer Cache-Name bzw. das Abmelden des Service Workers zeigt die neue Fassung. |
