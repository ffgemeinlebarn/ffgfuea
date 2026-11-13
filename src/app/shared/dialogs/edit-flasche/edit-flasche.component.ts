import { Component, DestroyRef, inject } from '@angular/core';
import { formatDate } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { IFeuerwehrRef } from '../../interfaces/i-feuerwehr';
import { IFlasche, IMatFlasche } from '../../interfaces/i-flasche';
import { BarcodeScannerService } from '../../services/barcode-scanner/barcode-scanner.service';
import { DataService } from '../../services/data/data.service';
import { NotificationService } from '../../services/notification/notification.service';

export interface IEditFlascheData
{
    feuerwehr: IFeuerwehrRef;
    /** Die bearbeitete manuelle Flasche, fehlt beim Anlegen */
    flasche?: IFlasche;
}

/** Wert für input type="date" */
function toDateInput(value: Date | string | undefined): string
{
    if (value == null || value === '') return '';
    try
    {
        return formatDate(value, 'yyyy-MM-dd', 'en-US');
    }
    catch
    {
        return '';
    }
}

const text = (value: string) => value.trim() || undefined;
const zahl = (value: number | null) => value ?? undefined;

/**
 * Anlegen und Bearbeiten einer manuell erfassten Flasche
 */
@Component({
    selector: 'ffg-edit-flasche',
    templateUrl: './edit-flasche.component.html',
    styleUrls: ['./edit-flasche.component.scss'],
    imports: [ReactiveFormsModule, MatFormField, MatLabel, MatError, MatHint, MatInput, MatButton]
})
export class EditFlascheComponent
{
    private dialog = inject<MatDialogRef<EditFlascheComponent, boolean>>(MatDialogRef);
    private data = inject(DataService);
    private notification = inject(NotificationService);
    public readonly input = inject<IEditFlascheData>(MAT_DIALOG_DATA);

    private readonly original = this.input.flasche;

    public readonly form = new FormGroup({
        barcode: new FormControl(this.original?.barcode ?? '', { nonNullable: true, validators: control => this.validateBarcode(control) }),
        karteiNr: new FormControl<number | null>(this.original?.karteiNr ?? null, Validators.min(0)),
        flaschennummer: new FormControl(this.original?.flaschennummer ?? '', { nonNullable: true }),
        typenBezeichnung: new FormControl(this.original?.typenBezeichnung ?? '', { nonNullable: true }),
        typenInfo1: new FormControl(this.original?.typenInfo1 ?? '', { nonNullable: true }),
        typenInfo2: new FormControl(this.original?.typenInfo2 ?? '', { nonNullable: true }),
        typenInfo3: new FormControl(this.original?.typenInfo3 ?? '', { nonNullable: true }),
        baujahr: new FormControl<number | null>(this.original?.baujahr ?? null, [Validators.min(1900), Validators.max(2100)]),
        pruefdatum: new FormControl(toDateInput(this.original?.pruefdatum), { nonNullable: true })
    });

    public constructor()
    {
        // Ein in das Barcode-Feld gescannter Barcode darf keine Füllung im laufenden Ereignis auslösen
        const scanner = inject(BarcodeScannerService);
        const active = scanner.active();
        scanner.active.set(false);
        inject(DestroyRef).onDestroy(() => scanner.active.set(active));
    }

    public get isNew(): boolean
    {
        return this.original == null;
    }

    private validateBarcode(control: AbstractControl<string>): ValidationErrors | null
    {
        const problem = this.data.validateBarcode(control.value, this.original);
        return problem ? { barcode: problem } : null;
    }

    public close(): void
    {
        this.dialog.close(false);
    }

    public async save(): Promise<void>
    {
        this.form.markAllAsTouched();
        if (this.form.invalid) return;

        const value = this.form.getRawValue();
        const daten: IMatFlasche = {
            // Nicht bearbeitbare Felder (z.B. geraeteNr) einer bestehenden Flasche beibehalten
            ...this.stripRef(this.original),
            barcode: value.barcode.trim(),
            karteiNr: zahl(value.karteiNr),
            flaschennummer: text(value.flaschennummer),
            typenBezeichnung: text(value.typenBezeichnung),
            typenInfo1: text(value.typenInfo1),
            typenInfo2: text(value.typenInfo2),
            typenInfo3: text(value.typenInfo3),
            baujahr: zahl(value.baujahr),
            pruefdatum: text(value.pruefdatum)
        };

        try
        {
            await this.data.saveManuelleFlasche(this.input.feuerwehr.feuerwehrNummer, daten, this.original);
            this.notification.show(this.isNew ? 'Flasche hinzugefügt' : 'Flasche gespeichert');
            this.dialog.close(true);
        }
        catch (error)
        {
            this.notification.showError(error);
        }
    }

    private stripRef(flasche: IFlasche | undefined): IMatFlasche
    {
        if (!flasche) return {};
        const { feuerwehr: _feuerwehr, quelle: _quelle, ...rest } = flasche;
        return rest;
    }
}
