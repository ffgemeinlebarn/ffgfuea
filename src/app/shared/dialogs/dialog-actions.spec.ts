import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { DataService } from '../services/data/data.service';
import { OperatingService } from '../services/operating/operating.service';
import { ConfirmFuellungComponent } from './confirm-fuellung/confirm-fuellung.component';
import { ConfirmImportComponent } from './confirm-import/confirm-import.component';
import { EditEreignisComponent } from './edit-ereignis/edit-ereignis.component';
import { EditPersonComponent } from './edit-person/edit-person.component';
import { RemoveFeuerwehrComponent } from './remove-feuerwehr/remove-feuerwehr.component';
import { RemoveFuellungComponent } from './remove-fuellung/remove-fuellung.component';
import { SearchFlascheComponent } from './search-flasche/search-flasche.component';

describe('Dialog-Aktionen', () =>
{
    let data: DataService;
    let dialogData: unknown;
    const feuerwehr1 = createFeuerwehr(1, ['11111', '11112']);
    const feuerwehr2 = createFeuerwehr(2, ['22221']);

    beforeEach(async () =>
    {
        dialogData = null;
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                { provide: MatDialogRef, useValue: { close: vi.fn() } },
                { provide: MAT_DIALOG_DATA, useFactory: () => dialogData }
            ]
        });
        data = TestBed.inject(DataService);
        await data.saveFeuerwehr(feuerwehr1);
        await data.saveFeuerwehr(feuerwehr2);
    });

    function create<T>(component: Type<T>, data: unknown = null)
    {
        dialogData = data;
        const instance = TestBed.createComponent(component).componentInstance;
        return { instance, close: TestBed.inject(MatDialogRef).close };
    }

    for (const [name, component] of [['ConfirmFuellung', ConfirmFuellungComponent], ['ConfirmImport', ConfirmImportComponent]] as const)
    {
        it(`${name} liefert die Entscheidung zurück`, () =>
        {
            const { instance, close } = create<{ confirm(): void; close(): void }>(component, {});

            instance.confirm();
            expect(close).toHaveBeenLastCalledWith(true);

            instance.close();
            expect(close).toHaveBeenLastCalledWith(false);
        });
    }

    it('EditEreignis speichert die Änderungen und schließt', async () =>
    {
        const id = await data.saveEreignis(createEreignis());
        const ereignis = await data.getEreignis(id);
        const { instance, close } = create(EditEreignisComponent, ereignis);

        instance.ereignis.ort = 'Tulln';
        await instance.save();

        expect((await data.getEreignis(id)).ort).toBe('Tulln');
        expect(close).toHaveBeenCalled();
    });

    it('EditPerson speichert die Person und schließt', async () =>
    {
        const id = await data.savePerson({ vorname: 'Max', nachname: 'Muster' });
        const { instance, close } = create(EditPersonComponent, { id, vorname: 'Moritz', nachname: 'Muster' });

        await instance.save();

        expect(data.personen().map(p => p.vorname)).toEqual(['Moritz']);
        expect(close).toHaveBeenCalled();
    });

    it('EditPerson verwirft beim Abbrechen', async () =>
    {
        const id = await data.savePerson({ vorname: 'Max', nachname: 'Muster' });
        const { instance, close } = create(EditPersonComponent, { id, vorname: 'Moritz', nachname: 'Muster' });

        instance.close();

        expect(data.personen().map(p => p.vorname)).toEqual(['Max']);
        expect(close).toHaveBeenCalled();
    });

    it('RemoveFeuerwehr entfernt die Feuerwehr und schließt', async () =>
    {
        const { instance, close } = create(RemoveFeuerwehrComponent, feuerwehr1);

        instance.remove();

        await vi.waitFor(() => expect(close).toHaveBeenCalled());
        expect(data.feuerwehren().map(f => f.feuerwehrNummer)).toEqual([2]);
    });

    it('RemoveFuellung entfernt die Füllung aus dem laufenden Ereignis', async () =>
    {
        const operating = TestBed.inject(OperatingService);
        const removeFuellung = vi.spyOn(operating, 'removeFuellung').mockResolvedValue();
        const fuellung = createFuellung(feuerwehr1.flaschen[0]);
        const { instance, close } = create(RemoveFuellungComponent, fuellung);

        instance.remove();

        expect(removeFuellung).toHaveBeenCalledWith(fuellung);
        expect(close).toHaveBeenCalled();
    });

    it('SearchFlasche wählt die erste Flasche der gewählten Feuerwehr und fügt sie hinzu', () =>
    {
        const operating = TestBed.inject(OperatingService);
        const addFuellung = vi.spyOn(operating, 'addFuellung').mockResolvedValue();
        const { instance, close } = create(SearchFlascheComponent);

        expect(instance.selectedFlasche.barcode).toBe('11111');

        instance.selectedFeuerwehr = data.feuerwehren()[1];
        instance.feuerwehrChanged();
        expect(instance.selectedFlasche.barcode).toBe('22221');

        instance.add();
        expect(addFuellung).toHaveBeenCalledWith(instance.selectedFlasche);
        expect(close).toHaveBeenCalled();
    });
});
