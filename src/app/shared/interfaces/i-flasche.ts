import type { IFeuerwehrRef } from './i-feuerwehr';

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

/**
 * Herkunft einer Flasche:
 * mat = aus der MAT Synchronisierung (nur lesbar), manuell = in der Verwaltung erfasst
 */
export type FlaschenQuelle = 'mat' | 'manuell';

export interface IFlasche extends IMatFlasche
{
    feuerwehr: IFeuerwehrRef;
    /** Fehlt bei Flaschen, die vor Einführung manueller Flaschen gespeichert wurden - diese stammen aus MAT */
    quelle?: FlaschenQuelle;
}

export function getFlaschenQuelle(flasche: Pick<IFlasche, 'quelle'>): FlaschenQuelle
{
    return flasche.quelle ?? 'mat';
}

export function isManuelleFlasche(flasche: Pick<IFlasche, 'quelle'>): boolean
{
    return getFlaschenQuelle(flasche) === 'manuell';
}
