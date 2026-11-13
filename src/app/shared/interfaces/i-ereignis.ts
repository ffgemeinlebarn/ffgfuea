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

    personen: Array<IPerson>;
    fuellungen: Array<IFuellung>;
}
