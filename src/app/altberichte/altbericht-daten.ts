// Texte, Gruppierung und Dateinamen der Altberichte. Ohne jsPDF, damit der AltberichteService
// die Dateinamen kennt, bevor der Renderer nachgeladen wird.
import { EreignisType } from '../shared/enums/ereignis-type';
import { IEreignis } from '../shared/interfaces/i-ereignis';
import { IFuellung } from '../shared/interfaces/i-fuellung';
import { formatEreignisNummer } from '../shared/models/ereignis-nummer/ereignis-nummer';
import { IFeuerwehrFuellungen } from '../shared/reports/report-data';
import { feuerwehrberichtDateinamen, gesamtberichtDateiname } from '../shared/services/pdf/pdf-dateinamen';

// Texte wie im bisherigen Druckdialog (print-reports vor der Überarbeitung).
// Bewusst eigene Konstanten, damit spätere Änderungen an den neuen Berichten das alte Layout nicht verändern.
export const ALT_KOPF = 'Füllbericht';
export const ALT_KOPF_ZUSATZ = 'der Atemluftfüllstelle Gemeinlebarn';
const ALT_GESAMTBERICHT = 'Gesamtbericht';
export const ALT_NACHTRAEGLICH = '(nachträglich erstellt)';

function altFeuerwehrberichtTitel(feuerwehrName: string): string
{
    return `Bericht für die Feuerwehr ${feuerwehrName}`;
}

/** "Übung in Gemeinlebarn" bzw. "Einsatz", wie in der Zeile "Ereignis:" der alten Berichte */
export function altEreignisText(ereignis: IEreignis): string
{
    return (ereignis.type === EreignisType.Uebung ? 'Übung' : 'Einsatz') + (ereignis.ort ? ` in ${ereignis.ort}` : '');
}

/** Für Fortschritt und Fehlerliste, z.B. "2026-007 Übung in Gemeinlebarn" */
export function altEreignisBezeichnung(ereignis: IEreignis): string
{
    return [formatEreignisNummer(ereignis), altEreignisText(ereignis)].filter(teil => !!teil).join(' ');
}

/**
 * Gruppiert die Füllungen nach Feuerwehr wie der alte Druckdialog: Feuerwehren in der Reihenfolge ihrer ersten
 * Füllung, Füllungen in der gespeicherten Reihenfolge (keine Sortierung).
 */
export function altGruppen(fuellungen: Array<IFuellung>): Array<IFeuerwehrFuellungen>
{
    const gruppen = new Map<number, IFeuerwehrFuellungen>();
    for (const fuellung of fuellungen)
    {
        const feuerwehr = fuellung.flasche.feuerwehr;
        let gruppe = gruppen.get(feuerwehr.feuerwehrNummer);
        if (!gruppe)
        {
            gruppe = { feuerwehr, fuellungen: [] };
            gruppen.set(feuerwehr.feuerwehrNummer, gruppe);
        }
        gruppe.fuellungen.push(fuellung);
    }
    return [...gruppen.values()];
}

/** Ein Altbericht: Dateiname wie bei den neuen PDFs, Titel und die enthaltenen Feuerwehren */
export interface IAltbericht
{
    dateiname: string;
    titel: string;
    gruppen: Array<IFeuerwehrFuellungen>;
}

/**
 * Die Berichte eines Ereignisses wie im alten Druckdialog: der Gesamtbericht mit allen Feuerwehren und
 * ein Bericht pro Feuerwehr. Die Dateinamen stimmen mit denen der neuen PDFs überein (pdf-dateinamen).
 */
export function altberichte(ereignis: IEreignis): Array<IAltbericht>
{
    const gruppen = altGruppen(ereignis.fuellungen ?? []);
    const dateinamen = feuerwehrberichtDateinamen(ereignis, gruppen);
    return [
        { dateiname: gesamtberichtDateiname(ereignis), titel: ALT_GESAMTBERICHT, gruppen },
        ...gruppen.map((gruppe, i) => ({
            dateiname: dateinamen[i],
            titel: altFeuerwehrberichtTitel(gruppe.feuerwehr.name),
            gruppen: [gruppe]
        }))
    ];
}
