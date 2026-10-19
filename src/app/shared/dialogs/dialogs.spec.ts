import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { provideDialog } from 'src/app/testing/dialog';
import { AddMangelComponent } from './add-mangel/add-mangel.component';
import { ConfirmEreignisAbschlussComponent } from './confirm-ereignis-abschluss/confirm-ereignis-abschluss.component';
import { ConfirmFuellungComponent } from './confirm-fuellung/confirm-fuellung.component';
import { EditEreignisComponent } from './edit-ereignis/edit-ereignis.component';
import { EditPersonComponent } from './edit-person/edit-person.component';
import { RemoveFeuerwehrComponent } from './remove-feuerwehr/remove-feuerwehr.component';
import { RemoveFuellungComponent } from './remove-fuellung/remove-fuellung.component';
import { SearchFlascheComponent } from './search-flasche/search-flasche.component';

describe('Dialoge', () =>
{
    const feuerwehr = createFeuerwehr(1, ['11111']);
    const fuellung = createFuellung(feuerwehr.flaschen[0]);

    const dialogs: Array<[Type<unknown>, unknown, string]> = [
        [AddMangelComponent, createEreignis(), 'Mangel hinzufügen'],
        [ConfirmEreignisAbschlussComponent, null, 'Ereignis abschließen'],
        [ConfirmFuellungComponent, fuellung, 'Barcode: 11111'],
        [EditEreignisComponent, createEreignis({ ort: 'Tulln' }), 'Übung in Tulln'],
        [EditPersonComponent, { vorname: 'Max', nachname: 'Muster' }, 'Max Muster'],
        [RemoveFeuerwehrComponent, feuerwehr, 'Soll die Feuerwehr FF 1 wirklich entfernt werden?'],
        [RemoveFuellungComponent, fuellung, 'Feuerwehr: FF 1'],
        [SearchFlascheComponent, null, 'Flasche manuell hinzufügen']
    ];

    for (const [component, data, expectedText] of dialogs)
    {
        it(`${component.name} zeigt "${expectedText}"`, async () =>
        {
            TestBed.configureTestingModule({ providers: [provideRouter([]), provideDialog(data)] });
            const fixture = TestBed.createComponent(component);
            await fixture.whenStable();

            expect(fixture.nativeElement.textContent).toContain(expectedText);
        });
    }

    it('Abschluss-Dialog liefert die Entscheidung zurück', () =>
    {
        TestBed.configureTestingModule({ providers: provideDialog() });
        const fixture = TestBed.createComponent(ConfirmEreignisAbschlussComponent);
        const close = TestBed.inject(MatDialogRef).close;

        fixture.componentInstance.confirm();
        expect(close).toHaveBeenLastCalledWith(true);

        fixture.componentInstance.close();
        expect(close).toHaveBeenLastCalledWith(false);
    });
});
