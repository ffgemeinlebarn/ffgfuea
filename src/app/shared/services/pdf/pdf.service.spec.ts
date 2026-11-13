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
            expect(text).toContain('(01.05.2026 18:30 Uhr)');
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
            expect(text).toContain('(Übernommen von Feuerwehr FF 1)');
            expect(text).toContain('(Seite 1 von 1)');
        });

        it('bleibt auch über mehrere Seiten im Hochformat', () =>
        {
            const ereignis = ereignisMit([80]);
            const doc = renderFeuerwehrbericht(ereignis, groupFuellungenByFeuerwehr(ereignis.fuellungen)[0], erstellt);

            expect(doc.getNumberOfPages()).toBeGreaterThan(1);
            for (let i = 1; i <= doc.getNumberOfPages(); i++)
                expect(format(doc, i)).toEqual({ breite: A4.kurz, hoehe: A4.lang });
            expect(seitenText(doc).at(-1)).toContain('(Übernommen von Feuerwehr FF 1)');
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
