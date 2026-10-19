import { Injectable } from '@angular/core';
import { IFeuerwehr } from '../../interfaces/i-feuerwehr';
import { SyncApi } from './sync-api';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Liefert Beispieldaten, damit ohne installiertes MAT entwickelt werden kann
 */
@Injectable()
export class FakeSyncApi extends SyncApi
{
    public async getLastEdit(): Promise<string>
    {
        await delay(500);
        // Immer neu, damit bei jedem Start synchronisiert wird
        return new Date().toISOString();
    }

    public async getFeuerwehr(feuerwehrNummer: number): Promise<IFeuerwehr | null>
    {
        await delay(500);
        feuerwehrNummer = Number(feuerwehrNummer);
        const name = `Feuerwehr Nr. ${feuerwehrNummer}`;

        return {
            feuerwehrNummer,
            eigentuemerId: feuerwehrNummer,
            name,
            flaschen: Array.from({ length: 12 }, (_, i) => ({
                geraeteNr: i + 1,
                karteiNr: i + 1,
                flaschennummer: `${i + 1}`,
                barcode: `${feuerwehrNummer}${String(i + 1).padStart(2, '0')}`,
                typenBezeichnung: 'Beispieltype',
                typenInfo1: 'Info 1',
                typenInfo2: 'Info 2',
                typenInfo3: 'Info 3',
                lastEdit: new Date()
            }))
        };
    }
}
