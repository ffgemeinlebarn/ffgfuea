import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { provideDialog } from 'src/app/testing/dialog';
import { AddMangelComponent } from './add-mangel/add-mangel.component';
import { ConfirmEreignisAbschlussComponent } from './confirm-ereignis-abschluss/confirm-ereignis-abschluss.component';
import { ConfirmImportComponent } from './confirm-import/confirm-import.component';
import { ConfirmFuellungComponent } from './confirm-fuellung/confirm-fuellung.component';
import { EditEreignisComponent } from './edit-ereignis/edit-ereignis.component';
import { EditFlascheComponent } from './edit-flasche/edit-flasche.component';
import { EditPersonComponent } from './edit-person/edit-person.component';
import { RemoveFeuerwehrComponent } from './remove-feuerwehr/remove-feuerwehr.component';
import { RemoveFlascheComponent } from './remove-flasche/remove-flasche.component';
import { RemoveFuellungComponent } from './remove-fuellung/remove-fuellung.component';
import { SearchFlascheComponent } from './search-flasche/search-flasche.component';

describe('Dialoge', () =>
{
    const feuerwehr = createFeuerwehr(1, ['11111'], ['19999']);
    const fuellung = createFuellung(feuerwehr.flaschen[0]);
    const manuelleFuellung = createFuellung(feuerwehr.flaschen[1]);

    const dialogs: Array<[Type<unknown>, unknown, string]> = [
        [AddMangelComponent, createEreignis(), 'Mangel hinzufügen'],
        [ConfirmEreignisAbschlussComponent, null, 'Abschließen & Berichte drucken'],
        [ConfirmFuellungComponent, fuellung, 'Barcode: 11111'],
        [ConfirmFuellungComponent, manuelleFuellung, 'Manuell erfasste Flasche'],
        [ConfirmImportComponent, { feuerwehren: 2, personen: 3, ereignisse: 40, testMode: true }, '40 Einsätze & Übungen, 3 Personen und 2 Feuerwehren der Testdatenbank'],
        [EditEreignisComponent, createEreignis({ ort: 'Tulln' }), 'Übung in Tulln'],
        [EditFlascheComponent, { feuerwehr }, 'Flasche hinzufügen'],
        [EditFlascheComponent, { feuerwehr, flasche: feuerwehr.flaschen[1] }, 'Flasche bearbeiten'],
        [EditPersonComponent, { vorname: 'Max', nachname: 'Muster' }, 'Max Muster'],
        [RemoveFeuerwehrComponent, feuerwehr, 'Soll die Feuerwehr FF 1 wirklich entfernt werden?'],
        [RemoveFlascheComponent, feuerwehr.flaschen[1], 'Soll die Flasche mit dem Barcode 19999 wirklich gelöscht werden?'],
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

    it('ConfirmFuellung kennzeichnet Flaschen aus MAT nicht', async () =>
    {
        TestBed.configureTestingModule({ providers: provideDialog(fuellung) });
        const fixture = TestBed.createComponent(ConfirmFuellungComponent);
        await fixture.whenStable();

        expect(fixture.nativeElement.textContent).not.toContain('Manuell');
    });

    it('Abschluss-Dialog liefert die Entscheidung zurück', () =>
    {
        TestBed.configureTestingModule({ providers: provideDialog() });
        const fixture = TestBed.createComponent(ConfirmEreignisAbschlussComponent);
        const close = TestBed.inject(MatDialogRef).close;

        fixture.componentInstance.confirm();
        expect(close).toHaveBeenLastCalledWith('abschliessen');

        fixture.componentInstance.confirm(true);
        expect(close).toHaveBeenLastCalledWith('abschliessenUndDrucken');

        fixture.componentInstance.close();
        expect(close).toHaveBeenLastCalledWith();
    });
});
