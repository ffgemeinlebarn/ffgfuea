import { TestBed } from '@angular/core/testing';
import Dexie from 'dexie';
import { environment } from 'src/environments/environment';
import { createEreignis } from 'src/app/testing/test-data';
import { formatEreignisNummer } from '../../models/ereignis-nummer/ereignis-nummer';
import { DatabaseService } from './database.service';

describe('DatabaseService', () =>
{
    /** Legt eine Datenbank im Stand von Version 1 (ohne Ereignisnummern) an */
    async function createVersion1(name: string)
    {
        const db = new Dexie(name);
        db.version(1).stores({ feuerwehren: '&feuerwehrNummer', personen: '++id', ereignisse: '++id' });
        await db.table('ereignisse').bulkAdd([
            createEreignis({ ort: 'Juni', datetimeStart: new Date(2025, 5, 1), datetimeEnd: new Date(2025, 5, 1, 2) }),
            createEreignis({ ort: 'Silvester', datetimeStart: new Date(2025, 11, 31, 22), datetimeEnd: new Date(2026, 0, 1, 2) }),
            createEreignis({ ort: 'Jänner', datetimeStart: new Date(2025, 0, 15), datetimeEnd: new Date(2025, 0, 15, 2) }),
            createEreignis({ ort: 'Neujahr B', datetimeStart: new Date(2026, 0, 1), datetimeEnd: new Date(2026, 0, 1, 2) }),
            createEreignis({ ort: 'Neujahr A', datetimeStart: new Date(2026, 0, 1), datetimeEnd: new Date(2026, 0, 1, 2) })
        ]);
        db.close();
    }

    async function nummern(service: DatabaseService): Promise<Array<string>>
    {
        const ereignisse = await service.db.ereignisse.toArray();
        return ereignisse.map(ereignis => `${ereignis.ort} ${formatEreignisNummer(ereignis)}`);
    }

    const expected = [
        'Juni 2025-002',
        'Silvester 2025-003',
        'Jänner 2025-001',
        'Neujahr B 2026-001',
        'Neujahr A 2026-002'
    ];

    it('nummeriert bestehende Ereignisse bei der Migration pro Jahr nach Beginn und Id', async () =>
    {
        await createVersion1(environment.database.name);

        const service = TestBed.inject(DatabaseService);

        expect(await nummern(service)).toEqual(expected);
        expect(service.db.verno).toBe(2);
    });

    it('migriert auch die Testdatenbank', async () =>
    {
        await createVersion1(environment.database.name + '_test');
        localStorage.setItem('testMode', 'true');

        const service = TestBed.inject(DatabaseService);

        expect(service.testMode).toBe(true);
        expect(await nummern(service)).toEqual(expected);
    });

    it('verhindert doppelte Ereignisnummern', async () =>
    {
        const db = TestBed.inject(DatabaseService).db;
        await db.ereignisse.add(createEreignis({ jahr: 2026, nummer: 1 }));

        await expect(db.ereignisse.add(createEreignis({ jahr: 2026, nummer: 1 }))).rejects.toThrow();
    });
});
