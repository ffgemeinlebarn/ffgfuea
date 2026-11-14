// Coverage als Kommentar im Pull Request (Ersatz für das kostenpflichtige GitHub Code Quality):
// Gesamtwerte gegen die Schwellen aus angular.json und gegen main, dazu die im PR geänderten Dateien.
// Der Kommentar wird bei jedem Lauf aktualisiert (erkennbar an MARKER), nicht neu angelegt.
//
//   node scripts/coverage-comment.mjs            Markdown auf stdout (lokal: geänderte Dateien seit main)
//   node scripts/coverage-comment.mjs --post     Kommentar im PR anlegen/aktualisieren (CI, braucht gh)
//
// Eingaben:
//   coverage/ffgfuea/coverage-summary.json       aktueller Lauf (npm run test:coverage)
//   $COVERAGE_BASELINE                           optional: coverage-summary.json von main zum Vergleich
//   $PR_NUMBER, $GITHUB_REPOSITORY, $GH_TOKEN    für --post und die Liste der geänderten Dateien
//   $GITHUB_SERVER_URL, $GITHUB_RUN_ID           optional: Link zum Lauf
// Exit-Code 0, auch wenn Schwellen verfehlt sind (das prüft `npm run test:coverage`).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = '<!-- ffgfuea-coverage -->';
/** Ab so vielen geänderten Dateien wird die Tabelle eingeklappt */
const MAX_OFFEN = 15;
const METRIKEN = [['statements', 'Anweisungen'], ['branches', 'Zweige'], ['functions', 'Funktionen'], ['lines', 'Zeilen']];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const post = process.argv.includes('--post');
const env = process.env;

/** Liest eine coverage-summary.json; Dateischlüssel werden zu Pfaden ab Repo-Wurzel (src/…) */
function lesen(datei)
{
    if (!datei || !existsSync(datei)) return null;
    const roh = JSON.parse(readFileSync(datei, 'utf8'));
    const dateien = new Map();
    for (const [pfad, werte] of Object.entries(roh))
    {
        if (pfad === 'total') continue;
        const normal = pfad.split('\\').join('/');
        const ab = normal.indexOf('/src/');
        dateien.set(ab >= 0 ? normal.slice(ab + 1) : normal, werte);
    }
    return { gesamt: roh.total, dateien };
}

function gh(args)
{
    return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

/** Im PR geänderte Dateien: über gh in CI, lokal per git gegen main */
function geaenderteDateien()
{
    try
    {
        const ausgabe = env['PR_NUMBER']
            ? gh(['pr', 'diff', env['PR_NUMBER'], '--name-only', '--repo', env['GITHUB_REPOSITORY'] ?? ''])
            : execFileSync('git', ['diff', '--name-only', 'main...HEAD'], { cwd: root, encoding: 'utf8' });
        return ausgabe.split('\n').map(z => z.trim()).filter(Boolean);
    }
    catch
    {
        return [];
    }
}

const prozent = wert => `${wert.toFixed(2)} %`;

function delta(jetzt, vorher)
{
    if (vorher === undefined) return '–';
    const d = jetzt - vorher;
    if (Math.abs(d) < 0.005) return '±0';
    return `${d > 0 ? '▲ +' : '▼ '}${d.toFixed(2)}`;
}

const aktuell = lesen(join(root, 'coverage', 'ffgfuea', 'coverage-summary.json'));
const basis = lesen(env['COVERAGE_BASELINE']);
const angular = JSON.parse(readFileSync(join(root, 'angular.json'), 'utf8'));
const schwellen = Object.values(angular.projects)[0]?.architect?.test?.options?.coverageThresholds ?? {};

const md = [MARKER, '### Coverage', ''];
if (aktuell === null)
{
    md.push('⚠️ Keine Coverage-Daten (Unit-Tests abgebrochen?).');
}
else
{
    const verfehlt = METRIKEN.filter(([key]) => schwellen[key] !== undefined && aktuell.gesamt[key].pct < schwellen[key]);
    md.push(verfehlt.length === 0
        ? '✅ Alle Schwellen eingehalten.'
        : `❌ Schwelle verfehlt: ${verfehlt.map(([, name]) => name).join(', ')}.`);
    md.push('', `| Metrik | Abgedeckt | ${basis ? 'main | Δ | ' : ''}Schwelle | |`, `| --- | ---: | ${basis ? '---: | ---: | ' : ''}---: | --- |`);
    for (const [key, name] of METRIKEN)
    {
        const jetzt = aktuell.gesamt[key];
        const vorher = basis?.gesamt[key];
        const schwelle = schwellen[key];
        const ok = schwelle === undefined || jetzt.pct >= schwelle;
        const vergleich = basis ? `${vorher ? prozent(vorher.pct) : '–'} | ${delta(jetzt.pct, vorher?.pct)} | ` : '';
        md.push(`| ${name} | ${prozent(jetzt.pct)} (${jetzt.covered}/${jetzt.total}) | ${vergleich}${schwelle === undefined ? '–' : `${schwelle} %`} | ${ok ? '✅' : '❌'} |`);
    }
    if (!basis) md.push('', '_Kein Vergleich mit main: Coverage von main nicht verfügbar (Artefakt älter als 14 Tage?)._');

    const geaendert = geaenderteDateien().filter(d => aktuell.dateien.has(d) || basis?.dateien.has(d));
    if (geaendert.length > 0)
    {
        const zeilen = [`| Datei | Zeilen | ${basis ? 'Δ zu main | ' : ''}Zweige |`, `| --- | ---: | ${basis ? '---: | ' : ''}---: |`];
        for (const datei of geaendert.sort())
        {
            const jetzt = aktuell.dateien.get(datei);
            const vorher = basis?.dateien.get(datei);
            if (!jetzt)
            {
                zeilen.push(`| \`${datei}\` | entfernt | ${basis ? '– | ' : ''}– |`);
                continue;
            }
            const neu = basis && !vorher ? 'neu' : delta(jetzt.lines.pct, vorher?.lines.pct);
            zeilen.push(`| \`${datei}\` | ${prozent(jetzt.lines.pct)} | ${basis ? `${neu} | ` : ''}${jetzt.branches.total === 0 ? '–' : prozent(jetzt.branches.pct)} |`);
        }
        const titel = `Geänderte Dateien mit Coverage (${geaendert.length})`;
        if (geaendert.length > MAX_OFFEN) md.push('', `<details><summary>${titel}</summary>`, '', ...zeilen, '', '</details>');
        else md.push('', `**${titel}**`, '', ...zeilen);
    }
}
if (env['GITHUB_RUN_ID'])
{
    const lauf = `${env['GITHUB_SERVER_URL'] ?? 'https://github.com'}/${env['GITHUB_REPOSITORY']}/actions/runs/${env['GITHUB_RUN_ID']}`;
    md.push('', `<sub>Vollständiger Bericht: Artefakt \`coverage\` im [CI-Lauf](${lauf}). Kein Gate, das sind die Schwellen im Check „Unit-Tests & Coverage“.</sub>`);
}
const text = `${md.join('\n')}\n`;

if (!post)
{
    process.stdout.write(text);
    process.exit(0);
}

const pr = env['PR_NUMBER'];
const repo = env['GITHUB_REPOSITORY'];
if (!pr || !repo)
{
    console.error('--post braucht PR_NUMBER und GITHUB_REPOSITORY.');
    process.exit(2);
}

// Vorhandenen Kommentar (mit MARKER) aktualisieren, sonst neu anlegen
const kommentare = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/issues/${pr}/comments?per_page=100`])).flat();
const vorhanden = kommentare.find(k => k.user?.type === 'Bot' && typeof k.body === 'string' && k.body.startsWith(MARKER));
const eingabe = JSON.stringify({ body: text });
if (vorhanden)
{
    execFileSync('gh', ['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${vorhanden.id}`, '--input', '-'], { input: eingabe, stdio: ['pipe', 'ignore', 'inherit'] });
    console.log(`Coverage-Kommentar aktualisiert: ${vorhanden.html_url}`);
}
else
{
    execFileSync('gh', ['api', '-X', 'POST', `repos/${repo}/issues/${pr}/comments`, '--input', '-'], { input: eingabe, stdio: ['pipe', 'ignore', 'inherit'] });
    console.log(`Coverage-Kommentar angelegt in PR #${pr}.`);
}
