import { IFeuerwehrRef } from './i-feuerwehr';

/** Flasche, wie sie der MAT Sync-Service liefert */
export interface IMatFlasche
{
    geraeteNr?: number;
    karteiNr?: number;
    flaschennummer?: string;
    baujahr?: number;
    pruefdatum?: Date | string;
    pruefer?: string;
    barcode?: string;
    typenBezeichnung?: string;
    typenInfo1?: string;
    typenInfo2?: string;
    typenInfo3?: string;
    lastEdit?: Date | string;
}

export interface IFlasche extends IMatFlasche
{
    feuerwehr: IFeuerwehrRef;
}
