import { Injectable } from '@angular/core';
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
    public async createBerichte(ereignis: IEreignis, auswahl?: Array<IBerichtAuswahl>, erstellt = new Date()): Promise<Array<IPdfDatei>>
    {
        const { renderGesamtbericht, renderFeuerwehrbericht } = await import('./pdf-render');

        // Dateinamen über alle Feuerwehren bestimmen, damit sie unabhängig von der Auswahl gleich bleiben
        const gruppen = groupFuellungenByFeuerwehr(ereignis.fuellungen ?? []);
        const dateinamen = feuerwehrberichtDateinamen(ereignis, gruppen);

        const dateien: Array<IPdfDatei> = [];
        for (const bericht of auswahl ?? this.alleBerichte(ereignis))
        {
            // Zwischen den Berichten die Oberfläche kurz zum Zug kommen lassen (Fortschrittsanzeige)
            await new Promise(resolve => setTimeout(resolve));

            const gruppe = bericht.gruppe;
            if (!gruppe)
            {
                dateien.push({
                    dateiname: gesamtberichtDateiname(ereignis),
                    titel: GESAMTBERICHT_TITEL,
                    inhalt: renderGesamtbericht(ereignis, erstellt).output('blob')
                });
                continue;
            }

            const index = gruppen.findIndex(g => g.feuerwehr.feuerwehrNummer === gruppe.feuerwehr.feuerwehrNummer);
            dateien.push({
                dateiname: index >= 0 ? dateinamen[index] : feuerwehrberichtDateiname(ereignis, gruppe),
                titel: feuerwehrberichtTitel(gruppe.feuerwehr.name),
                inhalt: renderFeuerwehrbericht(ereignis, gruppe, erstellt).output('blob')
            });
        }
        return dateien;
    }
}
