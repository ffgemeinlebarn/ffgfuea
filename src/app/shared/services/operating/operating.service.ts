import { DOCUMENT, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmFuellungComponent } from '../../dialogs/confirm-fuellung/confirm-fuellung.component';
import { IEreignis } from '../../interfaces/i-ereignis';
import { IFlasche } from '../../interfaces/i-flasche';
import { IFuellung } from '../../interfaces/i-fuellung';
import { DataService } from '../data/data.service';
import { DialogService } from '../dialog/dialog.service';
import { NotificationDuration, NotificationService } from '../notification/notification.service';
import { TimingService } from '../timing/timing.service';

@Injectable({
    providedIn: 'root'
})
export class OperatingService
{
    private data = inject(DataService);
    private timing = inject(TimingService);
    private dialogs = inject(DialogService);
    private router = inject(Router);
    private notification = inject(NotificationService);

    private readonly minBarcodeZeichen = 5;
    private barcodeInputBuffer = '';

    public readonly barcodeInputActive = signal(true);
    public readonly confirmFuellungActive = signal(true);

    /** Das aktuell laufende Ereignis */
    public readonly ereignis = signal<IEreignis | null>(null);

    public readonly ereignisAnzahlFeuerwehren = computed(() =>
        new Set(this.ereignis()?.fuellungen?.map(fuellung => fuellung.flasche?.feuerwehr?.feuerwehrNummer)).size
    );

    // Mängel sind noch nicht umgesetzt
    public readonly ereignisAnzahlMaengel = signal(0);

    public constructor()
    {
        const body = inject(DOCUMENT).body;
        const listener = (event: KeyboardEvent) => this.onScannerInputEnter(event);
        body.addEventListener('keydown', listener);
        inject(DestroyRef).onDestroy(() => body.removeEventListener('keydown', listener));
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
                this.notification.show(`Barcodeeingabe erkannt: ${this.barcodeInputBuffer}`, NotificationDuration.short);

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
            this.notification.showError(error);
        }
    }

    public async addFuellung(flasche: IFlasche)
    {
        const fuellung: IFuellung = {
            datetime: new Date(),
            flasche
        };

        if (this.confirmFuellungActive() && !await this.dialogs.confirm(ConfirmFuellungComponent, fuellung)) return;

        await this.updateFuellungen(fuellungen => [fuellung, ...fuellungen]);
    }

    public async removeFuellung(fuellung: IFuellung)
    {
        if (!this.ereignis()?.fuellungen.includes(fuellung))
        {
            this.notification.show('Füllung konnte nicht entfernt werden!');
            return;
        }

        await this.updateFuellungen(fuellungen => fuellungen.filter(item => item !== fuellung));
        this.notification.show('Füllung entfernt!');
    }

    public async closeEreignis()
    {
        const ereignis = this.ereignis();
        if (!ereignis) return;

        this.ereignis.set(null);
        this.timing.ereignisStart.set(null);
        await this.data.saveEreignis({ ...ereignis, datetimeEnd: new Date() });
        this.router.navigate(['/']);
    }

    private async updateFuellungen(update: (fuellungen: Array<IFuellung>) => Array<IFuellung>)
    {
        const ereignis = this.ereignis();
        if (!ereignis) return;

        const updated = { ...ereignis, fuellungen: update(ereignis.fuellungen) };
        this.ereignis.set(updated);
        await this.data.saveEreignis(updated);
    }
}
