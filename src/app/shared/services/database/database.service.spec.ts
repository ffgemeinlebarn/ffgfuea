import { TestBed } from '@angular/core/testing';
import Dexie from 'dexie';
import { environment } from 'src/environments/environment';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { IFeuerwehrRef } from '../../interfaces/i-feuerwehr';
import { IFuellung } from '../../interfaces/i-fuellung';
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
        expect(service.db.verno).toBe(3);
    });

    it('entfernt Zirkelbezüge aus v1.2.0 (Füllungen an der Feuerwehr einer Flasche), damit der Export klappt', async () =>
    {
        // Stand nach dem alten Druckdialog: Er hat feuerwehr.fuellungen an die Feuerwehr der Flaschen gehängt
        const feuerwehr = createFeuerwehr(1, ['111', '112']);
        const ref = feuerwehr.flaschen[0].feuerwehr as IFeuerwehrRef & { fuellungen?: Array<IFuellung> };
        const fuellungen = feuerwehr.flaschen.map(flasche => createFuellung(flasche));
        ref.fuellungen = fuellungen;
        const ereignis = createEreignis({ datetimeEnd: new Date(2026, 4, 1, 12), fuellungen });
        expect(() => JSON.stringify(ereignis)).toThrow(/circular/);

        const db = new Dexie(environment.database.name);
        db.version(1).stores({ feuerwehren: '&feuerwehrNummer', personen: '++id', ereignisse: '++id' });
        db.version(2).stores({ ereignisse: '++id, &[jahr+nummer]' });
        await db.table('feuerwehren').add(feuerwehr);
        await db.table('ereignisse').add({ ...ereignis, jahr: 2026, nummer: 1 });
        db.close();

        const service = TestBed.inject(DatabaseService);
        const [gespeichert] = await service.db.ereignisse.toArray();
        const [stammdaten] = await service.db.feuerwehren.toArray();

        expect(() => JSON.stringify([gespeichert, stammdaten])).not.toThrow();
        expect(gespeichert.fuellungen.map(fuellung => fuellung.flasche.feuerwehr))
            .toEqual([{ feuerwehrNummer: 1, eigentuemerId: 1, name: 'FF 1' }, { feuerwehrNummer: 1, eigentuemerId: 1, name: 'FF 1' }]);
        expect(gespeichert.fuellungen.map(fuellung => fuellung.flasche.barcode)).toEqual(['111', '112']);
        expect(stammdaten.flaschen[0].feuerwehr).toEqual({ feuerwehrNummer: 1, eigentuemerId: 1, name: 'FF 1' });
        expect(formatEreignisNummer(gespeichert)).toBe('2026-001');
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
