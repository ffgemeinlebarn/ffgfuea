// Claude-Code-Hook (PostToolUse auf Edit|Write|MultiEdit, siehe .claude/settings.json):
// prüft nur die gerade geänderte Datei mit ESLint und gitleaks, Dateien unter .github/ zusätzlich
// mit actionlint und zizmor.
//
// Eingabe: Hook-JSON auf stdin (tool_input.file_path).
// Exit 0 ohne Ausgabe: alles in Ordnung oder Datei nicht zu prüfen.
// Exit 2 mit Befunden auf stderr: Claude Code gibt stderr direkt an Claude zurück.
//
// Von Hand testen:
//   echo '{"tool_input":{"file_path":"src/main.ts"}}' | node scripts/claude-hook-check.mjs
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(process.env.CLAUDE_PROJECT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..'));

/** Verzeichnisse ab Repo-Wurzel, die nie geprüft werden (generiert, fremd oder andere Worktrees) */
const ausgenommen = ['node_modules/', 'dist/', '.angular/', 'coverage/', 'reports/', 'out-tsc/', '.claude/worktrees/', '.git/'];
const eslintEndungen = new Set(['.ts', '.html', '.mjs', '.js']);

function eingabe()
{
    try
    {
        const json = JSON.parse(readFileSync(0, 'utf8'));
        return { datei: json.tool_input?.file_path, cwd: json.cwd };
    }
    catch
    {
        return {};
    }
}

/** Führt ein Programm aus und liefert Exit-Code und Ausgabe, wirft nie */
function ausfuehren(befehl, argumente)
{
    return new Promise(fertig =>
    {
        execFile(befehl, argumente, { cwd: root, maxBuffer: 10 * 1024 * 1024 }, (fehler, stdout, stderr) =>
        {
            const code = fehler ? (typeof fehler.code === 'number' ? fehler.code : 1) : 0;
            fertig({ code, ausgabe: `${stdout}${stderr}`.trim() });
        });
    });
}

const { datei, cwd } = eingabe();
if (typeof datei !== 'string' || datei === '') process.exit(0);

const absolut = resolve(cwd ?? root, datei);
if (!existsSync(absolut) || !statSync(absolut).isFile()) process.exit(0);

const rel = relative(root, realpathSync(absolut)).split(sep).join('/');
if (rel === '' || rel.startsWith('../') || isAbsolute(rel)) process.exit(0);
if (ausgenommen.some(pfad => rel.startsWith(pfad)) || rel.includes('/node_modules/')) process.exit(0);

const pruefungen = [];
/** Einrichtungsfehler (z. B. Download offline): nur Hinweis für den Menschen, kein Befund für Claude */
let hinweis = null;

if (eslintEndungen.has(extname(rel)))
{
    const eslint = join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
    if (existsSync(eslint))
    {
        pruefungen.push(ausfuehren(process.execPath, [eslint, '--no-warn-ignored', '--no-color', rel])
            .then(({ code, ausgabe }) => code === 0 ? null : `ESLint (${rel}):\n${ausgabe}`));
    }
}

// Workflows, Composite-Action, Dependabot: actionlint und zizmor (prüfen immer alle Dateien unter .github/)
if (/^\.github\/.*\.ya?ml$/.test(rel))
{
    pruefungen.push(ausfuehren('bash', [join(root, 'scripts', 'actions-lint.sh')])
        .then(({ code, ausgabe }) =>
        {
            if (code === 1) return `actionlint/zizmor (.github/):\n${ausgabe}`;
            if (code !== 0) hinweis = `actionlint/zizmor konnten .github/ nicht prüfen:\n${ausgabe}`;
            return null;
        }));
}

// gitleaks: 1 = Secret gefunden, 2 = Einrichtungsfehler (z. B. Download offline)
pruefungen.push(ausfuehren('bash', [join(root, 'scripts', 'gitleaks.sh'), '--files', rel])
    .then(({ code, ausgabe }) =>
    {
        if (code === 1) return `gitleaks (${rel}):\n${ausgabe}`;
        if (code !== 0) hinweis = `gitleaks konnte ${rel} nicht prüfen:\n${ausgabe}`;
        return null;
    }));

const befunde = (await Promise.all(pruefungen)).filter(befund => befund !== null);
if (befunde.length > 0)
{
    process.stderr.write(`${befunde.join('\n\n')}\n`);
    process.exit(2);
}
if (hinweis !== null)
{
    // Exit 1: nur als Hinweis für den Menschen, nicht an Claude
    process.stderr.write(`${hinweis}\n`);
    process.exit(1);
}
