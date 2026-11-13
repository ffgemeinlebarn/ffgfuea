# FFGFÜA

[![Build & Deploy](https://github.com/ffgemeinlebarn/ffgfuea/actions/workflows/multistage.yml/badge.svg)](https://github.com/ffgemeinlebarn/ffgfuea/actions/workflows/multistage.yml)
[![CodeQL](https://github.com/ffgemeinlebarn/ffgfuea/actions/workflows/codeql.yml/badge.svg)](https://github.com/ffgemeinlebarn/ffgfuea/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/ffgemeinlebarn/ffgfuea/badge)](https://scorecard.dev/viewer/?uri=github.com/ffgemeinlebarn/ffgfuea)

FF Gemeinlebarn Füllapplikation

## Entwicklung

- `npm start` – Entwicklungsserver. Verwendet Beispieldaten statt des lokalen MAT Sync-Services (`fakeSyncApi` in `src/environments/environment.development.ts`).
- `npm test` – Unit-Tests mit Vitest
- `npm run build` – Produktions-Build nach `dist/ffgfuea/browser`
- `npm run e2e` – E2E-Tests mit Playwright, siehe unten

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

In GitHub Actions laufen die Tests bei jedem Pull Request und bei Pushes auf `main` und `refactoring` (`.github/workflows/e2e.yml`); der HTML-Bericht und bei Fehlern die Traces werden als Artefakte hochgeladen.

## Release

Pull Requests und Pushes auf `main` werden von GitHub Actions getestet und gebaut. Deployt wird nur ein Release:

1. Version in `package.json` und `src/environments/environment.ts` anheben
2. Tag pushen, z. B. `git tag v1.4.0 && git push origin v1.4.0`

Alternativ in GitHub unter *Actions → Build & Deploy → Run workflow* von `main` manuell starten. Die Option „Clean slate“ löscht vorher alle Dateien am Server (z. B. beim ersten Deploy, um alte Builds zu entfernen).

## Qualität & Sicherheit

### Was läuft wo

| Prüfung | Lokal | CI (Workflow → Check) | Wann in CI |
| --- | --- | --- | --- |
| Unit-Tests & Build | `npm test`, `npm run build` | `multistage.yml` → **Test & Build** | Push auf `main`, `v*`-Tags, jeder PR |
| npm audit (nur Produktionsabhängigkeiten, ab *high*) | `npm audit --omit=dev --audit-level=high` | Schritt in **Test & Build** | wie oben |
| Lizenzen der Abhängigkeiten | `npm run check:licenses` | Schritt in **Test & Build** | wie oben |
| CodeQL (SAST, Suite `security-extended`) für App und Workflows | `npm run sast:codeql` | `codeql.yml` → **Analyze (javascript-typescript)**, **Analyze (actions)** | Push auf `main`, jeder PR, montags |
| Secrets im Code und in der Git-Historie (gitleaks) | `npm run secrets:scan` | `secrets.yml` → **gitleaks** | Push auf `main`, jeder PR |
| Bekannte Schwachstellen in Abhängigkeiten (OSV-Scanner) | – (siehe unten) | `osv-scanner.yml` → **Scan PR / osv-scan** bzw. **Scan / osv-scan** | PR bzw. Push auf `main` und montags |
| OpenSSF Scorecard (Supply-Chain-Praktiken) | – | `scorecard.yml` → **Scorecard analysis** | Push auf `main`, montags |
| Updates von npm-Paketen und Actions | – | Dependabot (`.github/dependabot.yml`) | montags |

Alle Actions sind per Commit-SHA gepinnt (Kommentar mit Version dahinter), Dependabot hält sie aktuell. Workflows haben nur die nötigen Rechte (`permissions`), neue Pushes auf einen PR brechen ältere Läufe ab.

### Lokale Befehle

- `npm run sast:codeql` lädt beim ersten Aufruf das gepinnte CodeQL-Bundle (~550 MB, Prüfsumme wird kontrolliert) nach `~/.cache/ffgfuea/codeql` (änderbar über `FFGFUEA_CACHE_DIR` bzw. `CODEQL_CACHE_DIR`), analysiert App und Workflows und schreibt `reports/codeql.sarif` (plus je Sprache `reports/codeql-<sprache>.sarif`). Gibt es Funde der Stufe *error* oder *warning*, listet das Skript sie auf und endet mit Exit-Code 1. Bei wenig Arbeitsspeicher: `CODEQL_RAM=2048 CODEQL_THREADS=2 npm run sast:codeql`.
- `npm run secrets:scan` lädt das gepinnte gitleaks nach `~/.cache/ffgfuea/gitleaks` und prüft die gesamte Git-Historie (alle Refs) und das Arbeitsverzeichnis. Gefundene Secrets werden nur geschwärzt ausgegeben. `bash scripts/gitleaks.sh --staged` prüft nur die gestagten Änderungen (für einen Pre-Commit-Hook), `--history` bzw. `--dir` nur einen Teil.
- `npm run check:licenses` prüft die Lizenzen aller installierten Pakete gegen `license-check.json`.
- `reports/` ist in `.gitignore`.

### Ergebnisse lesen

- **CodeQL / OSV-Scanner / Scorecard:** GitHub → *Security → Code scanning*. Jeder Alert zeigt Regel, Fundstelle und bei CodeQL den Datenfluss (*Show paths*). Lokal: Ausgabe von `npm run sast:codeql` oder `reports/codeql.sarif` z. B. mit der VS-Code-Erweiterung *SARIF Viewer* öffnen.
- **gitleaks:** Ausgabe im Log des Checks **gitleaks** (Datei, Zeile, Regel, Commit; das Secret selbst ist geschwärzt).
- **npm audit / Lizenzen:** Log des Checks **Test & Build**.

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
2. *Settings → Actions → General*: *Workflow permissions* auf **Read repository contents and packages permissions** stellen; *Allow GitHub Actions to create and approve pull requests* aus.
3. *Settings → Rules → Rulesets* → neues Branch-Ruleset für `main` (Default branch):
   - *Restrict deletions*, *Block force pushes*, *Require a pull request before merging*.
   - *Require status checks to pass* mit genau diesen Checks:
     - `Test & Build`
     - `Analyze (javascript-typescript)`
     - `Analyze (actions)`
     - `gitleaks`
     - `Scan PR / osv-scan`
   - *Require code scanning results*: Tool **CodeQL**, Schwelle *Security alerts: High or higher*, *Alerts: Errors*.
   - Die Checks erscheinen in der Auswahl erst, nachdem die Workflows einmal gelaufen sind.
4. Optional: *Environments → production* auf *Deployment branches and tags*: `main` und Tags `v*` beschränken und ggf. *Required reviewers* setzen.

## Flaschen

Flaschen kommen aus der MAT Synchronisierung oder werden unter *Verwaltung* je Feuerwehr manuell erfasst (`quelle`: `mat` bzw. `manuell`, Flaschen ohne `quelle` stammen aus MAT). Nur manuelle Flaschen können bearbeitet und gelöscht werden. Der Barcode einer manuellen Flasche besteht nur aus Ziffern (mindestens 5) und muss über alle Feuerwehren eindeutig sein.

Die Synchronisierung ersetzt die MAT Flaschen einer Feuerwehr und behält ihre manuellen Flaschen. Liefert MAT eine Flasche mit dem Barcode einer manuellen Flasche – egal bei welcher Feuerwehr – gewinnt MAT: Die manuelle Flasche wird entfernt und darüber informiert. Bereits erfasste Füllungen bleiben unverändert.

## Berichte

Der Dialog *Berichte* (Kachel im Füllbetrieb, Button unter *Ereignisse*, nach „Abschließen & Berichte drucken“) zeigt das Ereignis und bietet den Gesamtbericht (A4-Querformat) und einen Bericht pro Feuerwehr (A4-Hochformat) zur Auswahl an, mit Schnellauswahl *Alle Berichte*, *Nur Gesamtbericht* und *Alle Feuerwehrberichte*. Alle Berichte werden mit jsPDF als PDF erzeugt (echter Text, Kopfzeilen der Tabelle auf jeder Seite, Fußzeile mit Ereignisnummer und „Seite x von y“ pro Bericht). jsPDF wird erst beim ersten Bericht nachgeladen.

- **Drucken** erzeugt ein einziges PDF mit allen ausgewählten Berichten (Seiten in Hoch- und Querformat gemischt) und öffnet dafür den Druckdialog des Browsers über einen versteckten iframe. Klappt das nicht, wird das PDF in einem neuen Tab geöffnet; blockiert der Browser auch das, bietet der Dialog einen Link *PDF öffnen* an.
- **Als PDF speichern** speichert jeden ausgewählten Bericht als eigenes PDF.

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
