import { Injectable, computed, inject, signal } from '@angular/core';
import { IEreignis } from '../../interfaces/i-ereignis';
import { IFeuerwehr } from '../../interfaces/i-feuerwehr';
import { IFlasche } from '../../interfaces/i-flasche';
import { IPerson } from '../../interfaces/i-person';
import { DatabaseService } from '../database/database.service';
import { buildStatistics } from './statistics';

export function compareById(a: { id?: number }, b: { id?: number }): boolean
{
    return a && b ? a.id === b.id : a === b;
}

@Injectable({
    providedIn: 'root'
})
export class DataService
{
    private database = inject(DatabaseService);

    public readonly feuerwehren = signal<Array<IFeuerwehr>>([]);
    public readonly personen = signal<Array<IPerson>>([]);
    /** Neueste Ereignisse zuerst */
    public readonly ereignisse = signal<Array<IEreignis>>([]);
    public readonly statistics = computed(() => buildStatistics(this.ereignisse()));

    constructor()
    {
        this.load();
    }

    public async load(): Promise<void>
    {
        await Promise.all([
            this.loadFeuerwehren(),
            this.loadPersonen(),
            this.loadEreignisse()
        ]);
    }

    /**
     * Feuerwehren & Flaschen
     */
    public async loadFeuerwehren(): Promise<void>
    {
        const feuerwehren = await this.database.db.feuerwehren.toArray();
        this.feuerwehren.set(feuerwehren.sort((a, b) => Number(a.feuerwehrNummer) - Number(b.feuerwehrNummer)));
    }

    public async saveFeuerwehr(feuerwehr: IFeuerwehr): Promise<void>
    {
        await this.database.db.feuerwehren.put(feuerwehr);
        await this.loadFeuerwehren();
    }

    public async removeFeuerwehr(feuerwehr: IFeuerwehr): Promise<void>
    {
        await this.database.db.feuerwehren.delete(feuerwehr.feuerwehrNummer);
        await this.loadFeuerwehren();
    }

    public getFlascheByBarcode(barcode: string): IFlasche
    {
        const result = this.feuerwehren().flatMap(feuerwehr => feuerwehr.flaschen.filter(flasche => flasche.barcode === barcode));

        if (result.length === 0)
            throw new Error(`Keine Flasche für den Barcode ${barcode} gefunden!`);

        if (result.length > 1)
            throw new Error(`Der Barcode ${barcode} ist nicht eindeutig. Es wurden ${result.length} Flaschen gefunden!`);

        return result[0];
    }

    /**
     * Füllpersonal
     */
    public async loadPersonen(): Promise<void>
    {
        const personen = await this.database.db.personen.toArray();
        this.personen.set(personen.sort((a, b) => a.nachname.localeCompare(b.nachname) || a.vorname.localeCompare(b.vorname)));
    }

    public async savePerson(person: IPerson): Promise<number>
    {
        const id = await this.database.db.personen.put(person);
        await this.loadPersonen();
        return id;
    }

    public async removePerson(person: IPerson): Promise<void>
    {
        await this.database.db.personen.delete(person.id);
        await this.loadPersonen();
    }

    /**
     * Einsätze & Übungen
     */
    public async loadEreignisse(): Promise<void>
    {
        const ereignisse = await this.database.db.ereignisse.toArray();
        this.ereignisse.set(ereignisse.sort((a, b) => b.datetimeStart.getTime() - a.datetimeStart.getTime() || b.id - a.id));
    }

    public getEreignis(id: number): Promise<IEreignis>
    {
        return this.database.db.ereignisse.get(id);
    }

    public async saveEreignis(ereignis: IEreignis): Promise<number>
    {
        if (ereignis.fuellungen == null) ereignis.fuellungen = [];
        const id = await this.database.db.ereignisse.put(ereignis);
        await this.loadEreignisse();
        return id;
    }

    /** Id des noch nicht abgeschlossenen Ereignisses */
    public async findOpenEreignisId(): Promise<number | null>
    {
        const ereignisse = await this.database.db.ereignisse.toArray();
        return ereignisse.find(item => item.datetimeEnd == null)?.id ?? null;
    }
}
