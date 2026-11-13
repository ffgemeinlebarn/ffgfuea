import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { createEreignis, createFeuerwehr } from 'src/app/testing/test-data';
import { BarcodeScannerService } from '../barcode-scanner/barcode-scanner.service';
import { DataService } from '../data/data.service';
import { NotificationService } from '../notification/notification.service';
import { TimingService } from '../timing/timing.service';
import { OperatingService } from './operating.service';

describe('OperatingService', () =>
{
    let service: OperatingService;
    let data: DataService;
    let dialogResult: boolean;
    let ereignisId: number;

    const pressKeys = (...keys: Array<string>) =>
        keys.forEach(key => document.body.dispatchEvent(new KeyboardEvent('keydown', { key })));

    beforeEach(async () =>
    {
        dialogResult = true;
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) } }
            ]
        });

        data = TestBed.inject(DataService);
        await data.saveFeuerwehr(createFeuerwehr(1, ['11111', '11112']));
        await data.saveFeuerwehr(createFeuerwehr(2, ['22221']));
        ereignisId = await data.saveEreignis(createEreignis());

        service = TestBed.inject(OperatingService);
        expect(await service.tryStartOpenEreignis()).toBe(true);
    });

    const savedFuellungen = async () => (await data.getEreignis(ereignisId)).fuellungen;

    it('lädt das offene Ereignis und startet die Laufzeit', () =>
    {
        expect(service.ereignis()!.id).toBe(ereignisId);
        expect(TestBed.inject(TimingService).ereignisStart()).toEqual(createEreignis().datetimeStart);
    });

    it('meldet, wenn kein Ereignis offen ist', async () =>
    {
        await service.closeEreignis();
        expect(await service.tryStartOpenEreignis()).toBe(false);
    });

    it('fügt Füllungen ohne Bestätigung direkt hinzu, neueste zuerst', async () =>
    {
        service.confirmFuellungActive.set(false);
        await service.addFuellung(data.getFlascheByBarcode('11111'));
        await service.addFuellung(data.getFlascheByBarcode('22221'));

        expect(service.ereignis()!.fuellungen.map(f => f.flasche.barcode)).toEqual(['22221', '11111']);
        expect((await savedFuellungen()).length).toBe(2);
        expect(service.ereignisAnzahlFeuerwehren()).toBe(2);
    });

    it('fügt Füllungen erst nach Bestätigung hinzu', async () =>
    {
        dialogResult = false;
        await service.addFuellung(data.getFlascheByBarcode('11111'));
        expect(service.ereignis()!.fuellungen).toEqual([]);

        dialogResult = true;
        await service.addFuellung(data.getFlascheByBarcode('11111'));
        await vi.waitFor(async () => expect((await savedFuellungen()).length).toBe(1));
        expect(TestBed.inject(MatDialog).open).toHaveBeenCalledTimes(2);
    });

    it('entfernt Füllungen', async () =>
    {
        service.confirmFuellungActive.set(false);
        await service.addFuellung(data.getFlascheByBarcode('11111'));
        await service.addFuellung(data.getFlascheByBarcode('11112'));

        await service.removeFuellung(service.ereignis()!.fuellungen[0]);

        expect(service.ereignis()!.fuellungen.map(f => f.flasche.barcode)).toEqual(['11111']);
        expect((await savedFuellungen()).length).toBe(1);
    });

    describe('Barcode-Scanner', () =>
    {
        beforeEach(() => service.confirmFuellungActive.set(false));

        it('erfasst gescannte Barcodes', async () =>
        {
            pressKeys('1', '1', '1', '1', '2', 'Enter');
            await vi.waitFor(() => expect(service.ereignis()!.fuellungen.length).toBe(1));
            expect(service.ereignis()!.fuellungen[0].flasche.barcode).toBe('11112');
        });

        it('ignoriert Barcodes ohne laufendes Ereignis', async () =>
        {
            await service.closeEreignis();
            pressKeys('1', '1', '1', '1', '1', 'Enter');
            await new Promise(resolve => setTimeout(resolve, 50));
            expect((await savedFuellungen()).length).toBe(0);
        });

        it('ist über den Scanner deaktivierbar', async () =>
        {
            TestBed.inject(BarcodeScannerService).active.set(false);
            pressKeys('1', '1', '1', '1', '1', 'Enter');
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(service.ereignis()!.fuellungen).toEqual([]);
        });
    });

    it('schließt das Ereignis ab', async () =>
    {
        const closed = await service.closeEreignis();

        expect(closed).toMatchObject({ id: ereignisId, datetimeEnd: expect.any(Date) });
        expect(service.ereignis()).toBeNull();
        expect(TestBed.inject(TimingService).ereignisStart()).toBeNull();
        expect((await data.getEreignis(ereignisId)).datetimeEnd).toBeInstanceOf(Date);
    });

    it('lädt das laufende Ereignis neu und aktiviert den Scanner', async () =>
    {
        const scanner = TestBed.inject(BarcodeScannerService);
        scanner.active.set(false);
        await data.saveEreignis({ ...service.ereignis()!, ort: 'Tulln' });

        await service.reload();

        expect(service.ereignis()!.ort).toBe('Tulln');
        expect(scanner.active()).toBe(true);
    });

    it('meldet unbekannte Barcodes', async () =>
    {
        const show = vi.spyOn(TestBed.inject(NotificationService), 'show');

        await service.addFuellungByBarcode('99999');

        expect(show).toHaveBeenCalledWith('Keine Flasche für den Barcode 99999 gefunden!', expect.any(Number));
        expect(service.ereignis()!.fuellungen).toEqual([]);
    });
});
