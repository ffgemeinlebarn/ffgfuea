# FFGFÜA

[![CI](https://github.com/ffgemeinlebarn/ffgfuea/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ffgemeinlebarn/ffgfuea/actions/workflows/ci.yml?query=branch%3Amain)
[![CodeQL](https://github.com/ffgemeinlebarn/ffgfuea/actions/workflows/codeql.yml/badge.svg)](https://github.com/ffgemeinlebarn/ffgfuea/actions/workflows/codeql.yml)
[![OSV-Scanner](https://github.com/ffgemeinlebarn/ffgfuea/actions/workflows/osv-scanner.yml/badge.svg?branch=main)](https://github.com/ffgemeinlebarn/ffgfuea/actions/workflows/osv-scanner.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/ffgemeinlebarn/ffgfuea/badge)](https://scorecard.dev/viewer/?uri=github.com/ffgemeinlebarn/ffgfuea)

FF Gemeinlebarn Füllapplikation

## Entwicklung

- `npm start` – Entwicklungsserver. Verwendet Beispieldaten statt des lokalen MAT Sync-Services (`fakeSyncApi` in `src/environments/environment.development.ts`).
- `npm test` – Unit-Tests mit Vitest, `npm run test:coverage` einmalig mit Coverage-Schwelle
- `npm run lint` – ESLint für das ganze Projekt, `npx eslint <datei>` für einzelne Dateien
- `npm run typecheck` – Typecheck von App (inkl. Templates), Unit-Tests und E2E
- `npm run check` – alle Pflicht-Checks der CI lokal mit Übersicht, siehe [Qualität & Sicherheit](#qualität--sicherheit)
- `npm run build` – Produktions-Build nach `dist/ffgfuea/browser`
- `npm run e2e` – E2E-Tests mit Playwright inkl. Barrierefreiheit, siehe unten
- `npm run knip` / `npm run depcruise` / `npm run lint:actions` – ungenutzter Code, Architekturregeln, Workflows
- `npm run mutation` – Mutation-Testing der Fachlogik mit Stryker (~15 min beim ersten Lauf, danach inkrementell)

## E2E-Tests

Die End-to-End-Tests in `e2e/` (`*.e2e.ts`) laufen mit [Playwright](https://playwright.dev) in Chromium gegen den Entwicklungsserver mit der FakeSyncApi: Eine synchronisierte Feuerwehr Nr. N hat 12 Flaschen mit den Barcodes `N01` bis `N12`. Jeder Test startet mit einem neuen Browser-Kontext und damit einer leeren Datenbank. Gemeinsame Schritte (Feuerwehr synchronisieren, Personal anlegen, Ereignis starten, Barcode scannen, auf die Synchronisierung beim Start warten, Ordnerauswahl im Origin Private File System) liegen in `e2e/fixtures.ts`.

```bash
npx playwright install chromium   # einmalig, CI: --with-deps
npm run e2e                       # alle Tests, startet `ng serve --port 4300` (läuft er schon, wird er verwendet)
npm run e2e:ui                    # interaktiver UI-Modus
npx playwright show-report        # HTML-Bericht der letzten Ausführung
```

- `PW_CHROMIUM_PATH=/usr/bin/chromium npm run e2e` verwendet ein vorhandenes Chromium statt des von Playwright installierten.
- `PW_WORKERS=4 npm run e2e` ändert die Anzahl paralleler Browser (Standard 2).
- Bei Fehlern liegen Trace, Screenshot und Video in `test-results/` (`npx playwright show-trace <trace.zip>`).

**Barrierefreiheit:** `e2e/barrierefreiheit.e2e.ts` prüft alle Seiten mit Daten und den Berichte-Dialog mit [axe-core](https://github.com/dequelabs/axe-core) gegen WCAG 2.2 A/AA (`expectBarrierefrei()` in `e2e/fixtures.ts`). Ein Verstoß nennt Regel, Hilfe-Link und Elemente; das vollständige Ergebnis hängt als `axe-<seite>.json` am Test im HTML-Bericht. Neue Seiten oder Dialoge dort ergänzen.

In GitHub Actions laufen die Tests bei jedem Pull Request und bei Pushes auf `main` (Job **E2E (Playwright)** in `.github/workflows/ci.yml`). Fehlgeschlagene Tests erscheinen als Annotation im PR und als Tabelle in der Job-Zusammenfassung (`e2e/summary-reporter.ts`); der HTML-Bericht und bei Fehlern die Traces werden als Artefakte hochgeladen.

## Release

Pull Requests und Pushes auf `main` werden von GitHub Actions getestet und gebaut. Deployt wird nur ein Release:

1. Version in `package.json` und `src/environments/environment.ts` anheben
2. Tag pushen, z. B. `git tag v1.4.0 && git push origin v1.4.0`

Alternativ in GitHub unter *Actions → CI → Run workflow* von `main` manuell starten. Die Option „Clean slate“ löscht vorher alle Dateien am Server (z. B. beim ersten Deploy, um alte Builds zu entfernen).

## Qualität & Sicherheit

### Was läuft wo

Pull Requests nach `main` brauchen ein Review von @jakob-fyi (`.github/CODEOWNERS`) und grüne **Pflicht-Checks**. Die Pflicht-Jobs in `ci.yml` laufen parallel und werden vom Job **CI ok** zusammengefasst; im Ruleset ist nur dieser eingetragen, neue Pflicht-Jobs kommen unter `needs` von **CI ok**. **Optionale** Checks werden angezeigt, blockieren aber nicht.

| Prüfung | Lokal | CI-Check (Workflow) | Art | Wann in CI |
| --- | --- | --- | --- | --- |
| ESLint (Code-Stil und typ-informierte Regeln) | `npm run lint` | **Lint** (CI) | Pflicht über **CI ok** | Push auf `main`, `v*`-Tags, jeder PR |
| Typecheck App inkl. Templates, Unit-Tests, E2E | `npm run typecheck` | **Typecheck** (CI) | Pflicht über **CI ok** | wie oben |
| Unit-Tests mit Coverage-Schwelle | `npm run test:coverage` | **Unit-Tests & Coverage** (CI) | Pflicht über **CI ok** | wie oben |
| Produktions-Build | `npm run build` | **Build** (CI) | Pflicht über **CI ok** | wie oben |
| Lizenzen der Abhängigkeiten | `npm run check:licenses` | **Lizenzen** (CI) | Pflicht über **CI ok** | wie oben |
| Secrets im Code und in der Git-Historie (gitleaks) | `npm run secrets:scan` | **Secrets (gitleaks)** (CI) | Pflicht über **CI ok** | wie oben |
| E2E-Tests (Playwright) inkl. Barrierefreiheit (axe, WCAG 2.2 A/AA) | `npm run e2e` | **E2E (Playwright)** (CI) | Pflicht über **CI ok** | wie oben |
| Ungenutzte Dateien, Exporte, Abhängigkeiten (Knip) | `npm run knip` | **Knip (ungenutzter Code)** (CI) | Pflicht über **CI ok** | wie oben |
| Architekturregeln der Imports (dependency-cruiser) | `npm run depcruise` | **Architektur (dependency-cruiser)** (CI) | Pflicht über **CI ok** | wie oben |
| Workflows: Syntax (actionlint) und Sicherheit (zizmor) | `npm run lint:actions` | **Workflows (actionlint, zizmor)** (CI) | Pflicht über **CI ok** | wie oben |
| CodeQL (SAST, Suite `security-extended`) für App und Workflows | `npm run sast:codeql` | **Analyze (javascript-typescript)**, **Analyze (actions)** (CodeQL) | Pflicht, zusätzlich *Code scanning results* im Ruleset | Push auf `main`, jeder PR, montags |
| Neu eingeführte Schwachstellen in Abhängigkeiten (OSV-Scanner) | – (siehe unten) | **Scan PR / osv-scan** (OSV-Scanner) | Pflicht | jeder PR |
| Coverage als Kommentar im PR (gegen main und für geänderte Dateien) | `node scripts/coverage-comment.mjs` (Vorschau) | **Coverage-Kommentar (optional)** (CI) | optional, kein Gate | PRs aus diesem Repo (nicht Forks, nicht Dependabot) |
| Mutation-Testing der Fachlogik (Stryker) | `npm run mutation` | **Stryker** (Mutation) | optional, nur Bericht | montags, manuell |
| npm audit (nur Produktionsabhängigkeiten, ab *high*) | `npm audit --omit=dev --audit-level=high` | **npm audit (optional)** (CI) | optional: kann ohne Zutun des PRs rot werden | wie **Lint** |
| Alle bekannten Schwachstellen (OSV-Scanner) | – | **Scan / osv-scan** (OSV-Scanner) | optional, nur Alerts | Push auf `main`, montags |
| OpenSSF Scorecard (Supply-Chain-Praktiken) | – | **Scorecard analysis** (Scorecard) | optional, nur Alerts | Push auf `main`, montags |
| Updates von npm-Paketen und Actions | – | Dependabot (`.github/dependabot.yml`) | – | montags |

Deployt wird nur, wenn **CI ok** grün ist (Job **Deploy via FTP**, siehe [Release](#release)).

### Lokal: Hooks und Übersicht

- `npm run check` führt die Pflicht-Checks wie in CI nacheinander aus (ohne E2E, ~45 s) und zeigt am Ende eine Übersicht mit dem jeweiligen CI-Check; Ausgaben gibt es nur bei Fehlern. `npm run check -- --all` nimmt E2E, CodeQL und Mutation-Testing dazu, `npm run check -- typecheck unit` nur einzelne Checks.
- **Git-Hooks** über [lefthook](https://lefthook.dev) (`lefthook.yml`, installiert bei `npm ci`/`npm install`): vor jedem Commit gitleaks und ESLint auf die gestagten Dateien, bei gestagten Dateien unter `.github/` actionlint und zizmor; vor jedem Push Typecheck, Unit-Tests, Knip und Architekturregeln. Im Notfall überspringen: `LEFTHOOK=0 git commit …`.
- **Claude Code** (`.claude/settings.json`): Nach jedem Bearbeiten prüft `scripts/claude-hook-check.mjs` die Datei mit ESLint und gitleaks (Dateien unter `.github/` zusätzlich mit actionlint und zizmor), vor dem Ende jeder Antwort prüft `scripts/claude-stop-check.mjs` bei uncommitteten Code-Änderungen Typecheck, Unit-Tests, Knip und Architekturregeln. Befunde gehen direkt an Claude zurück, Claude behebt sie, bevor es weitergeht.
- `npm run pr:status` zeigt für den PR des aktuellen Branches Pflicht- und optionale Checks, die Logs fehlgeschlagener Jobs, offene Code-Scanning-Alerts (CodeQL, OSV) und den Review-Stand; `-- --watch` wartet, bis alle Checks fertig sind.

Alle Actions sind per Commit-SHA gepinnt (Kommentar mit Version dahinter), Dependabot hält sie aktuell. Workflows haben nur die nötigen Rechte (`permissions`), neue Pushes auf einen PR brechen ältere Läufe ab.

### Lokale Befehle

- `npm run sast:codeql` lädt beim ersten Aufruf das gepinnte CodeQL-Bundle (~550 MB, Prüfsumme wird kontrolliert) nach `~/.cache/ffgfuea/codeql` (änderbar über `FFGFUEA_CACHE_DIR` bzw. `CODEQL_CACHE_DIR`), analysiert App und Workflows und schreibt `reports/codeql.sarif` (plus je Sprache `reports/codeql-<sprache>.sarif`). Gibt es Funde der Stufe *error* oder *warning*, listet das Skript sie auf und endet mit Exit-Code 1. Bei wenig Arbeitsspeicher: `CODEQL_RAM=2048 CODEQL_THREADS=2 npm run sast:codeql`.
- `npm run secrets:scan` lädt das gepinnte gitleaks nach `~/.cache/ffgfuea/gitleaks` und prüft die gesamte Git-Historie (alle Refs) und das Arbeitsverzeichnis. Gefundene Secrets werden nur geschwärzt ausgegeben. `bash scripts/gitleaks.sh --staged` prüft nur die gestagten Änderungen (Pre-Commit-Hook), `--files <datei> …` nur einzelne Dateien (Claude-Code-Hook), `--history` bzw. `--dir` nur einen Teil.
- `npm run test:coverage` misst die Coverage (Bericht in `coverage/`) und schlägt fehl, wenn eine der Schwellen in `angular.json` (`coverageThresholds`) unterschritten wird.
- `npx lefthook run pre-commit` bzw. `pre-push` führt die Git-Hooks von Hand aus. In CI (`CI` gesetzt), ohne Git-Repository und in Git-Worktrees installiert `npm ci` keine Hooks; die im Haupt-Repo installierten gelten auch für Worktrees.
- `npm run check:licenses` prüft die Lizenzen aller installierten Pakete gegen `license-check.json`.
- `npm run lint:actions` lädt die gepinnten Releases von actionlint und zizmor (Prüfsummen im Skript) nach `~/.cache/ffgfuea/` und prüft `.github/`. Mit gesetztem `GH_TOKEN` macht zizmor zusätzlich Online-Prüfungen (z. B. bekannte Schwachstellen in verwendeten Actions).
- `npm run mutation` schreibt den Bericht nach `reports/mutation/index.html` und merkt sich die Ergebnisse in `reports/stryker-incremental.json`; spätere Läufe prüfen nur Mutanten in geändertem Code oder mit geänderten Tests. Welche Dateien mutiert werden, steht in `stryker.config.mjs`.
- `reports/` ist in `.gitignore`.

### Ergebnisse lesen

- **CodeQL / OSV-Scanner / Scorecard:** GitHub → *Security → Code scanning*. Jeder Alert zeigt Regel, Fundstelle und bei CodeQL den Datenfluss (*Show paths*). Lokal: Ausgabe von `npm run sast:codeql` oder `reports/codeql.sarif` z. B. mit der VS-Code-Erweiterung *SARIF Viewer* öffnen.
- **Im PR:** ESLint-, Knip-, actionlint- und zizmor-Befunde sowie fehlgeschlagene Unit- und E2E-Tests erscheinen als Annotation direkt an der Codezeile (*Files changed*). Jeder Lauf von **CI** hat eine Zusammenfassung (*Checks → CI → Summary*) mit ESLint-Befunden, Coverage je Metrik gegen die Schwellen, E2E-Ergebnis, bei Fehlern Knip- und Architektur-Befunden und der Tabelle der Pflicht-Jobs von **CI ok**. Coverage-Bericht, Playwright-Bericht und Traces liegen als Artefakte beim Lauf.
- **Coverage:** Im PR ein Kommentar (wird bei jedem Push aktualisiert) mit den vier Metriken gegen die Schwellen und gegen den letzten Lauf auf `main`, dazu die Zeilen- und Zweig-Coverage der im PR geänderten Dateien (`scripts/coverage-comment.mjs`). Dieselbe Tabelle ohne Vergleich steht in der Zusammenfassung von **Unit-Tests & Coverage**, der vollständige HTML-Bericht im Artefakt `coverage`. GitHub Code Quality (kostenpflichtig) wird bewusst nicht verwendet; das Gate sind die Schwellen in `angular.json`.
- **Mutation-Testing:** *Actions → Mutation → letzter Lauf → Summary* (Score je Datei); überlebende Mutanten mit Fundstelle im Artefakt `mutation-report`.
- **Im Terminal:** `npm run pr:status` (siehe oben).
- **gitleaks:** Ausgabe im Log des Checks **Secrets (gitleaks)** (Datei, Zeile, Regel, Commit; das Secret selbst ist geschwärzt).
- **npm audit / Lizenzen:** Log der Checks **npm audit (optional)** bzw. **Lizenzen**.

### Fehlalarme und bewusste Ausnahmen

Jede Ausnahme bekommt eine Begründung – im Code-Kommentar, in der Konfiguration oder beim Schließen des Alerts.

- **CodeQL:** Echte Probleme im Code beheben. Fehlalarme in GitHub unter *Security → Code scanning* mit *Dismiss alert* („False positive“ oder „Won’t fix“) und Kommentar schließen; der Alert bleibt dann auch bei späteren Läufen geschlossen. Ganze Pfade lassen sich in `.github/codeql/codeql-config.yml` (`paths-ignore`) ausnehmen – dort sind bewusst nur `node_modules`, Build-Ausgaben und Testcode (`*.spec.ts`, `src/test-setup.ts`, `src/app/testing/`) ausgenommen: Testcode läuft nur in Vitest und wird nie ausgeliefert, Alerts dort sind nicht ausnutzbar.
- **gitleaks:** Ein echtes Secret, das committet wurde, gilt als kompromittiert: **sofort widerrufen bzw. rotieren**, erst danach aufräumen (die Historie wird nicht umgeschrieben). Fehlalarme mit `gitleaks:allow` als Kommentar in der betroffenen Zeile markieren oder in `.gitleaks.toml` eine `[[allowlists]]`-Regel (möglichst eng, mit `description`) ergänzen.
- **OSV-Scanner:** Am besten das Paket aktualisieren (Dependabot). Ist eine Schwachstelle nachweislich nicht ausnutzbar, eine `osv-scanner.toml` im Repo-Root anlegen:

  ```toml
  [[IgnoredVulns]]
  id = "GHSA-xxxx-xxxx-xxxx"
  ignoreUntil = 2027-01-31
  reason = "Nur im Dev-Server von Vite, nicht im ausgelieferten Build"
  ```

  Der PR-Check schlägt nur bei Schwachstellen fehl, die der PR neu einführt; der Lauf auf `main` meldet alle bekannten als Alerts, ohne fehlzuschlagen.
- **npm audit:** Geprüft werden nur Produktionsabhängigkeiten ab *high*. Lässt sich ein Fund nicht sofort beheben, `overrides` in `package.json` prüfen oder das Paket aktualisieren.
- **Knip:** Ungenutztes entfernen. Wird etwas nur über Konfiguration eingebunden (z. B. `angular.json`, `.claude/settings.json`), in `knip.jsonc` unter `entry` eintragen; Pakete, die nur per CLI laufen, unter `ignoreDependencies`.
- **dependency-cruiser:** Import umbauen. Ist eine Regel selbst falsch, in `.dependency-cruiser.cjs` anpassen (jede Regel hat einen `comment` mit Begründung).
- **actionlint / zizmor:** Befund beheben. Ausnahmen in `.github/actionlint.yaml` bzw. `.github/zizmor.yml` (Regel) oder als `# zizmor: ignore[<regel>]` in der Zeile, jeweils mit Begründung.
- **Barrierefreiheit (axe):** Im Template beheben (z. B. `aria-label`, Kontrast). Echte Fehlalarme gezielt mit `AxeBuilder.disableRules()` bzw. `exclude()` in `expectBarrierefrei()` ausnehmen, mit Kommentar.
- **Lizenzen:** Neue Lizenz zur `allowed`-Liste in `license-check.json` hinzufügen, wenn sie für eine ausgelieferte Web-App unproblematisch ist; sonst eine Ausnahme je Paket unter `exceptions` mit `reason`. Entwicklungsabhängigkeiten werden nicht ausgeliefert und erzeugen nur Warnungen.

### CodeQL-Lizenz und LICENSE-Datei

Die CodeQL CLI darf ohne kommerzielle Lizenz nur für Open-Source-Codebasen genutzt werden, also für öffentlich auf GitHub gehosteten Code unter einer von der OSI anerkannten Lizenz (CodeQL Terms and Conditions). Das Repository ist öffentlich, **enthält aber derzeit keine `LICENSE`-Datei** – ohne Lizenz ist der Code rechtlich nicht „Open Source“. Damit die lokale Nutzung (`npm run sast:codeql`) eindeutig erlaubt ist, sollte eine OSI-Lizenz (z. B. MIT) ergänzt werden. Code scanning mit CodeQL in GitHub Actions ist für öffentliche Repositories unabhängig davon kostenlos.

### Manuelle Einstellungen in GitHub

Diese Einstellungen kann nur ein Admin der Organisation bzw. des Repos setzen:

1. *Settings → Advanced Security* (bzw. *Code security*):
   - **Secret scanning** und **Push protection** aktivieren.
   - **Dependabot alerts** und **Dependabot security updates** aktivieren (*Dependabot version updates* kommen aus `.github/dependabot.yml`).
   - **Private vulnerability reporting** aktivieren (für `SECURITY.md`).
   - **Code scanning**: kein *Default setup* aktivieren, der Workflow `codeql.yml` ist das *Advanced setup* (beides gleichzeitig ist nicht möglich).
   - **Code Quality** nicht aktivieren (kostenpflichtig pro Committer); Coverage prüft die CI selbst.
2. *Settings → Actions → General*: *Workflow permissions* auf **Read repository contents and packages permissions** stellen; *Allow GitHub Actions to create and approve pull requests* aus.
3. *Settings → Rules → Rulesets* → neues Branch-Ruleset für `main` (Default branch):
   - *Restrict deletions*, *Block force pushes*, *Require a pull request before merging* (nur Squash) mit *Required approvals* 1, *Require review from Code Owners*, *Dismiss stale pull request approvals when new commits are pushed* und *Require approval of the most recent reviewable push*.
   - *Bypass list*: Rolle *Repository admin* mit *For pull requests only*, damit eigene PRs von @jakob-fyi (ohne zweiten Reviewer) gemergt werden können.
   - *Require status checks to pass* mit genau diesen Checks (Quelle GitHub Actions), *Require branches to be up to date* aus:
     - `CI ok`
     - `Analyze (javascript-typescript)`
     - `Analyze (actions)`
     - `Scan PR / osv-scan`
   - *Require code scanning results*: Tool **CodeQL**, Schwelle *Security alerts: High or higher*, *Alerts: Errors*.
   - Keine Regeln *Require code quality results* und *Restrict code coverage*: beide setzen GitHub Code Quality voraus.
   - Die Checks erscheinen in der Auswahl erst, nachdem die Workflows einmal gelaufen sind.
4. Optional: *Environments → production* auf *Deployment branches and tags*: `main` und Tags `v*` beschränken und ggf. *Required reviewers* setzen.

## Flaschen

Flaschen kommen aus der MAT Synchronisierung oder werden unter *Verwaltung* je Feuerwehr manuell erfasst (`quelle`: `mat` bzw. `manuell`, Flaschen ohne `quelle` stammen aus MAT). Nur manuelle Flaschen können bearbeitet und gelöscht werden. Der Barcode einer manuellen Flasche besteht nur aus Ziffern (mindestens 5) und muss über alle Feuerwehren eindeutig sein.

Die Synchronisierung ersetzt die MAT Flaschen einer Feuerwehr und behält ihre manuellen Flaschen. Liefert MAT eine Flasche mit dem Barcode einer manuellen Flasche – egal bei welcher Feuerwehr – gewinnt MAT: Die manuelle Flasche wird entfernt und darüber informiert. Bereits erfasste Füllungen bleiben unverändert.

## Berichte

Der Dialog *Berichte* (Kachel im Füllbetrieb, Button unter *Ereignisse*, nach „Abschließen & Berichte drucken“) zeigt das Ereignis und bietet den Gesamtbericht (A4-Querformat) und einen Bericht pro Feuerwehr (A4-Hochformat) zur Auswahl an, mit Schnellauswahl *Alle Berichte*, *Nur Gesamtbericht* und *Alle Feuerwehrberichte*. Alle Berichte werden mit jsPDF als PDF erzeugt (echter Text, Kopfzeilen der Tabelle auf jeder Seite, Fußzeile mit Ereignisnummer und „Seite x von y“ pro Bericht). jsPDF wird erst beim ersten Bericht nachgeladen.

- **Drucken** erzeugt ein einziges PDF mit allen ausgewählten Berichten (Seiten in Hoch- und Querformat gemischt) und öffnet dafür den Druckdialog des Browsers über einen versteckten iframe. Klappt das nicht, wird das PDF in einem neuen Tab geöffnet; blockiert der Browser auch das, bietet der Dialog einen Link *PDF öffnen* an.
- **Als PDF speichern** (nur unter „Einsätze & Übungen“, im Füllbetrieb nicht angeboten) speichert jeden ausgewählten Bericht als eigenes PDF.

Ist unter *Einstellungen → PDF-Ablage* ein Ordner gewählt, wird jeder Bericht, der gedruckt oder gespeichert wird, dort als eigenes PDF abgelegt. Darin werden die PDFs nach Jahr und Ereignisnummer abgelegt, vorhandene Dateien werden überschrieben:

```
<Ordner>/
  2026/
    2026-007_Einsatz_Tulln/
      2026-007_Gesamtbericht.pdf
      2026-007_Feuerwehr_FF_Tulln.pdf
      2026-007_Feuerwehr_FF_Grossweikersdorf.pdf
```

Ordner- und Dateinamen enthalten keine Umlaute (ä → ae, ß → ss) und keine Sonderzeichen. Im Testmodus landen die PDFs im Unterordner `Testmodus`.

Ist *Beim Abschließen & Drucken alle Berichte ablegen* eingeschaltet (Standard) und ein Ordner gewählt, legt „Abschließen & Berichte drucken“ alle Berichte im Ordner ab, bevor sich der Dialog *Berichte* öffnet.

Die Ordnerauswahl nutzt die File System Access API und funktioniert nur in **Chrome und Edge am PC**. Der Ordner wird in einer eigenen IndexedDB (`ffgfuea_dateiablage`) gespeichert, die Schreibberechtigung fragt der Browser bei Bedarf gleich nach dem Klick ab, noch bevor die PDFs erzeugt werden. Ohne gewählten Ordner, ohne Berechtigung oder in anderen Browsern lädt *Als PDF speichern* die PDFs einzeln herunter – mit denselben Dateinamen, damit sie nach Ereignisnummer sortiert bleiben. *Drucken* druckt in diesem Fall nur.

### Altberichte (Übergangslösung)

Unter *Einstellungen → Altberichte* lassen sich einmalig die Berichte aller abgeschlossenen Ereignisse (optional nur eines Jahres) im **alten Layout** des früheren Druckdialogs als PDF erzeugen: A4 hoch, Gesamtbericht und ein Bericht pro Feuerwehr, „Gedruckt“ mit dem Zeitpunkt der Erzeugung und dem Vermerk „(nachträglich erstellt)“. Die PDFs landen mit denselben Ordner- und Dateinamen wie die neuen PDFs im Ordner der PDF-Ablage (im Testmodus im Unterordner `Testmodus`). **Vorhandene Dateien werden nie überschrieben**, sondern übersprungen, ein erneuter Durchlauf erzeugt also nur fehlende PDFs. Ein Ordner muss gewählt sein, ein Download als Ersatz ist nicht vorgesehen.

Entfernen, sobald die alten Berichte übernommen sind:

1. Den Ordner `src/app/altberichte/` löschen.
2. In `src/app/pages/settings-page/settings-page.component.html` die Zeile `<ffg-altberichte-card></ffg-altberichte-card>` und in `settings-page.component.ts` den Import sowie den Eintrag `AltberichteCardComponent` in `imports` entfernen.
3. Diesen Abschnitt aus der README löschen.

## Export & Import

Unter *Einstellungen* lassen sich alle Daten als JSON-Datei herunterladen und wieder importieren – zur Weiterverarbeitung oder als Sicherung. Im Testmodus wird die Testdatenbank exportiert bzw. befüllt.

```json
{
  "format": "ffgfuea-export",
  "version": 1,
  "appVersion": "1.3.0",
  "exportedAt": "2026-10-20T08:05:00.000Z",
  "testMode": false,
  "feuerwehren": [
    {"feuerwehrNummer": 12345, "eigentuemerId": 12345, "name": "…", "flaschen": [{"barcode": "1234501", "…": "…"}]}
  ],
  "personen": [
    {"id": 1, "vorname": "Max", "nachname": "Muster"}
  ],
  "ereignisse": [
    {"id": 1, "type": "uebung", "ort": "Gemeinlebarn", "datetimeStart": "2026-05-01T08:00:00.000Z", "datetimeEnd": "2026-05-01T10:00:00.000Z", "personen": [{"id": 1, "…": "…"}], "fuellungen": [{"datetime": "2026-05-01T08:30:00.000Z", "flasche": {"barcode": "1234501", "…": "…"}}]}
  ]
}
```

Jeder Datensatz steht in einer eigenen Zeile. Füllungen enthalten die Flasche so, wie sie zum Zeitpunkt der Füllung gespeichert war.

Beim Import gibt es zwei Möglichkeiten:

- **Zusammenführen** – fügt nur hinzu, was noch fehlt: Feuerwehren nach Feuerwehrnummer, Personen nach Vor- und Nachname, Ereignisse nach Art und Beginn.
- **Ersetzen** – löscht alle vorhandenen Daten und stellt den Export wieder her (inklusive Ids).

Der Import läuft in einer Transaktion: Entweder wird alles übernommen oder nichts. Während eines laufenden Ereignisses ist kein Import möglich.

### Altes Import-Format

Eine Liste von Ereignissen, deren Füllungen über den Barcode einer Flasche der gespeicherten Feuerwehren zugeordnet werden. Dieses Format kann nur zusammengeführt werden.

```json
[{
    "type": "uebung",
    "ort": "Gemeinlebarn",
    "datetimeStart": "2021-07-02 23:12:09",
    "datetimeEnd": "2021-07-03 01:18:59",
    "fuellungen": [
        {
            "datetime": "2021-07-02 23:14:09",
            "flaschenBarcode": "176160"
        }
    ]
}]
```
