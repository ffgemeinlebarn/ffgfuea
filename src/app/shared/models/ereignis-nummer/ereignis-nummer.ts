import { IEreignis } from '../../interfaces/i-ereignis';

export type EreignisNummer = Pick<IEreignis, 'jahr' | 'nummer'>;

/**
 * Ereignisnummer im Format JJJJ-NNN, z.B. 2026-007 (ab 1000 entsprechend mehr Stellen).
 * Leer, solange das Ereignis noch keine Nummer hat.
 */
export function formatEreignisNummer(ereignis: EreignisNummer | null | undefined): string
{
    if (!hasEreignisNummer(ereignis)) return '';
    return `${ereignis.jahr}-${String(ereignis.nummer).padStart(3, '0')}`;
}

export function hasEreignisNummer<T extends EreignisNummer>(ereignis: T | null | undefined): ereignis is T & Required<EreignisNummer>
{
    return ereignis?.jahr != null && ereignis?.nummer != null;
}

/**
 * Vergibt allen Ereignissen ohne Nummer die nächste freie Nummer im Jahr ihres Beginns,
 * also im Anschluss an die höchste Nummer dieses Jahres (aus `ereignisse` und `vergeben`).
 * Mehrere Ereignisse werden in der Reihenfolge ihres Beginns nummeriert, bei Gleichstand nach Id.
 * Vorhandene Nummern bleiben unverändert. Die Ereignisse werden direkt verändert.
 */
export function assignEreignisNummern(ereignisse: Array<IEreignis>, vergeben: Array<IEreignis> = []): void
{
    const hoechste = new Map<number, number>();
    for (const ereignis of [...vergeben, ...ereignisse].filter(hasEreignisNummer))
        hoechste.set(ereignis.jahr, Math.max(hoechste.get(ereignis.jahr) ?? 0, ereignis.nummer));

    ereignisse
        .filter(ereignis => !hasEreignisNummer(ereignis))
        .sort((a, b) => a.datetimeStart.getTime() - b.datetimeStart.getTime() || (a.id ?? 0) - (b.id ?? 0))
        .forEach(ereignis =>
        {
            const jahr = ereignis.datetimeStart.getFullYear();
            const nummer = (hoechste.get(jahr) ?? 0) + 1;
            hoechste.set(jahr, nummer);
            ereignis.jahr = jahr;
            ereignis.nummer = nummer;
        });
}
