import { Injectable, inject } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { environment } from 'src/environments/environment';
import { IEreignis } from '../../interfaces/i-ereignis';
import { assignEreignisNummern } from '../../models/ereignis-nummer/ereignis-nummer';
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

    private database!: Database;
    private openedInTestMode = false;

    constructor()
    {
        this.refresh();
    }

    /** Die geöffnete Datenbank, wechselt mit refresh() */
    public get db(): Database
    {
        return this.database;
    }

    /** Ob die geöffnete Datenbank die Testdatenbank ist (unabhängig von noch nicht gespeicherten Einstellungen) */
    public get testMode(): boolean
    {
        return this.openedInTestMode;
    }

    /** Öffnet die Datenbank passend zum gespeicherten Testmodus */
    public refresh()
    {
        this.database?.close();
        this.openedInTestMode = this.settings.testMode();
        const name = environment.database.name + (this.openedInTestMode ? '_test' : '');
        this.database = new Database(name);
    }
}

export class Database extends Dexie
{
    public feuerwehren!: Table<IFeuerwehr, number>;
    public maengel!: Table<IMangel, number>;
    public personen!: Table<IPerson, number>;
    public ereignisse!: Table<IEreignis, number>;

    constructor(name: string)
    {
        super(name);
        this.version(1).stores({
            feuerwehren: '&feuerwehrNummer',
            // maengel: '++id, flascheId, datetime, personId, ereignisId, datetimeFixed',
            personen: '++id',
            ereignisse: '++id'
        });
        // Ereignisnummern: bestehende Ereignisse pro Jahr in der Reihenfolge ihres Beginns nummerieren
        this.version(2).stores({
            ereignisse: '++id, &[jahr+nummer]'
        }).upgrade(async transaction =>
        {
            const ereignisse = transaction.table<IEreignis, number>('ereignisse');
            const all = await ereignisse.toArray();
            assignEreignisNummern(all);
            await ereignisse.bulkPut(all);
        });
    }
}
