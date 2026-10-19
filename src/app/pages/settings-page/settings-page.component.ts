import { Component, OnDestroy, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { IEreignis } from 'src/app/shared/interfaces/i-ereignis';
import { IFuellung } from 'src/app/shared/interfaces/i-fuellung';
import { DatabaseService } from 'src/app/shared/services/database/database.service';
import { EreignisseService } from 'src/app/shared/services/ereignisse/ereignisse.service';
import { OperatingService } from 'src/app/shared/services/operating/operating.service';
import { SettingsService } from 'src/app/shared/services/settings/settings.service';
import { StammdatenService } from 'src/app/shared/services/stammdaten/stammdaten.service';
import { environment } from 'src/environments/environment.development';
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
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButton, MatCard, MatSlideToggle, FormsModule, MatFormField, MatInput, JsonPipe]
})
export class SettingsPageComponent implements OnInit, OnDestroy
{
    settings = inject(SettingsService);
    dialog = inject(MatDialog);
    ereignisse = inject(EreignisseService);
    operating = inject(OperatingService);
    private database = inject(DatabaseService);
    stammdaten = inject(StammdatenService);

    public showTestmodusSetting = true;
    public importData = '[]';
    public exportedData = null;
    public version = environment.version;

    public async ngOnInit(): Promise<void>
    {
        this.showTestmodusSetting = await this.operating.checkIfOpenEreignisExist() === false;
    }

    public async ngOnDestroy(): Promise<void>
    {
        this.settings.loadAll();
    }

    public async save()
    {
        this.settings.saveAll();
        await this.database.refresh();
        await this.stammdaten.reload();
        await this.ereignisse.loadList();
    }

    public async import()
    {
        const arr = JSON.parse(this.importData);

        arr.forEach(async (ereignis) =>
        {
            console.log('Importiere Ereignis', ereignis.type, ereignis.ort);

            const newEreignis: IEreignis = {
                ort: ereignis.ort,
                type: ereignis.type,
                datetimeStart: new Date(ereignis.datetimeStart),
                datetimeEnd: new Date(ereignis.datetimeEnd)
            };

            newEreignis.id = await this.ereignisse.saveOrCreate(newEreignis);

            ereignis.fuellungen.forEach((fuellung) =>
            {
                const flasche = this.stammdaten.getFlascheByBarcode(fuellung.flaschenBarcode);
                const newFuellung: IFuellung = {
                    datetime: new Date(fuellung.datetime),
                    flasche
                };

                newEreignis.fuellungen.push(newFuellung);
            });

            await this.ereignisse.saveOrCreate(newEreignis);

        });
    }

    public async export()
    {
        const feuerwehren = await this.stammdaten.feuerwehren;
        const personen = await this.stammdaten.personen;
        const ereignisse = await this.ereignisse.getAll();

        this.exportedData = {
            feuerwehren,
            personen,
            ereignisse
        };
    }
}
