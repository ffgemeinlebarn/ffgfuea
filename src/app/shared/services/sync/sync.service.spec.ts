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
        // Wie vom MAT Sync-Service: ohne Rückverweis auf die Feuerwehr und ohne Quelle
        return feuerwehr ? { ...feuerwehr, flaschen: feuerwehr.flaschen.map(({ feuerwehr: _, quelle: __, ...flasche }) => flasche) } : null;
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
        expect(feuerwehr.flaschen[0].quelle).toBe('mat');
    });

    it('meldet unbekannte Feuerwehren', async () =>
    {
        await service.addFeuerwehr(9);

        expect(data.feuerwehren()).toEqual([]);
        expect(snackBar).toHaveBeenCalledWith('Die Feuerwehr mit der Nummer 9 wurde nicht gefunden!', undefined, { duration: 3000 });
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

    describe('manuelle Flaschen', () =>
    {
        const barcodesVon = (nummer: number) => data.feuerwehren().find(fw => fw.feuerwehrNummer === nummer)!.flaschen
            .map(flasche => `${flasche.barcode} ${flasche.quelle}`);

        it('bleiben bei der Synchronisierung erhalten und übernehmen den neuen Namen', async () =>
        {
            await data.saveFeuerwehr(createFeuerwehr(1, ['11111'], ['19999']));
            api.feuerwehren.set(1, { ...createFeuerwehr(1, ['11111', '11112']), name: 'FF Neu' });

            await service.syncSavedFeuerwehren();

            expect(barcodesVon(1)).toEqual(['11111 mat', '11112 mat', '19999 manuell']);
            expect(data.getFlascheByBarcode('19999').feuerwehr.name).toBe('FF Neu');
            expect(snackBar).not.toHaveBeenCalled();
        });

        it('werden durch eine MAT Flasche mit gleichem Barcode ersetzt', async () =>
        {
            await data.saveFeuerwehr(createFeuerwehr(1, ['11111'], ['19999', '19998']));
            api.feuerwehren.set(1, createFeuerwehr(1, ['11111', '19999']));

            await service.syncSavedFeuerwehren();

            expect(barcodesVon(1)).toEqual(['11111 mat', '19999 mat', '19998 manuell']);
            expect(data.getFlascheByBarcode('19999').quelle).toBe('mat');
            expect(snackBar).toHaveBeenCalledWith('Die manuelle Flasche mit dem Barcode 19999 wurde durch die Flasche aus MAT ersetzt.', undefined, { duration: 5000 });
        });

        it('anderer Feuerwehren werden ebenfalls durch MAT ersetzt, damit der Barcode eindeutig bleibt', async () =>
        {
            await data.saveFeuerwehr(createFeuerwehr(2, ['22221'], ['11112', '29999']));
            api.feuerwehren.set(1, createFeuerwehr(1, ['11111', '11112']));

            await service.addFeuerwehr(1);

            expect(barcodesVon(1)).toEqual(['11111 mat', '11112 mat']);
            expect(barcodesVon(2)).toEqual(['22221 undefined', '29999 manuell']);
            expect(data.getFlascheByBarcode('11112').feuerwehr.feuerwehrNummer).toBe(1);
            expect(snackBar).toHaveBeenCalledWith('Die manuelle Flasche mit dem Barcode 11112 wurde durch die Flasche aus MAT ersetzt.', undefined, { duration: 5000 });
        });

        it('meldet mehrere ersetzte Flaschen gesammelt', async () =>
        {
            await data.saveFeuerwehr(createFeuerwehr(1, ['11111'], ['19999']));
            await data.saveFeuerwehr(createFeuerwehr(2, ['22221'], ['29999']));
            api.feuerwehren.set(1, createFeuerwehr(1, ['11111', '19999']));
            api.feuerwehren.set(2, createFeuerwehr(2, ['22221', '29999']));

            await service.syncSavedFeuerwehren();

            expect(snackBar).toHaveBeenCalledTimes(1);
            expect(snackBar).toHaveBeenCalledWith('2 manuelle Flaschen wurden durch Flaschen aus MAT ersetzt (Barcodes: 19999, 29999).', undefined, { duration: 5000 });
        });
    });

    it('meldet einen nicht erreichbaren Sync-Service', async () =>
    {
        api.getLastEdit.mockRejectedValue(new Error('offline'));

        await service.syncSavedFeuerwehren();

        expect(snackBar).toHaveBeenCalledWith('Synchronisation nicht möglich - Service nicht erreichbar!', undefined, { duration: 3000 });
    });
});
