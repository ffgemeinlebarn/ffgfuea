import { IFeuerwehr } from '../../interfaces/i-feuerwehr';

/**
 * Zugriff auf den lokalen MAT Sync-Service
 */
export abstract class SyncApi
{
    /** Stand des MAT Datensatzes */
    public abstract getLastEdit(): Promise<string>;

    public abstract getFeuerwehr(feuerwehrNummer: number): Promise<IFeuerwehr | null>;
}
