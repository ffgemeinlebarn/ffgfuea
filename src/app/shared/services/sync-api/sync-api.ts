import { IFeuerwehrRef } from '../../interfaces/i-feuerwehr';
import { IMatFlasche } from '../../interfaces/i-flasche';

/** Feuerwehr, wie sie der MAT Sync-Service liefert */
export interface IMatFeuerwehr extends IFeuerwehrRef
{
    flaschen: Array<IMatFlasche>;
}

/**
 * Zugriff auf den lokalen MAT Sync-Service
 */
export abstract class SyncApi
{
    /** Stand des MAT Datensatzes */
    public abstract getLastEdit(): Promise<string>;

    public abstract getFeuerwehr(feuerwehrNummer: number): Promise<IMatFeuerwehr | null>;
}
