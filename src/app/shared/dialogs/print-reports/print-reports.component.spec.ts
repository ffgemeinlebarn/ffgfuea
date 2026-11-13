import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '../../services/notification/notification.service';
import { IAblageErgebnis, PdfAblageService } from '../../services/pdf-ablage/pdf-ablage.service';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { provideDialog } from 'src/app/testing/dialog';
import { PrintReportsComponent } from './print-reports.component';

describe('PrintReportsComponent', () =>
{
    const ff1 = createFeuerwehr(1, ['11111', '11112']);
    const ff2 = createFeuerwehr(2, ['22221']);
    const ereignis = createEreignis({
        jahr: 2026,
        nummer: 12,
        fuellungen: [createFuellung(ff1.flaschen[0]), createFuellung(ff2.flaschen[0]), createFuellung(ff1.flaschen[1])]
    });

    let fixture: ComponentFixture<PrintReportsComponent>;
    let component: PrintReportsComponent;
    let speichern: ReturnType<typeof vi.fn>;
    let speichernFertig: (ergebnis: IAblageErgebnis) => void;
    const ordnerName = signal<string | null>('Berichte');

    beforeEach(async () =>
    {
        ordnerName.set('Berichte');
        speichern = vi.fn(() => new Promise<IAblageErgebnis>(resolve => speichernFertig = resolve));
        TestBed.configureTestingModule({
            providers: [
                ...provideDialog(ereignis),
                {
                    provide: PdfAblageService,
                    useValue: { speichern, ordnerName, meldung: (ergebnis: IAblageErgebnis) => `gespeichert in ${ergebnis.pfad}` }
                }
            ]
        });
        fixture = TestBed.createComponent(PrintReportsComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    const printContent = (): HTMLElement => fixture.nativeElement.querySelector('.print-content');
    const reportCheckboxes = (): Array<HTMLInputElement> =>
        [...fixture.nativeElement.querySelectorAll('.reports input[type=checkbox]')];

    it('erstellt einen Gesamtbericht und einen Bericht pro Feuerwehr', () =>
    {
        expect(component.reports.map(r => r.name)).toEqual(['Gesamtbericht', 'Bericht für die Feuerwehr FF 1', 'Bericht für die Feuerwehr FF 2']);
        expect(component.reports[1].gruppe?.fuellungen.length).toBe(2);
        expect(component.reports.map(r => r.beschreibung)).toEqual([
            'Übersicht aller Feuerwehren · 3 Füllungen · Querformat',
            '2 Füllungen · Hochformat',
            '1 Füllung · Hochformat'
        ]);
    });

    it('zeigt das Ereignis und alle Berichte ausgewählt an', () =>
    {
        expect(fixture.nativeElement.querySelector('.ereignis').textContent).toContain('Übung in Gemeinlebarn');
        expect(fixture.nativeElement.querySelector('.ereignis').textContent).toContain('2026-012');
        expect(reportCheckboxes().map(c => c.checked)).toEqual([true, true, true]);
        expect(fixture.nativeElement.querySelector('.reports').textContent).toContain('Bericht für die Feuerwehr FF 2');
    });

    it('rendert alle ausgewählten Berichte versteckt in den Druckinhalt', () =>
    {
        const content = printContent();
        expect(content.hidden).toBe(true);
        expect(content.querySelectorAll('ffg-gesamtbericht').length).toBe(1);
        expect(content.querySelectorAll('ffg-feuerwehrbericht').length).toBe(2);
    });

    it('druckt nur die ausgewählten Berichte', async () =>
    {
        reportCheckboxes()[0].click();
        await fixture.whenStable();

        expect(component.selectedReports().map(r => r.id)).toEqual(['feuerwehr-1', 'feuerwehr-2']);
        expect(printContent().querySelectorAll('ffg-gesamtbericht').length).toBe(0);
        expect(printContent().querySelectorAll('ffg-feuerwehrbericht').length).toBe(2);
        expect(fixture.nativeElement.querySelector('.auswahl').textContent).toContain('2 von 3 ausgewählt');
    });

    it('wählt alle oder keine Berichte aus', async () =>
    {
        const alle = (): HTMLInputElement => fixture.nativeElement.querySelector('.alle input[type=checkbox]');
        const drucken = (): HTMLButtonElement =>
            [...fixture.nativeElement.querySelectorAll('button')].find((b: HTMLButtonElement) => b.textContent?.includes('Drucken'));

        expect(alle().checked).toBe(true);

        alle().click();
        await fixture.whenStable();
        expect(component.noneSelected()).toBe(true);
        expect(reportCheckboxes().map(c => c.checked)).toEqual([false, false, false]);
        expect(printContent().children.length).toBe(0);
        expect(drucken().disabled).toBe(true);

        component.toggle(component.reports[2], true);
        await fixture.whenStable();
        expect(alle().indeterminate).toBe(true);
        expect(drucken().disabled).toBe(false);

        alle().click();
        await fixture.whenStable();
        expect(component.allSelected()).toBe(true);
        expect(reportCheckboxes().map(c => c.checked)).toEqual([true, true, true]);
    });

    it('druckt nichts, wenn kein Bericht ausgewählt ist', () =>
    {
        const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
        component.selectAll(false);

        component.print();

        expect(print).not.toHaveBeenCalled();
        print.mockRestore();
    });

    it('verändert die Daten des Ereignisses nicht', () =>
    {
        expect(ereignis.fuellungen[0].flasche.feuerwehr).not.toHaveProperty('fuellungen');
        expect(ereignis.fuellungen.map(f => f.flasche.barcode)).toEqual(['11111', '22221', '11112']);
    });

    describe('Als PDF speichern', () =>
    {
        const pdfButton = (): HTMLButtonElement => fixture.nativeElement.querySelector('button.pdf');
        const druckenButton = (): HTMLButtonElement =>
            [...fixture.nativeElement.querySelectorAll('button')].find((b: HTMLButtonElement) => b.textContent?.trim() === 'Drucken');

        it('zeigt das Ziel der PDFs', async () =>
        {
            expect(fixture.nativeElement.querySelector('.ablage').textContent).toContain('PDFs werden im Ordner „Berichte“ abgelegt');

            ordnerName.set(null);
            await fixture.whenStable();
            expect(fixture.nativeElement.querySelector('.ablage').textContent).toContain('PDFs werden heruntergeladen');
        });

        it('speichert die ausgewählten Berichte und meldet den Pfad', async () =>
        {
            const show = vi.spyOn(TestBed.inject(NotificationService), 'show').mockImplementation(() => undefined);
            const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
            reportCheckboxes()[1].click();
            await fixture.whenStable();

            pdfButton().click();
            await fixture.whenStable();

            expect(speichern).toHaveBeenCalledWith(ereignis, [component.reports[0], component.reports[2]], { erstellt: component.printedDateTime });
            // Während des Speicherns: Fortschritt anzeigen, nicht doppelt speichern und nicht drucken
            expect(component.saving()).toBe(true);
            expect(pdfButton().textContent).toContain('Speichert');
            expect(pdfButton().disabled).toBe(true);
            expect(druckenButton().disabled).toBe(true);
            expect(fixture.nativeElement.querySelector('mat-progress-bar')).not.toBeNull();
            await component.savePdf();
            component.print();
            expect(speichern).toHaveBeenCalledTimes(1);
            expect(print).not.toHaveBeenCalled();

            speichernFertig({ art: 'ordner', pfad: 'Berichte/2026/2026-012_Uebung_Gemeinlebarn', dateien: [] });
            await vi.waitFor(() => expect(component.saving()).toBe(false));
            await fixture.whenStable();

            expect(show).toHaveBeenCalledWith('gespeichert in Berichte/2026/2026-012_Uebung_Gemeinlebarn', expect.any(Number));
            expect(pdfButton().textContent).toContain('Als PDF speichern');
            expect(pdfButton().disabled).toBe(false);
            expect(fixture.nativeElement.querySelector('mat-progress-bar')).toBeNull();
            print.mockRestore();
        });

        it('meldet Fehler beim Speichern', async () =>
        {
            const showError = vi.spyOn(TestBed.inject(NotificationService), 'showError').mockImplementation(() => undefined);
            speichern.mockRejectedValue(new Error('Datenträger voll'));

            await component.savePdf();

            expect(showError).toHaveBeenCalledWith(expect.any(Error), 'PDFs konnten nicht gespeichert werden', expect.any(Number));
            expect(component.saving()).toBe(false);
        });

        it('speichert nichts, wenn kein Bericht ausgewählt ist', async () =>
        {
            component.selectAll(false);
            await fixture.whenStable();

            expect(pdfButton().disabled).toBe(true);
            await component.savePdf();
            expect(speichern).not.toHaveBeenCalled();
        });
    });
});
