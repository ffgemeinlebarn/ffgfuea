// Führt die Checks der CI lokal nacheinander aus und zeigt am Ende eine Übersicht.
// Ausgaben werden mitgeschnitten und nur bei Fehlern gezeigt (letzte Zeilen).
//
//   npm run check                        Pflicht-Checks wie "CI ok" ohne E2E, plus npm audit (optional)
//   npm run check -- --all               zusätzlich E2E (inkl. Barrierefreiheit), CodeQL und Mutation-Testing
//                                        (dauert, CodeQL lädt beim 1. Mal ~550 MB)
//   npm run check -- typecheck unit      nur bestimmte Checks (Namen siehe Tabelle unten)
//
// Exit 1, wenn ein Pflicht-Check fehlschlägt. Optionale Checks werden nur angezeigt.
// Die Checks laufen bewusst nacheinander (parallele Last führt zu Timeouts, siehe AGENTS.md).
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function coverageDetail()
{
    const datei = join(root, 'coverage', 'ffgfuea', 'coverage-summary.json');
    if (!existsSync(datei)) return '';
    const t = JSON.parse(readFileSync(datei, 'utf8')).total;
    return `Anw. ${t.statements.pct} %, Zweige ${t.branches.pct} %, Fkt. ${t.functions.pct} %, Zeilen ${t.lines.pct} %`;
}

function mutationDetail()
{
    const datei = join(root, 'reports', 'mutation', 'mutation.json');
    if (!existsSync(datei)) return '';
    const mutanten = Object.values(JSON.parse(readFileSync(datei, 'utf8')).files ?? {}).flatMap(f => f.mutants);
    const getoetet = mutanten.filter(m => m.status === 'Killed' || m.status === 'Timeout').length;
    const zaehlend = mutanten.filter(m => ['Killed', 'Timeout', 'Survived', 'NoCoverage'].includes(m.status)).length;
    return zaehlend === 0 ? '' : `Score ${(getoetet / zaehlend * 100).toFixed(1)} %, Bericht reports/mutation/index.html`;
}

/** name: Kurzname für die Kommandozeile, ci: entsprechender Check in GitHub */
const checks = [
    { name: 'lint', titel: 'Lint (ESLint)', ci: 'Lint', befehl: [npx, '--no', '--', 'eslint', '.'] },
    { name: 'typecheck', titel: 'Typecheck', ci: 'Typecheck', befehl: [npm, 'run', '--silent', 'typecheck'] },
    { name: 'unit', titel: 'Unit-Tests & Coverage', ci: 'Unit-Tests & Coverage', befehl: [npm, 'run', '--silent', 'test:coverage'], detail: coverageDetail },
    { name: 'build', titel: 'Build', ci: 'Build', befehl: [npx, '--no', '--', 'ng', 'build'] },
    { name: 'licenses', titel: 'Lizenzen', ci: 'Lizenzen', befehl: [npm, 'run', '--silent', 'check:licenses'] },
    { name: 'secrets', titel: 'Secrets (gitleaks)', ci: 'Secrets (gitleaks)', befehl: ['bash', 'scripts/gitleaks.sh'] },
    { name: 'knip', titel: 'Knip (ungenutzter Code)', ci: 'Knip (ungenutzter Code)', befehl: [npm, 'run', '--silent', 'knip'] },
    { name: 'depcruise', titel: 'Architektur', ci: 'Architektur (dependency-cruiser)', befehl: [npm, 'run', '--silent', 'depcruise'] },
    { name: 'actions', titel: 'Workflows', ci: 'Workflows (actionlint, zizmor)', befehl: ['bash', 'scripts/actions-lint.sh'] },
    { name: 'audit', titel: 'npm audit', ci: 'npm audit (optional)', befehl: [npm, 'audit', '--omit=dev', '--audit-level=high'], optional: true },
    { name: 'e2e', titel: 'E2E (Playwright)', ci: 'E2E (Playwright)', befehl: [npx, '--no', '--', 'playwright', 'test'], extra: true },
    { name: 'codeql', titel: 'CodeQL (SAST)', ci: 'Analyze (…)', befehl: ['bash', 'scripts/codeql.sh'], extra: true },
    { name: 'mutation', titel: 'Mutation (Stryker)', ci: 'Mutation (wöchentlich)', befehl: [npm, 'run', '--silent', 'mutation'], extra: true, optional: true, detail: mutationDetail }
];

const argumente = process.argv.slice(2);
const namen = argumente.filter(a => !a.startsWith('-'));
const unbekannt = namen.filter(n => !checks.some(c => c.name === n));
if (unbekannt.length > 0 || argumente.includes('--help'))
{
    if (unbekannt.length > 0) console.error(`Unbekannt: ${unbekannt.join(', ')}`);
    console.error(`Verwendung: npm run check [-- --all | <${checks.map(c => c.name).join('|')}> …]`);
    process.exit(2);
}
const auswahl = namen.length > 0
    ? checks.filter(c => namen.includes(c.name))
    : checks.filter(c => !c.extra || argumente.includes('--all'));

const tty = process.stdout.isTTY;
const farbe = (code, text) => tty ? `\u001b[${code}m${text}\u001b[0m` : text;
const gruen = text => farbe('32', text);
const rot = text => farbe('31', text);
const gelb = text => farbe('33', text);
const grau = text => farbe('90', text);

function ausfuehren([befehl, ...args])
{
    return new Promise(fertig =>
    {
        const kind = spawn(befehl, args, { cwd: root, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
        let ausgabe = '';
        kind.stdout.on('data', d => ausgabe += d);
        kind.stderr.on('data', d => ausgabe += d);
        kind.on('error', fehler => fertig({ code: 127, ausgabe: String(fehler) }));
        kind.on('close', code => fertig({ code: code ?? 1, ausgabe }));
    });
}

const ergebnisse = [];
for (const check of auswahl)
{
    if (tty) process.stdout.write(`${grau('▶')} ${check.titel} …`);
    const start = Date.now();
    const { code, ausgabe } = await ausfuehren(check.befehl);
    const sekunden = ((Date.now() - start) / 1000).toFixed(1);
    const ok = code === 0;
    const symbol = ok ? gruen('✔') : check.optional ? gelb('▲') : rot('✘');
    const detail = check.detail?.() ?? '';
    if (tty) process.stdout.write('\r\u001b[2K');
    console.log(`${symbol} ${check.titel} ${grau(`${sekunden} s`)}${detail ? `  ${grau(detail)}` : ''}`);
    if (!ok)
    {
        // ngc färbt auch ohne TTY
        const zeilen = ausgabe.replace(new RegExp(String.raw`\u001b\[[0-9;]*m`, 'g'), '').trimEnd().split('\n');
        const ausschnitt = zeilen.slice(-60);
        if (zeilen.length > ausschnitt.length) console.log(grau(`  … ${zeilen.length - ausschnitt.length} Zeilen gekürzt`));
        console.log(ausschnitt.map(z => `  ${z}`).join('\n'));
        console.log(grau(`  Befehl: ${check.befehl.join(' ')}`));
    }
    ergebnisse.push({ check, ok, sekunden });
}

const fehler = ergebnisse.filter(e => !e.ok && !e.check.optional);
const warnungen = ergebnisse.filter(e => !e.ok && e.check.optional);
console.log('');
console.log('Check'.padEnd(26) + 'Ergebnis'.padEnd(12) + 'CI-Check');
for (const { check, ok } of ergebnisse)
{
    const status = ok ? gruen('ok'.padEnd(12)) : check.optional ? gelb('optional'.padEnd(12)) : rot('FEHLER'.padEnd(12));
    console.log(`${check.titel.padEnd(26)}${status}${grau(check.ci)}`);
}
console.log('');
if (fehler.length > 0) console.log(rot(`${fehler.length} Pflicht-Check(s) fehlgeschlagen.`));
else console.log(gruen(`Alle Pflicht-Checks grün${warnungen.length > 0 ? `, ${warnungen.length} optionale(r) mit Befund` : ''}.`));
if (!auswahl.some(c => c.extra)) console.log(grau('E2E, CodeQL und Mutation nicht enthalten: npm run check -- --all'));
process.exit(fehler.length > 0 ? 1 : 0);
