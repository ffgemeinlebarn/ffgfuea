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
