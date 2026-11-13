# Sicherheit

## Sicherheitslücken melden

Bitte Sicherheitslücken **nicht** als öffentliches Issue melden, sondern vertraulich über GitHub:

**[Security → Report a vulnerability](https://github.com/ffgemeinlebarn/ffgfuea/security/advisories/new)** (Private Vulnerability Reporting)

Hilfreich sind:

- betroffene Version bzw. Commit und Browser,
- Schritte zum Nachstellen, ggf. ein Proof of Concept,
- die eingeschätzte Auswirkung (welche Daten, welche Voraussetzungen).

Das Projekt wird ehrenamtlich betreut. Wir melden uns so bald wie möglich, stimmen eine Lösung mit dir ab und nennen dich auf Wunsch im Advisory.

*English: please report vulnerabilities privately via GitHub's "Report a vulnerability" button on the Security tab, not in public issues.*

## Unterstützte Versionen

Sicherheitskorrekturen gibt es nur für die jeweils aktuelle Version (letzter `v*`-Tag bzw. `main`).

## Umfang

FFGFÜA ist eine PWA, die ihre Daten lokal im Browser (IndexedDB) speichert und optional mit dem lokalen MAT Sync-Service spricht. Relevant sind vor allem Probleme, über die fremder Code im Kontext der App ausgeführt werden kann (z. B. über importierte JSON-Dateien oder Daten aus der MAT Synchronisierung), Datenabfluss sowie Schwachstellen in ausgelieferten Abhängigkeiten.
