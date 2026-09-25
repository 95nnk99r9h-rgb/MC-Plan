# Inventar der Anwendung

Stand: Analyse des Quellcodes im Repository `Mailander-Consult-GmbH/MC-Plan`
(Zweig `main`). Es sind ausschließlich Sachverhalte
aufgeführt, die sich im Code belegen lassen; Dateipfade verweisen auf die
jeweilige Fundstelle.

## 1. Zweck der Anwendung

**MC Plan** besteht aus den Bereichen **Planlaufmanagement** und
**Baubetriebsplanung**; letzterer ist angelegt, aber noch ohne Inhalt. Dieses
Inventar beschreibt das Planlaufmanagement.

Der Bereich verwaltet die Planläufe von Bauprojekten: Zu
jedem Plan bzw. Planverzeichnis wird ein Workflow (Prozesskette) gestartet,
dessen Schritte Soll-Termine, eine zuständige Funktion und eine Person tragen
(`src/bereiche/planlauf/domain/engine.ts`, `src/bereiche/planlauf/domain/types.ts`).
Ein Planverzeichnis durchläuft den Planlauf entweder **gebündelt** – das
Verzeichnis hat den Lauf, seine Pläne laufen mit – oder mit **Plänen einzeln**,
dann hat jeder Plan einen eigenen Lauf und das Verzeichnis ordnet nur
(`planlaufModus`; ohne Angabe gilt gebündelt). Einzelne Pläne eines
gebündelten Verzeichnisses lassen sich nachträglich herauslösen
(`eigenerLauf`), Pläne mit eigenem Lauf wieder bündeln (`planeBuendeln`). Welcher Eintrag einen eigenen Lauf hat, entscheidet allein
`hatEigenenPlanlauf` in `types.ts`. Die Anwendung rechnet aus den
Fristen je Schritt die Soll-Termine, überwacht sie mit einer Ampel (im Plan /
fällig / überfällig) und bereitet Erinnerungen als E-Mail für Outlook vor
(`ampelFuerSchritt`, `src/bereiche/planlauf/components/EmailDialog.tsx`). Sie läuft vollständig im
Browser: Der gesamte Bestand liegt in `localStorage`, ein Server wird nicht
angesprochen (`src/bereiche/planlauf/store/storage.ts`).

## 2. Routen und Seiten

Die Anwendung besteht aus zwei getrennten Bereichen. Die erste Wegmarke der
Adresse benennt den Bereich; die Shell (`src/shell/router.ts`) wählt danach
aus, welcher Bereich geladen wird: `#/` zeigt die Bereichsauswahl
(`src/shell/Start.tsx`: zwei hochkante Kacheln, links Planlaufmanagement,
rechts Baubetriebsplanung mit dem Kennzeichen „In Vorbereitung“),
`#/planlauf/…` das Planlaufmanagement, `#/baubetrieb` die noch leere
Baubetriebsplanung. Innerhalb des Bereichs adressiert ein Hash-Router ohne
Bibliothek (`src/bereiche/planlauf/lib/router.ts`); unbekannte Adressen führen
auf die Übersicht. Adressen aus der Fassung ohne Bereiche (`#/dashboard`,
`#/projekt/<id>/<reiter>` …) werden beim Aufruf auf `#/planlauf/…` umgelenkt
und bleiben damit als Lesezeichen gültig.

### 2.1 Hauptrouten

| Route | Seite | Aktionen |
| --- | --- | --- |
| `#/planlauf` bzw. `#/planlauf/dashboard` | Übersicht (`src/bereiche/planlauf/pages/Dashboard.tsx`) | Vier Kacheln: Laufende Planläufe, To-Dos (Planlaufmanagement), Überfällige Schritte, Demnächst fällig – die beiden letzten führen per Klick auf `#/planlauf/fristen`. Tabelle „Meine To-Dos“ mit Schritt, Gewerk, Projekt, Soll-Termin, Status, Erinnerungs-Mail und Erledigt-Haken. Tabelle „Projekte“ mit Anzahl Pläne/Verzeichnisse, laufenden Planläufen, demnächst fällig, überfällig, Fortschrittsbalken und „Projekt öffnen“. Angezeigt werden markierte Projekte; ohne Markierung alle (`sichtbareProjekte`). |
| `#/planlauf/fristen` | Fristen & Erinnerungen (`src/bereiche/planlauf/pages/Fristen.tsx`) | Alle offenen Schritte über alle Projekte, gegliedert nach Projekt. Filter Alle / Überfällig / Fällig / Im Plan mit Zählern, Suche über Schritt, Planlauf, Projekt, Funktion, Nachname und Firma. Je Zeile: Planlauf öffnen, Erinnerungs-Mail vorbereiten, Schritt als erledigt setzen. Kein Eintrag in der Seitenleiste – erreichbar über die Kacheln der Übersicht und auf dem Telefon über die untere Navigationsleiste. |
| `#/planlauf/projekte` | Projekte (`src/bereiche/planlauf/pages/Projekte.tsx`) | Projektliste mit Suche über Name, Nummer und Beschreibung; Projekt anlegen (übernimmt alle projektübergreifenden Funktionen als Projektfunktionen), bearbeiten, mit ★ markieren bzw. Markierung aufheben, Projekt öffnen. |
| `#/planlauf/ketten` | Workflows (`src/bereiche/planlauf/pages/Workflows.tsx`) | Standard-Workflows und projektspezifische Ketten: neue Kette anlegen, Kette bearbeiten, duplizieren (wird zur manuellen Kette), löschen. Je Schritt: Bezeichnung, Art (Aufgabe / Entscheidung / Sonstiges), Verantwortlicher (Vorschlagsliste der Funktionen, je Bezeichnung einmal), Frist in Tagen, Nachweis bei Abschluss, „Weiter mit“, Antworten einer Entscheidung und die Option „E-Mail nach Abschluss“ samt Vorlage. „Weiter mit“ und die Antwortziele nennen die Nummer des Zielschritts im Workflow (`ziele` in `SchrittListe`). |
| `#/planlauf/rollen` | Funktionen (`src/bereiche/planlauf/pages/Funktionen.tsx`) | Projektübergreifende Funktionen, gegliedert in „Übergreifend“ und je Gewerk. Neue Funktion anlegen (Bezeichnung, Kürzel, Farbe, Gewerk, Beschreibung), vorhandene Funktion eines anderen Gewerks übernehmen, bearbeiten, löschen. Über das **+** an den Reitern entsteht ein Gewerk, über „Gewerk … löschen“ am Seitenende entfällt es. |
| `#/planlauf/vorlagen` | Vorlagen (`src/bereiche/planlauf/pages/Vorlagen.tsx`) | Reiter **E-Mail-Texte**: Vorlagen anlegen, bearbeiten, löschen; Editor mit Bausteinen aus `PLATZHALTER` (`src/bereiche/planlauf/domain/email.ts`) und Vorschau mit Beispielwerten; Anlass je Vorlage (Erinnerung, Mahnung, Freigabe, Übergabe, Allgemein). Reiter **Excel-Vorlagen**: Vorlagen „Planliste“ und „Rollen & Funktionen“ als `.xlsx` herunterladen, mit Spaltenerläuterung. |
| `#/planlauf/projekt/<id>/<reiter>` | Projektarbeitsbereich (`src/bereiche/planlauf/pages/ProjektDetail.tsx`) | Reiter siehe 2.2. Frühere Adressen werden umgeleitet: `planlaeufe` → `plaene`, `adressbuch` → `rollen`. |
| `#/planlauf/projekt/<id>/planlauf/<runId>` | Planlauf (`src/bereiche/planlauf/pages/projekt/PlanlaufDetail.tsx`) | Siehe 2.3. |

### 2.2 Reiter im Projekt

| Reiter | Seite | Aktionen |
| --- | --- | --- |
| `uebersicht` | Projektübersicht (`src/bereiche/planlauf/pages/projekt/Uebersicht.tsx`, Liste in `src/bereiche/planlauf/components/PlanlaufListe.tsx`) | Kennzahlen (Planpakete, Planverzeichnisse, Pläne, fällige und überfällige Schritte) und Gesamtfortschritt. Liste der Planläufe, gegliedert nach Planpaketen, je Eintrag mit dem offenen Schritt in der Spalte „Nächster Schritt“: Gliederung umschalten („Planpakete“ / „+ Pläne & Verzeichnisse“), Pakete und Planverzeichnisse am Pfeil auf- und zuklappen (Verzeichnisse zunächst zugeklappt; der Pfeil steht vor Symbol und Titel, sodass Pläne und Verzeichnisse auf einer Linie beginnen), Suche, Filter in den Spaltenüberschriften (Gewerk, Zuständig, Status – einschließlich „Angekündigt“), Sortierung je Spalte, Erinnerungs-Mail, Erledigt-Haken, Planlauf öffnen. Die Bezeichnung steht gelb, solange „Eingang PLM“ aussteht – diese Läufe tragen den Status „Angekündigt“, ist der Eingang überfällig jedoch „Überfällig“; Filter und Sortierung folgen derselben Regel –, und grün, wenn der Lauf abgeschlossen ist. Unter einem gebündelten Verzeichnis stehen seine Pläne mit „läuft im Planlauf des Verzeichnisses mit“ – solange der Verzeichnislauf läuft, mit der Schaltfläche „Herauslösen …“ (`planHerausloesen`; die Liste bleibt danach stehen) –, herausgelöste Pläne dagegen mit ihrem eigenen Schritt und Status. Ein Verzeichnis mit Plänen einzeln erscheint als Zeile „… · Pläne einzeln“ ohne eigenen Lauf, mit der Zahl seiner laufenden Pläne, dem aus ihnen zusammengefassten Fortschritt und Status (wie ein Planpaket) und der Schaltfläche „Bündeln …“; seine Pläne stehen darunter. Abgebrochene Läufe – ersatzlos wie durch neuen Index ersetzt – stehen gesammelt am Ende unter der zunächst zugeklappten Zeile „Abgebrochen · … Planläufe“, ausgegraut ohne Schritt, Fortschritt und Schaltflächen, mit dem Index des abgebrochenen Laufs, „Abgebrochen am …“ und dem Zusatz *ersatzlos* bzw. *ersetzt durch Index …*. Aufgeteilte bzw. wieder gebündelte Läufe erscheinen dort nicht (`laufUeberfuehrt` in `engine.ts`). Fortschrittsbalken stehen immer in der Hausfarbe. |
| `plaene` | Planliste (`src/bereiche/planlauf/pages/projekt/Plaene.tsx`) | Alle Pläne und Planverzeichnisse mit laufender Nummer, Art, Bezeichnung/Titel, Gewerk, zugehörigem Planverzeichnis, Planpaket und Eingang Soll. Pläne eines Planverzeichnisses stehen unter ihm, mit Symbol, Art und Titel eingerückt; der Pfeil zum Auf- und Zuklappen steht zwischen Nummer und Symbol (zunächst aufgeklappt). Ist das Verzeichnis ausgefiltert, stehen seine Pläne für sich. Filter (Alle / Pläne / Verzeichnisse), Suche, Sortierung je Spalte. Einträge, deren Planlauf noch beim Schritt „Eingang PLM“ steht, tragen eine gelbe Bezeichnung und das Kennzeichen „Angekündigt“; bei abgeschlossenen Läufen steht die Bezeichnung grün. Kennzeichen „Pläne einzeln“ an Verzeichnissen mit Einzelläufen, „eigener Lauf“ an herausgelösten Plänen eines gebündelten Verzeichnisses. Eintrag anlegen (startet zugleich den Planlauf, sofern der Eintrag einen eigenen hat), bearbeiten, löschen; Planverzeichnis oder Planpaket direkt aus den Auswahlfeldern neu anlegen; Excel-Import (`PlaeneImport.tsx`). Einträge, deren Lauf durch einen neuen Index ersetzt oder ersatzlos abgebrochen wurde, tragen einen grauen Zusatz; aufgeteilte bzw. wieder gebündelte Läufe zählen nicht als Abbruch. Im Dialog eines Planverzeichnisses: Haken „Pläne einzeln durch den Planlauf führen“ – frei wählbar, solange weder das Verzeichnis noch seine Pläne einen Lauf haben – und bei laufendem gebündeltem Lauf „Alle Pläne einzeln weiterführen …“ (`verzeichnisAufteilen`). Im Dialog eines mitlaufenden Plans: „Aus dem Verzeichnislauf herauslösen …“ (`planHerausloesen`). Haben Pläne des Verzeichnisses einen eigenen Lauf, bietet der Verzeichnis-Dialog „Pläne wieder bündeln …“: Der Dialog (`src/bereiche/planlauf/components/BuendelnDialog.tsx`) listet diese Pläne mit Haken, aktuellem Schritt und Fortschritt; die angekreuzten kehren in einen gemeinsamen Verzeichnislauf zurück (`planeBuendeln`), ihre eigenen Läufe enden mit der Abbruchart `gebuendelt`, nicht angekreuzte behalten ihren Lauf. Läuft das Verzeichnis noch, übernehmen sie dessen Stand – ein Plan, der weiter ist, wird mit „weiter als das Verzeichnis – fällt zurück“ gekennzeichnet. Ist es aufgeteilt, entsteht ein neuer Verzeichnislauf; sein Stand wird unter „Stand des Verzeichnislaufs übernehmen von“ gewählt, vorgeschlagen ist der am wenigsten weit gediehene Plan. In beiden Fällen übernimmt der Plan den Stand des Verzeichnislaufs – erledigte Schritte bleiben erledigt, Start und Termine laufen weiter (`laufUebernehmen` in `engine.ts`); der gebündelte Lauf endet beim Aufteilen mit der Abbruchart `aufgeteilt`. Ein Plan, der schon einen eigenen Lauf hat, behält ihn beim Verschieben in ein anderes Verzeichnis. |
| `pakete` | Planpakete (`src/bereiche/planlauf/pages/projekt/Planpakete.tsx`) | Planpakete anlegen, bearbeiten, löschen; Inhalt aufklappen, Pläne und Planverzeichnisse zuordnen und wieder entfernen. Reines Ordnungsmerkmal ohne Einfluss auf Planläufe. |
| `rollen` | Rollen & Funktionen (`src/bereiche/planlauf/pages/projekt/RollenFunktionen.tsx`) | Nach Gewerken gegliedert („Übergreifend“ + je Gewerk, **+** für ein weiteres Gewerk, „Gewerk … löschen“ am Seitenende). Je Funktion die Besetzung mit einer Person samt Adressdaten: Funktion anlegen, bearbeiten, löschen; Besetzung setzen, wechseln, aufheben – von der Funktion aus (Person übernehmen oder neu erfassen) oder über „Person hinzufügen“ von der Person aus (Funktion optional gleich mitwählen). Suche über Funktion, Person und Firma; Personen ohne Funktion in einer eigenen Liste; Excel-Import (`RollenImport.tsx`), der fehlende Gewerke und Funktionen anlegt. |
| `ketten` | Workflows im Projekt (`src/bereiche/planlauf/pages/Workflows.tsx` mit `projectId`) | Wie der globale Bereich, zusätzlich mit den Projektvarianten dieses Projekts. |
| `einstellungen` | Einstellungen (`src/bereiche/planlauf/pages/projekt/Einstellungen.tsx`) | Projektdaten bearbeiten; Vorlaufzeit für Erinnerungen, Fristenrechnung in Arbeitstagen, Feiertage, Absendername und Absender-E-Mail pflegen; Hinweis auf die projektübergreifenden E-Mail-Texte; **Export** (`ExportDialog.tsx`): Auswahl der Einträge, Kurz- oder Langfassung, Ausgabe als Excel-Datei (`src/shared/xlsx.ts`) oder als PDF über den Druckdialog (`src/shared/print.ts`); Projekt löschen. |

### 2.3 Planlauf

`src/bereiche/planlauf/pages/projekt/PlanlaufDetail.tsx`: Kopf mit Stammdaten, Status und
Fortschritt, Verlaufskette und Schrittliste. Aktionen am jeweils anstehenden
Schritt: **Erledigt**, **Überspringen**, **Erinnern** (E-Mail vorbereiten);
abgeschlossene Schritte bieten **Wieder öffnen**, jede Zeile **Anpassen**
(Bezeichnung, Art, Funktion, zuständige Person, Frist, Soll-Termin, Status,
Bemerkung, Nachweis). Zur Wahl der Funktion stehen die Funktionen des Gewerks
des Eintrags und die übergreifenden, je Bezeichnung einmal
(`funktionenFuerGewerk` in `engine.ts`); eine bereits gesetzte Funktion bleibt
wählbar. Beim Lauf eines Planverzeichnisses steht unter dem Kopf die Karte
**Pläne dieses Verzeichnisses**, zunächst zugeklappt, mit der Zahl der
mitlaufenden Pläne und der Pläne mit eigenem Lauf. Läuft der gebündelte Lauf,
bietet sie **Alle Pläne einzeln weiterführen …** (`verzeichnisAufteilen`) und
je mitlaufendem Plan **Herauslösen …** (`planHerausloesen`); Pläne mit eigenem
Lauf haben **Planlauf öffnen**. Gibt es solche Pläne, steht dort auch **Pläne
wieder bündeln …** – ebenso auf der Seite eines bereits aufgeteilten Laufs;
entsteht dabei ein neuer Verzeichnislauf, öffnet die Seite ihn. Ein
aufgeteilter Lauf zeigt statt der roten Abbruchmeldung den Hinweis „In
Einzelläufe der Pläne aufgeteilt am …“, der eigene Lauf eines wieder
gebündelten Plans „Wieder im Planlauf des Verzeichnisses gebündelt am …“.
Weiter: **Schritt einfügen**, Antwort einer Entscheidung
wählen, **Planlauf abbrechen** (ersatzlos oder mit neuem Index bzw. neuer
Ausgabe – dann startet ein Nachfolgelauf) und **Lauf löschen**. Ein
abgebrochener Lauf ist schreibgeschützt: `beendet = run.status !== 'laufend'`
blendet alle Schaltflächen aus. Verlangt ein Schritt einen Nachweis
(`Freigabe-Nr.` oder `Prüfbericht-Nr.`), wird die Nummer beim Erledigen
abgefragt (`src/bereiche/planlauf/components/SchrittStatus.tsx`).

### 2.4 Übergreifende Bedienelemente

* **Kopfzeile** (`src/bereiche/planlauf/App.tsx`, `kopfzeile`): Pfad zur aktuellen Seite
  (z.B. Planlaufmanagement / Projekte / Projektname), dessen vordere Teile anklickbar sind; der
  Seitentitel steht mit Überzeile und Untertitel groß am Anfang des Inhalts.
* **Navigationsleiste unten** (nur Telefonbreite, `MobilItem` in `App.tsx`): Übersicht, Projekte,
  Fristen und „Mehr“, das die Seitenleiste öffnet.
* **Seitenleiste** (`src/bereiche/planlauf/App.tsx`): Navigation unter „Planlaufmanagement“ (Übersicht, Projekte, Workflows,
  Funktionen, Vorlagen), darunter die markierten Projekte mit vorangestellter
  Projektnummer und der Anzahl überfälliger Schritte. Ganz unten
  **Bereich wechseln** zurück zur Bereichsauswahl
  (`src/shell/BereichWechsel.tsx`).
* **Angemeldet als** (unten links): Name (Vorgabe `STANDARD_BEARBEITER =
  'Max Mustermann'`), Schalter „Nachfragen zulassen, wenn ein Workflow-Schritt
  eine E-Mail vorsieht“ und Schalter „Farbmodus für Rot-Grün-Sehschwäche
  (hoher Kontrast)“.
* **Sicherung**: lädt den gesamten Bestand als JSON herunter
  (`exportiereDaten`). **Zurücksetzen**: verwirft den Bestand und lädt die
  Demodaten (`zuruecksetzen` in `src/bereiche/planlauf/store/store.tsx`).
* **E-Mail-Dialog** (`src/bereiche/planlauf/components/EmailDialog.tsx`): Vorlage wählen, Betreff
  und Text bearbeiten, „In Outlook öffnen“ (mailto), „Outlook im Web“ oder „In
  die Zwischenablage“.

## 3. Nutzerrollen und Rechte

**Es gibt keine Anmeldung, keine Benutzerverwaltung und keine Rechteprüfung.**
Weder `src/bereiche/planlauf/App.tsx` noch der Store (`src/bereiche/planlauf/store/store.tsx`) prüfen irgendeine
Berechtigung; jede Person, die die Anwendung im Browser öffnet, kann alles
lesen und ändern. Der Bestand liegt ausschließlich im `localStorage` des
jeweiligen Browsers, wird also ohnehin nicht geteilt.

Der Begriff „Rolle“ hat im Code zwei rein fachliche Bedeutungen:

1. **Bearbeiter** (`Bearbeiter` in `src/bereiche/planlauf/domain/types.ts`): Name,
   `mailNachfrage` und `farbmodus`. Die Funktion der angemeldeten Person ist
   stets `EIGENE_ROLLE = 'Planlaufmanagement'`; Schritte dieser Funktion gelten
   als eigene To-Dos (`eigeneTodos` in `src/bereiche/planlauf/domain/engine.ts`). In jedem
   markierten Projekt wird die Person automatisch unter „Rollen & Funktionen“
   geführt und besetzt dort das Planlaufmanagement (`eigeneKontakteSichern`).
   Rechte verleiht das nicht.
2. **Funktionen** (`StandardRolle` projektübergreifend, `Role` je Projekt):
   fachliche Zuständigkeiten, die Prozessschritten zugeordnet und im Projekt mit
   Personen besetzt werden (`kontaktFuerRolleUndGewerk`). Ein Schritt speichert
   nur die Bezeichnung der Funktion; welche Funktion und damit welche Person
   gemeint ist, ergibt sich aus dem Gewerk des Eintrags – ersatzweise gilt die
   übergreifende Funktion gleichen Namens. Mitgeliefert werden 15
   Funktionen (`src/bereiche/planlauf/domain/seed.ts`), davon zwei übergreifend
   (Planlaufmanagement, Projektleitung) und dreizehn je Gewerk (Fachplaner,
   Fachspezialist, Bauvorlageberechtiger, Bau AN, Bauüberwachung,
   Fachtechnischer Prüfer, Prüfstatiker, Vermessungsprüfer, Erdungsprüfer,
   Schweißtechnischer Prüfer, Korrosionsschutzprüfer, Gleisgeometrie Prüfer,
   Geotechnischer Prüfer) für die mitgelieferten Gewerke EEA, KIB, LST, OLA,
   OSE, TK und VA. Gewerke und Funktionen lassen sich ergänzen und löschen.

Die Besetzung wirkt sofort: `zustaendigkeitenNachziehen` (`src/bereiche/planlauf/domain/engine.ts`)
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
| `import.meta.env.BASE_URL` | Basispfad der Auslieferung; wird für den Pfad des Hauslogos verwendet (`src/shared/logos.tsx`). Vite setzt ihn aus `base: './'` in `vite.config.ts`. | von Vite gesetzt, keine eigene Pflege |
| `import.meta.env.PROD` | Nur im Produktionsbuild wird der Service Worker registriert (`src/shared/pwa.ts`). | von Vite gesetzt, keine eigene Pflege |

## 5. Setup von Null bis zur laufenden Anwendung

1. **Voraussetzungen**: Node.js und npm. Eine Fassung legt das Repository nicht
   fest (kein `engines`-Eintrag in `package.json`, keine `.nvmrc`); der
   Workflow `.github/workflows/pages.yml` baut mit Node 22. Weitere Werkzeuge
   sind nicht nötig.
2. **Abhängigkeiten installieren**: `npm install` (bzw. `npm ci` bei
   vorhandener `package-lock.json`). Laufzeitabhängigkeiten sind nur `react`
   und `react-dom`; Vite, TypeScript und die Typpakete sind Entwicklungs-
   abhängigkeiten (`package.json`).
3. **Datenbank**: entfällt. Es gibt keine Datenbank, keinen Server und keine
   Migrationsskripte. Der Bestand liegt unter dem Schlüssel
   `planlauf-management.data.v1` im `localStorage`
   (`src/bereiche/planlauf/store/storage.ts`).
4. **Migrationen**: laufen automatisch beim Laden. `DATEN_VERSION = 11` und
   `STAMMDATEN_VERSION = 4` (`src/bereiche/planlauf/domain/types.ts`) steuern, ob `migriere()`
   einen älteren Bestand auf die aktuelle Struktur hebt und ob neue Stammdaten
   (Funktionen, Standard-Workflows) übernommen werden. Ohne gespeicherten
   Bestand werden die Demodaten aus `src/bereiche/planlauf/domain/seed.ts` geladen.
5. **Entwicklung starten**: `npm run dev` – Vite startet auf Port 5173 und ist
   im Netz erreichbar (`server: { port: 5173, host: true }`).
6. **Prüfen und bauen**: `npm run typecheck` (`tsc --noEmit`) und `npm run
   build` (`tsc -b && vite build`, Ergebnis in `dist/`). `npm run preview`
   liefert den Build lokal aus.
7. **Veröffentlichen**: Der Workflow `.github/workflows/pages.yml` baut bei
   jedem Push auf `main` und stellt den Build über GitHub Pages bereit
   (Quelle „GitHub Actions“); zusätzlich legt er ihn im Branch `gh-pages` und
   im Ordner `app/` auf `main` ab. Steht Pages auf „Deploy from a branch“ mit
   `main`, liefert GitHub den Zweig selbst aus: Die Wurzel-`index.html`
   verweist auf `/src/main.tsx`, das der Browser nicht ausführen kann; ihr
   Skript wechselt deshalb nach 1,5 Sekunden auf `app/`. Bei Pull Requests
   baut der Workflow nur (einschließlich Typprüfung). Wegen
   `base: './'` funktioniert die Anwendung auch in einem Unterverzeichnis.

## 6. Bekannte Meldungen und ihre Ursachen

### Eingabeprüfungen (als Hinweis eingeblendet)

| Meldung | Fundstelle | Ursache |
| --- | --- | --- |
| „Bitte einen Projektnamen angeben.“ | `src/bereiche/planlauf/pages/Projekte.tsx` | Projektname leer. |
| „Bitte einen Titel angeben.“ | `src/bereiche/planlauf/pages/projekt/Plaene.tsx` | Titel eines Plans / Planverzeichnisses leer. |
| „Bitte einen Namen für das Planpaket angeben.“ | `src/bereiche/planlauf/pages/projekt/Planpakete.tsx` | Name des Planpakets leer. |
| „Bitte die … angeben.“ / „Bitte … angeben.“ | `src/bereiche/planlauf/pages/projekt/Plaene.tsx`, `PlanlaufDetail.tsx` | Pflichtfeld einer Schnellanlage bzw. der neue Index beim Abbruch fehlt. |
| „Bitte einen Nachnamen angeben.“ | `src/bereiche/planlauf/pages/projekt/RollenFunktionen.tsx` | Besetzung ohne Nachname gespeichert. |
| „Bitte eine Bezeichnung angeben.“ | `Funktionen.tsx`, `RollenFunktionen.tsx`, `GewerkDialog.tsx` | Funktion oder Gewerk ohne Bezeichnung. |
| „„…“ ist bereits angelegt.“ | `src/bereiche/planlauf/components/GewerkDialog.tsx` | Gewerk mit diesem Namen existiert schon. |
| „Bitte einen Namen angeben.“ / „Bitte jeden Schritt benennen.“ | `src/bereiche/planlauf/pages/Workflows.tsx` | Workflow ohne Namen bzw. Schritt ohne Bezeichnung. |
| „Bitte jeden Schritt der Workflow benennen.“ | `src/bereiche/planlauf/pages/projekt/Plaene.tsx` | Beim Start eines Planlaufs ist ein Schritt unbenannt. |
| „Bitte einen Grund angeben.“ | `src/bereiche/planlauf/pages/projekt/PlanlaufDetail.tsx` | Abbruch ohne Begründung. |
| „Bitte mindestens einen Eintrag auswählen.“ | `src/bereiche/planlauf/pages/projekt/ExportDialog.tsx` | Export ohne Auswahl. |

### Import aus Excel/CSV

| Meldung | Ursache |
| --- | --- |
| „Die Datei enthält keine Datenzeilen.“ | Die Tabelle hat nur eine Kopfzeile oder ist leer (`PlaeneImport.tsx`, `RollenImport.tsx`). |
| „Weder ‚Plancodierung‘ noch ‚Titel‘ gefunden. Gelesene Überschriften: …“ | Die Kopfzeile der Planliste enthält keine der erkannten Schreibweisen (`PLAN_SPALTEN` in `src/bereiche/planlauf/domain/importVorlagen.ts`). |
| „Die Spalte ‚Name‘ wurde nicht gefunden. Gelesene Überschriften: …“ | Dasselbe für die Rollenliste (`ROLLEN_SPALTEN`). |
| „Die Datei ist keine gültige Excel-Datei (ZIP-Ende fehlt).“ | `src/shared/xlsxLesen.ts`: Die Datei ist kein ZIP – etwa eine alte `.xls`-Datei. |
| „Die Datei verwendet ein nicht unterstütztes Packverfahren.“ | Der ZIP-Eintrag ist nicht „deflate“ (`methode !== 8`). |
| „Dieser Browser kann keine Excel-Dateien entpacken – bitte die Liste als CSV speichern.“ | `DecompressionStream` fehlt im Browser. |
| „Die Datei konnte nicht gelesen werden.“ | Auffangmeldung für alle übrigen Lesefehler. |
| Hinweise je Zeile: „Eintrag mit dieser Bezeichnung ist bereits vorhanden“, „Planpaket ‚…‘ wird angelegt“, „Workflow ‚…‘ ist nicht hinterlegt“, „Gewerk ‚…‘ wird angelegt“, „Funktion ‚…‘ wird angelegt“, „ersetzt … in dieser Funktion“ | Kein Fehler: Die Vorschau nennt, was beim Übernehmen geschieht. |

### Laufzeit und Technik

| Meldung | Ursache |
| --- | --- |
| „Kopieren nicht möglich – bitte Text manuell markieren.“ | `navigator.clipboard.writeText` wurde abgelehnt (fehlende Berechtigung oder unsicherer Kontext), `src/bereiche/planlauf/components/EmailDialog.tsx`. |
| „Druckdialog geöffnet – dort ‚Als PDF sichern‘ wählen.“ | Kein Fehler: Der PDF-Export läuft über den Druckdialog des Browsers (`src/shared/print.ts`). |
| Konsole: „Daten konnten nicht lokal gespeichert werden: …“ | `localStorage.setItem` schlug fehl – Speicher voll oder gesperrt (privates Fenster), `src/bereiche/planlauf/store/storage.ts`. |
| Konsole: „Service Worker konnte nicht registriert werden: …“ | Registrierung abgelehnt, etwa ohne HTTPS (`src/shared/pwa.ts`). Die Anwendung läuft weiter, nur der Offline-Betrieb entfällt. |
| Ausnahme: „useStore muss innerhalb des StoreProvider verwendet werden.“ | Entwicklungsfehler: Eine Komponente nutzt `useStore` außerhalb von `StoreProvider` (`src/bereiche/planlauf/store/store.tsx`). |
| Seite „Nicht gefunden – Der aufgerufene Eintrag existiert nicht (mehr).“ | Die Adresse nennt ein Projekt oder einen Planlauf, den es nicht (mehr) gibt (`src/bereiche/planlauf/App.tsx`). |
| Ein alter Stand erscheint nach einer Aktualisierung | Entweder liegt unter `app/` noch ein älterer Build (siehe Abschnitt 5, Schritt 7), oder der Service Worker liefert aus seinem Cache, derzeit `mc-plan-v3` (`public/sw.js`). Beim Aktivieren löscht er alle älteren Caches; bis dahin hilft einmal Neuladen bzw. Strg+Umschalt+R. |
| Planliste: Haken „Pläne einzeln durch den Planlauf führen“ ist ausgegraut – „Es bestehen bereits Planläufe. Die Pläne lassen sich nur noch nachträglich einzeln weiterführen.“ bzw. „Die Pläne laufen bereits einzeln. Über „Pläne wieder bündeln …“ lassen sich ausgewählte Pläne zurückführen.“ | Kein Fehler: Sobald das Verzeichnis oder einer seiner Pläne einen Lauf hat, ist die Wahl gesperrt (`modusGesperrt` in `Plaene.tsx`). Weiter geht es über die Nachträge „Herauslösen …“, „Alle Pläne einzeln weiterführen …“ und „Pläne wieder bündeln …“ bzw. „Bündeln …“ – im Dialog der Planliste, in der Karte „Pläne dieses Verzeichnisses“ des Planlaufs und in der Planlaufübersicht. |
| Konsole der Wurzelseite: 404 für `/src/main.tsx`, `icon.svg`, `icons/icon-192.png` | Kein Fehler: Die Wurzelseite ist der ausgelieferte Quellcode und springt nur nach `app/` weiter; dort gibt es diese Fehlanfragen nicht. |
