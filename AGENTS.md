# AGENTS.md

Hinweise für KI-Agents (Claude Code, Codex, Copilot, …) und Menschen, die an FFGFÜA arbeiten. Fachliche Details und Bedienung stehen im [README](README.md); hier steht, wie am Code gearbeitet wird.

## Projekt

FFGFÜA ist die PWA der Atemluftfüllstelle der FF Gemeinlebarn: Atemschutzflaschen von Feuerwehren werden bei **Einsätzen und Übungen (Ereignisse)** gefüllt, per Barcode-Scanner erfasst und als Füllberichte (PDF) dokumentiert. Flaschendaten kommen aus der MAT-Datenbank über einen lokalen Sync-Service oder werden manuell erfasst.

- Angular 22, standalone Components, zoneless, Signals, Angular Material
- Daten nur lokal im Browser: IndexedDB über Dexie (`DatabaseService`), Einstellungen im `localStorage`
- PDFs mit jsPDF + jspdf-autotable (lazy geladen), Ablage über die File System Access API (Chrome/Edge)
- Unit-Tests mit Vitest (jsdom, fake-indexeddb), E2E mit Playwright

## Befehle

| Zweck | Befehl |
| --- | --- |
| Dev-Server (Fake-MAT-API, Port 4200) | `npm start` |
| Unit-Tests | `npx ng test --watch=false` |
| Build | `npx ng build` |
| E2E (startet eigenen Server auf Port 4300) | `npm run e2e` (lokal ggf. `PW_CHROMIUM_PATH=/usr/bin/chromium npm run e2e`) |
| Lizenzen | `npm run check:licenses` |
| Secrets (gitleaks) | `npm run secrets:scan` |
| SAST (CodeQL, lädt beim 1. Mal ~550 MB) | `npm run sast:codeql` |

Vor jedem Commit: Unit-Tests und Build grün. Bei Änderungen an Abläufen in der UI zusätzlich `npm run e2e`.

## Konventionen

- **Sprache:** Fachbegriffe, UI-Texte und Kommentare auf Deutsch (Ereignis, Feuerwehr, Flasche, Füllung, Füllpersonal, Mangel). Commit-Messages auf Englisch im Imperativ („Add …“, „Fix …“).
- **Stil:** Allman-Klammern (öffnende Klammer in eigener Zeile), 4 Leerzeichen, `inject()` statt Konstruktor-Injection, Signals für Zustand, `@if`/`@for` im Template.
- **TypeScript:** `strict: true` und `strictTemplates`. Kein `any`, `!` nur wenn wirklich garantiert.
- **Dialoge** nur über `DialogService` (`open()` liefert ein Promise mit dem Ergebnis, `confirm()` ein `boolean`), **Meldungen** nur über `NotificationService`. `MatDialog`/`MatSnackBar` nicht direkt verwenden.
- **Modelle** in `src/app/shared/interfaces/`: Pflichtfelder sind Pflicht. Rohdaten von MAT sind `IMatFeuerwehr`/`IMatFlasche`.
- **Tests:** Verhalten testen, nicht Implementierung. Testdaten über `src/app/testing/test-data.ts`, Dialog-Provider über `src/app/testing/dialog.ts`, Dateisystem-Fakes über `src/app/testing/file-system.ts`. Unit-Specs heißen `*.spec.ts`, E2E-Specs `e2e/*.e2e.ts`.

## Architektur in Kürze

- `src/app/pages/`: Start (Ereignis anlegen), Operating (laufendes Ereignis), Ereignisse, Verwaltung, Statistik, Einstellungen
- `src/app/shared/services/`
  - `data/`: Lesen und Schreiben aller Daten, Signals für Feuerwehren, Personen, Ereignisse. Vergibt die Ereignisnummer.
  - `database/`: Dexie-Schema mit Migrationen (aktuell `version(2)`). Schemaänderungen nur mit neuer Version und Upgrade.
  - `operating/`: laufendes Ereignis, Füllungen erfassen
  - `barcode-scanner/`: Tastatureingabe des Scanners (Ziffern + Enter, mind. 5 Stellen). Scannen wirkt auf allen Seiten, solange ein Ereignis läuft.
  - `sync/`, `sync-api/`: MAT-Synchronisierung (im Dev-Modus `FakeSyncApi`)
  - `pdf/`: Berichte als PDF (`pdf-render.ts`), Dateinamen (`pdf-dateinamen.ts`), Drucken über iframe (`pdf-druck.service.ts`)
  - `pdf-ablage/`: Ordnerwahl, Berechtigungen, Ablage, Download-Fallback
  - `backup/`: JSON-Export und -Import (Modi „Zusammenführen“ und „Ersetzen“)
- `src/app/shared/reports/report-data.ts`: reine Logik für die Berichte (Gruppierung, Texte)
- `src/app/altberichte/`: **Übergangslösung**, wird wieder entfernt (Anleitung im README unter „Altberichte“). Nichts Neues darauf aufbauen.

## Fachliche Regeln, die leicht übersehen werden

- **Ereignisnummer** `JJJJ-NNN`: pro Jahr fortlaufend, beim Anlegen vergeben und danach stabil, auch wenn sich der Beginn ändert. Ein eindeutiger Index `[jahr+nummer]` in Dexie verhindert Duplikate.
- **Flaschen** haben `quelle: 'mat' | 'manuell'` (fehlend = MAT). Nur manuelle Flaschen sind editierbar. Barcodes sind über alle Feuerwehren eindeutig. Liefert MAT den Barcode einer manuellen Flasche, gewinnt MAT.
- **Füllungen** speichern eine Kopie der Flasche. Spätere Änderungen an Stammdaten ändern alte Füllungen nicht.
- **Berichte:** Gesamtbericht A4 quer (Unterschrift je Feuerwehr und Füllpersonal), Feuerwehrbericht A4 hoch (nur Füllpersonal). Unterschriftsfelder ohne Name/Datum. Zeitangaben immer mit Jahr, Uhrzeit fett als „HH:mm Uhr“.
- **Drucken** läuft über ein erzeugtes PDF, nie über HTML. Jedes erzeugte PDF wird im gewählten Ordner abgelegt (`<JJJJ>/<JJJJ-NNN>_<Art>[_<Ort>]/…`). `requestPermission` nur direkt im Klick, also vor der PDF-Erzeugung.

## Git-Workflow

- Die laufende Arbeit liegt lokal auf dem langlebigen Branch `refactoring`. Jede Änderung bekommt einen eigenen Branch davon (`feature/…`, `fix/…`) und wird mit `--no-ff` zurück nach `refactoring` gemergt.
- Auf GitHub liegt `refactoring` als **`refactoring-next`** (PR nach `main`). Push: `git push https://github.com/ffgemeinlebarn/ffgfuea.git refactoring:refactoring-next`. In der Sandbox funktioniert der SSH-Remote `origin` nicht, HTTPS schon.
- `main` wird per Squash-Merge eines PRs aktualisiert, danach `main` lokal in `refactoring` mergen.
- Nur pushen oder PRs anlegen, wenn darum gebeten wurde.

## Fallstricke

- **Worktrees für Subagents** starten teils von `main` statt vom aktuellen Branch. Immer zuerst `git checkout -b <branch> refactoring` und den HEAD prüfen. `.claude/worktrees/` nie committen (lokal in `.git/info/exclude`).
- **Parallele Last:** Vitest lässt ~30 jsdom-Dateien parallel laufen. Laufen daneben Playwright oder CodeQL, gibt es Timeouts (das Test-Setup erlaubt bereits 20 s). Schwere Läufe nicht parallel starten.
- **Playwright:** Port 4200 gehört dem Entwickler, E2E nutzt 4300. Dateien mit `setInputFiles` als Buffer übergeben, nicht als Pfad: Die Ausgabeordner enthalten Umlaute aus den Testnamen, und mit solchen Pfaden setzt Playwright die Datei stillschweigend nicht.
- **Dev-Modus:** Die Fake-MAT-API meldet bei jedem Laden neue Daten, deshalb synchronisiert die App bei jedem Start und zeigt ein blockierendes Overlay. In E2E-Tests darauf warten.
- **Drucken headless:** `print()` auf einem PDF-iframe lässt headless Chromium abstürzen. Drucken nur im echten Browser prüfen.
- **Abhängigkeiten:** Neue Pakete mit exakter, einige Wochen alter Version. Der OSV-Scanner-Check im PR schlägt bei neu eingeführten bekannten Schwachstellen fehl, auch in Dev-Abhängigkeiten.

## Offene Arbeit

Geplante Schritte stehen als GitHub-Issues im Repo. Vor größeren Änderungen dort nachsehen:

- [#12](https://github.com/ffgemeinlebarn/ffgfuea/issues/12) Qualität Welle 2: ESLint, lefthook, Claude-Code-Hooks, Coverage-Schwelle
- [#13](https://github.com/ffgemeinlebarn/ffgfuea/issues/13) Altberichte-Übergangslösung nach der Migration entfernen
- [#14](https://github.com/ffgemeinlebarn/ffgfuea/issues/14) Manuelle Schritte: Browser-Checks, GitHub-Einstellungen, LICENSE
