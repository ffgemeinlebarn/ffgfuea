import { Injectable, inject, signal } from '@angular/core';
import { DataService } from '../data/data.service';
import { NotificationDuration, NotificationService } from '../notification/notification.service';
import { SettingsService } from '../settings/settings.service';
import { IFeuerwehr, toFeuerwehrRef } from '../../interfaces/i-feuerwehr';
import { IFlasche, isManuelleFlasche } from '../../interfaces/i-flasche';
import { SyncApi } from '../sync-api/sync-api';

@Injectable({
    providedIn: 'root'
})
export class SyncService
{
    private api = inject(SyncApi);
    private data = inject(DataService);
    private settings = inject(SettingsService);
    private notification = inject(NotificationService);

    public readonly progressActive = signal(false);
    public readonly progressMessage = signal('Lade Daten aus MAT Datenbank');

    public async addFeuerwehr(feuerwehrNummer: number): Promise<void>
    {
        try
        {
            this.notifyVerdraengt(await this.syncFeuerwehr(feuerwehrNummer));
        }
        catch (error)
        {
            this.notification.showError(error);
        }
    }

    /**
     * Aktualisiert alle gespeicherten Feuerwehren, wenn sich der MAT Datensatz geändert hat
     */
    public async syncSavedFeuerwehren(): Promise<void>
    {
        let lastEdit: string;
        try
        {
            lastEdit = await this.api.getLastEdit();
        }
        catch
        {
            this.notification.show('Synchronisation nicht möglich - Service nicht erreichbar!');
            return;
        }

        if (lastEdit === this.settings.syncLastEdit()) return;

        this.progressActive.set(true);
        const start = performance.now();
        let failed = false;
        const verdraengt: Array<IFlasche> = [];

        await this.data.loadFeuerwehren();
        const feuerwehren = this.data.feuerwehren();

        for (const feuerwehr of feuerwehren)
        {
            this.progressMessage.set(`Feuerwehr ${feuerwehr.name} (${feuerwehr.feuerwehrNummer})`);
            try
            {
                verdraengt.push(...await this.syncFeuerwehr(feuerwehr.feuerwehrNummer));
            }
            catch (error)
            {
                failed = true;
                this.notification.showError(error);
            }
        }

        this.notifyVerdraengt(verdraengt);

        // Nur bei Erfolg merken, sonst wird beim nächsten Start erneut synchronisiert
        if (!failed) this.settings.writeSyncLastEdit(lastEdit);

        console.log(`Synchronisierung beendet - ${feuerwehren.length} Feuerwehren in ${Math.round(performance.now() - start)}ms geladen`);
        this.progressActive.set(false);
    }

    /**
     * Übernimmt die Feuerwehr samt Flaschen aus MAT und behält die manuell erfassten Flaschen.
     *
     * Konfliktregel: Liefert MAT eine Flasche mit dem Barcode einer manuellen Flasche (egal bei welcher Feuerwehr),
     * gewinnt MAT - die manuelle Flasche wird entfernt, damit der Barcode eindeutig bleibt.
     * @returns die durch MAT verdrängten manuellen Flaschen
     */
    private async syncFeuerwehr(feuerwehrNummer: number): Promise<Array<IFlasche>>
    {
        const feuerwehr = await this.api.getFeuerwehr(feuerwehrNummer);

        if (!feuerwehr)
            throw new Error(`Die Feuerwehr mit der Nummer ${feuerwehrNummer} wurde nicht gefunden!`);

        const { flaschen, ...rest } = feuerwehr;
        const ref = toFeuerwehrRef(feuerwehr);
        const matFlaschen: Array<IFlasche> = (flaschen ?? []).map(flasche => ({ ...flasche, quelle: 'mat', feuerwehr: ref }));
        const matBarcodes = new Set<string | undefined>(matFlaschen.map(flasche => flasche.barcode).filter(barcode => barcode != null));
        const verdraengt: Array<IFlasche> = [];

        // Manuelle Flaschen, deren Barcode MAT jetzt liefert, entfernen
        const ohneKonflikte = (gespeichert: IFeuerwehr) => gespeichert.flaschen.filter(flasche =>
        {
            const konflikt = isManuelleFlasche(flasche) && matBarcodes.has(flasche.barcode);
            if (konflikt) verdraengt.push(flasche);
            return !konflikt;
        });

        await this.data.loadFeuerwehren();
        const changed: Array<IFeuerwehr> = [];

        for (const gespeichert of this.data.feuerwehren())
        {
            if (gespeichert.feuerwehrNummer === ref.feuerwehrNummer) continue;
            const anzahl = verdraengt.length;
            const behalten = ohneKonflikte(gespeichert);
            if (verdraengt.length > anzahl) changed.push({ ...gespeichert, flaschen: behalten });
        }

        const bisher = this.data.feuerwehren().find(item => item.feuerwehrNummer === ref.feuerwehrNummer);
        const manuelle = (bisher ? ohneKonflikte(bisher) : [])
            .filter(isManuelleFlasche)
            .map(flasche => ({ ...flasche, feuerwehr: ref }));

        changed.push({ ...rest, flaschen: [...matFlaschen, ...manuelle] });
        await this.data.saveFeuerwehren(changed);

        return verdraengt;
    }

    private notifyVerdraengt(verdraengt: Array<IFlasche>): void
    {
        if (verdraengt.length === 0) return;

        const barcodes = verdraengt.map(flasche => flasche.barcode).join(', ');
        this.notification.show(
            verdraengt.length === 1
                ? `Die manuelle Flasche mit dem Barcode ${barcodes} wurde durch die Flasche aus MAT ersetzt.`
                : `${verdraengt.length} manuelle Flaschen wurden durch Flaschen aus MAT ersetzt (Barcodes: ${barcodes}).`,
            NotificationDuration.long
        );
    }
}
