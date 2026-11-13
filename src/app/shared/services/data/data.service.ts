import { Injectable, computed, inject, signal } from '@angular/core';
import Dexie from 'dexie';
import { IEreignis } from '../../interfaces/i-ereignis';
import { IFeuerwehr, toFeuerwehrRef } from '../../interfaces/i-feuerwehr';
import { IFlasche, IMatFlasche, isManuelleFlasche } from '../../interfaces/i-flasche';
import { IPerson } from '../../interfaces/i-person';
import { assignEreignisNummern, hasEreignisNummer } from '../../models/ereignis-nummer/ereignis-nummer';
import { MIN_BARCODE_LENGTH } from '../barcode-scanner/barcode-scanner.service';
import { DatabaseService } from '../database/database.service';
import { buildStatistics } from './statistics';

export function compareById(a: { id?: number } | null, b: { id?: number } | null): boolean
{
    return a && b ? a.id === b.id : a === b;
}

/** Flaschen sind über Feuerwehr und Barcode eindeutig */
function isSameFlasche(a: IFlasche, b: IFlasche): boolean
{
    return a.barcode === b.barcode && a.feuerwehr.feuerwehrNummer === b.feuerwehr.feuerwehrNummer;
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
        void this.load();
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
        // Gespeicherte Nummern können aus älteren Ständen als Text vorliegen
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
        this.feuerwehren.set(feuerwehren.sort((a, b) => Number(a.feuerwehrNummer) - Number(b.feuerwehrNummer)));
    }

    public async saveFeuerwehr(feuerwehr: IFeuerwehr): Promise<void>
    {
        await this.database.db.feuerwehren.put(feuerwehr);
        await this.loadFeuerwehren();
    }

    public async saveFeuerwehren(feuerwehren: Array<IFeuerwehr>): Promise<void>
    {
        await this.database.db.feuerwehren.bulkPut(feuerwehren);
        await this.loadFeuerwehren();
    }

    public async removeFeuerwehr(feuerwehr: IFeuerwehr): Promise<void>
    {
        await this.database.db.feuerwehren.delete(feuerwehr.feuerwehrNummer);
        await this.loadFeuerwehren();
    }

    /**
     * Prüft den Barcode einer manuellen Flasche und liefert die Fehlermeldung oder null.
     * Der Barcode muss über die Flaschen aller Feuerwehren eindeutig sein, damit der Scanner sie findet.
     * @param original die bearbeitete Flasche, sie zählt nicht als Duplikat
     */
    public validateBarcode(barcode: string | null | undefined, original?: IFlasche): string | null
    {
        const value = (barcode ?? '').trim();

        if (!value)
            return 'Der Barcode ist erforderlich.';

        if (!/^\d+$/.test(value))
            return 'Der Barcode darf nur aus Ziffern bestehen.';

        if (value.length < MIN_BARCODE_LENGTH)
            return `Der Barcode muss mindestens ${MIN_BARCODE_LENGTH} Ziffern haben.`;

        const vorhanden = this.feuerwehren()
            .flatMap(feuerwehr => feuerwehr.flaschen)
            .find(flasche => flasche.barcode === value && !(original && isSameFlasche(flasche, original)));

        if (vorhanden)
            return `Der Barcode ist bereits der Flasche Nr. ${vorhanden.karteiNr ?? '-'} der Feuerwehr ${vorhanden.feuerwehr.name} zugeordnet.`;

        return null;
    }

    /**
     * Legt eine manuelle Flasche an oder ersetzt die bearbeitete manuelle Flasche
     * @param original die bearbeitete Flasche, fehlt beim Anlegen
     */
    public async saveManuelleFlasche(feuerwehrNummer: number, daten: IMatFlasche, original?: IFlasche): Promise<IFlasche>
    {
        if (original && !isManuelleFlasche(original))
            throw new Error('Flaschen aus MAT können nicht bearbeitet werden!');

        // Aktuellen Stand lesen, damit die Eindeutigkeit gegen die gespeicherten Daten geprüft wird
        await this.loadFeuerwehren();
        const feuerwehr = this.findFeuerwehr(feuerwehrNummer);

        const problem = this.validateBarcode(daten.barcode, original);
        if (problem) throw new Error(problem);

        const flasche: IFlasche = {
            ...daten,
            barcode: (daten.barcode ?? '').trim(),
            lastEdit: new Date(),
            quelle: 'manuell',
            feuerwehr: toFeuerwehrRef(feuerwehr)
        };

        let flaschen = [...feuerwehr.flaschen, flasche];
        if (original)
        {
            if (!feuerwehr.flaschen.some(item => isSameFlasche(item, original)))
                throw new Error(`Die Flasche mit dem Barcode ${original.barcode} wurde nicht gefunden!`);

            flaschen = feuerwehr.flaschen.map(item => isSameFlasche(item, original) ? flasche : item);
        }

        await this.saveFeuerwehr({ ...feuerwehr, flaschen });
        return flasche;
    }

    public async removeManuelleFlasche(flasche: IFlasche): Promise<void>
    {
        if (!isManuelleFlasche(flasche))
            throw new Error('Flaschen aus MAT können nicht gelöscht werden!');

        await this.loadFeuerwehren();
        const feuerwehr = this.findFeuerwehr(flasche.feuerwehr.feuerwehrNummer);

        await this.saveFeuerwehr({ ...feuerwehr, flaschen: feuerwehr.flaschen.filter(item => !isSameFlasche(item, flasche)) });
    }

    private findFeuerwehr(feuerwehrNummer: number): IFeuerwehr
    {
        const feuerwehr = this.feuerwehren().find(item => item.feuerwehrNummer === feuerwehrNummer);

        if (!feuerwehr)
            throw new Error(`Die Feuerwehr mit der Nummer ${feuerwehrNummer} wurde nicht gefunden!`);

        return feuerwehr;
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
        if (person.id == null) return;
        await this.database.db.personen.delete(person.id);
        await this.loadPersonen();
    }

    /**
     * Einsätze & Übungen
     */
    public async loadEreignisse(): Promise<void>
    {
        const ereignisse = await this.database.db.ereignisse.toArray();
        this.ereignisse.set(ereignisse.sort((a, b) => b.datetimeStart.getTime() - a.datetimeStart.getTime() || (b.id ?? 0) - (a.id ?? 0)));
    }

    public async getEreignis(id: number): Promise<IEreignis>
    {
        const ereignis = await this.database.db.ereignisse.get(id);
        if (!ereignis) throw new Error(`Das Ereignis mit der Id ${id} wurde nicht gefunden!`);
        return ereignis;
    }

    /**
     * Neue Ereignisse bekommen die nächste freie Ereignisnummer im Jahr ihres Beginns.
     * Die Nummer bleibt danach unverändert, auch wenn der Beginn später geändert wird.
     */
    public async saveEreignis(ereignis: IEreignis): Promise<number>
    {
        ereignis.fuellungen ??= [];
        const db = this.database.db;
        const id = await db.transaction('rw', db.ereignisse, async () =>
        {
            if (!hasEreignisNummer(ereignis))
            {
                const jahr = ereignis.datetimeStart.getFullYear();
                const letztes = await db.ereignisse.where('[jahr+nummer]').between([jahr, Dexie.minKey], [jahr, Dexie.maxKey]).last();
                assignEreignisNummern([ereignis], letztes ? [letztes] : []);
            }
            return db.ereignisse.put(ereignis);
        });
        await this.loadEreignisse();
        return id;
    }

    /** Id des noch nicht abgeschlossenen Ereignisses */
    public async findOpenEreignisId(): Promise<number | null>
    {
        // datetimeEnd ist nicht indiziert, null-Werte könnte IndexedDB ohnehin nicht indizieren
        const offen = await this.database.db.ereignisse.filter(item => item.datetimeEnd == null).first();
        return offen?.id ?? null;
    }
}
