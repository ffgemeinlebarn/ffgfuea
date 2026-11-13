import { TestBed } from '@angular/core/testing';
import { jsPDF } from 'jspdf';
import { IEreignis } from '../../interfaces/i-ereignis';
import { groupFuellungenByFeuerwehr } from '../../reports/report-data';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { renderFeuerwehrbericht, renderGesamtbericht } from './pdf-render';
import { PdfService } from './pdf.service';

/** A4 in mm */
const A4 = { kurz: 210, lang: 297 };

/** Text-Operatoren aller Seiten, solange das Dokument noch nicht komprimiert ausgegeben wurde */
function seitenText(doc: jsPDF): Array<string>
{
    const pages = (doc.internal as unknown as { pages: Array<Array<string> | undefined> }).pages;
    return pages.slice(1).map(page => (page ?? []).join('\n'));
}

function format(doc: jsPDF, seite = 1): { breite: number; hoehe: number }
{
    doc.setPage(seite);
    return { breite: Math.round(doc.internal.pageSize.getWidth()), hoehe: Math.round(doc.internal.pageSize.getHeight()) };
}

/** Seitengrößen aller Seiten eines ausgegebenen PDFs in pt, gerundet */
async function mediaBoxen(pdf: Blob): Promise<Array<string>>
{
    const matches = (await pdf.text()).matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g);
    return [...matches].map(([, breite, hoehe]) => `${Math.round(Number(breite))}x${Math.round(Number(hoehe))}`);
}

describe('PDF-Berichte', () =>
{
    const ff1 = createFeuerwehr(1, ['11111', '11112']);
    const ff2 = createFeuerwehr(2, ['22221']);
    const erstellt = new Date(2026, 4, 1, 18, 30);

    function ereignisMit(anzahl: Array<number>): IEreignis
    {
        const feuerwehren = anzahl.map((_, i) => createFeuerwehr(i + 1, ['1']));
        return createEreignis({
            jahr: 2026,
            nummer: 7,
            personen: [{ vorname: 'Max', nachname: 'Muster' }],
            fuellungen: feuerwehren.flatMap((feuerwehr, i) =>
                Array.from({ length: anzahl[i] }, (_, n) => createFuellung(feuerwehr.flaschen[0], new Date(2026, 4, 1, 10, n))))
        });
    }

    describe('Gesamtbericht', () =>
    {
        it('ist A4 im Querformat und enthält Kopf, Feuerwehren und Fußzeile', () =>
        {
            const doc = renderGesamtbericht(ereignisMit([2, 1]), erstellt);

            expect(doc.getNumberOfPages()).toBe(1);
            expect(format(doc)).toEqual({ breite: A4.lang, hoehe: A4.kurz });

            const text = seitenText(doc)[0];
            expect(text).toContain('(Gesamtbericht)');
            expect(text).toContain('(2026-007)');
            // Datum normal, Uhrzeit fett als eigenes Textstück
            expect(text).toContain('(01.05.2026 )');
            expect(text).toContain('(18:30 Uhr)');
            expect(text).toContain('(Übernommen von Feuerwehr FF 1)');
            // Unterschriftsfelder ohne Name und Datum
            expect(text).not.toContain('(Name)');
            expect(text).not.toContain('(Datum)');
            expect(text).toContain('(Max Muster)');
            expect(text).toContain('(FF 1)');
            expect(text).toContain('(FF 2)');
            expect(text).toContain('(Gesamt \\(2 Feuerwehren\\))');
            expect(text).toContain('(Unterschrift)');
            expect(text).toContain('(Seite 1 von 1)');
        });

        it('bricht viele Füllungen auf mehrere Querformat-Seiten um und nummeriert sie', () =>
        {
            const doc = renderGesamtbericht(ereignisMit([40, 30, 25]), erstellt);
            const seiten = doc.getNumberOfPages();

            expect(seiten).toBeGreaterThan(2);
            for (let i = 1; i <= seiten; i++)
                expect(format(doc, i)).toEqual({ breite: A4.lang, hoehe: A4.kurz });

            const texte = seitenText(doc);
            texte.forEach((text, i) =>
            {
                expect(text).toContain(`(Seite ${i + 1} von ${seiten})`);
                expect(text).toContain('(Füllbericht 2026-007 · Gesamtbericht)');
                // Spaltenköpfe auf jeder Seite
                expect(text).toContain('(Karteinr.)');
            });
        });

        it('weist auf fehlende Füllungen hin', () =>
        {
            const doc = renderGesamtbericht(createEreignis(), erstellt);

            expect(doc.getNumberOfPages()).toBe(1);
            expect(seitenText(doc)[0]).toContain('(Keine Füllungen erfasst)');
            expect(seitenText(doc)[0]).toContain('(Gesamt \\(0 Feuerwehren\\))');
        });
    });

    describe('Feuerwehrbericht', () =>
    {
        it('ist A4 im Hochformat mit Unterschriftsfeldern', () =>
        {
            const ereignis = ereignisMit([3]);
            const doc = renderFeuerwehrbericht(ereignis, groupFuellungenByFeuerwehr(ereignis.fuellungen)[0], erstellt);

            expect(doc.getNumberOfPages()).toBe(1);
            expect(format(doc)).toEqual({ breite: A4.kurz, hoehe: A4.lang });

            const text = seitenText(doc)[0];
            expect(text).toContain('(Bericht für die Feuerwehr FF 1)');
            expect(text).toContain('(Summe: 3 Füllungen)');
            expect(text).toContain('(Füllpersonal)');
            // Die Feuerwehr unterschreibt nur am Gesamtbericht
            expect(text).not.toContain('(Übernommen von Feuerwehr FF 1)');
            expect(text).not.toContain('(Name)');
            expect(text).toContain('(Seite 1 von 1)');
        });

        it('bleibt auch über mehrere Seiten im Hochformat', () =>
        {
            const ereignis = ereignisMit([80]);
            const doc = renderFeuerwehrbericht(ereignis, groupFuellungenByFeuerwehr(ereignis.fuellungen)[0], erstellt);

            expect(doc.getNumberOfPages()).toBeGreaterThan(1);
            for (let i = 1; i <= doc.getNumberOfPages(); i++)
                expect(format(doc, i)).toEqual({ breite: A4.kurz, hoehe: A4.lang });
            expect(seitenText(doc).at(-1)).toContain('(Füllpersonal)');
        });
    });

    describe('Sammel-PDF', () =>
    {
        /** Ausrichtung jeder Seite wie bei pdfinfo -f 1 -l n: q = Querformat, h = Hochformat */
        function ausrichtungen(doc: jsPDF): string
        {
            return Array.from({ length: doc.getNumberOfPages() }, (_, i) =>
            {
                const { breite, hoehe } = format(doc, i + 1);
                expect([breite, hoehe].sort()).toEqual([A4.kurz, A4.lang]);
                return breite > hoehe ? 'q' : 'h';
            }).join('');
        }

        it('hängt Berichte mit eigener Ausrichtung an ein Dokument an', () =>
        {
            const ereignis = ereignisMit([2, 1]);
            const [g1, g2] = groupFuellungenByFeuerwehr(ereignis.fuellungen);

            let doc = renderFeuerwehrbericht(ereignis, g1, erstellt);
            doc = renderGesamtbericht(ereignis, erstellt, doc);
            const ergebnis = renderFeuerwehrbericht(ereignis, g2, erstellt, doc);

            expect(ergebnis).toBe(doc);
            expect(doc.getNumberOfPages()).toBe(3);
            expect(ausrichtungen(doc)).toBe('hqh');
            const texte = seitenText(doc);
            expect(texte[0]).toContain('(Bericht für die Feuerwehr FF 1)');
            expect(texte[1]).toContain('(Gesamtbericht)');
            expect(texte[2]).toContain('(Bericht für die Feuerwehr FF 2)');
            // Jeder Bericht zählt seine Seiten selbst
            texte.forEach(text => expect(text).toContain('(Seite 1 von 1)'));
        });

        it('bleibt bei Seitenumbrüchen in der Ausrichtung des jeweiligen Berichts und nummeriert pro Bericht', () =>
        {
            const ereignis = ereignisMit([80, 60]);
            const [g1] = groupFuellungenByFeuerwehr(ereignis.fuellungen);

            const doc = renderFeuerwehrbericht(ereignis, g1, erstellt, renderGesamtbericht(ereignis, erstellt));

            const einzelnGesamt = renderGesamtbericht(ereignis, erstellt).getNumberOfPages();
            const einzelnFf1 = renderFeuerwehrbericht(ereignis, g1, erstellt).getNumberOfPages();
            expect(einzelnGesamt).toBeGreaterThan(1);
            expect(einzelnFf1).toBeGreaterThan(1);
            expect(doc.getNumberOfPages()).toBe(einzelnGesamt + einzelnFf1);
            expect(ausrichtungen(doc)).toBe('q'.repeat(einzelnGesamt) + 'h'.repeat(einzelnFf1));

            const texte = seitenText(doc);
            expect(texte[einzelnGesamt - 1]).toContain(`(Seite ${einzelnGesamt} von ${einzelnGesamt})`);
            expect(texte[einzelnGesamt]).toContain(`(Seite 1 von ${einzelnFf1})`);
            expect(texte[einzelnGesamt]).toContain('(Füllbericht 2026-007 · Bericht für die Feuerwehr FF 1)');
            expect(texte.at(-1)).toContain(`(Seite ${einzelnFf1} von ${einzelnFf1})`);
        });

        it('erzeugt die ausgewählten Berichte als ein PDF in der Reihenfolge der Auswahl', async () =>
        {
            const service = TestBed.inject(PdfService);
            const ereignis = ereignisMit([2, 1]);
            const fortschritt = vi.fn();

            const pdf = await service.createSammelPdf(ereignis, undefined, erstellt, fortschritt);

            expect(pdf.type).toBe('application/pdf');
            const inhalt = await pdf.text();
            expect(inhalt).toMatch(/^%PDF-1\.\d/);
            expect(inhalt).toMatch(/\/Count 3\b/);
            expect(await mediaBoxen(pdf)).toEqual(['842x595', '595x842', '595x842']);
            // Titel im PDF-Viewer (das ü ist nicht UTF-8-kodiert)
            expect(inhalt).toMatch(/\/Title \(F.llbericht 2026-007 Berichte\)/);
            expect(fortschritt).toHaveBeenCalledTimes(3);

            const [gesamt, ff1] = service.alleBerichte(ereignis);
            const auswahl = await service.createSammelPdf(ereignis, [ff1, gesamt], erstellt);
            expect(await mediaBoxen(auswahl)).toEqual(['595x842', '842x595']);

            const nurGesamt = await service.createSammelPdf(ereignis, [gesamt], erstellt);
            expect(await nurGesamt.text()).toMatch(/\/Title \(F.llbericht 2026-007 Gesamtbericht\)/);
        });

        it('verlangt mindestens einen Bericht', async () =>
        {
            await expect(TestBed.inject(PdfService).createSammelPdf(ereignisMit([1]), [])).rejects.toThrow('Kein Bericht ausgewählt');
        });
    });

    describe('PdfService', () =>
    {
        const ereignis = createEreignis({
            jahr: 2026,
            nummer: 7,
            fuellungen: [createFuellung(ff1.flaschen[0]), createFuellung(ff2.flaschen[0]), createFuellung(ff1.flaschen[1])]
        });

        it('erzeugt ein PDF für den Gesamtbericht und eines pro Feuerwehr', async () =>
        {
            const dateien = await TestBed.inject(PdfService).createBerichte(ereignis, undefined, erstellt);

            expect(dateien.map(datei => datei.dateiname)).toEqual([
                '2026-007_Gesamtbericht.pdf',
                '2026-007_Feuerwehr_FF_1.pdf',
                '2026-007_Feuerwehr_FF_2.pdf'
            ]);
            expect(dateien.map(datei => datei.titel)).toEqual(['Gesamtbericht', 'Bericht für die Feuerwehr FF 1', 'Bericht für die Feuerwehr FF 2']);

            for (const datei of dateien)
            {
                expect(datei.inhalt.type).toBe('application/pdf');
                expect(await datei.inhalt.text()).toMatch(/^%PDF-1\.\d/);
            }

            // MediaBox in pt (A4 = 595 x 842): Querformat beim Gesamtbericht, Hochformat bei den Feuerwehren
            expect(await mediaBoxen(dateien[0].inhalt)).toEqual(['842x595']);
            expect(await mediaBoxen(dateien[1].inhalt)).toEqual(['595x842']);
            expect(await mediaBoxen(dateien[2].inhalt)).toEqual(['595x842']);
        });

        it('erzeugt nur die ausgewählten Berichte', async () =>
        {
            const service = TestBed.inject(PdfService);
            const [, , ff2Bericht] = service.alleBerichte(ereignis);

            const dateien = await service.createBerichte(ereignis, [ff2Bericht], erstellt);

            expect(dateien.map(datei => datei.dateiname)).toEqual(['2026-007_Feuerwehr_FF_2.pdf']);
        });

        it('erzeugt ohne Füllungen nur den Gesamtbericht', async () =>
        {
            const dateien = await TestBed.inject(PdfService).createBerichte(createEreignis({ jahr: 2026, nummer: 1 }));

            expect(dateien.map(datei => datei.dateiname)).toEqual(['2026-001_Gesamtbericht.pdf']);
        });
    });
});
