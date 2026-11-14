// Mutation-Score je Datei aus dem JSON-Bericht von Stryker (reports/mutation/mutation.json) als Tabelle.
// In GitHub Actions in die Job-Zusammenfassung, sonst auf stdout. Exit-Code immer 0 (Hinweis, kein Gate).
//
//   node scripts/mutation-summary.mjs
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const datei = join(root, 'reports', 'mutation', 'mutation.json');

/** Mutanten, die zählen: getötet (Killed, Timeout) gegen überlebt (Survived, NoCoverage) */
function auswerten(mutanten)
{
    const anzahl = status => mutanten.filter(m => m.status === status).length;
    const getoetet = anzahl('Killed') + anzahl('Timeout');
    const ueberlebt = anzahl('Survived');
    const ohneTest = anzahl('NoCoverage');
    const gesamt = getoetet + ueberlebt + ohneTest;
    return { getoetet, ueberlebt, ohneTest, score: gesamt === 0 ? null : getoetet / gesamt * 100 };
}

function symbol(score, schwellen)
{
    if (score === null) return '–';
    if (score >= schwellen.high) return '✅';
    return score >= schwellen.low ? '⚠️' : '❌';
}

let md;
if (existsSync(datei))
{
    const bericht = JSON.parse(readFileSync(datei, 'utf8'));
    const schwellen = bericht.thresholds ?? { high: 80, low: 60 };
    const dateien = Object.entries(bericht.files ?? {}).sort(([a], [b]) => a.localeCompare(b));
    const alle = auswerten(dateien.flatMap(([, f]) => f.mutants));
    const prozent = score => score === null ? '–' : `${score.toFixed(1)} %`;

    md = [
        '### Mutation-Testing (Stryker)',
        '',
        `${symbol(alle.score, schwellen)} Mutation-Score **${prozent(alle.score)}** (grün ab ${schwellen.high} %, rot unter ${schwellen.low} %)`,
        '',
        '| Datei | Score | getötet | überlebt | ohne Test |',
        '| --- | ---: | ---: | ---: | ---: |'
    ];
    for (const [pfad, f] of dateien)
    {
        const e = auswerten(f.mutants);
        md.push(`| \`${pfad}\` | ${symbol(e.score, schwellen)} ${prozent(e.score)} | ${e.getoetet} | ${e.ueberlebt} | ${e.ohneTest} |`);
    }
    md.push('', 'Überlebende Mutanten mit Fundstelle: HTML-Bericht im Artefakt `mutation-report` (lokal `reports/mutation/index.html`).');
}
else
{
    md = ['### Mutation-Testing (Stryker)', '', `⚠️ Kein Bericht (${datei} fehlt, Lauf abgebrochen?).`];
}

const text = `${md.join('\n')}\n\n`;
const summary = process.env['GITHUB_STEP_SUMMARY'];
if (summary) appendFileSync(summary, text);
else process.stdout.write(text);
