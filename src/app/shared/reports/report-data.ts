import { EreignisType } from '../enums/ereignis-type';
import { IEreignis } from '../interfaces/i-ereignis';
import { IFeuerwehrRef } from '../interfaces/i-feuerwehr';
import { IFlasche } from '../interfaces/i-flasche';
import { IFuellung } from '../interfaces/i-fuellung';
import { IPerson } from '../interfaces/i-person';

/** Überschrift aller Berichte */
export const BERICHT_KOPF = 'Füllbericht';
export const BERICHT_KOPF_ZUSATZ = 'der Atemluftfüllstelle Gemeinlebarn';

export const GESAMTBERICHT_TITEL = 'Gesamtbericht';

export function feuerwehrberichtTitel(feuerwehrName: string): string
{
    return `Bericht für die Feuerwehr ${feuerwehrName}`;
}

/** Füllungen einer Feuerwehr innerhalb eines Ereignisses */
export interface IFeuerwehrFuellungen
{
    feuerwehr: IFeuerwehrRef;
    fuellungen: Array<IFuellung>;
}

/**
 * Gruppiert die Füllungen nach Feuerwehr, sortiert nach dem Namen der Feuerwehr
 * und innerhalb einer Feuerwehr nach dem Zeitpunkt. Die Füllungen selbst bleiben unverändert.
 */
export function groupFuellungenByFeuerwehr(fuellungen: Array<IFuellung>): Array<IFeuerwehrFuellungen>
{
    const gruppen = new Map<number, IFeuerwehrFuellungen>();

    for (const fuellung of fuellungen)
    {
        const feuerwehr = fuellung.flasche.feuerwehr;
        let gruppe = gruppen.get(feuerwehr.feuerwehrNummer);
        if (!gruppe)
        {
            gruppe = { feuerwehr, fuellungen: [] };
            gruppen.set(feuerwehr.feuerwehrNummer, gruppe);
        }
        gruppe.fuellungen.push(fuellung);
    }

    const result = [...gruppen.values()];
    result.forEach(gruppe => gruppe.fuellungen.sort((a, b) => zeitpunkt(a) - zeitpunkt(b)));
    return result.sort((a, b) => a.feuerwehr.name.localeCompare(b.feuerwehr.name, 'de', { numeric: true }));
}

function zeitpunkt(fuellung: IFuellung): number
{
    return new Date(fuellung.datetime).getTime();
}

/** "Übung" oder "Einsatz" */
export function ereignisTyp(ereignis: IEreignis): string
{
    return ereignis.type === EreignisType.Uebung ? 'Übung' : 'Einsatz';
}

/** z.B. "Übung in Gemeinlebarn" */
export function ereignisBezeichnung(ereignis: IEreignis): string
{
    return ereignisTyp(ereignis) + (ereignis.ort ? ` in ${ereignis.ort}` : '');
}

/** Typenbezeichnung samt Zusatzinfos, ohne leere Teile, z.B. "Dräger (300 bar 6 l)" */
export function flaschenTyp(flasche: IFlasche): string
{
    const infos = [flasche.typenInfo1, flasche.typenInfo2, flasche.typenInfo3].filter(info => !!info?.trim());
    return [flasche.typenBezeichnung, infos.length ? `(${infos.join(' ')})` : '']
        .filter(teil => !!teil)
        .join(' ');
}

/** z.B. "Max Muster, Erika Muster" */
export function personenNamen(personen: Array<IPerson>): string
{
    return personen.map(person => `${person.vorname} ${person.nachname}`).join(', ');
}

/** "1 Füllung" oder z.B. "3 Füllungen" */
export function anzahlFuellungen(anzahl: number): string
{
    return `${anzahl} ${anzahl === 1 ? 'Füllung' : 'Füllungen'}`;
}
