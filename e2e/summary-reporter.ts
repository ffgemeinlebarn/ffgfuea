import { appendFileSync } from 'node:fs';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/** Entfernt ANSI-Farbcodes aus Fehlermeldungen */
function ohneFarben(text: string): string
{
    return text.replace(new RegExp(String.raw`\u001b\[[0-9;]*m`, 'g'), '');
}

/** Text für eine Markdown-Tabellenzelle: erst Backslashes, dann Spaltentrenner escapen */
function zelle(text: string): string
{
    return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

/**
 * Schreibt das Ergebnis der E2E-Tests als Tabelle in die Job-Zusammenfassung von GitHub Actions
 * ($GITHUB_STEP_SUMMARY). Ohne diese Variable (lokal) tut der Reporter nichts.
 */
export default class SummaryReporter implements Reporter
{
    private readonly tests = new Map<TestCase, TestResult>();

    onTestEnd(test: TestCase, result: TestResult): void
    {
        // Bei Wiederholungen zählt der letzte Versuch
        this.tests.set(test, result);
    }

    onEnd(result: FullResult): void
    {
        const summary = process.env['GITHUB_STEP_SUMMARY'];
        if (!summary) return;

        const faelle = [...this.tests.keys()];
        const fehlgeschlagen = faelle.filter(t => t.outcome() === 'unexpected');
        const instabil = faelle.filter(t => t.outcome() === 'flaky');
        const uebersprungen = faelle.filter(t => t.outcome() === 'skipped');
        const bestanden = faelle.length - fehlgeschlagen.length - instabil.length - uebersprungen.length;
        const dauer = Math.round(result.duration / 1000);

        const md = [
            '### E2E-Tests (Playwright)',
            '',
            `${result.status === 'passed' ? '✅' : '❌'} ${bestanden} bestanden, ${fehlgeschlagen.length} fehlgeschlagen, ${instabil.length} instabil, ${uebersprungen.length} übersprungen (${dauer} s)`
        ];

        const auflisten = (titel: string, liste: Array<TestCase>): void =>
        {
            if (liste.length === 0) return;
            md.push('', `| ${titel} | Datei | Fehler |`, '| --- | --- | --- |');
            for (const test of liste)
            {
                const fehler = zelle(ohneFarben(this.tests.get(test)?.error?.message ?? '').split('\n')[0] ?? '');
                md.push(`| ${zelle(test.titlePath().slice(3).join(' › '))} | \`${test.location.file.split(/[\\/]e2e[\\/]/).pop()}:${test.location.line}\` | ${fehler} |`);
            }
        };
        auflisten('Fehlgeschlagen', fehlgeschlagen);
        auflisten('Instabil (erst bei Wiederholung bestanden)', instabil);
        if (fehlgeschlagen.length > 0) md.push('', 'Traces und HTML-Bericht: Artefakte `playwright-traces` und `playwright-report` dieses Laufs.');

        appendFileSync(summary, `${md.join('\n')}\n\n`);
    }
}
