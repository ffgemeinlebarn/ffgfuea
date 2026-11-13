import { TestBed } from '@angular/core/testing';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { FeuerwehrberichtComponent } from './feuerwehrbericht.component';

describe('FeuerwehrberichtComponent', () =>
{
    it('zeigt die Füllungen der Feuerwehr mit Summe und beiden Unterschriftsfeldern', async () =>
    {
        const ff1 = createFeuerwehr(1, ['11111', '11112']);
        const flasche = { ...ff1.flaschen[0], flaschennummer: 'A-17', typenInfo1: '300 bar' };
        const fixture = TestBed.createComponent(FeuerwehrberichtComponent);
        fixture.componentRef.setInput('ereignis', createEreignis());
        fixture.componentRef.setInput('gruppe', {
            feuerwehr: ff1.flaschen[0].feuerwehr,
            fuellungen: [createFuellung(flasche, new Date(2026, 4, 1, 10, 5)), createFuellung(ff1.flaschen[1])]
        });
        fixture.componentRef.setInput('gedruckt', new Date());
        await fixture.whenStable();

        const element: HTMLElement = fixture.nativeElement;
        const texts = (selector: string) =>
            [...element.querySelectorAll(selector)].map(e => e.textContent?.replace(/\s+/g, ' ').trim());

        expect(element.querySelector('ffg-report-header')?.textContent).toContain('Bericht für die Feuerwehr FF 1');
        expect(element.querySelectorAll('tr.fuellung').length).toBe(2);
        expect(texts('tr.fuellung:first-child td')).toEqual(['1', '01.05. 10:05', '1', '11111', 'A-17', 'Typ (300 bar)']);
        expect(texts('.summe')).toEqual(['Summe: 2 Füllungen']);
        expect(texts('ffg-unterschrift .label')).toEqual(['Füllpersonal', 'Übernommen von Feuerwehr FF 1']);
    });
});
