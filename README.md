# MC Plan – Planlaufmanagement

Verwaltungssoftware für Planläufe: Projekte, Planpakete/Pläne/Planverzeichnisse und die
Prozessketten, die diese durchlaufen – mit Soll-/Ist-Terminen, Fristenüberwachung und
vorbereiteten Erinnerungs-E-Mails.

Dieser Stand ist ein **lauffähiger Prototyp ohne Datenbank**: Alle Daten liegen lokal im Browser
(`localStorage`). Die Anwendung ist responsiv und als PWA installierbar.

Die Software ist auf die Nutzung durch mehrere Personen ausgelegt – alle sehen alle Projekte, und
jede Person stellt in der Seitenleiste ein, wer sie ist (Rolle im Projekt: **PLM**). Solange die
Daten lokal im Browser liegen, arbeitet allerdings jeder Arbeitsplatz auf einem eigenen Stand; ein
gemeinsamer Datenbestand setzt den nächsten Schritt – die Anbindung einer Datenbank – voraus. Das Datenmodell ist bereits so geschnitten, dass es später ohne Änderungen an
der Oberfläche auf eine relationale Datenbank umgestellt werden kann.

## Logo austauschen

Die Wortmarke in der Kopfzeile stammt aus der Datei `public/mailaender-consult.svg`. Die derzeit
hinterlegte Fassung ist mit der Systemschrift nachgezeichnet. Um das Original zu verwenden, genügt
es, diese Datei durch die Originaldatei zu **ersetzen** – gleicher Name, gleicher Ort; eine
PNG-Datei funktioniert ebenso (`public/mailaender-consult.png`, dann in
`src/components/logos.tsx` die Konstante `MAILAENDER_DATEI` anpassen). Die Anwendung skaliert die
Datei ausschließlich über die Höhe, das Seitenverhältnis bleibt damit unverändert.

## Starten

```bash
npm install
npm run dev      # Entwicklungsserver auf http://localhost:5173
npm run build    # Produktionsbuild nach dist/
npm run preview  # Produktionsbuild lokal ansehen
npm run typecheck
```

Beim ersten Start wird ein Demodatenbestand mit zwei Projekten, Adressbüchern, Plänen und
laufenden Planläufen geladen. Über **Zurücksetzen** (unten in der Seitenleiste) lässt sich dieser
Stand jederzeit wiederherstellen, über **Export** der gesamte Bestand als JSON sichern.

## Veröffentlichen (GitHub Pages)

**Einmalig einzustellen: Settings → Pages → Build and deployment → Source: „GitHub Actions".**
Ohne diese Umstellung bleibt die Seite weiß – und zwar aus folgendem Grund:

Steht die Quelle auf „Deploy from a branch", baut GitHub den **Repository-Stamm mit Jekyll** und
liefert die dortige `index.html` aus. Das ist aber die Einstiegsdatei für die Entwicklung; sie
verweist auf `/src/main.tsx`, was ein Browser nicht ausführen kann. Dieser Jekyll-Lauf startet bei
jedem Push zusätzlich zum Workflow und überschreibt dessen Ergebnis, weil er später fertig wird.

Nach der Umstellung veröffentlicht ausschließlich
[`.github/workflows/pages.yml`](.github/workflows/pages.yml): Der Workflow baut bei jedem Push und
stellt `dist/` bereit. Die Seite erscheint dann unter `https://<konto>.github.io/<repository>/`.

Zwei Hilfen, falls die Einstellung nicht geändert werden kann oder soll:

* Der Workflow legt denselben Build zusätzlich im Branch **`gh-pages`** ab. Damit genügt es auch,
  unter „Deploy from a branch" den Branch `gh-pages` und den Ordner `/ (root)` zu wählen.
* Wird versehentlich doch der Quellcode ausgeliefert, erscheint statt einer weißen Seite ein
  Hinweis mit genau diesem Lösungsweg.

Technische Voraussetzung für Unterverzeichnisse: Der Build verwendet `base: './'` (relative Pfade).
Ohne diese Einstellung verweisen die Dateien auf `/assets/…` – unter `https://…/PLM-DB/` führt das
ebenfalls zu einer weißen Seite. Die Navigation arbeitet mit Hash-Adressen (`#/fristen`), daher
funktionieren Direktaufrufe und das Neuladen ohne zusätzliche Serverregeln.

## Als App installieren (PWA)

Die Anwendung ist eine installierbare Progressive Web App und läuft nach dem ersten Aufruf auch
ohne Netzverbindung – die Daten liegen ohnehin lokal im Browser.

* **iPhone/iPad (Safari):** Teilen → *Zum Home-Bildschirm*
* **Android (Chrome):** Menü → *App installieren*
* **Desktop (Chrome/Edge):** Installationssymbol in der Adressleiste

Enthalten sind `manifest.webmanifest`, App-Symbole (192/512 px, maskable und Apple-Touch-Icon)
sowie ein Service Worker (`public/sw.js`): Seitenaufrufe werden zuerst aus dem Netz geladen und
bei fehlender Verbindung aus dem Zwischenspeicher beantwortet, Programmdateien kommen direkt aus
dem Zwischenspeicher. Der Service Worker ist nur im Produktionsbuild aktiv, in der Entwicklung
stört er also nicht.

Die Oberfläche ist durchgehend responsiv: Ab etwa 860 px klappt die Seitenleiste in ein Menü, auf
Telefonbreite stehen die Kennzahlen zweispaltig, Tabellen scrollen quer bzw. werden – wie die
Fristenliste – zu gestapelten Karten, damit die Schaltflächen erreichbar bleiben.

## Funktionsumfang

### Projekte
Anlage und Pflege von Projekten (Projektnummer, Name, Status, Beschreibung). Beim Anlegen werden
die Standardrollen und die E-Mail-Vorlagen übernommen.

### Funktionen und Gewerke
Im übergeordneten Reiter **Funktionen** werden die projektübergreifenden Funktionen gepflegt –
gegliedert in eine Seite je Gewerk sowie eine Seite **Übergreifend**. Neue Projekte übernehmen sie
automatisch. Mitgeliefert sind die vorgegebenen Funktionen: Planlaufmanagement (PLM), Projektleitung (PL), Fachplaner (FP),
Fachspezialist (FS), Bauvorlageberechtiger (BVB), Bau AN, Bauüberwachung (BÜW), Fachtechnischer
Prüfer (PSV), Prüfstatiker, Vermessungs-, Erdungs-, Schweißtechnischer, Korrosionsschutz-,
Gleisgeometrie- und Geotechnischer Prüfer.

Funktionen auf der Seite **Übergreifend** (Planlaufmanagement, Projektleitung) werden im Projekt
einmal besetzt; alle übrigen gehören zu einem oder mehreren Gewerken und werden je Gewerk mit einer
eigenen Person belegt – es gibt also z.B. einen Fachplaner je Gewerk. Beim Start eines Planlaufs
setzt die Anwendung die Verantwortlichen **nach dem Gewerk des Plans** ein: Zwei Pläne nach
demselben Workflow, aber mit unterschiedlichem Gewerk, erhalten unterschiedliche Verantwortliche.

Gewerke zur Auswahl: EEA, KIB, LST, OLA, OSE, TK, VA – weitere lassen sich über das **+** an den
Gewerk-Reitern anlegen; sie gelten dann überall.

### Rollen & Funktionen (im Projekt)
Im Vordergrund steht die **Funktion, nicht die Person**: Die Seite ist – wie der projektübergreifende
Reiter *Funktionen* – nach **Gewerken** gegliedert (je Gewerk eine Seite, dazu „Übergreifend“). Je
Funktion steht in der Zeile, wer sie ausfüllt; ein Klick öffnet die Besetzung, in der eine im Projekt
bekannte Person übernommen oder eine neue mit Anrede, Firma, E-Mail, Telefon und Anschrift erfasst
wird. Jede Funktion wird von genau einer Person ausgefüllt; eine Person kann mehrere Funktionen
haben.

Über das **+** an den Gewerk-Reitern entsteht ein weiteres Gewerk, über *Gewerk löschen* am Ende der
Seite verschwindet das gerade geöffnete wieder – der Dialog nennt vorher, welche Funktionen und Besetzungen damit
entfallen. Gewerke gelten projektübergreifend: angelegt oder gelöscht wird überall, also auch im
Reiter *Funktionen* im Hauptmenü, und jedes Gewerk des Projekts steht in **Planliste** und
**Planpaketen** zur Auswahl – darüber findet ein Planlauf die Verantwortlichen seines Gewerks.
Über *Neue Funktion* entsteht eine weitere Funktion im gewählten Gewerk. Beide Wege führen zum Ziel: **Funktion anlegen und dort die Person
eintragen** oder mit *Person hinzufügen* die **Person erfassen und die Funktion gleich dabei
zuweisen** – die Zuweisung kann offen bleiben und später nachgeholt werden. Personen ohne Funktion –
aus einem Import, nach einem Wechsel oder bewusst ohne Zuordnung – stehen in einer eigenen Liste
darunter; ein Klick weist ihnen eine Funktion zu.

**Excel-Import:** Je Zeile *Gewerk · Funktion · Kürzel · Anrede · Vorname · Name · Firma · Telefon ·
Email · Straße · Nr. · PLZ · Ort · Notiz*. Gewerke und Funktionen, die es noch nicht gibt, werden
beim Import angelegt; „Übergreifend“ steht für Funktionen ohne Gewerkbezug. Die Vorschau nennt je
Zeile, was angelegt wird und wen eine Besetzung ersetzt.

### Pläne & Planläufe
Planbestand aus Plänen, Planpaketen und Planverzeichnissen. Je Eintrag
werden Plancodierung, Titel, Index (standardmäßig leer), Gewerk (EEA, KIB, LST, OLA, OSE, TK, VA oder
freie Eingabe), Planungsphase (Entwurfs-, Genehmigungs- oder Ausführungsplanung, ebenfalls frei ergänzbar),
der Soll-Termin für den Eingang und eine Bemerkung geführt.

Pläne lassen sich einem **Planpaket oder Planverzeichnis unterordnen**. Untergeordnete Pläne
durchlaufen keinen eigenen Planlauf – maßgeblich ist der Lauf des übergeordneten Eintrags; die
Liste weist sie entsprechend aus.

**Zu jedem eigenständigen Eintrag gehört genau ein Planlauf.** Er entsteht zusammen mit dem Eintrag:
Im selben Dialog werden der Workflow gewählt und seine Schritte für diesen Lauf angepasst. Die Liste
zeigt Stammdaten und Ablauf nebeneinander – aktueller Schritt, Verantwortlicher, Frist und
Fortschritt – und lässt sich über die Spaltenüberschriften sortieren. Ein Klick auf die Zeile öffnet
den Planlauf.

Die Feldbezeichnungen richten sich nach der Art: **Plancodierung** beim Plan, **Name Planpaket**
bzw. **Name PlanVZ** beim Paket und Verzeichnis, wo statt *Index* die **Ausgabe** geführt wird.

**Farbige Bezeichnungen:** Steht in einem Planlauf noch der Schritt **Eingang PLM** aus, ist der
Plan angekündigt, aber noch nicht eingegangen – seine Bezeichnung steht in Planliste und
Projektübersicht **gelb**, in der Übersicht trägt er den Status **Angekündigt** (nach ihm lässt sich
auch filtern und sortieren), in der Planliste das Kennzeichen *Angekündigt*. Abgeschlossene
Planläufe stehen in **Grün**, abgebrochene grau.

**Excel-Import:** Planlisten lassen sich als `.xlsx` oder `.csv` einlesen. Erwartete Spalten:
*Art · Plancodierung/Name Planpaket / Name Plan VZ · Index/Ausgabe · Titel · Gewerk ·
Planungsphase · Planpaket · Planverzeichnis · Eingang Soll · Datum Ausgabe · Workflow · Bemerkung*.
Ist in *Workflow* ein hinterlegter Workflow benannt, startet der Planlauf gleich beim Import.
Genannte, aber noch nicht vorhandene Planpakete und Planverzeichnisse entstehen beim Import.

### Planlaufliste im Projekt
Je Eintrag steht in der Spalte **Nächster Schritt** der offene Schritt mit seiner Frist.

Die Übersicht lässt sich über die Spaltenüberschriften **sortieren** – nach Bezeichnung, Gewerk,
Soll-Termin des nächsten Schritts, Zuständigkeit, Fortschritt oder Status (überfällige zuerst). Ein zweiter Klick kehrt die Richtung um, ein dritter hebt die Sortierung auf. Sortiert wird
innerhalb der Planpakete, die Paketzeilen folgen derselben Spalte.

Die **Kopfzeile der Tabellen bleibt beim Scrollen stehen**, sodass die Spaltenbezeichnungen auch in
langen Listen sichtbar sind.

**Filtern** geschieht in derselben Überschrift: Der Trichter neben *Gewerk*, *Zuständig* und *Status*
öffnet die Auswahl der vorhandenen Werte; der gewählte Wert steht anschließend in der Überschrift.
Die **Suche** über Nummer, Titel und Schritt steht oben in der Kartenzeile neben der Gliederung,
daneben erscheint bei gesetzten Filtern *Filter zurücksetzen*.

### Zuständigkeiten
Ein Schritt nennt eine **Funktion**; wer sie ausfüllt, steht unter **Rollen & Funktionen** des Projekts. Die
Zuordnung wird laufend nachgezogen: Wird eine Person erst nach dem Start eines Planlaufs eingetragen
oder wechselt sie während des Projekts, gilt die neue Besetzung sofort auch in laufenden Planläufen.
Bereits erledigte Schritte behalten ihre Person, ebenso Schritte, in denen im Planlauf eine Person
von Hand gewählt wurde.

### Prozessketten
Ein Schritt ist eine **Aufgabe**, eine **Entscheidung** oder **Sonstiges**, hat eine Frist in Tagen und
einen Verantwortlichen (Rolle). Entscheidungen erhalten zwei Antwortmöglichkeiten („Ja“/„Nein“ als
Vorbelegung, frei überschreibbar); weitere lassen sich ergänzen. Je Antwort wird festgelegt, mit
welchem Schritt es weitergeht – mit dem nächsten Schritt, einem beliebigen anderen oder dem Ende des
Laufs.

Zeigt eine Antwort auf einen bereits durchlaufenen Schritt zurück, entsteht eine **Schleife**
(z.B. Überarbeitung nach einer Prüfung): Der Ablauf endet dort nicht, sondern nimmt den genannten
Schritt in einem weiteren Durchlauf erneut auf.

Mitgeliefert sind die drei vorgegebenen Ketten **VVBau ohne Prüfstatik**, **VVBau mit Prüfstatik**
und **VVBau STE** mit ihren Verzweigungen und Rücksprüngen. Die Fristen sind dort nicht vorgegeben
und daher als Erfahrungswerte vorbelegt (z.B. 10 Tage Planerstellung, 3 Tage formale Prüfung,
10 Tage BVB-Freigabe, 15 Tage Fachprüfung); sie lassen sich je Kette und je Planlauf ändern. Schritte,
die in der Vorgabe parallel laufen (etwa die vier Versandschritte nach der Genehmigung), sind
nacheinander abgebildet.

Ketten lassen sich duplizieren und als **Projektvariante** abweichend pflegen. Die eigene Rolle im
Projekt ist **Planlaufmanagement (PLM)**.

### Nachweise: Freigabe- und Prüfbericht-Nummern
Je Schritt lässt sich hinterlegen, welcher Nachweis bei erfolgreichem Abschluss zu erfassen ist:

* **Freigabe-Nr.** – hinterlegt an den BVB-Freigaben (nicht an der Freigabe *zur fachtechnischen
  Prüfung*).
* **Prüfbericht-Nr.** – hinterlegt an den Fachprüfungen; bei Schritten mit prüfender Rolle
  (Erdungs-, Vermessungsprüfer …) wird sie automatisch vorgeschlagen.

Beim Erledigen fragt die Anwendung die Nummer ab – bei Entscheidungen nur, wenn die erste
(zustimmende) Antwort gewählt ist. Die Nummer steht anschließend am Schritt und in beiden
Exportfassungen.

### Prüfer individuell ergänzen
Über **Schritt einfügen** wird ein zusätzlicher Prüfschritt in den laufenden Verlauf eingehängt –
mit Rolle (z.B. Erdungsprüfer), Frist und Nachweis. Die Einfügeposition wird aus dem aktuellen
Verlauf gewählt; die Verkettung wird dabei richtig gesetzt, auch hinter Entscheidungen.

### Planläufe (Soll-/Ist-Termine)
Ein Planlauf ist die laufende Instanz einer Prozesskette für einen Plan, ein Paket oder ein
Verzeichnis. Beim Start werden die Schritte der Vorlage kopiert und lassen sich **für diesen Lauf**
noch ergänzen, ändern oder entfernen – **individuelle Abweichungen** wirken deshalb nur auf den
jeweiligen Lauf und sind als solche gekennzeichnet.

* **Soll-Termine** werden aus den Fristen gerechnet: Soll = Soll des Vorgängers + Frist. Wahlweise
  in Arbeitstagen (Mo–Fr, ohne hinterlegte Feiertage) oder Kalendertagen.
* Ein Soll-Termin kann **manuell festgesetzt** werden und bildet dann die Basis für alle folgenden
  Schritte.
* Führt eine Antwort zurück auf einen früheren Schritt, beginnt mit dem Erledigen der Entscheidung
  ein **weiterer Durchlauf** ab diesem Schritt; die betroffenen Schritte werden erneut geöffnet und
  als „2. Durchlauf“ gekennzeichnet.
* **Ist-Termine** dokumentieren die Erledigung; Schritte lassen sich auch **überspringen**. Der
  jeweils nächste Schritt wird automatisch aktiv, der Lauf schließt sich, wenn alle Schritte des
  Verlaufs erledigt sind.
* Bei **Entscheidungen** wird die Antwort im Lauf gewählt. Der angezeigte Verlauf folgt dieser
  Antwort; ohne Auswahl der ersten Möglichkeit. Schritte, die nur bei anderer Antwort durchlaufen
  werden, sind unterhalb der Liste aufgeführt.
* Im Planlauf sind die Schaltflächen (Erledigt, Überspringen, Erinnern) nur am **aktuell anstehenden
  Schritt** sichtbar; abgeschlossene Schritte bieten *Wieder öffnen*, und *Anpassen* steht als
  Stiftsymbol rechts an jeder Zeile.
* Ein Lauf kann mit Begründung **abgebrochen** werden – wahlweise **ersatzlos** oder mit **neuem
  Index bzw. neuer Ausgabe**. Im zweiten Fall erhält der Eintrag den angegebenen Index, und der
  Planlauf beginnt mit denselben Schritten von vorn.
* Ein abgebrochener Lauf ist **nicht mehr zu bearbeiten**: In der Projektübersicht steht seine Zeile
  ausgegraut, ohne aktuellen Schritt, Fortschritt und Schaltflächen – stattdessen in Grau
  „Abgebrochen am …“ mit dem Zusatz *ersatzlos abgebrochen* bzw. *ersetzt durch Index C*. Er lässt
  sich weiterhin zum Nachschlagen öffnen, bietet dort aber keine Aktionen mehr und erscheint nicht
  in der Fristenliste. In der **Planliste** trägt der Eintrag den entsprechenden Zusatz
  (`Index B → C` bzw. `abgebrochen`).

### Fristen & Erinnerungen
Fristenübersicht über alle Projekte, sortiert nach Dringlichkeit und gefiltert nach
überfällig / fällig / im Plan. Angezeigt wird je Planlauf **nur der aktuell anstehende Schritt**.
Ein Schritt gilt als *fällig*, sobald der Soll-Termin näher liegt als die in den Projekteinstellungen
gepflegte Vorlaufzeit.

Je Schritt öffnet der Button **Erinnern** ein Fenster mit der vorbereiteten E-Mail: Die zur Lage
passende Vorlage (Erinnerung oder Mahnung) wird ausgewählt, die Platzhalter aus Projekt, Plan,
Schritt, Frist und Empfänger ersetzt. Von dort lässt sich die Nachricht in **Outlook** öffnen
(`mailto:`, also das eingerichtete Standardprogramm), in **Outlook im Web** anlegen oder in die
Zwischenablage kopieren; der Zeitpunkt wird am Schritt vermerkt.

### Export je Projekt
Über **Export** in den Projekteinstellungen lassen sich Planpakete, Pläne und Planverzeichnisse
auswählen und in zwei Umfängen ausgeben:

* **Kurzfassung** – je Eintrag der aktuelle Stand, der nächste Schritt und die Verantwortlichen.
* **Langfassung** – zusätzlich alle bereits durchlaufenen und alle ausstehenden Schritte.

Beides jeweils als **Excel** (.xlsx, ohne zusätzliche Programmbibliothek erzeugt) und als **PDF**
über den Druckdialog des Browsers („Als PDF sichern“).

### Übersicht und Markierung von Projekten
Alle Bearbeiter sehen alle Projekte. Mit ★ markierte Projekte erscheinen in der Übersicht und in der
Seitenleiste (mit vorangestellter Projektnummer); ohne Markierung werden alle angezeigt. Die
Übersicht zeigt Kennzahlen, die eigenen **To-Dos** (laufende Schritte des Planlaufmanagements) und
die laufenden Planläufe nach Projekt gegliedert. In einem markierten Projekt ist die angemeldete
Person automatisch unter **Rollen & Funktionen** als **Planlaufmanagement** geführt und damit für dessen Schritte
zuständig.

### Angemeldet als
Unten links in der Seitenleiste stehen der eigene Name (bis zur Anmeldung je Person „Max
Mustermann“), die Nachfrage nach E-Mails und der **Farbmodus für eine Rot-Grün-Sehschwäche**: er
stellt Blaugrün, Bernstein und Magenta statt Grün, Orange und Rot dar und erhöht die Kontraste.

### Projekteinstellungen
Vorlaufzeit für Erinnerungen, Arbeitstage/Feiertage, Absenderangaben sowie die
**E-Mail-Vorlagen** (Betreff und Text) mit einer Übersicht aller verfügbaren Platzhalter.

## Aufbau des Codes

```
src/
  domain/        Fachlogik ohne UI-Bezug
    types.ts     Datenmodell (Projekt, Rolle, Kontakt, Plan, Vorlage, Planlauf …)
    engine.ts    Verlauf durch die Kette, Fristenrechnung, Ampelstatus, To-Dos
    email.ts     Platzhalter und Aufbereitung der Vorlagen
    export.ts    Kurz- und Langfassung für Excel und PDF
    seed.ts      Standard-Prozessketten und Demodaten
  store/
    storage.ts   Persistenz (localStorage) – Austauschpunkt für eine spätere Datenbank
    store.tsx    Zentraler Zustand, alle Schreibzugriffe
  lib/
    xlsx.ts      Erzeugt Excel-Arbeitsmappen ohne externe Abhängigkeit
    xlsxLesen.ts Liest Excel- und CSV-Listen für die Importe
    print.ts     Druckausgabe als Grundlage der PDF-Fassung
    dates.ts     Fristen- und Datumsrechnung, router.ts, pwa.ts
  pages/         Ansichten (Übersicht, Fristen, Projekte, Workflows, Funktionen, Projektreiter)
  components/    Wiederverwendbare Bausteine (ui.tsx, icons.tsx, EmailDialog …)
  styles/        Design-Tokens im hellen Apple-Erscheinungsbild
```

## Gestaltung

Helles Erscheinungsbild in Anlehnung an Apple: Systemschriftart (SF Pro / `-apple-system`),
zurückhaltende Flächen auf `#f5f5f7`, weiße Karten mit weichen Radien und feinen Schatten,
Systemblau `#0071e3` als Akzent, transluzente Seitenleiste und Kopfzeile, Segmented Controls und
Pill-Buttons. Die Oberfläche ist bis auf Telefonbreite (~400 px) nutzbar.

## Nächste Schritte (Ausblick)

* Ablösung von `storage.ts` durch eine Datenbank (z.B. PostgreSQL) samt API – das Datenmodell in
  `domain/types.ts` ist bereits auf Tabellen mit ID-Referenzen ausgelegt.
* Mehrbenutzerbetrieb auf einem gemeinsamen Datenbestand mit Anmeldung und Rechten je Rolle
  (heute sieht jeder Arbeitsplatz nur seinen lokalen Stand).
* Automatischer Mailversand über SMTP statt `mailto:` inkl. Erinnerungslauf im Hintergrund.
* Dateiablage für die eigentlichen Plandateien (PDF/DWG) je Index.
* Auswertungen: Terminlisten, Planlieferlisten und Verzugsberichte als Export.
