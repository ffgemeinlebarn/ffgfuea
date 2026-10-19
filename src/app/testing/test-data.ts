import { EreignisType } from '../shared/enums/ereignis-type';
import { IEreignis } from '../shared/interfaces/i-ereignis';
import { IFeuerwehr } from '../shared/interfaces/i-feuerwehr';
import { IFlasche } from '../shared/interfaces/i-flasche';
import { IFuellung } from '../shared/interfaces/i-fuellung';

export function createFeuerwehr(feuerwehrNummer: number, barcodes: Array<string> = []): IFeuerwehr
{
    const name = `FF ${feuerwehrNummer}`;
    return {
        feuerwehrNummer,
        eigentuemerId: feuerwehrNummer,
        name,
        flaschen: barcodes.map((barcode, i) => ({
            karteiNr: i + 1,
            barcode,
            typenBezeichnung: 'Typ',
            feuerwehr: { feuerwehrNummer, eigentuemerId: feuerwehrNummer, name }
        }))
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
