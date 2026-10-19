import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { createFeuerwehr } from 'src/app/testing/test-data';
import { IFeuerwehr } from '../../interfaces/i-feuerwehr';
import { DataService } from '../data/data.service';
import { SettingsService } from '../settings/settings.service';
import { SyncApi } from '../sync-api/sync-api';
import { SyncService } from './sync.service';

class StubSyncApi extends SyncApi
{
    public lastEdit = '2026-10-01';
    public feuerwehren = new Map<number, IFeuerwehr>();

    public getLastEdit = vi.fn(async () => this.lastEdit);

    public getFeuerwehr = vi.fn(async (feuerwehrNummer: number) =>
    {
        const feuerwehr = this.feuerwehren.get(Number(feuerwehrNummer));
        // Wie vom MAT Sync-Service: ohne Rückverweis auf die Feuerwehr
        return feuerwehr ? { ...feuerwehr, flaschen: feuerwehr.flaschen.map(({ feuerwehr: _, ...flasche }) => flasche) } : null;
    });
}

describe('SyncService', () =>
{
    let service: SyncService;
    let api: StubSyncApi;
    let data: DataService;
    let settings: SettingsService;
    let snackBar: ReturnType<typeof vi.spyOn>;

    beforeEach(() =>
    {
        api = new StubSyncApi();
        TestBed.configureTestingModule({ providers: [{ provide: SyncApi, useValue: api }] });

        service = TestBed.inject(SyncService);
        data = TestBed.inject(DataService);
        settings = TestBed.inject(SettingsService);
        snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    });

    it('fügt eine Feuerwehr samt Flaschen hinzu', async () =>
    {
        api.feuerwehren.set(1, createFeuerwehr(1, ['11111']));

        await service.addFeuerwehr(1);

        const [feuerwehr] = data.feuerwehren();
        expect(feuerwehr.feuerwehrNummer).toBe(1);
        expect(feuerwehr.flaschen[0].feuerwehr).toEqual({ feuerwehrNummer: 1, eigentuemerId: 1, name: 'FF 1' });
    });

    it('meldet unbekannte Feuerwehren', async () =>
    {
        await service.addFeuerwehr(9);

        expect(data.feuerwehren()).toEqual([]);
        expect(snackBar).toHaveBeenCalledWith('Die Feuerwehr mit der Nummer 9 wurde nicht gefunden!', null, { duration: 3000 });
    });

    it('synchronisiert nicht, wenn sich der MAT Datensatz nicht geändert hat', async () =>
    {
        settings.writeSyncLastEdit(api.lastEdit);

        await service.syncSavedFeuerwehren();

        expect(api.getFeuerwehr).not.toHaveBeenCalled();
    });

    it('aktualisiert alle gespeicherten Feuerwehren und merkt sich den Stand', async () =>
    {
        await data.saveFeuerwehr(createFeuerwehr(1, ['11111']));
        await data.saveFeuerwehr(createFeuerwehr(2, ['22221']));
        api.feuerwehren.set(1, createFeuerwehr(1, ['11111', '11112']));
        api.feuerwehren.set(2, createFeuerwehr(2, ['22221', '22222']));

        await service.syncSavedFeuerwehren();

        expect(data.feuerwehren().map(fw => fw.flaschen.length)).toEqual([2, 2]);
        expect(settings.syncLastEdit()).toBe(api.lastEdit);
        expect(service.progressActive()).toBe(false);
    });

    it('merkt sich den Stand nicht, wenn eine Feuerwehr fehlschlägt', async () =>
    {
        await data.saveFeuerwehr(createFeuerwehr(1));

        await service.syncSavedFeuerwehren();

        expect(settings.syncLastEdit()).toBe('');
        expect(service.progressActive()).toBe(false);
    });

    it('meldet einen nicht erreichbaren Sync-Service', async () =>
    {
        api.getLastEdit.mockRejectedValue(new Error('offline'));

        await service.syncSavedFeuerwehren();

        expect(snackBar).toHaveBeenCalledWith('Synchronisation nicht möglich - Service nicht erreichbar!', null, { duration: 3000 });
    });
});
