import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmFuellungComponent } from '../../dialogs/confirm-fuellung/confirm-fuellung.component';
import { IEreignis } from '../../interfaces/i-ereignis';
import { IFlasche } from '../../interfaces/i-flasche';
import { IFuellung } from '../../interfaces/i-fuellung';
import { BarcodeScannerService } from '../barcode-scanner/barcode-scanner.service';
import { DataService } from '../data/data.service';
import { DialogService } from '../dialog/dialog.service';
import { NotificationDuration, NotificationService } from '../notification/notification.service';
import { TimingService } from '../timing/timing.service';

/**
 * Das laufende Ereignis und das Erfassen seiner Füllungen
 */
@Injectable({
    providedIn: 'root'
})
export class OperatingService
{
    private data = inject(DataService);
    private timing = inject(TimingService);
    private scanner = inject(BarcodeScannerService);
    private dialogs = inject(DialogService);
    private notification = inject(NotificationService);

    public readonly confirmFuellungActive = signal(true);

    /** Das aktuell laufende Ereignis */
    public readonly ereignis = signal<IEreignis | null>(null);

    public readonly ereignisAnzahlFeuerwehren = computed(() =>
        new Set(this.ereignis()?.fuellungen.map(fuellung => fuellung.flasche?.feuerwehr?.feuerwehrNummer)).size
    );

    // Mängel sind noch nicht umgesetzt
    public readonly ereignisAnzahlMaengel = signal(0);

    public constructor()
    {
        // Gescannt wird auf allen Seiten, solange ein Ereignis läuft
        this.scanner.barcodes
            .pipe(takeUntilDestroyed())
            .subscribe(barcode => this.onBarcodeScanned(barcode));
    }

    private onBarcodeScanned(barcode: string)
    {
        if (!this.ereignis()) return;

        this.notification.show(`Barcodeeingabe erkannt: ${barcode}`, NotificationDuration.short);
        this.addFuellungByBarcode(barcode);
    }

    public async tryStartOpenEreignis(): Promise<boolean>
    {
        const id = await this.data.findOpenEreignisId();
        if (id == null) return false;

        await this.load(id);
        return true;
    }

    /** Lädt das laufende Ereignis neu, z. B. nachdem es bearbeitet wurde */
    public async reload(): Promise<void>
    {
        const id = this.ereignis()?.id;
        if (id != null) await this.load(id);
    }

    private async load(id: number): Promise<void>
    {
        this.scanner.active.set(true);
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

    /** Schließt das laufende Ereignis ab und liefert es abgeschlossen zurück */
    public async closeEreignis(): Promise<IEreignis | null>
    {
        const ereignis = this.ereignis();
        if (!ereignis) return null;

        const closed = { ...ereignis, datetimeEnd: new Date() };
        this.ereignis.set(null);
        this.timing.ereignisStart.set(null);
        await this.data.saveEreignis(closed);
        return closed;
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
