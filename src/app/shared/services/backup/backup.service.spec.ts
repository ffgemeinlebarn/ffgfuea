import { TestBed } from '@angular/core/testing';
import { EreignisType } from 'src/app/shared/enums/ereignis-type';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { DataService } from '../data/data.service';
import { DatabaseService } from '../database/database.service';
import { SettingsService } from '../settings/settings.service';
import { BACKUP_FORMAT, BackupError, IBackup, LEGACY_VERSION, serializeBackup } from './backup-format';
import { BackupService } from './backup.service';

describe('BackupService', () =>
{
    let service: BackupService;
    let data: DataService;
    const feuerwehr = createFeuerwehr(12345, ['1234501', '1234502']);

    beforeEach(async () =>
    {
        service = TestBed.inject(BackupService);
        data = TestBed.inject(DataService);
        await data.load();
    });

    async function exportAndRead(): Promise<IBackup>
    {
        const backup = await service.createBackup();
        return service.read(await serializeBackup(backup).text());
    }

    async function seed()
    {
        await data.saveFeuerwehr(feuerwehr);
        const personId = await data.savePerson({ vorname: 'Max', nachname: 'Muster' });
        await data.saveEreignis(createEreignis({
            ort: 'Tulln',
            datetimeEnd: new Date(2026, 4, 1, 12, 0),
            personen: [{ id: personId, vorname: 'Max', nachname: 'Muster' }],
            fuellungen: [createFuellung(feuerwehr.flaschen[0], new Date(2026, 4, 1, 10, 30))]
        }));
    }

    it('exportiert alle Daten und liest sie mit Zeitpunkten wieder ein', async () =>
    {
        await seed();

        const backup = await exportAndRead();

        expect(backup.format).toBe(BACKUP_FORMAT);
        expect(backup.testMode).toBe(false);
        expect(backup.feuerwehren).toEqual([feuerwehr]);
        expect(backup.personen).toEqual(data.personen());
        expect(backup.ereignisse).toEqual(data.ereignisse());
        expect(backup.ereignisse[0].fuellungen[0].datetime).toEqual(new Date(2026, 4, 1, 10, 30));
    });

    it('schreibt einen Datensatz pro Zeile', async () =>
    {
        await seed();
        await data.saveEreignis(createEreignis({ datetimeEnd: new Date() }));

        const text = await serializeBackup(await service.createBackup()).text();
        const lines = text.split('\n');

        expect(lines.filter(line => line.startsWith('    {"type"'))).toHaveLength(2);
        expect(JSON.parse(text).ereignisse).toHaveLength(2);
    });

    it('benennt die Datei nach Zeitpunkt und Testmodus', async () =>
    {
        const backup = await service.createBackup();
        backup.exportedAt = new Date(2026, 9, 20, 8, 5).toISOString();

        expect(service.fileName(backup)).toBe('ffgfuea-export_2026-10-20_08-05.json');
        expect(service.fileName({ ...backup, testMode: true })).toBe('ffgfuea-export-test_2026-10-20_08-05.json');
    });

    it('ersetzt beim Wiederherstellen alle Daten und behält die Ids', async () =>
    {
        await seed();
        const backup = await exportAndRead();
        await data.savePerson({ vorname: 'Anna', nachname: 'Huber' });
        await data.saveFeuerwehr(createFeuerwehr(1));

        const result = await service.import(backup, 'replace');

        expect(result).toEqual({ feuerwehren: 1, personen: 1, ereignisse: 1, skipped: 0 });
        expect(data.feuerwehren()).toEqual(backup.feuerwehren);
        expect(data.personen()).toEqual(backup.personen);
        expect(data.ereignisse()).toEqual(backup.ereignisse);
    });

    it('führt zusammen und überspringt vorhandene Datensätze', async () =>
    {
        await seed();
        const backup = await exportAndRead();
        await TestBed.inject(DatabaseService).db.delete();
        TestBed.inject(DatabaseService).refresh();
        await data.load();
        // Anna bekommt die Id 1, die im Export Max gehört
        await data.savePerson({ vorname: 'Anna', nachname: 'Huber' });
        await data.saveEreignis(createEreignis({ type: EreignisType.Einsatz, datetimeEnd: new Date() }));

        expect(await service.import(backup, 'merge')).toEqual({ feuerwehren: 1, personen: 1, ereignisse: 1, skipped: 0 });
        expect(await service.import(backup, 'merge')).toEqual({ feuerwehren: 0, personen: 0, ereignisse: 0, skipped: 3 });

        const max = data.personen().find(person => person.vorname === 'Max');
        const imported = data.ereignisse().find(ereignis => ereignis.ort === 'Tulln');
        expect(data.ereignisse()).toHaveLength(2);
        expect(imported.personen).toEqual([max]);
        expect(max.id).not.toBe(backup.personen[0].id);
    });

    it('setzt nach dem Import von Feuerwehren die MAT Synchronisierung zurück', async () =>
    {
        await seed();
        const backup = await exportAndRead();
        TestBed.inject(SettingsService).writeSyncLastEdit('2026-01-01');

        await service.import(backup, 'replace');

        expect(TestBed.inject(SettingsService).syncLastEdit()).toBe('');
    });

    it('verweigert den Import während eines laufenden Ereignisses', async () =>
    {
        const backup = await exportAndRead();
        await data.saveEreignis(createEreignis());

        await expect(service.import(backup, 'merge')).rejects.toThrow('Während eines laufenden Ereignisses');
    });

    it('importiert viele Jahre an Daten', async () =>
    {
        await data.saveFeuerwehr(feuerwehr);
        const ereignisse = Array.from({ length: 1000 }, (_, i) => createEreignis({
            datetimeStart: new Date(2020, 0, 1 + i * 2),
            datetimeEnd: new Date(2020, 0, 1 + i * 2, 4),
            fuellungen: Array.from({ length: 30 }, (_, j) => createFuellung(feuerwehr.flaschen[j % 2], new Date(2020, 0, 1 + i * 2, 1, j)))
        }));
        const text = await serializeBackup({ ...await service.createBackup(), ereignisse }).text();

        const result = await service.import(service.read(text), 'replace');

        expect(result.ereignisse).toBe(1000);
        expect(data.ereignisse()).toHaveLength(1000);
        expect(data.statistics().length).toBeGreaterThan(5);
    });

    describe('altes Import-Format', () =>
    {
        const legacy = [{
            type: 'uebung',
            ort: 'Gemeinlebarn',
            datetimeStart: '2021-07-02 23:12:09',
            datetimeEnd: '2021-07-03 01:18:59',
            fuellungen: [{ datetime: '2021-07-02 23:14:09', flaschenBarcode: '1234502' }]
        }];

        beforeEach(() => data.saveFeuerwehr(feuerwehr));

        it('löst die Barcodes über die gespeicherten Flaschen auf', async () =>
        {
            const backup = service.read(JSON.stringify(legacy));

            expect(backup.version).toBe(LEGACY_VERSION);
            expect(backup.ereignisse[0].fuellungen[0].flasche).toEqual(feuerwehr.flaschen[1]);

            await service.import(backup, 'merge');
            expect(data.ereignisse()[0].datetimeStart).toEqual(new Date(2021, 6, 2, 23, 12, 9));
        });

        it('meldet unbekannte Barcodes', () =>
        {
            const unknown = [{ ...legacy[0], fuellungen: [{ datetime: '2021-07-02 23:14:09', flaschenBarcode: '99999' }] }];

            expect(() => service.read(JSON.stringify(unknown))).toThrow('Ereignis 1, Füllung 1: Keine Flasche für den Barcode 99999 gefunden!');
        });

        it('kann die Daten nicht ersetzen', async () =>
        {
            await expect(service.import(service.read(JSON.stringify(legacy)), 'replace')).rejects.toThrow('nur zusammengeführt');
            expect(data.feuerwehren()).toEqual([feuerwehr]);
        });
    });

    describe('Prüfung', () =>
    {
        function problemsOf(value: unknown): Array<string>
        {
            try
            {
                service.read(JSON.stringify(value));
            }
            catch (error)
            {
                if (error instanceof BackupError) return error.problems;
                throw error;
            }
            return [];
        }

        const valid = { format: BACKUP_FORMAT, version: 1, feuerwehren: [], personen: [], ereignisse: [] };

        it('erkennt fremde Dateien', () =>
        {
            expect(problemsOf({ foo: 1 })).toEqual(['Die Datei ist kein FFGFUEA-Export.']);
            expect(() => service.read('{ kaputt')).toThrow('kein gültiges JSON');
        });

        it('lehnt Exporte neuerer Versionen ab', () =>
        {
            expect(problemsOf({ ...valid, version: 2 })[0]).toContain('neueren Version');
        });

        it('meldet fehlerhafte Datensätze', () =>
        {
            const problems = problemsOf({
                ...valid,
                feuerwehren: [{ name: 'ohne Nummer' }],
                personen: [{ id: 1, vorname: 'Max', nachname: 'Muster' }, { id: 1, vorname: 'Anna', nachname: 'Huber' }],
                ereignisse: [
                    { type: 'ausflug', datetimeStart: 'gestern', fuellungen: [{ datetime: '2026-01-01T10:00:00Z' }] },
                    { type: 'uebung', datetimeStart: '2026-01-01T10:00:00Z' }
                ]
            });

            expect(problems).toEqual([
                'Feuerwehr 1: Feuerwehrnummer fehlt.',
                'Ereignis 1: Unbekannte Art "ausflug".',
                'Ereignis 1: Ungültiger Beginn.',
                'Ereignis 1, Füllung 1: Flasche fehlt.',
                'Die Personen-Id 1 kommt mehrfach vor.',
                'Es darf höchstens ein Ereignis nicht abgeschlossen sein.'
            ]);
        });
    });
});
