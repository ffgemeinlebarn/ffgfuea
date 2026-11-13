import { Pipe, PipeTransform } from '@angular/core';
import { EreignisNummer, formatEreignisNummer } from '../../models/ereignis-nummer/ereignis-nummer';

/** Zeigt die Ereignisnummer an, z.B. 2026-007 */
@Pipe({ name: 'ereignisNummer' })
export class EreignisNummerPipe implements PipeTransform
{
    public transform(ereignis: EreignisNummer | null | undefined): string
    {
        return formatEreignisNummer(ereignis);
    }
}
