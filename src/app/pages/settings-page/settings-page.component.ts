import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IEreignis } from 'src/app/shared/interfaces/i-ereignis';
import { DataService } from 'src/app/shared/services/data/data.service';
import { DatabaseService } from 'src/app/shared/services/database/database.service';
import { SettingsService } from 'src/app/shared/services/settings/settings.service';
import { environment } from 'src/environments/environment';
import { MatButton } from '@angular/material/button';
import { JsonPipe } from '@angular/common';
import { MatCard } from '@angular/material/card';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

@Component({
    selector: 'ffg-settings-page',
    templateUrl: './settings-page.component.html',
    styleUrls: ['./settings-page.component.scss'],
    imports: [MatButton, MatCard, MatSlideToggle, FormsModule, MatFormField, MatInput, JsonPipe]
})
export class SettingsPageComponent implements OnInit, OnDestroy
{
    settings = inject(SettingsService);
    private data = inject(DataService);
    private database = inject(DatabaseService);
    private snackBar = inject(MatSnackBar);

    public readonly showTestmodusSetting = signal(false);
    public readonly exportedData = signal(null);
    public importData = '[]';
    public version = environment.version;

    public async ngOnInit(): Promise<void>
    {
        // Während eines laufenden Ereignisses darf nicht umgeschaltet werden
        this.showTestmodusSetting.set(await this.data.findOpenEreignisId() == null);
    }

    public ngOnDestroy(): void
    {
        // Nicht gespeicherte Änderungen verwerfen
        this.settings.loadAll();
    }

    public async save()
    {
        this.settings.saveAll();
        this.database.refresh();
        await this.data.load();
    }

    public async import()
    {
        const arr = JSON.parse(this.importData);

        for (const ereignis of arr)
        {
            console.log('Importiere Ereignis', ereignis.type, ereignis.ort);
            try
            {
                const newEreignis: IEreignis = {
                    ort: ereignis.ort,
                    type: ereignis.type,
                    datetimeStart: new Date(ereignis.datetimeStart),
                    datetimeEnd: new Date(ereignis.datetimeEnd),
                    fuellungen: ereignis.fuellungen.map(fuellung => ({
                        datetime: new Date(fuellung.datetime),
                        flasche: this.data.getFlascheByBarcode(fuellung.flaschenBarcode)
                    }))
                };
                await this.data.saveEreignis(newEreignis);
            }
            catch (error)
            {
                this.snackBar.open(`Import von ${ereignis.type} ${ereignis.ort ?? ''} fehlgeschlagen: ${error.message}`, null, { duration: 5000 });
            }
        }
    }

    public export()
    {
        this.exportedData.set({
            feuerwehren: this.data.feuerwehren(),
            personen: this.data.personen(),
            ereignisse: this.data.ereignisse()
        });
    }
}
