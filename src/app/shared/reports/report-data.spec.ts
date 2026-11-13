import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { EreignisType } from '../enums/ereignis-type';
import { anzahlFuellungen, ereignisBezeichnung, flaschenTyp, groupFuellungenByFeuerwehr, personenNamen } from './report-data';

describe('report-data', () =>
{
    const ff2 = createFeuerwehr(2, ['22221']);
    const ff10 = createFeuerwehr(10, ['10001']);
    const ff1 = createFeuerwehr(1, ['11111', '11112']);

    it('gruppiert die Füllungen nach Feuerwehr, sortiert nach Name und Zeitpunkt', () =>
    {
        const spaet = createFuellung(ff1.flaschen[0], new Date(2026, 4, 1, 12, 0));
        const frueh = createFuellung(ff1.flaschen[1], new Date(2026, 4, 1, 10, 0));
        const gruppen = groupFuellungenByFeuerwehr([
            createFuellung(ff10.flaschen[0]), spaet, createFuellung(ff2.flaschen[0]), frueh
        ]);

        expect(gruppen.map(g => g.feuerwehr.name)).toEqual(['FF 1', 'FF 2', 'FF 10']);
        expect(gruppen[0].fuellungen).toEqual([frueh, spaet]);
        expect(gruppen.map(g => g.fuellungen.length)).toEqual([2, 1, 1]);
    });

    it('liefert ohne Füllungen keine Gruppen und verändert die Eingabe nicht', () =>
    {
        expect(groupFuellungenByFeuerwehr([])).toEqual([]);

        const fuellungen = [createFuellung(ff2.flaschen[0]), createFuellung(ff1.flaschen[0])];
        groupFuellungenByFeuerwehr(fuellungen);
        expect(fuellungen.map(f => f.flasche.feuerwehr.name)).toEqual(['FF 2', 'FF 1']);
        expect(fuellungen[0].flasche.feuerwehr).not.toHaveProperty('fuellungen');
    });

    it('beschreibt das Ereignis', () =>
    {
        expect(ereignisBezeichnung(createEreignis())).toBe('Übung in Gemeinlebarn');
        expect(ereignisBezeichnung(createEreignis({ type: EreignisType.Einsatz, ort: '' }))).toBe('Einsatz');
    });

    it('setzt den Flaschentyp ohne leere Teile zusammen', () =>
    {
        const flasche = ff1.flaschen[0];
        expect(flaschenTyp(flasche)).toBe('Typ');
        expect(flaschenTyp({ ...flasche, typenInfo1: '300 bar', typenInfo2: '', typenInfo3: '6 l' })).toBe('Typ (300 bar 6 l)');
    });

    it('formatiert Personen und Anzahl der Füllungen', () =>
    {
        expect(personenNamen([{ vorname: 'Max', nachname: 'Muster' }, { vorname: 'Erika', nachname: 'Muster' }]))
            .toBe('Max Muster, Erika Muster');
        expect(anzahlFuellungen(1)).toBe('1 Füllung');
        expect(anzahlFuellungen(0)).toBe('0 Füllungen');
        expect(anzahlFuellungen(3)).toBe('3 Füllungen');
    });
});
