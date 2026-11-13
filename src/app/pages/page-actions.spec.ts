import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { createEreignis, createFeuerwehr } from 'src/app/testing/test-data';
import { ConfirmEreignisAbschlussComponent } from '../shared/dialogs/confirm-ereignis-abschluss/confirm-ereignis-abschluss.component';
import { EditEreignisComponent } from '../shared/dialogs/edit-ereignis/edit-ereignis.component';
import { EditFlascheComponent } from '../shared/dialogs/edit-flasche/edit-flasche.component';
import { EditPersonComponent } from '../shared/dialogs/edit-person/edit-person.component';
import { BerichteComponent } from '../shared/dialogs/berichte/berichte.component';
import { RemoveFeuerwehrComponent } from '../shared/dialogs/remove-feuerwehr/remove-feuerwehr.component';
import { RemoveFlascheComponent } from '../shared/dialogs/remove-flasche/remove-flasche.component';
import { EreignisType } from '../shared/enums/ereignis-type';
import { BarcodeScannerService } from '../shared/services/barcode-scanner/barcode-scanner.service';
import { DataService } from '../shared/services/data/data.service';
import { NotificationService } from '../shared/services/notification/notification.service';
import { PdfAblageService } from '../shared/services/pdf-ablage/pdf-ablage.service';
import { SettingsService } from '../shared/services/settings/settings.service';
import { FakeDirectoryHandle } from 'src/app/testing/file-system';
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
            const closeEreignis = vi.spyOn(operating, 'closeEreignis');

            dialogResult = undefined;
            await page.confirmCloseEreignis();
            openedWith(ConfirmEreignisAbschlussComponent);
            expect(closeEreignis).not.toHaveBeenCalled();
            expect(navigate).not.toHaveBeenCalled();

            dialogResult = 'abschliessen';
            await page.confirmCloseEreignis();
            expect(closeEreignis).toHaveBeenCalled();
            expect(navigate).toHaveBeenCalledWith(['/']);
            expect(open).not.toHaveBeenCalledWith(BerichteComponent, expect.anything());
        });

        it('öffnet nach "Abschließen & Drucken" die Berichte des abgeschlossenen Ereignisses', async () =>
        {
            dialogResult = 'abschliessenUndDrucken';

            await page.confirmCloseEreignis();

            expect(operating.ereignis()).toBeNull();
            expect(navigate).toHaveBeenCalledWith(['/']);
            openedWith(BerichteComponent);
            expect(openedData()).toMatchObject({ id, datetimeEnd: expect.any(Date) });
            expect((await data.getEreignis(id)).datetimeEnd).toBeInstanceOf(Date);
        });

        describe('automatische PDF-Ablage beim Abschließen & Drucken', () =>
        {
            let ablage: PdfAblageService;
            let zielErmitteln: ReturnType<typeof vi.spyOn>;
            let speichern: ReturnType<typeof vi.spyOn>;
            let show: ReturnType<typeof vi.spyOn>;
            const ordner = new FakeDirectoryHandle('Berichte').asHandle();

            beforeEach(() =>
            {
                ablage = TestBed.inject(PdfAblageService);
                ablage.ordner.set(ordner);
                zielErmitteln = vi.spyOn(ablage, 'zielErmitteln').mockResolvedValue({ ordner });
                speichern = vi.spyOn(ablage, 'speichern').mockResolvedValue({ art: 'ordner', pfad: 'Berichte/2026/2026-001_Uebung_Gemeinlebarn', dateien: ['a.pdf', 'b.pdf'] });
                show = vi.spyOn(TestBed.inject(NotificationService), 'show').mockImplementation(() => undefined);
                dialogResult = 'abschliessenUndDrucken';
            });

            const berichteDialogOrder = () => open.mock.invocationCallOrder[open.mock.calls.findIndex(([c]) => c === BerichteComponent)];

            it('legt alle Berichte ab, bevor der Berichte-Dialog öffnet', async () =>
            {
                const closeEreignis = vi.spyOn(operating, 'closeEreignis');

                await page.confirmCloseEreignis();

                // Berechtigung vor dem Speichern des Ereignisses, PDFs vor dem Berichte-Dialog
                expect(zielErmitteln.mock.invocationCallOrder[0]).toBeLessThan(closeEreignis.mock.invocationCallOrder[0]);
                expect(speichern).toHaveBeenCalledWith(expect.objectContaining({ id, datetimeEnd: expect.any(Date) }), undefined, { ziel: { ordner }, download: false });
                expect(speichern.mock.invocationCallOrder[0]).toBeLessThan(berichteDialogOrder());
                openedWith(BerichteComponent);
                expect(show).toHaveBeenLastCalledWith('2 PDFs gespeichert in Berichte/2026/2026-001_Uebung_Gemeinlebarn', expect.any(Number));
            });

            it('fragt die Berechtigung vor dem Abschließen an und schreibt die PDFs in den Ordner', async () =>
            {
                zielErmitteln.mockRestore();
                speichern.mockRestore();
                const berichte = new FakeDirectoryHandle('Berichte');
                berichte.berechtigung = 'prompt';
                ablage.ordner.set(berichte.asHandle());
                const closeEreignis = vi.spyOn(operating, 'closeEreignis');

                await page.confirmCloseEreignis();

                expect(berichte.requestPermission.mock.invocationCallOrder[0]).toBeLessThan(closeEreignis.mock.invocationCallOrder[0]);
                const [jahr] = berichte.ordner.keys();
                const [ereignisOrdner] = berichte.ordner.get(jahr)!.ordner.values();
                expect([...ereignisOrdner.dateien.keys()]).toEqual([expect.stringMatching(/_Gesamtbericht\.pdf$/)]);
                expect(show).toHaveBeenLastCalledWith(expect.stringMatching(/^1 PDF gespeichert in Berichte\//), expect.any(Number));
                openedWith(BerichteComponent);
            });

            it('legt nichts ab, wenn die automatische Ablage ausgeschaltet ist', async () =>
            {
                TestBed.inject(SettingsService).pdfAutoAblage.set(false);

                await page.confirmCloseEreignis();

                expect(zielErmitteln).not.toHaveBeenCalled();
                expect(speichern).not.toHaveBeenCalled();
                openedWith(BerichteComponent);
            });

            it('legt ohne gewählten Ordner nichts ab', async () =>
            {
                ablage.ordner.set(null);

                await page.confirmCloseEreignis();

                expect(zielErmitteln).not.toHaveBeenCalled();
                expect(speichern).not.toHaveBeenCalled();
                openedWith(BerichteComponent);
            });

            it('legt beim Abschließen ohne Drucken nichts ab', async () =>
            {
                dialogResult = 'abschliessen';

                await page.confirmCloseEreignis();

                expect(zielErmitteln).not.toHaveBeenCalled();
                expect(speichern).not.toHaveBeenCalled();
            });

            it('weist auf eine fehlende Berechtigung hin und druckt trotzdem', async () =>
            {
                zielErmitteln.mockResolvedValue({ ordner: null, hinweis: 'Keine Schreibberechtigung für den Ordner „Berichte“' });

                await page.confirmCloseEreignis();

                expect(speichern).not.toHaveBeenCalled();
                expect(show).toHaveBeenCalledWith('PDFs wurden nicht abgelegt: Keine Schreibberechtigung für den Ordner „Berichte“', expect.any(Number));
                openedWith(BerichteComponent);
            });

            it('öffnet den Berichte-Dialog auch, wenn das Ablegen fehlschlägt', async () =>
            {
                const showError = vi.spyOn(TestBed.inject(NotificationService), 'showError').mockImplementation(() => undefined);
                speichern.mockRejectedValue(new Error('Datenträger voll'));

                await page.confirmCloseEreignis();

                expect(showError).toHaveBeenCalledWith(expect.any(Error), 'PDFs konnten nicht abgelegt werden', expect.any(Number));
                openedWith(BerichteComponent);
            });
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
            page.openBerichte();
            openedWith(BerichteComponent);
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

    it('Ereignisse-Seite öffnet die Berichte eines Ereignisses', () =>
    {
        const page = TestBed.createComponent(EreignissePageComponent).componentInstance;
        const ereignis = createEreignis({ id: 7 });

        page.openBerichte(ereignis);

        openedWith(BerichteComponent);
        expect(openedData()).toBe(ereignis);
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

        it('legt eine manuelle Flasche für die Feuerwehr an', () =>
        {
            page.addFlasche(feuerwehr);
            openedWith(EditFlascheComponent);
            expect(openedData()).toEqual({ feuerwehr: { feuerwehrNummer: 1, eigentuemerId: 1, name: 'FF 1' } });
        });

        it('bearbeitet nur manuelle Flaschen', async () =>
        {
            page.editFlasche(feuerwehr.flaschen[0]);
            expect(open).not.toHaveBeenCalled();

            const manuell = await data.saveManuelleFlasche(1, { barcode: '19999' });
            page.editFlasche(manuell);
            openedWith(EditFlascheComponent);
            expect(openedData()).toEqual({ feuerwehr: manuell.feuerwehr, flasche: manuell });
        });

        it('löscht eine manuelle Flasche nur nach Bestätigung', async () =>
        {
            const manuell = await data.saveManuelleFlasche(1, { barcode: '19999' });
            const barcodes = () => data.feuerwehren()[0].flaschen.map(f => f.barcode);

            dialogResult = false;
            await page.removeFlasche(manuell);
            openedWith(RemoveFlascheComponent);
            expect(barcodes()).toEqual(['11111', '19999']);

            dialogResult = true;
            await page.removeFlasche(manuell);
            expect(barcodes()).toEqual(['11111']);

            open.mockClear();
            await page.removeFlasche(feuerwehr.flaschen[0]);
            expect(open).not.toHaveBeenCalled();
            expect(barcodes()).toEqual(['11111']);
        });

        it('synchronisiert eine neue Feuerwehr', () =>
        {
            const addFeuerwehr = vi.spyOn(TestBed.inject(SyncService), 'addFeuerwehr').mockResolvedValue();
            page.addFeuerwehrToSync(42);
            expect(addFeuerwehr).toHaveBeenCalledWith(42);
        });
    });
});
