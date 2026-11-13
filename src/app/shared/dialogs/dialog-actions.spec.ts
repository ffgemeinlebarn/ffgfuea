import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { BarcodeScannerService } from '../services/barcode-scanner/barcode-scanner.service';
import { DataService } from '../services/data/data.service';
import { OperatingService } from '../services/operating/operating.service';
import { ConfirmFuellungComponent } from './confirm-fuellung/confirm-fuellung.component';
import { ConfirmImportComponent } from './confirm-import/confirm-import.component';
import { EditEreignisComponent } from './edit-ereignis/edit-ereignis.component';
import { EditFlascheComponent } from './edit-flasche/edit-flasche.component';
import { EditPersonComponent } from './edit-person/edit-person.component';
import { RemoveFeuerwehrComponent } from './remove-feuerwehr/remove-feuerwehr.component';
import { RemoveFlascheComponent } from './remove-flasche/remove-flasche.component';
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

    for (const [name, component] of [['ConfirmFuellung', ConfirmFuellungComponent], ['ConfirmImport', ConfirmImportComponent], ['RemoveFlasche', RemoveFlascheComponent]] as const)
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

    describe('EditFlasche', () =>
    {
        const ref = { feuerwehrNummer: 2, eigentuemerId: 2, name: 'FF 2' };
        const flaschenVon = (nummer: number) => data.feuerwehren().find(fw => fw.feuerwehrNummer === nummer)!.flaschen;

        it('legt eine manuelle Flasche an und schließt', async () =>
        {
            const { instance, close } = create(EditFlascheComponent, { feuerwehr: ref });

            instance.form.setValue({
                barcode: '22229', karteiNr: 4, flaschennummer: ' F-4 ', typenBezeichnung: 'Stahl 6L',
                typenInfo1: '300 bar', typenInfo2: '', typenInfo3: '', baujahr: 2015, pruefdatum: '2025-03-01'
            });
            await instance.save();

            expect(flaschenVon(2)[1]).toEqual({
                barcode: '22229', karteiNr: 4, flaschennummer: 'F-4', typenBezeichnung: 'Stahl 6L', typenInfo1: '300 bar',
                typenInfo2: undefined, typenInfo3: undefined, baujahr: 2015, pruefdatum: '2025-03-01',
                lastEdit: expect.any(Date) as Date, quelle: 'manuell', feuerwehr: ref
            });
            expect(close).toHaveBeenCalledWith(true);
        });

        it('speichert nicht bei ungültigem oder doppeltem Barcode', async () =>
        {
            const { instance, close } = create(EditFlascheComponent, { feuerwehr: ref });

            for (const [barcode, fehler] of [['', 'erforderlich'], ['12x45', 'nur aus Ziffern'], ['123', 'mindestens 5 Ziffern'], ['11111', 'Feuerwehr FF 1 zugeordnet']])
            {
                instance.form.controls.barcode.setValue(barcode);
                await instance.save();
                expect(instance.form.controls.barcode.errors?.['barcode']).toContain(fehler);
            }

            expect(flaschenVon(2)).toHaveLength(1);
            expect(close).not.toHaveBeenCalled();
        });

        it('bearbeitet eine manuelle Flasche mit ihren Werten', async () =>
        {
            const original = await data.saveManuelleFlasche(2, { barcode: '22229', karteiNr: 4, geraeteNr: 77, pruefdatum: new Date(2025, 2, 1) });
            const { instance, close } = create(EditFlascheComponent, { feuerwehr: ref, flasche: original });

            expect(instance.form.getRawValue()).toMatchObject({ barcode: '22229', karteiNr: 4, pruefdatum: '2025-03-01' });
            expect(instance.form.valid).toBe(true);

            instance.form.controls.karteiNr.setValue(5);
            await instance.save();

            expect(flaschenVon(2).map(f => [f.barcode, f.karteiNr, f.geraeteNr])).toEqual([['22221', 1, undefined], ['22229', 5, 77]]);
            expect(close).toHaveBeenCalledWith(true);
        });

        it('meldet Fehler beim Speichern und bleibt offen', async () =>
        {
            const snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
            const { instance, close } = create(EditFlascheComponent, { feuerwehr: { ...ref, feuerwehrNummer: 9 } });

            instance.form.controls.barcode.setValue('99999');
            await instance.save();

            expect(snackBar).toHaveBeenCalledWith('Die Feuerwehr mit der Nummer 9 wurde nicht gefunden!', undefined, { duration: 3000 });
            expect(close).not.toHaveBeenCalled();
        });

        it('verwirft beim Abbrechen und pausiert solange den Scanner', () =>
        {
            const scanner = TestBed.inject(BarcodeScannerService);
            dialogData = { feuerwehr: ref };
            const fixture = TestBed.createComponent(EditFlascheComponent);
            expect(scanner.active()).toBe(false);

            fixture.componentInstance.close();
            fixture.destroy();

            expect(TestBed.inject(MatDialogRef).close).toHaveBeenCalledWith(false);
            expect(scanner.active()).toBe(true);
            expect(flaschenVon(2)).toHaveLength(1);
        });
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
