import { OverlayContainer } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { provideDialog } from 'src/app/testing/dialog';
import { captureDownloads, FakeDirectoryHandle, installDirectoryPicker, removeDirectoryPicker } from 'src/app/testing/file-system';
import { NotificationService } from '../../services/notification/notification.service';
import { OrdnerStore } from '../../services/pdf-ablage/ordner-store';
import { PdfAblageService } from '../../services/pdf-ablage/pdf-ablage.service';
import { IDruckErgebnis, PdfDruckService } from '../../services/pdf/pdf-druck.service';
import { PdfService } from '../../services/pdf/pdf.service';
import { BerichteComponent, IBerichteDaten } from './berichte.component';

describe('BerichteComponent', () =>
{
    const ff1 = createFeuerwehr(1, ['11111', '11112']);
    const ff2 = createFeuerwehr(2, ['22221']);
    const ereignis = createEreignis({
        jahr: 2026,
        nummer: 12,
        fuellungen: [createFuellung(ff1.flaschen[0]), createFuellung(ff2.flaschen[0]), createFuellung(ff1.flaschen[1])]
    });
    const ereignisPfad = ['2026', '2026-012_Uebung_Gemeinlebarn'];
    const alleDateien = ['2026-012_Gesamtbericht.pdf', '2026-012_Feuerwehr_FF_1.pdf', '2026-012_Feuerwehr_FF_2.pdf'];

    let daten: IBerichteDaten;
    let fixture: ComponentFixture<BerichteComponent>;
    let component: BerichteComponent;
    let ordner: FakeDirectoryHandle | undefined;
    let drucken: ReturnType<typeof vi.fn>;
    let druckErgebnis: IDruckErgebnis;
    let show: ReturnType<typeof vi.spyOn>;
    let showError: ReturnType<typeof vi.spyOn>;

    beforeEach(() =>
    {
        ordner = undefined;
        daten = { ereignis };
        druckErgebnis = { art: 'druckdialog', url: 'blob:sammel' };
        drucken = vi.fn(async () => druckErgebnis);
        installDirectoryPicker(async () => ordner);
        TestBed.configureTestingModule({
            providers: [
                ...provideDialog(daten),
                { provide: OrdnerStore, useValue: { get: async () => ordner?.asHandle(), set: vi.fn(), delete: vi.fn() } },
                { provide: PdfDruckService, useValue: { drucken } }
            ]
        });
        show = vi.spyOn(TestBed.inject(NotificationService), 'show').mockImplementation(() => undefined);
        showError = vi.spyOn(TestBed.inject(NotificationService), 'showError').mockImplementation(() => undefined);
    });

    afterEach(() =>
    {
        removeDirectoryPicker();
        vi.restoreAllMocks();
    });

    /** Öffnet den Dialog, mit ordner als gewähltem Ablageordner und optional mit „Als PDF speichern“ */
    async function erstellen(ablageOrdner?: FakeDirectoryHandle, pdfSpeichern?: boolean): Promise<void>
    {
        ordner = ablageOrdner;
        daten.pdfSpeichern = pdfSpeichern;
        const ablage = TestBed.inject(PdfAblageService);
        ablage.downloadPause = 0;
        await ablage.geladen;
        fixture = TestBed.createComponent(BerichteComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    }

    const element = (selector: string): HTMLElement => fixture.nativeElement.querySelector(selector);
    const text = (selector: string): string => element(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const reportCheckboxes = (): Array<HTMLInputElement> => [...fixture.nativeElement.querySelectorAll('.reports input[type=checkbox]')];
    const alle = (): HTMLInputElement => fixture.nativeElement.querySelector('.alle input[type=checkbox]');
    const druckenButton = (): HTMLButtonElement => fixture.nativeElement.querySelector('button.drucken');
    const pdfButton = (): HTMLButtonElement => fixture.nativeElement.querySelector('button.pdf');
    const buttons = (): Array<string> => [...fixture.nativeElement.querySelectorAll('mat-dialog-actions button')]
        .map((button: HTMLElement) => button.textContent?.replace(/\s+/g, ' ').replace('picture_as_pdf', '').replace('print', '').trim());
    const selectedIds = () => component.selectedReports().map(r => r.id);

    describe('Anzeige und Auswahl', () =>
    {
        beforeEach(() => erstellen());

        it('zeigt Nummer, Art, Ort und Beginn des Ereignisses', () =>
        {
            const kopf = [...fixture.nativeElement.querySelectorAll('.ereignis > div')]
                .map((feld: HTMLElement) => [feld.querySelector('dt')?.textContent?.trim(), feld.querySelector('dd')?.textContent?.trim()]);
            expect(kopf).toEqual([['Nummer', '2026-012'], ['Art', 'Übung'], ['Ort', 'Gemeinlebarn'], ['Beginn', '01.05.2026 10:00 Uhr']]);
        });

        it('bietet den Gesamtbericht und einen Bericht pro Feuerwehr mit Füllungen und Ausrichtung an', () =>
        {
            expect(component.reports.map(r => [r.name, r.beschreibung, r.ausrichtung])).toEqual([
                ['Gesamtbericht', '3 Füllungen · 2 Feuerwehren', 'Querformat'],
                ['FF 1', '2 Füllungen', 'Hochformat'],
                ['FF 2', '1 Füllung', 'Hochformat']
            ]);
            const zeilen = [...fixture.nativeElement.querySelectorAll('.reports li')].map((li: HTMLElement) =>
                ['.name', '.beschreibung', '.ausrichtung'].map(teil => li.querySelector(teil)?.textContent?.trim()).filter(t => !!t).join(' | ')
                || li.textContent?.trim());
            expect(zeilen).toEqual([
                'Gesamtbericht | 3 Füllungen · 2 Feuerwehren | Querformat',
                'Feuerwehrberichte',
                'FF 1 | 2 Füllungen | Hochformat',
                'FF 2 | 1 Füllung | Hochformat'
            ]);
            expect(reportCheckboxes().map(c => c.checked)).toEqual([true, true, true]);
            expect(text('.anzahl')).toBe('3 von 3 ausgewählt');
        });

        it('wählt einzelne, alle oder keine Berichte aus', async () =>
        {
            reportCheckboxes()[0].click();
            await fixture.whenStable();
            expect(selectedIds()).toEqual(['feuerwehr-1', 'feuerwehr-2']);
            expect(alle().indeterminate).toBe(true);
            expect(text('.anzahl')).toBe('2 von 3 ausgewählt');

            alle().click();
            await fixture.whenStable();
            expect(component.allSelected()).toBe(true);

            alle().click();
            await fixture.whenStable();
            expect(component.noneSelected()).toBe(true);
            expect(reportCheckboxes().map(c => c.checked)).toEqual([false, false, false]);
            expect(druckenButton().disabled).toBe(true);
        });

        it('bietet eine Schnellauswahl im Menü an', async () =>
        {
            element('button.vorauswahl').click();
            await fixture.whenStable();
            const overlay = TestBed.inject(OverlayContainer).getContainerElement();
            const eintraege = [...overlay.querySelectorAll<HTMLButtonElement>('[mat-menu-item]')];
            expect(eintraege.map(e => e.textContent?.trim())).toEqual(['Alle Berichte', 'Nur Gesamtbericht', 'Alle Feuerwehrberichte']);

            overlay.querySelector<HTMLButtonElement>('.vorauswahl-gesamt')!.click();
            await fixture.whenStable();
            expect(selectedIds()).toEqual(['gesamt']);

            component.vorauswahl('feuerwehren');
            expect(selectedIds()).toEqual(['feuerwehr-1', 'feuerwehr-2']);

            component.vorauswahl('alle');
            expect(component.allSelected()).toBe(true);
        });

        it('bietet nur Schließen und Drucken an', () =>
        {
            expect(buttons()).toEqual(['Schließen', 'Drucken']);
            expect(pdfButton()).toBeNull();
        });

        it('weist ohne Ordner auf die Ablage in den Einstellungen hin, ohne Download zu erwähnen', () =>
        {
            expect(text('.ablage')).toBe('folder_off Kein Ablageordner gewählt, die PDFs werden nicht abgelegt. '
                + 'Ordner auswählen unter Einstellungen → PDF-Ablage.');
        });

        it('verändert die Daten des Ereignisses nicht', () =>
        {
            expect(ereignis.fuellungen[0].flasche.feuerwehr).not.toHaveProperty('fuellungen');
            expect(ereignis.fuellungen.map(f => f.flasche.barcode)).toEqual(['11111', '22221', '11112']);
        });
    });

    it('zeigt ohne Füllungen nur den Gesamtbericht', async () =>
    {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [...provideDialog({ ereignis: createEreignis() }), { provide: PdfDruckService, useValue: { drucken } }] });
        await erstellen();

        expect(component.reports.map(r => r.name)).toEqual(['Gesamtbericht']);
        expect(text('.reports')).toContain('Noch keine Füllungen');
    });

    describe('Drucken', () =>
    {
        it('druckt die Auswahl als ein PDF und legt ohne Ordner nichts ab', async () =>
        {
            const downloads = captureDownloads();
            await erstellen();
            const sammelPdf = vi.spyOn(TestBed.inject(PdfService), 'createSammelPdf');
            component.vorauswahl('feuerwehren');

            druckenButton().click();
            await vi.waitFor(() => expect(drucken).toHaveBeenCalled());
            await vi.waitFor(() => expect(component.busy()).toBe(false));

            expect(sammelPdf).toHaveBeenCalledWith(
                ereignis, [{ gruppe: component.reports[1].gruppe }, { gruppe: component.reports[2].gruppe }], expect.any(Date), expect.any(Function));
            const pdf: Blob = drucken.mock.calls[0][0];
            expect(pdf.type).toBe('application/pdf');
            expect(downloads).toEqual([]);
            expect(show).not.toHaveBeenCalled();
            expect(showError).not.toHaveBeenCalled();
        });

        it('legt jeden gedruckten Bericht als eigenes PDF im Ordner ab', async () =>
        {
            const berichte = new FakeDirectoryHandle('Berichte');
            await erstellen(berichte);
            expect(element('.ablage')).toBeNull();
            component.toggle(component.reports[2], false);

            await component.print();

            expect(drucken).toHaveBeenCalledTimes(1);
            expect([...berichte.pfad(...ereignisPfad)!.dateien.keys()]).toEqual(alleDateien.slice(0, 2));
            expect(show).toHaveBeenCalledWith('2 PDFs gespeichert in Berichte/2026/2026-012_Uebung_Gemeinlebarn', expect.any(Number));
        });

        it('fragt die Berechtigung für den Ordner an, bevor die PDFs erzeugt werden', async () =>
        {
            const berichte = new FakeDirectoryHandle('Berichte');
            berichte.berechtigung = 'prompt';
            await erstellen(berichte);
            const sammelPdf = vi.spyOn(TestBed.inject(PdfService), 'createSammelPdf');

            await component.print();

            expect(berichte.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
            expect(berichte.requestPermission.mock.invocationCallOrder[0]).toBeLessThan(sammelPdf.mock.invocationCallOrder[0]);
            expect(berichte.pfad(...ereignisPfad)!.dateien.size).toBe(3);
        });

        it('druckt ohne Berechtigung trotzdem und weist darauf hin, ohne herunterzuladen', async () =>
        {
            const downloads = captureDownloads();
            const berichte = new FakeDirectoryHandle('Berichte');
            berichte.berechtigung = 'prompt';
            berichte.anfrageErgebnis = 'denied';
            await erstellen(berichte);

            await component.print();

            expect(drucken).toHaveBeenCalledTimes(1);
            expect(berichte.ordner.size).toBe(0);
            expect(downloads).toEqual([]);
            expect(show).toHaveBeenCalledWith('PDFs wurden nicht abgelegt: Keine Schreibberechtigung für den Ordner „Berichte“', expect.any(Number));
        });

        it('meldet einen Fehler beim Ablegen, nachdem gedruckt wurde', async () =>
        {
            const berichte = new FakeDirectoryHandle('Berichte');
            await erstellen(berichte);
            vi.spyOn(berichte, 'getDirectoryHandle').mockRejectedValue(new Error('Datenträger voll'));

            await component.print();

            expect(drucken).toHaveBeenCalledTimes(1);
            expect(show).toHaveBeenCalledWith('PDFs konnten nicht abgelegt werden: Datenträger voll', expect.any(Number));
        });

        it('zeigt den Fortschritt und sperrt den Dialog, solange gearbeitet wird', async () =>
        {
            await erstellen(new FakeDirectoryHandle('Berichte'), true);
            let fertig!: () => void;
            drucken.mockImplementation(() => new Promise(resolve => fertig = () => resolve(druckErgebnis)));
            const dialogRef = TestBed.inject(MatDialogRef);

            const laeuft = component.print();
            await vi.waitFor(() => expect(drucken).toHaveBeenCalled());
            await fixture.whenStable();

            expect(component.busy()).toBe(true);
            expect(text('.status')).toContain('Druckdialog wird geöffnet');
            // Drei Berichte für den Druck erzeugt, drei zum Ablegen fehlen noch
            expect(component.fortschritt()).toBe(50);
            expect(element('.status mat-progress-bar')).not.toBeNull();
            expect(druckenButton().disabled).toBe(true);
            expect(pdfButton().disabled).toBe(true);
            expect(dialogRef.disableClose).toBe(true);

            await component.print();
            await component.savePdf();
            component.close();
            expect(drucken).toHaveBeenCalledTimes(1);
            expect(dialogRef.close).not.toHaveBeenCalled();

            fertig();
            await laeuft;
            await fixture.whenStable();
            expect(element('.status')).toBeNull();
            expect(dialogRef.disableClose).toBe(false);
            expect(druckenButton().disabled).toBe(false);
        });

        it('meldet einen in einem neuen Tab geöffneten Druck', async () =>
        {
            druckErgebnis = { art: 'tab', url: 'blob:sammel' };
            await erstellen();

            await component.print();

            expect(show).toHaveBeenCalledWith('PDF in neuem Tab geöffnet, bitte dort drucken', expect.any(Number));
            expect(component.druckLink()).toBeNull();
        });

        it('bietet einen Link zum PDF an, wenn der Browser den Druck blockiert', async () =>
        {
            druckErgebnis = { art: 'blockiert', url: 'blob:sammel' };
            await erstellen();

            await component.print();
            await fixture.whenStable();

            const link = element('.druck-link a') as HTMLAnchorElement;
            expect(link.getAttribute('href')).toBe('blob:sammel');
            expect(link.target).toBe('_blank');
            expect(show).toHaveBeenCalledWith('Neuer Tab wurde blockiert, bitte „PDF öffnen“ verwenden', expect.any(Number));
        });

        it('meldet Fehler beim Erzeugen des PDFs', async () =>
        {
            await erstellen();
            vi.spyOn(TestBed.inject(PdfService), 'createSammelPdf').mockRejectedValue(new Error('kaputt'));

            await component.print();

            expect(drucken).not.toHaveBeenCalled();
            expect(showError).toHaveBeenCalledWith(expect.any(Error), 'Berichte konnten nicht gedruckt werden', expect.any(Number));
            expect(component.busy()).toBe(false);
        });

        it('druckt nichts, wenn kein Bericht ausgewählt ist', async () =>
        {
            await erstellen();
            component.selectAll(false);

            await component.print();

            expect(drucken).not.toHaveBeenCalled();
        });
    });

    describe('Als PDF speichern', () =>
    {
        it('bietet den Button dezent neben Schließen und Drucken an, gesperrt ohne Auswahl', async () =>
        {
            await erstellen(undefined, true);

            expect(buttons()).toEqual(['Als PDF speichern', 'Schließen', 'Drucken']);
            expect(pdfButton().hasAttribute('mat-button')).toBe(true);
            component.selectAll(false);
            await fixture.whenStable();
            expect(pdfButton().disabled).toBe(true);
        });

        it('weist ohne Ordner zusätzlich auf den Download hin', async () =>
        {
            await erstellen(undefined, true);

            expect(text('.ablage')).toContain('Kein Ablageordner gewählt');
            expect(text('.ablage')).toContain('Als PDF speichern lädt die PDFs herunter.');
        });

        it('zeigt mit Ordner keinen Hinweis', async () =>
        {
            await erstellen(new FakeDirectoryHandle('Berichte'), true);

            expect(element('.ablage')).toBeNull();
        });

        it('legt die ausgewählten Berichte im Ordner ab, ohne zu drucken', async () =>
        {
            const downloads = captureDownloads();
            const berichte = new FakeDirectoryHandle('Berichte');
            await erstellen(berichte, true);
            component.vorauswahl('gesamt');

            pdfButton().click();
            await vi.waitFor(() => expect(show).toHaveBeenCalled());

            expect([...berichte.pfad(...ereignisPfad)!.dateien.keys()]).toEqual(['2026-012_Gesamtbericht.pdf']);
            expect(show).toHaveBeenCalledWith('1 PDF gespeichert in Berichte/2026/2026-012_Uebung_Gemeinlebarn', expect.any(Number));
            expect(downloads).toEqual([]);
            expect(drucken).not.toHaveBeenCalled();
        });

        it('lädt die PDFs ohne Ordner herunter', async () =>
        {
            const downloads = captureDownloads();
            await erstellen(undefined, true);

            await component.savePdf();

            expect(downloads).toEqual(alleDateien);
            expect(show).toHaveBeenCalledWith('3 PDFs heruntergeladen', expect.any(Number));
            expect(drucken).not.toHaveBeenCalled();
        });

        it('lädt ohne Berechtigung für den Ordner herunter und weist darauf hin', async () =>
        {
            const downloads = captureDownloads();
            const berichte = new FakeDirectoryHandle('Berichte');
            berichte.berechtigung = 'denied';
            berichte.anfrageErgebnis = 'denied';
            await erstellen(berichte, true);

            await component.savePdf();

            expect(downloads).toEqual(alleDateien);
            expect(show).toHaveBeenCalledWith('Keine Schreibberechtigung für den Ordner „Berichte“. 3 PDFs heruntergeladen', expect.any(Number));
        });

        it('meldet Fehler beim Speichern', async () =>
        {
            await erstellen(undefined, true);
            vi.spyOn(TestBed.inject(PdfAblageService), 'speichern').mockRejectedValue(new Error('Datenträger voll'));

            await component.savePdf();

            expect(showError).toHaveBeenCalledWith(expect.any(Error), 'PDFs konnten nicht gespeichert werden', expect.any(Number));
            expect(component.busy()).toBe(false);
        });
    });
});
