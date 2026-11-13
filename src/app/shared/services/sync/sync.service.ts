import { Injectable, inject, signal } from '@angular/core';
import { DataService } from '../data/data.service';
import { NotificationService } from '../notification/notification.service';
import { SettingsService } from '../settings/settings.service';
import { IFeuerwehrRef } from '../../interfaces/i-feuerwehr';
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
            await this.syncFeuerwehr(feuerwehrNummer);
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

        await this.data.loadFeuerwehren();
        const feuerwehren = this.data.feuerwehren();

        for (const feuerwehr of feuerwehren)
        {
            this.progressMessage.set(`Feuerwehr ${feuerwehr.name} (${feuerwehr.feuerwehrNummer})`);
            try
            {
                await this.syncFeuerwehr(feuerwehr.feuerwehrNummer);
            }
            catch (error)
            {
                failed = true;
                this.notification.showError(error);
            }
        }

        // Nur bei Erfolg merken, sonst wird beim nächsten Start erneut synchronisiert
        if (!failed) this.settings.writeSyncLastEdit(lastEdit);

        console.log(`Synchronisierung beendet - ${feuerwehren.length} Feuerwehren in ${Math.round(performance.now() - start)}ms geladen`);
        this.progressActive.set(false);
    }

    private async syncFeuerwehr(feuerwehrNummer: number): Promise<void>
    {
        const feuerwehr = await this.api.getFeuerwehr(feuerwehrNummer);

        if (!feuerwehr)
            throw new Error(`Die Feuerwehr mit der Nummer ${feuerwehrNummer} wurde nicht gefunden!`);

        const { flaschen, ...rest } = feuerwehr;
        const ref: IFeuerwehrRef = {
            feuerwehrNummer: feuerwehr.feuerwehrNummer,
            eigentuemerId: feuerwehr.eigentuemerId,
            name: feuerwehr.name
        };

        await this.data.saveFeuerwehr({
            ...rest,
            flaschen: (flaschen ?? []).map(flasche => ({ ...flasche, feuerwehr: ref }))
        });
    }
}
