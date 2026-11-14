## Was und warum

<!-- Kurz: Was ändert sich fachlich oder technisch, und warum? Issue verlinken, z. B. "Closes #13". -->

## Wie geprüft

- [ ] `npm run check` grün (Lint, Typecheck, Unit-Tests mit Coverage, Build, Lizenzen, Secrets, Knip, Architektur, Workflows)
- [ ] Abläufe in der UI geändert: `npm run e2e` grün (inkl. Barrierefreiheit), neue Abläufe mit E2E-Test
- [ ] Datenfluss, Dateisystem, PDF-Erzeugung oder Workflows geändert: `npm run sast:codeql` ohne neue Befunde
- [ ] Fachlogik geändert (Berichte, Dateinamen, Ereignisnummer, Statistik, Scanner): `npm run mutation` angesehen
- [ ] Nach dem Push: `npm run pr:status -- --watch` ohne fehlgeschlagene Checks und ohne offene Code-Scanning-Alerts

## Auswirkungen

- [ ] Dexie-Schema geändert (neue `version()` mit Upgrade)
- [ ] Neue Abhängigkeit (exakte Version, einige Wochen alt, Lizenz geprüft)
- [ ] Sichtbare Änderung in UI oder Berichten (Screenshot anhängen)
- [ ] README / AGENTS.md angepasst

<!-- Review: @jakob-fyi wird über CODEOWNERS automatisch angefragt. -->
