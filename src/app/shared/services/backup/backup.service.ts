import { formatDate } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { environment } from 'src/environments/environment';
import { IEreignis } from '../../interfaces/i-ereignis';
import { IPerson } from '../../interfaces/i-person';
import { DataService } from '../data/data.service';
import { DatabaseService } from '../database/database.service';
import { SettingsService } from '../settings/settings.service';
import { BACKUP_FORMAT, BACKUP_VERSION, BackupError, IBackup, LEGACY_VERSION, parseBackup } from './backup-format';

const TABLES = ['feuerwehren', 'personen', 'ereignisse'];

/**
 * merge: nur Feuerwehren, Personen und Ereignisse hinzufügen, die es noch nicht gibt
 * replace: alle vorhandenen Daten löschen und den Export wiederherstellen
 */
export type ImportMode = 'merge' | 'replace';

/** Anzahl der hinzugefügten Datensätze */
export interface IImportResult
{
    feuerwehren: number;
    personen: number;
    ereignisse: number;
    skipped: number;
}

@Injectable({
    providedIn: 'root'
})
export class BackupService
{
    private database = inject(DatabaseService);
    private data = inject(DataService);
    private settings = inject(SettingsService);

    public async createBackup(): Promise<IBackup>
    {
        const db = this.database.db;
        const [feuerwehren, personen, ereignisse] = await db.transaction('r', TABLES, () =>
            Promise.all([db.feuerwehren.toArray(), db.personen.toArray(), db.ereignisse.toArray()])
        );

        return {
            format: BACKUP_FORMAT,
            version: BACKUP_VERSION,
            appVersion: environment.version,
            exportedAt: new Date().toISOString(),
            testMode: this.database.testMode,
            feuerwehren,
            personen,
            ereignisse
        };
    }

    public fileName(backup: IBackup): string
    {
        const timestamp = formatDate(backup.exportedAt, 'yyyy-MM-dd_HH-mm', 'en-US');
        return `ffgfuea-export${backup.testMode ? '-test' : ''}_${timestamp}.json`;
    }

    /**
     * Liest einen Export ein. Das alte Import-Format (Liste von Ereignissen mit Flaschen-Barcodes)
     * wird über die Flaschen der gespeicherten Feuerwehren aufgelöst.
     */
    public read(text: string): IBackup
    {
        let value: unknown;
        try
        {
            value = JSON.parse(text);
        }
        catch
        {
            throw new BackupError(['Die Datei enthält kein gültiges JSON.']);
        }

        return parseBackup(Array.isArray(value) ? this.fromLegacy(value) : value);
    }

    public async import(backup: IBackup, mode: ImportMode): Promise<IImportResult>
    {
        if (await this.data.findOpenEreignisId() != null)
            throw new Error('Während eines laufenden Ereignisses ist kein Import möglich!');

        // Das alte Format enthält keine Stammdaten, Ersetzen würde sie löschen
        if (mode === 'replace' && backup.version === LEGACY_VERSION)
            throw new Error('Dateien im alten Import-Format können nur zusammengeführt werden!');

        const db = this.database.db;
        const result = await db.transaction('rw', TABLES, () =>
            mode === 'replace' ? this.replace(backup) : this.merge(backup)
        );

        // Gesicherte Flaschendaten können veraltet sein, beim nächsten Start neu mit MAT synchronisieren
        if (result.feuerwehren > 0) this.settings.writeSyncLastEdit('');

        await this.data.load();
        return result;
    }

    private async replace(backup: IBackup): Promise<IImportResult>
    {
        const db = this.database.db;
        await Promise.all([db.feuerwehren.clear(), db.personen.clear(), db.ereignisse.clear()]);
        await db.feuerwehren.bulkAdd(backup.feuerwehren);
        await db.personen.bulkAdd(backup.personen);
        await db.ereignisse.bulkAdd(backup.ereignisse);

        return {
            feuerwehren: backup.feuerwehren.length,
            personen: backup.personen.length,
            ereignisse: backup.ereignisse.length,
            skipped: 0
        };
    }

    private async merge(backup: IBackup): Promise<IImportResult>
    {
        const db = this.database.db;

        // Feuerwehren: vorhandene behalten, sie stammen meist aus einem neueren MAT-Stand
        const feuerwehrNummern = new Set(await db.feuerwehren.toCollection().primaryKeys());
        const feuerwehren = backup.feuerwehren.filter(feuerwehr => !feuerwehrNummern.has(feuerwehr.feuerwehrNummer));
        await db.feuerwehren.bulkAdd(feuerwehren);

        // Personen: über den Namen zuordnen, neue bekommen eine neue Id
        const personen = new Map((await db.personen.toArray()).map(person => [personKey(person), person]));
        const newPersonen: Array<IPerson> = [];
        for (const { id, ...person } of backup.personen)
        {
            if (personen.has(personKey(person))) continue;
            personen.set(personKey(person), person);
            newPersonen.push(person);
        }
        const personIds = await db.personen.bulkAdd(newPersonen, { allKeys: true });
        newPersonen.forEach((person, i) => person.id = personIds[i]);

        // Ereignisse: gleiche Art mit gleichem Beginn gilt als bereits vorhanden
        const ereignisKeys = new Set((await db.ereignisse.toArray()).map(ereignisKey));
        const ereignisse: Array<IEreignis> = [];
        for (const { id, ...ereignis } of backup.ereignisse)
        {
            if (ereignisKeys.has(ereignisKey(ereignis))) continue;
            ereignisKeys.add(ereignisKey(ereignis));
            ereignisse.push({ ...ereignis, personen: ereignis.personen?.map(person => personen.get(personKey(person)) ?? person) });
        }
        await db.ereignisse.bulkAdd(ereignisse);

        const total = backup.feuerwehren.length + backup.personen.length + backup.ereignisse.length;
        return {
            feuerwehren: feuerwehren.length,
            personen: newPersonen.length,
            ereignisse: ereignisse.length,
            skipped: total - feuerwehren.length - newPersonen.length - ereignisse.length
        };
    }

    private fromLegacy(items: Array<unknown>): unknown
    {
        const problems: Array<string> = [];
        const ereignisse = items.map((item, i) => ({
            ...(item as object),
            fuellungen: Array.isArray(item?.['fuellungen'])
                ? item['fuellungen'].map((fuellung, j) =>
                {
                    try
                    {
                        return { datetime: fuellung?.datetime, flasche: this.data.getFlascheByBarcode(String(fuellung?.flaschenBarcode)) };
                    }
                    catch (error)
                    {
                        problems.push(`Ereignis ${i + 1}, Füllung ${j + 1}: ${error.message}`);
                        return null;
                    }
                })
                : item?.['fuellungen']
        }));

        if (problems.length > 0)
            throw new BackupError(problems);

        return {
            format: BACKUP_FORMAT,
            version: LEGACY_VERSION,
            feuerwehren: [],
            personen: [],
            ereignisse
        };
    }
}

function personKey(person: IPerson): string
{
    return `${person?.vorname ?? ''} ${person?.nachname ?? ''}`.trim().toLowerCase();
}

function ereignisKey(ereignis: IEreignis): string
{
    return `${ereignis.type} ${ereignis.datetimeStart.getTime()}`;
}
