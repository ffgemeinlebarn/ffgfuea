import { TestBed } from '@angular/core/testing';
import { createEreignis, createFeuerwehr } from 'src/app/testing/test-data';
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
