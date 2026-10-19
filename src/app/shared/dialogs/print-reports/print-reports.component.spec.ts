import { TestBed } from '@angular/core/testing';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { provideDialog } from 'src/app/testing/dialog';
import { PrintReportsComponent } from './print-reports.component';

describe('PrintReportsComponent', () =>
{
    const ff1 = createFeuerwehr(1, ['11111', '11112']);
    const ff2 = createFeuerwehr(2, ['22221']);
    const ereignis = createEreignis({
        fuellungen: [createFuellung(ff1.flaschen[0]), createFuellung(ff2.flaschen[0]), createFuellung(ff1.flaschen[1])]
    });

    beforeEach(() => TestBed.configureTestingModule({ providers: provideDialog(ereignis) }));

    it('erstellt einen Gesamtbericht und einen Bericht pro Feuerwehr', async () =>
    {
        const fixture = TestBed.createComponent(PrintReportsComponent);
        await fixture.whenStable();

        const reports = fixture.componentInstance.reports;
        expect(reports.map(r => r.name)).toEqual(['Gesamtbericht', 'Bericht für die Feuerwehr FF 1', 'Bericht für die Feuerwehr FF 2']);
        expect(reports[1].data[0].fuellungen.length).toBe(2);
        expect(fixture.nativeElement.querySelectorAll('.inner-report').length).toBe(3);
    });

    it('verändert die Daten des Ereignisses nicht', () =>
    {
        TestBed.createComponent(PrintReportsComponent);

        expect(ereignis.fuellungen[0].flasche.feuerwehr).not.toHaveProperty('fuellungen');
    });
});
