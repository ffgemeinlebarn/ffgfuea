# FFGFÜA

FF Gemeinlebarn Füllapplikation

## Entwicklung

- `npm start` – Entwicklungsserver. Verwendet Beispieldaten statt des lokalen MAT Sync-Services (`fakeSyncApi` in `src/environments/environment.development.ts`).
- `npm test` – Unit-Tests mit Vitest
- `npm run build` – Produktions-Build nach `dist/ffgfuea/browser`

## Release

Pull Requests und Pushes auf `main` werden von GitHub Actions getestet und gebaut. Deployt wird nur ein Release:

1. Version in `package.json` und `src/environments/environment.ts` anheben
2. Tag pushen, z. B. `git tag v1.4.0 && git push origin v1.4.0`

Alternativ in GitHub unter *Actions → Build & Deploy → Run workflow* von `main` manuell starten. Die Option „Clean slate“ löscht vorher alle Dateien am Server (z. B. beim ersten Deploy, um alte Builds zu entfernen).

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
