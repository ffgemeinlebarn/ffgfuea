import { EreignisType } from '../../enums/ereignis-type';
import { IFeuerwehrFuellungen } from '../../reports/report-data';
import { createEreignis } from 'src/app/testing/test-data';
import
{
    ereignisOrdner, ereignisPfad, ereignisPraefix, feuerwehrberichtDateiname, feuerwehrberichtDateinamen, gesamtberichtDateiname,
    jahresOrdner, sanitizeDateiname
} from './pdf-dateinamen';

describe('PDF-Dateinamen', () =>
{
    const gruppe = (feuerwehrNummer: number, name: string): IFeuerwehrFuellungen =>
        ({ feuerwehr: { feuerwehrNummer, eigentuemerId: feuerwehrNummer, name }, fuellungen: [] });

    describe('sanitizeDateiname', () =>
    {
        it('ersetzt Umlaute und ß', () =>
        {
            expect(sanitizeDateiname('Übung Größing Äußere Öde')).toBe('Uebung_Groessing_Aeussere_Oede');
            expect(sanitizeDateiname('FF Großweikersdorf')).toBe('FF_Grossweikersdorf');
        });

        it('entfernt Akzente und ungültige Zeichen', () =>
        {
            expect(sanitizeDateiname('Café <Halle>: 1/2 "neu"?*|\\')).toBe('Cafe_Halle_1_2_neu');
            expect(sanitizeDateiname('Tulln\tan der\nDonau')).toBe('Tulln_an_der_Donau');
            expect(sanitizeDateiname('St. Pölten-Land')).toBe('St._Poelten-Land');
        });

        it('entfernt Punkte und Trennzeichen am Rand', () =>
        {
            expect(sanitizeDateiname('  ...Gemeinlebarn.  ')).toBe('Gemeinlebarn');
            expect(sanitizeDateiname('__-a-__')).toBe('a');
        });

        it('liefert einen leeren Text ohne verwertbare Zeichen', () =>
        {
            expect(sanitizeDateiname('')).toBe('');
            expect(sanitizeDateiname(undefined)).toBe('');
            expect(sanitizeDateiname('  /?*  ')).toBe('');
        });

        it('vermeidet reservierte Windows-Namen und begrenzt die Länge', () =>
        {
            expect(sanitizeDateiname('CON')).toBe('CON_');
            expect(sanitizeDateiname('com1')).toBe('com1_');
            expect(sanitizeDateiname('x'.repeat(100)).length).toBe(60);
        });
    });

    describe('Ordner und Dateien eines Ereignisses', () =>
    {
        const uebung = createEreignis({ jahr: 2026, nummer: 7, ort: 'Gemeinlebarn' });
        const einsatz = createEreignis({ type: EreignisType.Einsatz, jahr: 2025, nummer: 123, ort: 'Traismauer, B43 / Höhe Brücke' });

        it('ordnet nach Jahr und Ereignisnummer', () =>
        {
            expect(ereignisPfad(uebung)).toEqual(['2026', '2026-007_Uebung_Gemeinlebarn']);
            expect(ereignisPfad(einsatz)).toEqual(['2025', '2025-123_Einsatz_Traismauer_B43_Hoehe_Bruecke']);
        });

        it('lässt einen fehlenden Ort weg', () =>
        {
            expect(ereignisOrdner(createEreignis({ jahr: 2026, nummer: 8, ort: undefined }))).toBe('2026-008_Uebung');
            expect(ereignisOrdner(createEreignis({ jahr: 2026, nummer: 8, ort: ' ?? ' }))).toBe('2026-008_Uebung');
        });

        it('verwendet das Jahr der Nummer, nicht das des Beginns', () =>
        {
            const ereignis = createEreignis({ jahr: 2025, nummer: 99, datetimeStart: new Date(2026, 0, 1) });
            expect(jahresOrdner(ereignis)).toBe('2025');
        });

        it('verwendet ohne Ereignisnummer Datum und Uhrzeit des Beginns', () =>
        {
            const ereignis = createEreignis({ datetimeStart: new Date(2026, 4, 1, 9, 5) });
            expect(ereignisPraefix(ereignis)).toBe('2026-05-01_0905');
            expect(ereignisPfad(ereignis)).toEqual(['2026', '2026-05-01_0905_Uebung_Gemeinlebarn']);
        });

        it('stellt allen Dateien die Ereignisnummer voran', () =>
        {
            expect(gesamtberichtDateiname(uebung)).toBe('2026-007_Gesamtbericht.pdf');
            expect(feuerwehrberichtDateiname(uebung, gruppe(1, 'FF Würmla'))).toBe('2026-007_Feuerwehr_FF_Wuermla.pdf');
            expect(feuerwehrberichtDateiname(uebung, gruppe(42, '???'))).toBe('2026-007_Feuerwehr_42.pdf');
        });

        it('hängt bei gleichen Namen die Feuerwehrnummer an', () =>
        {
            const gruppen = [gruppe(1, 'FF Au'), gruppe(2, 'FF  Au'), gruppe(3, 'FF Tulln')];
            expect(feuerwehrberichtDateinamen(uebung, gruppen)).toEqual([
                '2026-007_Feuerwehr_FF_Au_1.pdf',
                '2026-007_Feuerwehr_FF_Au_2.pdf',
                '2026-007_Feuerwehr_FF_Tulln.pdf'
            ]);
        });
    });
});
