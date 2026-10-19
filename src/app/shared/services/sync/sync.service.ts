import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IFeuerwehr } from '../../interfaces/i-feuerwehr';
import { DatabaseService } from '../database/database.service';
import { SettingsService } from '../settings/settings.service';
import { StammdatenService } from '../stammdaten/stammdaten.service';

@Injectable({
    providedIn: 'root'
})
export class SyncService
{
    http = inject(HttpClient);
    settings = inject(SettingsService);
    private database = inject(DatabaseService);
    stammdaten = inject(StammdatenService);
    private snackBar = inject(MatSnackBar);

    public progressActive = false;
    public progressMessage = 'Lade Daten aus MAT Datenbank';

    public checkStatus(): Promise<boolean>
    {
        return new Promise((resolve, reject) =>
            this.http.get(`${this.settings.syncUrl}`)
                .subscribe((response: any) =>
                {
                    if (response.lastEdit !== this.settings.syncLastEdit)
                    {
                        this.settings.writeSyncLastEdit(response.lastEdit);
                        resolve(true);
                    }
                    else
                    {
                        resolve(false);
                    }
                }, (error) => reject(error)));

    }

    public addFeuerwehr(feuerwehrNummer: number)
    {
        return this.syncFeuerwehrWithFlaschen(feuerwehrNummer)
            .then(() => this.stammdaten.loadFeuerwehren(), (errorMsg) => this.snackBar.open(errorMsg, null, { duration: 3000 }));
    }

    public async syncSavedFeuerwehren()
    {
        this.stammdaten.loadFeuerwehren().then(() =>
            this.checkStatus().then(
                async (shouldUpdate) =>
                {
                    if (shouldUpdate)
                    {
                        this.progressActive = true;
                        const start = new Date();
                        const startTime = start.getMinutes() * 60000 + start.getSeconds() * 1000 + start.getMilliseconds();

                        console.log('Starte Synchronisierung');

                        for (const feuerwehr of this.stammdaten.feuerwehren)
                        {
                            this.progressMessage = `Feuerwehr ${feuerwehr.name} (${feuerwehr.feuerwehrNummer})`;
                            await this.syncFeuerwehrWithFlaschen(feuerwehr.feuerwehrNummer)
                                .catch(error => this.snackBar.open(error, null, { duration: 3000 }));
                        }

                        this.stammdaten.reload();
                        const end = new Date();
                        const endTime = end.getMinutes() * 60000 + end.getSeconds() * 1000 + end.getMilliseconds();
                        const dauer = endTime - startTime;
                        console.log(`Synchronisierung beendet - ${this.stammdaten.feuerwehren.length} Feuerwehren in ${dauer}ms geladen`);
                        this.progressActive = false;
                    }
                },
                (error) => this.snackBar.open('Synchronisation nicht möglich - Service nicht erreichbar!', null, { duration: 3000 })
            ));
    }

    public async syncFeuerwehrWithFlaschen(feuerwehrNummer: number): Promise<IFeuerwehr>
    {
        return new Promise((resolve, reject) =>
        {
            this.http.get(`${this.settings.syncUrl}/sync/${feuerwehrNummer}`).subscribe((feuerwehr: IFeuerwehr) =>
            {
                if (feuerwehr)
                {
                    this.updateOrCreateFeuerwehr(feuerwehr).then(_ =>
                    {
                        console.log('syncFeuerwehrWithFlaschen - Finish', feuerwehrNummer);
                        resolve(feuerwehr);
                    });
                }
                else
                {
                    reject(`Die Feuerwehr mit der Nummer ${feuerwehrNummer} wurde nicht gefunden!`);
                }
            });
        });
    }

    public async updateOrCreateFeuerwehr(feuerwehr: IFeuerwehr)
    {
        feuerwehr.flaschen.map((flasche) => flasche.feuerwehr = {
            feuerwehrNummer: feuerwehr.feuerwehrNummer,
            eigentuemerId: feuerwehr.eigentuemerId,
            name: feuerwehr.name
        });

        return this.database.db.transaction('rw', this.database.db.feuerwehren, async () =>
        {
            await this.database.db.feuerwehren.put(feuerwehr);
        });
    }
}
