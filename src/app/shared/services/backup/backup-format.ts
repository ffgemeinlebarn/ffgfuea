import { EreignisType } from '../../enums/ereignis-type';
import { IEreignis } from '../../interfaces/i-ereignis';
import { IFeuerwehr } from '../../interfaces/i-feuerwehr';
import { IFlasche } from '../../interfaces/i-flasche';
import { IFuellung } from '../../interfaces/i-fuellung';
import { IPerson } from '../../interfaces/i-person';

export const BACKUP_FORMAT = 'ffgfuea-export';
export const BACKUP_VERSION = 1;
/** Altes Import-Format aus dem README: nur Ereignisse mit Flaschen-Barcodes */
export const LEGACY_VERSION = 0;

export interface IBackup
{
    format: typeof BACKUP_FORMAT;
    version: number;
    appVersion: string | null;
    exportedAt: string | null;
    testMode: boolean;
    feuerwehren: Array<IFeuerwehr>;
    personen: Array<IPerson>;
    ereignisse: Array<IEreignis>;
}

export class BackupError extends Error
{
    constructor(public readonly problems: Array<string>)
    {
        super(problems.join('\n'));
    }
}

/**
 * Erzeugt das JSON stückweise mit einem Datensatz pro Zeile, damit auch Daten aus vielen Jahren
 * nicht in einem einzigen riesigen String landen und die Datei trotzdem lesbar bleibt
 */
export function serializeBackup(backup: IBackup): Blob
{
    const { feuerwehren, personen, ereignisse, ...meta } = backup;
    const parts: Array<string> = ['{\n'];

    for (const [key, value] of Object.entries(meta))
        parts.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},\n`);

    const lists = Object.entries({ feuerwehren, personen, ereignisse });
    lists.forEach(([key, items], i) =>
    {
        parts.push(`  ${JSON.stringify(key)}: [\n`);
        items.forEach((item, j) => parts.push(`    ${JSON.stringify(item)}${j < items.length - 1 ? ',' : ''}\n`));
        parts.push(i < lists.length - 1 ? '  ],\n' : '  ]\n');
    });

    parts.push('}\n');
    return new Blob(parts, { type: 'application/json' });
}

/**
 * Prüft einen eingelesenen Export und wandelt die Zeitpunkte wieder in Date-Objekte um
 */
export function parseBackup(value: unknown): IBackup
{
    if (!isObject(value) || value['format'] !== BACKUP_FORMAT || typeof value['version'] !== 'number')
        throw new BackupError(['Die Datei ist kein FFGFUEA-Export.']);

    if (value['version'] > BACKUP_VERSION)
        throw new BackupError([`Die Datei wurde mit einer neueren Version von FFGFUEA erstellt (Format ${value['version']}) und kann nicht importiert werden.`]);

    const problems: Array<string> = [];
    const list = (key: string): Array<unknown> =>
    {
        if (Array.isArray(value[key])) return value[key];
        problems.push(`"${key}" fehlt oder ist keine Liste.`);
        return [];
    };

    const feuerwehren = list('feuerwehren').map((item, i) => parseFeuerwehr(item, `Feuerwehr ${i + 1}`, problems));
    const personen = list('personen').map((item, i) => parsePerson(item, `Person ${i + 1}`, problems));
    const ereignisse = list('ereignisse').map((item, i) => parseEreignis(item, `Ereignis ${i + 1}`, problems));

    findDuplicates(feuerwehren.map(feuerwehr => feuerwehr?.feuerwehrNummer))
        .forEach(nummer => problems.push(`Die Feuerwehrnummer ${nummer} kommt mehrfach vor.`));
    findDuplicates(personen.map(person => person?.id))
        .forEach(id => problems.push(`Die Personen-Id ${id} kommt mehrfach vor.`));
    findDuplicates(ereignisse.map(ereignis => ereignis?.id))
        .forEach(id => problems.push(`Die Ereignis-Id ${id} kommt mehrfach vor.`));

    if (ereignisse.filter(ereignis => ereignis && ereignis.datetimeEnd == null).length > 1)
        problems.push('Es darf höchstens ein Ereignis nicht abgeschlossen sein.');

    if (problems.length > 0)
        throw new BackupError(problems);

    return {
        format: BACKUP_FORMAT,
        version: value['version'],
        appVersion: typeof value['appVersion'] === 'string' ? value['appVersion'] : null,
        exportedAt: typeof value['exportedAt'] === 'string' ? value['exportedAt'] : null,
        testMode: value['testMode'] === true,
        feuerwehren,
        personen,
        ereignisse
    };
}

function parseFeuerwehr(item: unknown, label: string, problems: Array<string>): IFeuerwehr
{
    if (!isObject(item) || !Number.isFinite(item['feuerwehrNummer']))
    {
        problems.push(`${label}: Feuerwehrnummer fehlt.`);
        return undefined;
    }

    if (item['flaschen'] != null && !Array.isArray(item['flaschen']))
        problems.push(`${label}: "flaschen" ist keine Liste.`);

    return { ...item, flaschen: (item['flaschen'] ?? []) as Array<IFlasche> };
}

function parsePerson(item: unknown, label: string, problems: Array<string>): IPerson
{
    if (!isObject(item) || typeof item['vorname'] !== 'string' || typeof item['nachname'] !== 'string')
    {
        problems.push(`${label}: Vor- oder Nachname fehlt.`);
        return undefined;
    }

    if (item['id'] != null && !Number.isInteger(item['id']))
        problems.push(`${label}: Ungültige Id.`);

    return item as unknown as IPerson;
}

function parseEreignis(item: unknown, label: string, problems: Array<string>): IEreignis
{
    if (!isObject(item))
    {
        problems.push(`${label}: Kein gültiger Datensatz.`);
        return undefined;
    }

    if (item['id'] != null && !Number.isInteger(item['id']))
        problems.push(`${label}: Ungültige Id.`);

    if (!Object.values(EreignisType).includes(item['type'] as EreignisType))
        problems.push(`${label}: Unbekannte Art "${item['type']}".`);

    const datetimeStart = parseDate(item['datetimeStart']);
    if (datetimeStart == null)
        problems.push(`${label}: Ungültiger Beginn.`);

    const datetimeEnd = item['datetimeEnd'] == null ? null : parseDate(item['datetimeEnd']);
    if (item['datetimeEnd'] != null && datetimeEnd == null)
        problems.push(`${label}: Ungültiges Ende.`);

    if (item['personen'] != null && !Array.isArray(item['personen']))
        problems.push(`${label}: "personen" ist keine Liste.`);

    if (item['fuellungen'] != null && !Array.isArray(item['fuellungen']))
        problems.push(`${label}: "fuellungen" ist keine Liste.`);

    const fuellungen = (Array.isArray(item['fuellungen']) ? item['fuellungen'] : [])
        .map((fuellung, i) => parseFuellung(fuellung, `${label}, Füllung ${i + 1}`, problems));

    return {
        ...item,
        type: item['type'] as EreignisType,
        datetimeStart,
        datetimeEnd,
        personen: Array.isArray(item['personen']) ? item['personen'] : [],
        fuellungen
    };
}

function parseFuellung(item: unknown, label: string, problems: Array<string>): IFuellung
{
    const datetime = isObject(item) ? parseDate(item['datetime']) : null;

    if (datetime == null)
        problems.push(`${label}: Ungültiger Zeitpunkt.`);

    if (!isObject(item) || !isObject(item['flasche']))
        problems.push(`${label}: Flasche fehlt.`);

    return isObject(item) ? { ...item, datetime, flasche: item['flasche'] } : undefined;
}

function parseDate(value: unknown): Date | null
{
    if (typeof value !== 'string' && !(value instanceof Date)) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

function isObject(value: unknown): value is Record<string, unknown>
{
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findDuplicates<T>(values: Array<T>): Array<T>
{
    const seen = new Set<T>();
    const duplicates = new Set<T>();
    for (const value of values.filter(value => value != null))
        (seen.has(value) ? duplicates : seen).add(value);
    return [...duplicates];
}
