import { EreignisType } from '../../enums/ereignis-type';
import { IEreignis } from '../../interfaces/i-ereignis';
import { formatEreignisNummer } from '../../models/ereignis-nummer/ereignis-nummer';
import { IFeuerwehrFuellungen } from '../../reports/report-data';

const UMLAUTE: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss', ẞ: 'SS' };

/** Unter Windows reservierte Namen, auch mit Dateiendung nicht erlaubt */
const RESERVIERT = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

const MAX_LAENGE = 60;

/**
 * Macht aus einem beliebigen Text einen Teil eines Datei- oder Ordnernamens, der unter Windows,
 * macOS und Linux gültig ist: Umlaute werden ersetzt (ä → ae, ß → ss), Akzente entfernt, ungültige
 * Zeichen gestrichen und Leerzeichen zu Unterstrichen. Liefert '' für Texte ohne verwertbare Zeichen.
 */
export function sanitizeDateiname(text: string | null | undefined): string
{
    const result = (text ?? '')
        .replace(/[äöüÄÖÜßẞ]/g, zeichen => UMLAUTE[zeichen])
        // Akzente abtrennen und entfernen, z.B. é → e
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        // Alles außer Buchstaben, Ziffern, Leerzeichen, Punkt, Bindestrich und Unterstrich entfernen
        .replace(/[^A-Za-z0-9 ._-]+/g, ' ')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .slice(0, MAX_LAENGE)
        // Punkte und Trennzeichen am Rand sind unter Windows problematisch bzw. unschön
        .replace(/^[._-]+|[._-]+$/g, '');

    return RESERVIERT.test(result) ? `${result}_` : result;
}

function pad(zahl: number, stellen = 2): string
{
    return String(zahl).padStart(stellen, '0');
}

/**
 * Präfix aller Dateien eines Ereignisses: die Ereignisnummer (JJJJ-NNN).
 * Ereignisse ohne Nummer (nur vor dem ersten Speichern möglich) bekommen Datum und Uhrzeit des Beginns.
 */
export function ereignisPraefix(ereignis: IEreignis): string
{
    const nummer = formatEreignisNummer(ereignis);
    if (nummer) return nummer;

    const beginn = ereignis.datetimeStart;
    return `${beginn.getFullYear()}-${pad(beginn.getMonth() + 1)}-${pad(beginn.getDate())}_${pad(beginn.getHours())}${pad(beginn.getMinutes())}`;
}

/** Jahresordner, z.B. "2026" */
export function jahresOrdner(ereignis: IEreignis): string
{
    return String(ereignis.jahr ?? ereignis.datetimeStart.getFullYear());
}

/** Ordner eines Ereignisses, z.B. "2026-007_Uebung_Gemeinlebarn" */
export function ereignisOrdner(ereignis: IEreignis): string
{
    const typ = ereignis.type === EreignisType.Uebung ? 'Uebung' : 'Einsatz';
    return [ereignisPraefix(ereignis), typ, sanitizeDateiname(ereignis.ort)].filter(teil => !!teil).join('_');
}

/** Pfad des Ereignisordners relativ zum gewählten Ordner, z.B. ["2026", "2026-007_Uebung_Gemeinlebarn"] */
export function ereignisPfad(ereignis: IEreignis): Array<string>
{
    return [jahresOrdner(ereignis), ereignisOrdner(ereignis)];
}

/** z.B. "2026-007_Gesamtbericht.pdf" */
export function gesamtberichtDateiname(ereignis: IEreignis): string
{
    return `${ereignisPraefix(ereignis)}_Gesamtbericht.pdf`;
}

/**
 * z.B. "2026-007_Feuerwehr_FF_Gemeinlebarn.pdf". Ergeben mehrere Feuerwehren denselben Namen,
 * wird die Feuerwehrnummer angehängt (siehe feuerwehrberichtDateinamen).
 */
export function feuerwehrberichtDateiname(ereignis: IEreignis, gruppe: IFeuerwehrFuellungen, eindeutig = true): string
{
    const name = sanitizeDateiname(gruppe.feuerwehr.name) || String(gruppe.feuerwehr.feuerwehrNummer);
    const nummer = eindeutig ? '' : `_${gruppe.feuerwehr.feuerwehrNummer}`;
    return `${ereignisPraefix(ereignis)}_Feuerwehr_${name}${nummer}.pdf`;
}

/** Dateinamen für die Berichte mehrerer Feuerwehren, bei gleichen Namen mit Feuerwehrnummer */
export function feuerwehrberichtDateinamen(ereignis: IEreignis, gruppen: Array<IFeuerwehrFuellungen>): Array<string>
{
    const namen = gruppen.map(gruppe => feuerwehrberichtDateiname(ereignis, gruppe).toLowerCase());
    return gruppen.map((gruppe, i) =>
        feuerwehrberichtDateiname(ereignis, gruppe, namen.indexOf(namen[i]) === namen.lastIndexOf(namen[i])));
}
