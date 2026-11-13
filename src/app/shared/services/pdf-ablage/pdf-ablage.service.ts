import { computed, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { IEreignis } from '../../interfaces/i-ereignis';
import { downloadBlob } from '../../utils/download';
import { errorMessage } from '../../utils/error-message';
import { DatabaseService } from '../database/database.service';
import { ereignisPfad } from '../pdf/pdf-dateinamen';
import { IBerichtAuswahl, IPdfDatei, PdfService } from '../pdf/pdf.service';
import { getDirectoryPicker, IBerechtigungOptionen, IOrdnerHandle } from './file-system-access';
import { OrdnerStore } from './ordner-store';

/** Unterordner für PDFs aus der Testdatenbank, damit sie keine echten Berichte überschreiben */
export const TESTMODUS_ORDNER = 'Testmodus';

const SCHREIBEN: IBerechtigungOptionen = { mode: 'readwrite' };

/** Wohin gespeichert wird: in den Ordner oder, ohne Ordner, als Download */
export interface IAblageZiel
{
    ordner: FileSystemDirectoryHandle | null;
    /** Grund, warum der gewählte Ordner nicht verwendet werden kann */
    hinweis?: string;
}

export interface IAblageErgebnis
{
    art: 'ordner' | 'download';
    /** Ordnerpfad samt gewähltem Ordner, z.B. "Berichte/2026/2026-007_Uebung_Gemeinlebarn" */
    pfad: string;
    dateien: Array<string>;
    hinweis?: string;
}

export interface IAblageOptionen
{
    /** Bereits mit zielErmitteln() bestimmtes Ziel, sonst wird es zuerst ermittelt */
    ziel?: IAblageZiel;
    /** Ohne verwendbaren Ordner herunterladen (Standard) oder gar nicht speichern */
    download?: boolean;
    erstellt?: Date;
}

/**
 * Legt die Berichte eines Ereignisses als PDF in einem lokalen Ordner ab (File System Access API):
 * <Ordner>/<JJJJ>/<JJJJ-NNN>_<Einsatz|Uebung>[_<Ort>]/<JJJJ-NNN>_….pdf
 * Ohne Ordner oder ohne Unterstützung des Browsers werden die PDFs einzeln heruntergeladen.
 */
@Injectable({
    providedIn: 'root'
})
export class PdfAblageService
{
    private store = inject(OrdnerStore);
    private pdf = inject(PdfService);
    private database = inject(DatabaseService);
    private document = inject(DOCUMENT);

    /** Ob der Browser die Auswahl eines Ordners unterstützt (Chrome und Edge am PC) */
    public readonly unterstuetzt = !!getDirectoryPicker(this.document.defaultView);

    public readonly ordner = signal<FileSystemDirectoryHandle | null>(null);
    public readonly ordnerName = computed(() => this.ordner()?.name ?? null);

    /** Pause zwischen mehreren Downloads, sonst verwirft der Browser manche davon */
    public downloadPause = 250;

    /** Erfüllt, sobald der gespeicherte Ordner geladen ist */
    public readonly geladen: Promise<void> = this.laden();

    private async laden(): Promise<void>
    {
        if (!this.unterstuetzt) return;
        try
        {
            this.ordner.set(await this.store.get() ?? null);
        }
        catch
        {
            // Ohne gespeicherten Ordner weiter, die PDFs werden dann heruntergeladen
        }
    }

    /**
     * Lässt den Benutzer einen Ordner wählen und merkt ihn sich.
     * Liefert false, wenn die Auswahl abgebrochen wurde.
     */
    public async ordnerWaehlen(): Promise<boolean>
    {
        const picker = getDirectoryPicker(this.document.defaultView);
        if (!picker) throw new Error('Dieser Browser unterstützt keine Ordnerauswahl');

        let handle: FileSystemDirectoryHandle;
        try
        {
            handle = await picker({ id: 'ffgfuea-berichte', mode: 'readwrite', startIn: this.ordner() ?? 'documents' });
        }
        catch (error)
        {
            if (error instanceof DOMException && error.name === 'AbortError') return false;
            throw error;
        }

        await this.store.set(handle);
        this.ordner.set(handle);
        return true;
    }

    public async ordnerEntfernen(): Promise<void>
    {
        await this.store.delete();
        this.ordner.set(null);
    }

    /**
     * Prüft die Schreibberechtigung für den gewählten Ordner und fragt sie bei Bedarf an.
     * Die Anfrage ist nur während einer Benutzeraktion (Klick) erlaubt, daher muss diese Methode
     * aufgerufen werden, bevor länger dauernde Arbeit (PDFs erzeugen, Ereignis speichern) beginnt.
     */
    public async zielErmitteln(): Promise<IAblageZiel>
    {
        await this.geladen;
        const ordner = this.ordner() as IOrdnerHandle | null;
        if (!ordner) return { ordner: null };

        try
        {
            if (!ordner.queryPermission || await ordner.queryPermission(SCHREIBEN) === 'granted') return { ordner };
            if (ordner.requestPermission && await ordner.requestPermission(SCHREIBEN) === 'granted') return { ordner };
            return { ordner: null, hinweis: `Keine Schreibberechtigung für den Ordner „${ordner.name}“` };
        }
        catch (error)
        {
            return { ordner: null, hinweis: `Kein Zugriff auf den Ordner „${ordner.name}“ (${errorMessage(error)})` };
        }
    }

    /**
     * Erzeugt die ausgewählten Berichte (ohne Auswahl alle) als PDF und legt sie im Ordner ab oder lädt sie herunter.
     * Vorhandene Dateien werden überschrieben. Liefert null, wenn ohne Ordner nicht heruntergeladen werden soll.
     */
    public async speichern(ereignis: IEreignis, auswahl?: Array<IBerichtAuswahl>, optionen: IAblageOptionen = {}): Promise<IAblageErgebnis | null>
    {
        // Berechtigung zuerst, solange die Benutzeraktion noch gilt
        const ziel = optionen.ziel ?? await this.zielErmitteln();
        if (!ziel.ordner && optionen.download === false) return null;

        const dateien = await this.pdf.createBerichte(ereignis, auswahl, optionen.erstellt);
        const namen = dateien.map(datei => datei.dateiname);

        if (ziel.ordner)
        {
            const pfad = [...(this.database.testMode ? [TESTMODUS_ORDNER] : []), ...ereignisPfad(ereignis)];
            await this.schreiben(ziel.ordner, pfad, dateien);
            return { art: 'ordner', pfad: [ziel.ordner.name, ...pfad].join('/'), dateien: namen };
        }

        const praefix = this.database.testMode ? `${TESTMODUS_ORDNER}_` : '';
        await this.herunterladen(dateien, praefix);
        return { art: 'download', pfad: '', dateien: namen.map(name => praefix + name), hinweis: ziel.hinweis };
    }

    /** Meldung für den Benutzer, z.B. "3 PDFs gespeichert in Berichte/2026/2026-007_Uebung" */
    public meldung(ergebnis: IAblageErgebnis): string
    {
        const anzahl = ergebnis.dateien.length === 1 ? '1 PDF' : `${ergebnis.dateien.length} PDFs`;
        if (ergebnis.art === 'ordner') return `${anzahl} gespeichert in ${ergebnis.pfad}`;
        return `${ergebnis.hinweis ? `${ergebnis.hinweis}. ` : ''}${anzahl} heruntergeladen`;
    }

    private async schreiben(basis: FileSystemDirectoryHandle, pfad: Array<string>, dateien: Array<IPdfDatei>): Promise<void>
    {
        let ordner = basis;
        for (const name of pfad)
            ordner = await ordner.getDirectoryHandle(name, { create: true });

        for (const datei of dateien)
        {
            const handle = await ordner.getFileHandle(datei.dateiname, { create: true });
            // Ersetzt den Inhalt einer vorhandenen Datei (keepExistingData ist standardmäßig false)
            const stream = await handle.createWritable();
            try
            {
                await stream.write(datei.inhalt);
                await stream.close();
            }
            catch (error)
            {
                // Abbrechen statt schließen, damit keine halb geschriebene Datei übrig bleibt
                await stream.abort().catch(() => undefined);
                throw error;
            }
        }
    }

    private async herunterladen(dateien: Array<IPdfDatei>, praefix: string): Promise<void>
    {
        for (const [i, datei] of dateien.entries())
        {
            if (i > 0) await new Promise(resolve => setTimeout(resolve, this.downloadPause));
            downloadBlob(this.document, datei.inhalt, praefix + datei.dateiname);
        }
    }
}
