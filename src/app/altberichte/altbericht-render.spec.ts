import { jsPDF } from 'jspdf';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { EreignisType } from '../shared/enums/ereignis-type';
import { IEreignis } from '../shared/interfaces/i-ereignis';
import { altberichte, altGruppen } from './altbericht-daten';
import { renderAltbericht } from './altbericht-render';

/** Text-Operatoren aller Seiten, solange das Dokument noch nicht komprimiert ausgegeben wurde */
function seitenText(doc: jsPDF): Array<string>
{
    const pages = (doc.internal as unknown as { pages: Array<Array<string> | undefined> }).pages;
    return pages.slice(1).map(page => (page ?? []).join('\n'));
}

function format(doc: jsPDF, seite: number): { breite: number; hoehe: number }
{
    doc.setPage(seite);
    return { breite: Math.round(doc.internal.pageSize.getWidth()), hoehe: Math.round(doc.internal.pageSize.getHeight()) };
}

describe('Altberichte: Renderer', () =>
{
    const ff1 = createFeuerwehr(1, ['11111', '11112']);
    const ff2 = createFeuerwehr(2, ['22221']);
    const erstellt = new Date(2026, 10, 13, 9, 5, 7);

    function ereignisMit(anzahlFf1 = 2): IEreignis
    {
        return createEreignis({
            type: EreignisType.Einsatz,
            jahr: 2026,
            nummer: 7,
            ort: 'Tulln',
            datetimeStart: new Date(2026, 4, 1, 10, 0),
            datetimeEnd: new Date(2026, 4, 1, 12, 30),
            personen: [{ vorname: 'Max', nachname: 'Muster' }, { vorname: 'Erika', nachname: 'Muster' }],
            fuellungen: [
                createFuellung(ff2.flaschen[0], new Date(2026, 4, 1, 10, 5)),
                ...Array.from({ length: anzahlFf1 }, (_, i) =>
                    createFuellung({ ...ff1.flaschen[i % 2], flaschennummer: 'AB-1', typenInfo1: '300 bar', typenInfo3: '6 l' }, new Date(2026, 4, 1, 10, 10 + i)))
            ]
        });
    }

    it('liefert den Gesamtbericht und einen Bericht pro Feuerwehr in der Reihenfolge des alten Druckdialogs', () =>
    {
        const berichte = altberichte(ereignisMit());

        expect(berichte.map(bericht => bericht.titel)).toEqual(['Gesamtbericht', 'Bericht für die Feuerwehr FF 2', 'Bericht für die Feuerwehr FF 1']);
        expect(berichte.map(bericht => bericht.dateiname)).toEqual([
            '2026-007_Gesamtbericht.pdf', '2026-007_Feuerwehr_FF_2.pdf', '2026-007_Feuerwehr_FF_1.pdf'
        ]);
        expect(berichte[0].gruppen.map(gruppe => gruppe.feuerwehr.name)).toEqual(['FF 2', 'FF 1']);
        expect(berichte[2].gruppen).toHaveLength(1);
    });

    it('liefert ohne Füllungen nur den Gesamtbericht', () =>
    {
        expect(altberichte(createEreignis({ jahr: 2026, nummer: 1 })).map(bericht => bericht.dateiname)).toEqual(['2026-001_Gesamtbericht.pdf']);
    });

    it('gruppiert ohne Sortierung wie der alte Druckdialog', () =>
    {
        const spaet = createFuellung(ff1.flaschen[0], new Date(2026, 4, 1, 12));
        const frueh = createFuellung(ff1.flaschen[1], new Date(2026, 4, 1, 10));

        expect(altGruppen([spaet, frueh])[0].fuellungen).toEqual([spaet, frueh]);
    });

    it('rendert den Gesamtbericht im A4-Hochformat mit den Abschnitten des alten Layouts', () =>
    {
        const ereignis = ereignisMit();
        const doc = renderAltbericht(ereignis, altberichte(ereignis)[0], erstellt);

        expect(format(doc, 1)).toEqual({ breite: 210, hoehe: 297 });
        const text = seitenText(doc).join('\n');
        for (const erwartet of [
            'Füllbericht', 'der Atemluftfüllstelle Gemeinlebarn', '(Gesamtbericht)',
            '(Gedruckt:)', '(13.11.2026 09:05:07 Uhr \\(nachträglich erstellt\\))',
            '(Ereignis:)', '(Einsatz in Tulln)',
            '(Beginn:)', '(01.05.2026 10:00 Uhr)',
            '(Ende:)', '(01.05.2026 12:30 Uhr)',
            '(Füllpersonal:)', '(Max Muster, Erika Muster)',
            '(Füllungen)', '(FF 2)', '(FF 1)',
            '(Datum)', '(Feuerwehr)', '(Flasche)', '(Type)',
            '(01.05.2026)', '(10:05 Uhr)', '(1 \\(Code: 11111\\))', '(Flaschen Nr.: AB-1)', '(\\(300 bar 6 l\\))',
            '(Unterschrift des Füllpersonals)'
        ])
            expect(text).toContain(erwartet);
        expect(text).not.toContain('Füllersonal');
    });

    it('rendert den Bericht einer Feuerwehr nur mit deren Füllungen', () =>
    {
        const ereignis = ereignisMit();
        const doc = renderAltbericht(ereignis, altberichte(ereignis)[1], erstellt);

        const text = seitenText(doc).join('\n');
        expect(text).toContain('(Bericht für die Feuerwehr FF 2)');
        expect(text).toContain('(1 \\(Code: 22221\\))');
        expect(text).not.toContain('11111');
        expect(text).toContain('(Unterschrift des Füllpersonals)');
    });

    it('bricht viele Füllungen auf mehrere Hochformat-Seiten um und wiederholt die Spaltenköpfe', () =>
    {
        const ereignis = ereignisMit(60);
        const doc = renderAltbericht(ereignis, altberichte(ereignis)[0], erstellt);
        const seiten = doc.getNumberOfPages();

        expect(seiten).toBeGreaterThan(2);
        for (let i = 1; i <= seiten; i++)
            expect(format(doc, i)).toEqual({ breite: 210, hoehe: 297 });
        const texte = seitenText(doc);
        expect(texte[1]).toContain('(Datum)');
        expect(texte.filter(text => text.includes('(Unterschrift des Füllpersonals)'))).toHaveLength(1);
    });

    it('gibt ein PDF aus', async () =>
    {
        const ereignis = ereignisMit();
        const blob = renderAltbericht(ereignis, altberichte(ereignis)[0], erstellt).output('blob');

        expect(blob.type).toBe('application/pdf');
        const inhalt = await blob.text();
        expect(inhalt).toMatch(/^%PDF-/);
        expect(inhalt).toMatch(/\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/);
    });
});
