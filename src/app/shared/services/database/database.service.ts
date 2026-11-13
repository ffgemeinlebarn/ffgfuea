import { Injectable, inject } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { environment } from 'src/environments/environment';
import { IEreignis } from '../../interfaces/i-ereignis';
import { assignEreignisNummern } from '../../models/ereignis-nummer/ereignis-nummer';
import { IFeuerwehr, toFeuerwehrRef } from '../../interfaces/i-feuerwehr';
import { IFlasche } from '../../interfaces/i-flasche';
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
        // v1.2.0 hat beim Drucken die Füllungen an die Feuerwehr der Flaschen gehängt und diese Zirkelbezüge
        // mitgespeichert (Füllung → Flasche → Feuerwehr → Füllungen). Der Export als JSON scheitert daran.
        this.version(3).stores({}).upgrade(async transaction =>
        {
            await transaction.table<IEreignis, number>('ereignisse').toCollection().modify(ereignis =>
            {
                (ereignis.fuellungen ?? []).forEach(fuellung => bereinigeFeuerwehrRef(fuellung.flasche));
            });
            await transaction.table<IFeuerwehr, number>('feuerwehren').toCollection().modify(feuerwehr =>
            {
                (feuerwehr.flaschen ?? []).forEach(bereinigeFeuerwehrRef);
            });
        });
    }
}

/** Reduziert die Feuerwehr an einer Flasche auf die Referenzfelder */
function bereinigeFeuerwehrRef(flasche: IFlasche | undefined)
{
    if (flasche?.feuerwehr != null)
        flasche.feuerwehr = toFeuerwehrRef(flasche.feuerwehr);
}
