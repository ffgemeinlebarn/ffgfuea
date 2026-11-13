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
