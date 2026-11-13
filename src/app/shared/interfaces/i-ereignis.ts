import { EreignisType } from '../enums/ereignis-type';
import { IFuellung } from './i-fuellung';
import { IPerson } from './i-person';

export interface IEreignis
{
    /** Erst nach dem ersten Speichern vergeben */
    id?: number;
    type: EreignisType;
    datetimeStart: Date;
    /** null, solange das Ereignis läuft */
    datetimeEnd: Date | null;
    ort?: string;

    /**
     * Ereignisnummer (JJJJ-NNN, siehe formatEreignisNummer): Jahr und laufende Nummer innerhalb des Jahres.
     * Wird beim ersten Speichern aus dem Jahr des Beginns vergeben und bleibt danach unverändert,
     * auch wenn der Beginn später geändert wird. Pro Jahr eindeutig.
     */
    jahr?: number;
    nummer?: number;

    personen: Array<IPerson>;
    fuellungen: Array<IFuellung>;
}
