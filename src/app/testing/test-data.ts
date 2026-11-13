import { EreignisType } from '../shared/enums/ereignis-type';
import { IEreignis } from '../shared/interfaces/i-ereignis';
import { IFeuerwehr } from '../shared/interfaces/i-feuerwehr';
import { IFlasche } from '../shared/interfaces/i-flasche';
import { IFuellung } from '../shared/interfaces/i-fuellung';

/**
 * Flaschen aus barcodes haben (wie vor Einführung manueller Flaschen gespeicherte) keine quelle,
 * Flaschen aus manuelleBarcodes sind manuell erfasst
 */
export function createFeuerwehr(feuerwehrNummer: number, barcodes: Array<string> = [], manuelleBarcodes: Array<string> = []): IFeuerwehr
{
    const name = `FF ${feuerwehrNummer}`;
    const feuerwehr = { feuerwehrNummer, eigentuemerId: feuerwehrNummer, name };
    return {
        ...feuerwehr,
        flaschen: [
            ...barcodes.map((barcode, i) => ({ karteiNr: i + 1, barcode, typenBezeichnung: 'Typ', feuerwehr })),
            ...manuelleBarcodes.map((barcode, i) => ({ karteiNr: 100 + i, barcode, typenBezeichnung: 'Manuell', quelle: 'manuell' as const, feuerwehr }))
        ]
    };
}

export function createFuellung(flasche: IFlasche, datetime = new Date()): IFuellung
{
    return { datetime, flasche };
}

export function createEreignis(overrides: Partial<IEreignis> = {}): IEreignis
{
    return {
        type: EreignisType.Uebung,
        datetimeStart: new Date(2026, 4, 1, 10, 0),
        datetimeEnd: null,
        ort: 'Gemeinlebarn',
        personen: [],
        fuellungen: [],
        ...overrides
    };
}
