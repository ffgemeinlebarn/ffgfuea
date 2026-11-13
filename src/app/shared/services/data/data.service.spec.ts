import { TestBed } from '@angular/core/testing';
import { createEreignis, createFeuerwehr } from 'src/app/testing/test-data';
import { formatEreignisNummer } from '../../models/ereignis-nummer/ereignis-nummer';
import { getFlaschenQuelle, isManuelleFlasche } from '../../interfaces/i-flasche';
import { DatabaseService } from '../database/database.service';
import { SettingsService } from '../settings/settings.service';
import { DataService, compareById } from './data.service';

describe('DataService', () =>
{
    let service: DataService;

    beforeEach(async () =>
    {
        service = TestBed.inject(DataService);
        await service.load();
    });

    it('sortiert Feuerwehren nach Feuerwehrnummer', async () =>
    {
        await service.saveFeuerwehr(createFeuerwehr(30));
        await service.saveFeuerwehr(createFeuerwehr(4));

        expect(service.feuerwehren().map(fw => fw.feuerwehrNummer)).toEqual([4, 30]);
    });

    it('entfernt Feuerwehren', async () =>
    {
        const feuerwehr = createFeuerwehr(1);
        await service.saveFeuerwehr(feuerwehr);
        await service.removeFeuerwehr(feuerwehr);

        expect(service.feuerwehren()).toEqual([]);
    });

    describe('getFlascheByBarcode', () =>
    {
        beforeEach(async () =>
        {
            await service.saveFeuerwehr(createFeuerwehr(1, ['11111', '33333']));
            await service.saveFeuerwehr(createFeuerwehr(2, ['22222', '33333']));
        });

        it('findet die Flasche über alle Feuerwehren', () =>
        {
            expect(service.getFlascheByBarcode('22222').feuerwehr.feuerwehrNummer).toBe(2);
        });

        it('meldet unbekannte Barcodes', () =>
        {
            expect(() => service.getFlascheByBarcode('99999')).toThrow('Keine Flasche für den Barcode 99999 gefunden!');
        });

        it('meldet mehrdeutige Barcodes', () =>
        {
            expect(() => service.getFlascheByBarcode('33333')).toThrow('Es wurden 2 Flaschen gefunden!');
        });
    });

    describe('manuelle Flaschen', () =>
    {
        beforeEach(async () =>
        {
            await service.saveFeuerwehr(createFeuerwehr(1, ['11111'], ['19999']));
            await service.saveFeuerwehr(createFeuerwehr(2, ['22222']));
        });

        const flaschenVon = (nummer: number) => service.feuerwehren().find(fw => fw.feuerwehrNummer === nummer)!.flaschen;
        const flascheMit = (barcode: string) => service.feuerwehren().flatMap(fw => fw.flaschen).find(f => f.barcode === barcode)!;

        it('zählen Flaschen ohne Quelle als MAT', () =>
        {
            expect(getFlaschenQuelle(flascheMit('11111'))).toBe('mat');
            expect(isManuelleFlasche(flascheMit('11111'))).toBe(false);
            expect(isManuelleFlasche(flascheMit('19999'))).toBe(true);
        });

        it('legt eine manuelle Flasche bei der Feuerwehr an', async () =>
        {
            const flasche = await service.saveManuelleFlasche(2, { barcode: ' 22223 ', karteiNr: 5, typenBezeichnung: 'Neu' });

            expect(flasche).toMatchObject({ barcode: '22223', karteiNr: 5, quelle: 'manuell', feuerwehr: { feuerwehrNummer: 2, eigentuemerId: 2, name: 'FF 2' } });
            expect(flasche.lastEdit).toBeInstanceOf(Date);
            expect(flaschenVon(2).map(f => f.barcode)).toEqual(['22222', '22223']);
            expect(service.getFlascheByBarcode('22223').quelle).toBe('manuell');
        });

        it('prüft den Barcode', () =>
        {
            expect(service.validateBarcode('')).toBe('Der Barcode ist erforderlich.');
            expect(service.validateBarcode('   ')).toBe('Der Barcode ist erforderlich.');
            expect(service.validateBarcode('12a45')).toBe('Der Barcode darf nur aus Ziffern bestehen.');
            expect(service.validateBarcode('1234')).toBe('Der Barcode muss mindestens 5 Ziffern haben.');
            expect(service.validateBarcode('12345')).toBeNull();
        });

        it('verlangt einen über alle Feuerwehren eindeutigen Barcode', async () =>
        {
            expect(service.validateBarcode('22222')).toBe('Der Barcode ist bereits der Flasche Nr. 1 der Feuerwehr FF 2 zugeordnet.');
            await expect(service.saveManuelleFlasche(1, { barcode: '22222' })).rejects.toThrow('bereits der Flasche Nr. 1 der Feuerwehr FF 2');
            await expect(service.saveManuelleFlasche(1, { barcode: 'abcde' })).rejects.toThrow('nur aus Ziffern');
            expect(flaschenVon(1)).toHaveLength(2);
        });

        it('meldet unbekannte Feuerwehren', async () =>
        {
            await expect(service.saveManuelleFlasche(9, { barcode: '99999' })).rejects.toThrow('Die Feuerwehr mit der Nummer 9 wurde nicht gefunden!');
        });

        it('bearbeitet eine manuelle Flasche, auch mit gleichbleibendem Barcode', async () =>
        {
            const original = flascheMit('19999');
            expect(service.validateBarcode('19999', original)).toBeNull();

            await service.saveManuelleFlasche(1, { barcode: '19999', karteiNr: 7 }, original);
            expect(flaschenVon(1).map(f => [f.barcode, f.karteiNr])).toEqual([['11111', 1], ['19999', 7]]);

            await service.saveManuelleFlasche(1, { barcode: '19998' }, flascheMit('19999'));
            expect(flaschenVon(1).map(f => f.barcode)).toEqual(['11111', '19998']);
            expect(flascheMit('19998').quelle).toBe('manuell');
        });

        it('bearbeitet und löscht keine Flaschen aus MAT', async () =>
        {
            const mat = flascheMit('11111');

            await expect(service.saveManuelleFlasche(1, { barcode: '11111', karteiNr: 9 }, mat)).rejects.toThrow('Flaschen aus MAT können nicht bearbeitet werden!');
            await expect(service.removeManuelleFlasche(mat)).rejects.toThrow('Flaschen aus MAT können nicht gelöscht werden!');
            expect(flaschenVon(1)).toHaveLength(2);
        });

        it('löscht eine manuelle Flasche', async () =>
        {
            await service.removeManuelleFlasche(flascheMit('19999'));

            expect(flaschenVon(1).map(f => f.barcode)).toEqual(['11111']);
            expect(flaschenVon(2)).toHaveLength(1);
        });
    });

    it('sortiert Personen nach Nachname und Vorname', async () =>
    {
        await service.savePerson({ vorname: 'Berta', nachname: 'Huber' });
        await service.savePerson({ vorname: 'Anton', nachname: 'Maier' });
        await service.savePerson({ vorname: 'Anna', nachname: 'Huber' });

        expect(service.personen().map(p => `${p.vorname} ${p.nachname}`)).toEqual(['Anna Huber', 'Berta Huber', 'Anton Maier']);
    });

    it('aktualisiert und entfernt Personen', async () =>
    {
        const id = await service.savePerson({ vorname: 'Max', nachname: 'Muster' });
        await service.savePerson({ id, vorname: 'Moritz', nachname: 'Muster' });
        expect(service.personen()).toEqual([{ id, vorname: 'Moritz', nachname: 'Muster' }]);

        await service.removePerson({ id, vorname: 'Moritz', nachname: 'Muster' });
        expect(service.personen()).toEqual([]);
    });

    it('speichert Ereignisse mit leerer Füllungsliste und listet neueste zuerst', async () =>
    {
        await service.saveEreignis(createEreignis({ ort: 'Alt', datetimeStart: new Date(2025, 0, 1), fuellungen: undefined }));
        await service.saveEreignis(createEreignis({ ort: 'Neu', datetimeStart: new Date(2026, 0, 1) }));

        expect(service.ereignisse().map(e => e.ort)).toEqual(['Neu', 'Alt']);
        expect(service.ereignisse()[1].fuellungen).toEqual([]);
        expect(service.statistics().map(stat => stat.year)).toEqual([2026, 2025]);
    });

    describe('Ereignisnummer', () =>
    {
        async function save(datetimeStart: Date): Promise<string>
        {
            const ereignis = createEreignis({ datetimeStart, datetimeEnd: datetimeStart });
            await service.saveEreignis(ereignis);
            return formatEreignisNummer(ereignis);
        }

        it('beginnt jedes Jahr bei 1 und zählt weiter', async () =>
        {
            expect(await save(new Date(2025, 11, 30))).toBe('2025-001');
            expect(await save(new Date(2025, 11, 31))).toBe('2025-002');
            expect(await save(new Date(2026, 0, 1))).toBe('2026-001');
            expect(await save(new Date(2026, 0, 2))).toBe('2026-002');
            // Nachträglich angelegtes Ereignis des Vorjahres
            expect(await save(new Date(2025, 5, 1))).toBe('2025-003');

            expect(service.ereignisse().map(formatEreignisNummer)).toEqual(['2026-002', '2026-001', '2025-002', '2025-001', '2025-003']);
        });

        it('bleibt beim Bearbeiten unverändert, auch wenn sich der Beginn ändert', async () =>
        {
            await save(new Date(2026, 0, 1));
            const id = await service.saveEreignis(createEreignis({ datetimeStart: new Date(2026, 1, 1) }));

            const ereignis = await service.getEreignis(id);
            await service.saveEreignis({ ...ereignis, ort: 'Tulln', datetimeStart: new Date(2027, 0, 1) });

            expect(formatEreignisNummer(await service.getEreignis(id))).toBe('2026-002');
            expect(await save(new Date(2027, 0, 1))).toBe('2027-001');
        });
    });

    it('findet das offene Ereignis', async () =>
    {
        expect(await service.findOpenEreignisId()).toBeNull();

        await service.saveEreignis(createEreignis({ datetimeEnd: new Date() }));
        const id = await service.saveEreignis(createEreignis());

        expect(await service.findOpenEreignisId()).toBe(id);
    });

    it('verwendet im Testmodus eine eigene Datenbank', async () =>
    {
        await service.saveFeuerwehr(createFeuerwehr(1));

        TestBed.inject(SettingsService).testMode.set(true);
        TestBed.inject(DatabaseService).refresh();
        await service.load();

        expect(service.feuerwehren()).toEqual([]);
    });

    it('vergleicht Objekte über die Id', () =>
    {
        expect(compareById({ id: 1 }, { id: 1 })).toBe(true);
        expect(compareById({ id: 1 }, { id: 2 })).toBe(false);
        expect(compareById(null, null)).toBe(true);
    });
});
