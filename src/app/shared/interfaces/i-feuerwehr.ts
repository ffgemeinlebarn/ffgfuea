import { IFlasche } from './i-flasche';

/** Kopie der Feuerwehr an jeder Flasche, damit Füllungen auch ohne Stammdaten lesbar bleiben */
export interface IFeuerwehrRef
{
    feuerwehrNummer: number;
    eigentuemerId: number;
    name: string;
}

export interface IFeuerwehr extends IFeuerwehrRef
{
    flaschen: Array<IFlasche>;
}

export function toFeuerwehrRef(feuerwehr: IFeuerwehrRef): IFeuerwehrRef
{
    return {
        feuerwehrNummer: feuerwehr.feuerwehrNummer,
        eigentuemerId: feuerwehr.eigentuemerId,
        name: feuerwehr.name
    };
}
