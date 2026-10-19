import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ConfirmFuellungComponent } from '../../dialogs/confirm-fuellung/confirm-fuellung.component';
import { IEreignis } from '../../interfaces/i-ereignis';
import { IFlasche } from '../../interfaces/i-flasche';
import { IFuellung } from '../../interfaces/i-fuellung';
import { DataService } from '../data/data.service';
import { TimingService } from '../timing/timing.service';

@Injectable({
    providedIn: 'root'
})
export class OperatingService
{
    private data = inject(DataService);
    private timing = inject(TimingService);
    private dialog = inject(MatDialog);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);

    private readonly minBarcodeZeichen = 5;
    private barcodeInputBuffer = '';

    public readonly barcodeInputActive = signal(true);
    public readonly confirmFuellungActive = signal(true);

    /** Das aktuell laufende Ereignis */
    public readonly ereignis = signal<IEreignis>(null);

    public readonly ereignisAnzahlFeuerwehren = computed(() =>
        new Set(this.ereignis()?.fuellungen?.map(fuellung => fuellung.flasche?.feuerwehr?.feuerwehrNummer)).size
    );

    // Mängel sind noch nicht umgesetzt
    public readonly ereignisAnzahlMaengel = signal(0);

    public constructor()
    {
        inject(DOCUMENT).body.addEventListener('keydown', event => this.onScannerInputEnter(event));
    }

    private onScannerInputEnter(event: KeyboardEvent)
    {
        if (this.barcodeInputActive() && this.ereignis())
        {
            // Number Input
            if (event.key !== 'Enter' && this.isDigit(event.key))
            {
                this.barcodeInputBuffer += event.key;
            }

            // Enter
            if (event.key === 'Enter' && this.barcodeInputBuffer.length >= this.minBarcodeZeichen)
            {
                this.snackBar.open(`Barcodeeingabe erkannt: ${this.barcodeInputBuffer}`, null, { duration: 1000 });

                this.addFuellungByBarcode(this.barcodeInputBuffer);
                this.barcodeInputBuffer = '';
            }

            // Reset Buffer on no Digit or Enter
            if (!this.isDigit(event.key) && event.key !== 'Enter')
            {
                this.barcodeInputBuffer = '';
            }
        }
    }

    private isDigit = (val: string) => /^\d+$/.test(val);

    public async tryStartOpenEreignis(): Promise<boolean>
    {
        const id = await this.data.findOpenEreignisId();
        if (id == null) return false;

        await this.reloadEreignis(id);
        return true;
    }

    public async reloadEreignis(id: number): Promise<void>
    {
        this.barcodeInputActive.set(true);
        const ereignis = await this.data.getEreignis(id);
        this.ereignis.set(ereignis);
        this.timing.ereignisStart.set(ereignis.datetimeStart);
    }

    public async addFuellungByBarcode(barcode: string)
    {
        try
        {
            const flasche = this.data.getFlascheByBarcode(barcode);
            await this.addFuellung(flasche);
        }
        catch (error)
        {
            this.snackBar.open(error.message, null, { duration: 3000 });
        }
    }

    public async addFuellung(flasche: IFlasche)
    {
        const fuellung: IFuellung = {
            datetime: new Date(),
            flasche
        };

        if (this.confirmFuellungActive())
        {
            const dialog = this.dialog.open(ConfirmFuellungComponent, { width: '500px', data: fuellung });
            dialog.afterClosed().subscribe(confirmation =>
            {
                if (confirmation) this.updateFuellungen(fuellungen => [fuellung, ...fuellungen]);
            });
        }
        else
        {
            await this.updateFuellungen(fuellungen => [fuellung, ...fuellungen]);
        }
    }

    public async removeFuellung(fuellung: IFuellung)
    {
        if (!this.ereignis()?.fuellungen.includes(fuellung))
        {
            this.snackBar.open(`Füllung konnte nicht entfernt werden!`, null, { duration: 3000 });
            return;
        }

        await this.updateFuellungen(fuellungen => fuellungen.filter(item => item !== fuellung));
        this.snackBar.open(`Füllung entfernt!`, null, { duration: 3000 });
    }

    public async closeEreignis()
    {
        const ereignis = { ...this.ereignis(), datetimeEnd: new Date() };
        this.ereignis.set(null);
        this.timing.ereignisStart.set(null);
        await this.data.saveEreignis(ereignis);
        this.router.navigate(['/']);
    }

    private async updateFuellungen(update: (fuellungen: Array<IFuellung>) => Array<IFuellung>)
    {
        this.ereignis.update(ereignis => ({ ...ereignis, fuellungen: update(ereignis.fuellungen) }));
        await this.data.saveEreignis(this.ereignis());
    }
}
