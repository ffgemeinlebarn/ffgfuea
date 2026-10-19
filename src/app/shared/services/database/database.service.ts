import { Injectable, inject } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { environment } from 'src/environments/environment';
import { IEreignis } from '../../interfaces/i-ereignis';
import { IFeuerwehr } from '../../interfaces/i-feuerwehr';
import { IMangel } from '../../interfaces/i-mangel';
import { IPerson } from '../../interfaces/i-person';
import { SettingsService } from '../settings/settings.service';

@Injectable({
    providedIn: 'root'
})
export class DatabaseService
{
    private settings = inject(SettingsService);

    public db: Database = null;

    constructor()
    {
        this.refresh();
    }

    public refresh()
    {
        this.db?.close();
        const name = environment.database.name + (this.settings.testMode() ? '_test' : '');
        this.db = new Database(name);
    }
}

class Database extends Dexie
{
    public feuerwehren: Table<IFeuerwehr, number>;
    public maengel: Table<IMangel, number>;
    public personen: Table<IPerson, number>;
    public ereignisse: Table<IEreignis, number>;

    constructor(name: string)
    {
        super(name);
        this.version(1).stores({
            feuerwehren: '&feuerwehrNummer',
            // maengel: '++id, flascheId, datetime, personId, ereignisId, datetimeFixed',
            personen: '++id',
            ereignisse: '++id'
        });
    }
}
