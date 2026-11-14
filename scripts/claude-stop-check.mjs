// Claude-Code-Hook (Stop, siehe .claude/settings.json): Bevor Claude eine Antwort beendet,
// laufen Typecheck, Unit-Tests, Knip und Architekturregeln, sofern sich seit der letzten Prüfung Code geändert hat.
// Ergänzt den PostToolUse-Hook (claude-hook-check.mjs), der nur die einzelne Datei prüft:
// Typfehler in anderen Dateien, kaputte Tests, verwaiste Exporte und Regelverstöße bei Imports fallen sonst erst beim Push auf.
//
// - Keine uncommitteten Änderungen an Code/Konfiguration: nichts zu tun.
// - Gleicher Stand wie bei der letzten Prüfung: Ergebnis wird nicht wiederholt. War sie rot und
//   Claude hat seitdem nichts geändert, wird nicht erneut blockiert (keine Endlosschleife),
//   sondern nur ein Hinweis für den Menschen ausgegeben.
// - Fehler: Exit 2, Befunde auf stderr. Claude Code gibt sie an Claude zurück, Claude arbeitet weiter.
//
// Von Hand testen:  echo '{}' | node scripts/claude-stop-check.mjs
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.CLAUDE_PROJECT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const relevant = /\.(ts|html|scss|css|json|mjs|js)$/;
const ausgenommen = ['node_modules/', 'dist/', '.angular/', 'coverage/', 'reports/', '.claude/', 'playwright-report/', 'test-results/'];

function ausfuehren(befehl, argumente)
{
    return new Promise(fertig =>
    {
        execFile(befehl, argumente, { cwd: root, maxBuffer: 50 * 1024 * 1024, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } }, (fehler, stdout, stderr) =>
        {
            const code = fehler ? (typeof fehler.code === 'number' ? fehler.code : 1) : 0;
            fertig({ code, stdout, ausgabe: `${stdout}${stderr}`.trim() });
        });
    });
}

/** Letzte Zeilen einer Ausgabe, damit Claude nicht mit Logs überflutet wird */
function ende(text, anzahl = 60)
{
    // ngc färbt auch ohne TTY, Farbcodes stören nur
    const zeilen = text.replace(new RegExp(String.raw`\u001b\[[0-9;]*m`, 'g'), '').split('\n');
    return (zeilen.length > anzahl ? [`… ${zeilen.length - anzahl} Zeilen gekürzt`] : []).concat(zeilen.slice(-anzahl)).join('\n');
}

const status = await ausfuehren('git', ['status', '--porcelain=v1', '-uall', '-z']);
if (status.code !== 0) process.exit(0);
const eintraege = status.stdout.split('\0').filter(e => e.length > 3);
const dateien = eintraege.map(e => e.slice(3)).filter(d => relevant.test(d) && !ausgenommen.some(a => d.startsWith(a)));
if (dateien.length === 0) process.exit(0);

// Fingerabdruck des Arbeitsstands: HEAD + Diff + Inhalt neuer Dateien
const head = await ausfuehren('git', ['rev-parse', 'HEAD']);
const diff = await ausfuehren('git', ['diff', 'HEAD', '--binary']);
const hash = createHash('sha256').update(head.stdout).update(diff.stdout);
for (const eintrag of eintraege.filter(e => e.startsWith('??')))
{
    const datei = resolve(root, eintrag.slice(3));
    hash.update(eintrag);
    if (existsSync(datei)) hash.update(readFileSync(datei));
}
const fingerabdruck = hash.digest('hex');

const pfad = await ausfuehren('git', ['rev-parse', '--git-path', 'claude-stop-check.json']);
const statusDatei = resolve(root, pfad.stdout.trim());
let letzte = null;
try
{
    letzte = JSON.parse(readFileSync(statusDatei, 'utf8'));
}
catch
{
    // Noch keine Prüfung gespeichert
}

if (letzte?.fingerabdruck === fingerabdruck)
{
    if (!letzte.ok)
    {
        process.stdout.write(JSON.stringify({ systemMessage: 'Stop-Check (Typecheck, Unit-Tests, Knip, Architektur) ist weiterhin rot (seit der letzten Prüfung unverändert).' }));
    }
    process.exit(0);
}

const [typecheck, tests, knip, architektur] = await Promise.all([
    ausfuehren('npm', ['run', '--silent', 'typecheck']),
    ausfuehren('npx', ['--no', '--', 'ng', 'test', '--watch=false']),
    ausfuehren('npm', ['run', '--silent', 'knip']),
    ausfuehren('npm', ['run', '--silent', 'depcruise'])
]);

const befunde = [];
if (typecheck.code !== 0) befunde.push(`Typecheck (npm run typecheck):\n${ende(typecheck.ausgabe)}`);
if (tests.code !== 0) befunde.push(`Unit-Tests (npx ng test --watch=false):\n${ende(tests.ausgabe, 80)}`);
if (knip.code !== 0) befunde.push(`Knip, ungenutzter Code (npm run knip):\n${ende(knip.ausgabe)}`);
if (architektur.code !== 0) befunde.push(`Architekturregeln (npm run depcruise, Regeln in .dependency-cruiser.cjs):\n${ende(architektur.ausgabe)}`);

try
{
    writeFileSync(statusDatei, JSON.stringify({ fingerabdruck, ok: befunde.length === 0, zeit: new Date().toISOString() }));
}
catch
{
    // Ohne gespeicherten Stand wird beim nächsten Mal einfach erneut geprüft
}

if (befunde.length > 0)
{
    process.stderr.write(`Stop-Check: uncommittete Änderungen brechen Typecheck, Unit-Tests, Knip oder Architekturregeln. Bitte beheben.\n\n${befunde.join('\n\n')}\n`);
    process.exit(2);
}
