// ESLint-Formatter für GitHub Actions (ohne zusätzliche Abhängigkeit):
// - jede Meldung als Workflow-Annotation (::error/::warning), erscheint im PR-Diff an der Zeile
// - Tabelle der Befunde in der Job-Zusammenfassung ($GITHUB_STEP_SUMMARY)
// - zusätzlich lesbare Ausgabe im Log
//
//   npx eslint . --format ./scripts/eslint-github-formatter.mjs
import { appendFileSync } from 'node:fs';
import { relative } from 'node:path';

/** Werte in Workflow-Kommandos escapen (https://github.com/actions/toolkit/blob/main/packages/core/src/command.ts) */
function escapeData(text)
{
    return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeProperty(text)
{
    return escapeData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

/** Text für eine Markdown-Tabellenzelle: erst Backslashes, dann Spaltentrenner escapen, Zeilenumbrüche entfernen */
function escapeTabelle(text)
{
    return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}

export default function format(results, context)
{
    const cwd = context?.cwd ?? process.cwd();
    const zeilen = [];
    const befunde = [];

    for (const result of results)
    {
        const datei = relative(cwd, result.filePath).split('\\').join('/');
        for (const meldung of result.messages)
        {
            const art = meldung.severity === 2 ? 'error' : 'warning';
            const regel = meldung.ruleId ?? 'eslint';
            const zeile = meldung.line ?? 1;
            const spalte = meldung.column ?? 1;
            const eigenschaften = [
                `file=${escapeProperty(datei)}`,
                `line=${zeile}`,
                `col=${spalte}`,
                meldung.endLine ? `endLine=${meldung.endLine}` : null,
                meldung.endColumn ? `endColumn=${meldung.endColumn}` : null,
                `title=${escapeProperty(`ESLint ${regel}`)}`
            ].filter(e => e !== null).join(',');

            zeilen.push(`::${art} ${eigenschaften}::${escapeData(meldung.message)}`);
            zeilen.push(`${datei}:${zeile}:${spalte}  ${art}  ${meldung.message}  ${regel}`);
            befunde.push({ art, datei, zeile, regel, text: meldung.message });
        }
    }

    const fehler = befunde.filter(b => b.art === 'error').length;
    const warnungen = befunde.length - fehler;
    zeilen.push(befunde.length === 0
        ? `ESLint: keine Befunde in ${results.length} Dateien.`
        : `ESLint: ${fehler} Fehler, ${warnungen} Warnungen.`);

    const summary = process.env['GITHUB_STEP_SUMMARY'];
    if (summary)
    {
        const md = ['### ESLint', ''];
        if (befunde.length === 0)
        {
            md.push(`✅ Keine Befunde in ${results.length} Dateien.`);
        }
        else
        {
            md.push(`❌ ${fehler} Fehler, ${warnungen} Warnungen`, '', '| | Datei | Regel | Meldung |', '| --- | --- | --- | --- |');
            for (const b of befunde.slice(0, 100))
            {
                md.push(`| ${b.art === 'error' ? '❌' : '⚠️'} | \`${b.datei}:${b.zeile}\` | \`${b.regel}\` | ${escapeTabelle(b.text)} |`);
            }
            if (befunde.length > 100) md.push('', `… und ${befunde.length - 100} weitere (siehe Log).`);
        }
        appendFileSync(summary, `${md.join('\n')}\n\n`);
    }

    return zeilen.join('\n');
}
