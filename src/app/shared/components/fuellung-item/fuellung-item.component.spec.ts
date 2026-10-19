import { TestBed } from '@angular/core/testing';
import { createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { FuellungItemComponent } from './fuellung-item.component';

describe('FuellungItemComponent', () =>
{
    it('zeigt Feuerwehr, Flasche und Uhrzeit', async () =>
    {
        const flasche = createFeuerwehr(1, ['11111']).flaschen[0];
        const fixture = TestBed.createComponent(FuellungItemComponent);
        fixture.componentRef.setInput('fuellung', createFuellung(flasche, new Date(2026, 0, 1, 14, 3, 9)));
        await fixture.whenStable();

        const text = fixture.nativeElement.textContent;
        expect(text).toContain('FF 1 - Nr. 1');
        expect(text).toContain('Barcode: 11111');
        expect(text).toContain('14:03:09 Uhr');
    });
});
