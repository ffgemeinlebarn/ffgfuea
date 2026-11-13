import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { createEreignis, createFeuerwehr } from 'src/app/testing/test-data';
import { ConfirmEreignisAbschlussComponent } from '../shared/dialogs/confirm-ereignis-abschluss/confirm-ereignis-abschluss.component';
import { EditEreignisComponent } from '../shared/dialogs/edit-ereignis/edit-ereignis.component';
import { EditPersonComponent } from '../shared/dialogs/edit-person/edit-person.component';
import { PrintReportsComponent } from '../shared/dialogs/print-reports/print-reports.component';
import { RemoveFeuerwehrComponent } from '../shared/dialogs/remove-feuerwehr/remove-feuerwehr.component';
import { EreignisType } from '../shared/enums/ereignis-type';
import { BarcodeScannerService } from '../shared/services/barcode-scanner/barcode-scanner.service';
import { DataService } from '../shared/services/data/data.service';
import { OperatingService } from '../shared/services/operating/operating.service';
import { SyncApi } from '../shared/services/sync-api/sync-api';
import { SyncService } from '../shared/services/sync/sync.service';
import { EreignissePageComponent } from './ereignisse-page/ereignisse-page.component';
import { OperatingPageComponent } from './operating-page/operating-page.component';
import { StartPageComponent } from './start-page/start-page.component';
import { VerwaltungPageComponent } from './verwaltung-page/verwaltung-page.component';

describe('Seiten-Aktionen', () =>
{
    let data: DataService;
    let navigate: ReturnType<typeof vi.spyOn>;
    let dialogResult: unknown;
    let open: ReturnType<typeof vi.fn>;
    const feuerwehr = createFeuerwehr(1, ['11111']);

    beforeEach(async () =>
    {
        dialogResult = undefined;
        open = vi.fn(() => ({ afterClosed: () => of(dialogResult) }));
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                { provide: SyncApi, useValue: {} },
                { provide: MatDialog, useValue: { open } }
            ]
        });
        navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        data = TestBed.inject(DataService);
        await data.saveFeuerwehr(feuerwehr);
    });

    const openedWith = (component: unknown) => expect(open).toHaveBeenCalledWith(component, expect.anything());
    const openedData = () => open.mock.lastCall![1].data;

    it('Startseite legt ein neues Ereignis an und wechselt in den Betrieb', async () =>
    {
        const page = TestBed.createComponent(StartPageComponent).componentInstance;
        page.newEreignis.type = EreignisType.Einsatz;
        page.newEreignis.ort = 'Tulln';

        await page.createEreignis();

        const [ereignis] = data.ereignisse();
        expect(ereignis).toMatchObject({ type: EreignisType.Einsatz, ort: 'Tulln', datetimeEnd: null, fuellungen: [] });
        expect(ereignis.datetimeStart).toBeInstanceOf(Date);
        expect(navigate).toHaveBeenCalledWith(['/operating']);
    });

    describe('Operating-Seite', () =>
    {
        let operating: OperatingService;
        let page: OperatingPageComponent;
        let id: number;

        beforeEach(async () =>
        {
            id = await data.saveEreignis(createEreignis());
            operating = TestBed.inject(OperatingService);
            await operating.tryStartOpenEreignis();
            page = TestBed.createComponent(OperatingPageComponent).componentInstance;
        });

        it('bearbeitet eine Kopie des Ereignisses und lädt danach neu', async () =>
        {
            const reload = vi.spyOn(operating, 'reload');

            await page.openEditEreignis();

            openedWith(EditEreignisComponent);
            expect(openedData()).toEqual(operating.ereignis());
            expect(openedData()).not.toBe(operating.ereignis());
            expect(reload).toHaveBeenCalled();
            expect(operating.ereignis()!.id).toBe(id);
        });

        it('schließt das Ereignis nur nach Bestätigung ab', async () =>
        {
            const closeEreignis = vi.spyOn(operating, 'closeEreignis').mockResolvedValue();

            dialogResult = false;
            page.confirmCloseEreignis();
            openedWith(ConfirmEreignisAbschlussComponent);
            await new Promise(resolve => setTimeout(resolve));
            expect(closeEreignis).not.toHaveBeenCalled();

            expect(navigate).not.toHaveBeenCalled();

            dialogResult = true;
            await page.confirmCloseEreignis();
            expect(closeEreignis).toHaveBeenCalled();
            expect(navigate).toHaveBeenCalledWith(['/']);
        });

        it('schaltet Scanner und Bestätigung um', () =>
        {
            page.toggleScannerInput();
            page.toggleConfirmFuellung();
            expect(TestBed.inject(BarcodeScannerService).active()).toBe(false);
            expect(operating.confirmFuellungActive()).toBe(false);
        });

        it('öffnet die Berichte für das laufende Ereignis', () =>
        {
            page.openPrintReportings();
            openedWith(PrintReportsComponent);
            expect(openedData()).toBe(operating.ereignis());
        });
    });

    it('Ereignisse-Seite bearbeitet eine Kopie des Ereignisses', () =>
    {
        const page = TestBed.createComponent(EreignissePageComponent).componentInstance;
        const ereignis = createEreignis({ id: 7 });

        page.openEditEreignis(ereignis);

        openedWith(EditEreignisComponent);
        expect(openedData()).toEqual(ereignis);
        expect(openedData()).not.toBe(ereignis);
    });

    describe('Verwaltung', () =>
    {
        let page: VerwaltungPageComponent;

        beforeEach(() => page = TestBed.createComponent(VerwaltungPageComponent).componentInstance);

        it('bearbeitet eine Kopie der Person', () =>
        {
            const person = { id: 1, vorname: 'Max', nachname: 'Muster' };
            page.editPerson(person);
            openedWith(EditPersonComponent);
            expect(openedData()).toEqual(person);
            expect(openedData()).not.toBe(person);
        });

        it('fragt vor dem Entfernen einer Feuerwehr nach', () =>
        {
            page.openRemoveFeuerwehr(feuerwehr);
            openedWith(RemoveFeuerwehrComponent);
            expect(openedData()).toBe(feuerwehr);
        });

        it('entfernt Füllpersonal', async () =>
        {
            const id = await data.savePerson({ vorname: 'Max', nachname: 'Muster' });
            await page.removePerson(data.personen().find(p => p.id === id)!);
            await vi.waitFor(() => expect(data.personen()).toEqual([]));
        });

        it('synchronisiert eine neue Feuerwehr', () =>
        {
            const addFeuerwehr = vi.spyOn(TestBed.inject(SyncService), 'addFeuerwehr').mockResolvedValue();
            page.addFeuerwehrToSync(42);
            expect(addFeuerwehr).toHaveBeenCalledWith(42);
        });
    });
});
