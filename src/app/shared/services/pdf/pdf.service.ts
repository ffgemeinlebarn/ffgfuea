import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { IEreignis } from '../../interfaces/i-ereignis';
import { feuerwehrberichtTitel, GESAMTBERICHT_TITEL, groupFuellungenByFeuerwehr, IFeuerwehrFuellungen } from '../../reports/report-data';
import { feuerwehrberichtDateiname, feuerwehrberichtDateinamen, gesamtberichtDateiname } from './pdf-dateinamen';

/** Auswahl eines Berichts: ohne gruppe der Gesamtbericht, sonst der Bericht dieser Feuerwehr */
export interface IBerichtAuswahl
{
    gruppe?: IFeuerwehrFuellungen;
}

export interface IPdfDatei
{
    dateiname: string;
    titel: string;
    inhalt: Blob;
}

/** Wird nach jedem erzeugten Bericht aufgerufen (Fortschrittsanzeige) */
export type PdfFortschritt = () => void;

/**
 * Erzeugt die Berichte eines Ereignisses als PDF (Vektor-PDF mit echtem Text).
 * jsPDF wird erst beim ersten Aufruf nachgeladen.
 */
@Injectable({
    providedIn: 'root'
})
export class PdfService
{
    /** Alle Berichte eines Ereignisses: der Gesamtbericht und ein Bericht pro Feuerwehr */
    public alleBerichte(ereignis: IEreignis): Array<IBerichtAuswahl>
    {
        return [{}, ...groupFuellungenByFeuerwehr(ereignis.fuellungen ?? []).map(gruppe => ({ gruppe }))];
    }

    /**
     * Erzeugt ein PDF pro ausgewähltem Bericht (ohne Auswahl alle Berichte), in der Reihenfolge der Auswahl
     */
    public async createBerichte(
        ereignis: IEreignis, auswahl?: Array<IBerichtAuswahl>, erstellt = new Date(), fortschritt?: PdfFortschritt
    ): Promise<Array<IPdfDatei>>
    {
        const { renderGesamtbericht, renderFeuerwehrbericht } = await import('./pdf-render');

        // Dateinamen über alle Feuerwehren bestimmen, damit sie unabhängig von der Auswahl gleich bleiben
        const gruppen = groupFuellungenByFeuerwehr(ereignis.fuellungen ?? []);
        const dateinamen = feuerwehrberichtDateinamen(ereignis, gruppen);

        const dateien: Array<IPdfDatei> = [];
        for (const bericht of auswahl ?? this.alleBerichte(ereignis))
        {
            await naechsterSchritt();

            const gruppe = bericht.gruppe;
            if (!gruppe)
            {
                dateien.push({
                    dateiname: gesamtberichtDateiname(ereignis),
                    titel: GESAMTBERICHT_TITEL,
                    inhalt: renderGesamtbericht(ereignis, erstellt).output('blob')
                });
            }
            else
            {
                const index = gruppen.findIndex(g => g.feuerwehr.feuerwehrNummer === gruppe.feuerwehr.feuerwehrNummer);
                dateien.push({
                    dateiname: index >= 0 ? dateinamen[index] : feuerwehrberichtDateiname(ereignis, gruppe),
                    titel: feuerwehrberichtTitel(gruppe.feuerwehr.name),
                    inhalt: renderFeuerwehrbericht(ereignis, gruppe, erstellt).output('blob')
                });
            }
            fortschritt?.();
        }
        return dateien;
    }

    /**
     * Erzeugt ein einziges PDF mit allen ausgewählten Berichten (ohne Auswahl alle) zum Drucken:
     * Seiten des Gesamtberichts im Querformat, die der Feuerwehrberichte im Hochformat.
     * Die Seitenzahlen beginnen bei jedem Bericht neu.
     */
    public async createSammelPdf(
        ereignis: IEreignis, auswahl?: Array<IBerichtAuswahl>, erstellt = new Date(), fortschritt?: PdfFortschritt
    ): Promise<Blob>
    {
        const { renderGesamtbericht, renderFeuerwehrbericht, setTitel, SAMMEL_TITEL } = await import('./pdf-render');
        const berichte = auswahl ?? this.alleBerichte(ereignis);
        if (berichte.length === 0) throw new Error('Kein Bericht ausgewählt');

        let doc: jsPDF | undefined;
        for (const bericht of berichte)
        {
            await naechsterSchritt();
            doc = bericht.gruppe
                ? renderFeuerwehrbericht(ereignis, bericht.gruppe, erstellt, doc)
                : renderGesamtbericht(ereignis, erstellt, doc);
            fortschritt?.();
        }

        if (berichte.length > 1) setTitel(doc!, ereignis, SAMMEL_TITEL);
        return doc!.output('blob');
    }
}

/** Zwischen den Berichten die Oberfläche kurz zum Zug kommen lassen (Fortschrittsanzeige) */
function naechsterSchritt(): Promise<void>
{
    return new Promise(resolve => setTimeout(resolve));
}
