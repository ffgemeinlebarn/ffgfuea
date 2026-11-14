// Coverage als Tabelle mit den Schwellen aus angular.json (coverageThresholds).
// Liest coverage/ffgfuea/coverage-summary.json (Reporter "json-summary", siehe angular.json).
// In GitHub Actions in die Job-Zusammenfassung, sonst auf stdout. Exit-Code immer 0:
// ob die Schwellen eingehalten sind, entscheidet `npm run test:coverage`.
//
//   node scripts/coverage-summary.mjs
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const datei = join(root, 'coverage', 'ffgfuea', 'coverage-summary.json');

let md;
if (existsSync(datei))
{
    const gesamt = JSON.parse(readFileSync(datei, 'utf8')).total;
    const angular = JSON.parse(readFileSync(join(root, 'angular.json'), 'utf8'));
    const schwellen = Object.values(angular.projects)[0]?.architect?.test?.options?.coverageThresholds ?? {};
    const metriken = [['statements', 'Anweisungen'], ['branches', 'Zweige'], ['functions', 'Funktionen'], ['lines', 'Zeilen']];

    md = ['### Coverage', '', '| Metrik | Abgedeckt | Schwelle | |', '| --- | ---: | ---: | --- |'];
    for (const [key, name] of metriken)
    {
        const wert = gesamt[key];
        const schwelle = schwellen[key];
        const ok = schwelle === undefined || wert.pct >= schwelle;
        md.push(`| ${name} | ${wert.pct.toFixed(2)} % (${wert.covered}/${wert.total}) | ${schwelle === undefined ? '–' : `${schwelle} %`} | ${ok ? '✅' : '❌'} |`);
    }
}
else
{
    md = ['### Coverage', '', `⚠️ Keine Coverage-Daten (${datei} fehlt, Tests abgebrochen?).`];
}

const text = `${md.join('\n')}\n\n`;
const summary = process.env['GITHUB_STEP_SUMMARY'];
if (summary) appendFileSync(summary, text);
else process.stdout.write(text);
