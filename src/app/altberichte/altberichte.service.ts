import { inject, Injectable, signal } from '@angular/core';
import { IEreignis } from '../shared/interfaces/i-ereignis';
import { DatabaseService } from '../shared/services/database/database.service';
import { PdfAblageService, TESTMODUS_ORDNER } from '../shared/services/pdf-ablage/pdf-ablage.service';
import { ereignisPfad, jahresOrdner } from '../shared/services/pdf/pdf-dateinamen';
import { errorMessage } from '../shared/utils/error-message';
import { altberichte, altEreignisBezeichnung } from './altbericht-daten';

export interface IAltberichteJahr
{
    jahr: number;
    /** Anzahl abgeschlossener Ereignisse */
    anzahl: number;
}

export interface IAltberichteFortschritt
{
    /** Nummer des aktuellen Ereignisses, beginnend bei 1 */
    aktuell: number;
    gesamt: number;
    ereignis: string;
}

export interface IAltberichtFehler
{
    ereignis: string;
    /** Fehlt, wenn das ganze Ereignis nicht verarbeitet werden konnte */
    datei?: string;
    fehler: string;
}

export interface IAltberichteErgebnis
{
    /** Ordnerpfad samt gewähltem Ordner, z.B. "Berichte" bzw. "Berichte/Testmodus" */
    pfad: string;
    ereignisse: number;
    /** Anzahl PDFs */
    erstellt: number;
    /** Bereits vorhandene PDFs, die nicht überschrieben wurden */
    uebersprungen: number;
    /** Anzahl Fehler: einzelne PDFs oder ganze Ereignisse, siehe fehler */
    fehlgeschlagen: number;
    fehler: Array<IAltberichtFehler>;
    abgebrochen: boolean;
}

interface IEreignisEintrag
{
    id: number;
    jahr: number;
    nummer: number;
    start: number;
}

/**
 * Übergangslösung: erzeugt für alle abgeschlossenen Ereignisse die Berichte im alten Layout als PDF und legt sie
 * mit denselben Ordner- und Dateinamen wie die neuen PDFs im Ordner der PDF-Ablage ab. Vorhandene Dateien werden
 * nie überschrieben, sondern übersprungen. Die Ereignisse werden einzeln nacheinander geladen und verarbeitet,
 * damit der Speicherbedarf gering bleibt.
 */
@Injectable({
    providedIn: 'root'
})
export class AltberichteService
{
    private database = inject(DatabaseService);
    private ablage = inject(PdfAblageService);

    public readonly laeuft = signal(false);
    public readonly fortschritt = signal<IAltberichteFortschritt | null>(null);
    public readonly ergebnis = signal<IAltberichteErgebnis | null>(null);
    /** Grund, warum nicht gestartet werden konnte */
    public readonly hinweis = signal<string | null>(null);

    private abbruch: AbortController | null = null;

    /** Jahre mit abgeschlossenen Ereignissen, neueste zuerst */
    public async jahre(): Promise<Array<IAltberichteJahr>>
    {
        const anzahl = new Map<number, number>();
        for (const eintrag of await this.abgeschlosseneEreignisse())
            anzahl.set(eintrag.jahr, (anzahl.get(eintrag.jahr) ?? 0) + 1);
        return [...anzahl.entries()].map(([jahr, n]) => ({ jahr, anzahl: n })).sort((a, b) => b.jahr - a.jahr);
    }

    /**
     * Startet die Erzeugung aus einem Klick heraus: zuerst wird (solange die Benutzeraktion gilt) die
     * Schreibberechtigung für den Ordner geprüft bzw. angefragt. Ohne Ordner oder Berechtigung wird nichts erzeugt
     * und es gibt keinen Download als Ersatz.
     */
    public async starten(jahr?: number | null): Promise<IAltberichteErgebnis | null>
    {
        if (this.laeuft()) return null;
        this.hinweis.set(null);
        await this.ablage.geladen;

        if (!this.ablage.ordner())
        {
            this.hinweis.set('Bitte zuerst unter „PDF-Ablage“ einen Ordner auswählen.');
            return null;
        }

        const ziel = await this.ablage.zielErmitteln();
        if (!ziel.ordner)
        {
            this.hinweis.set(ziel.hinweis ?? 'Der Ordner der PDF-Ablage kann nicht verwendet werden.');
            return null;
        }

        return this.erzeugen(ziel.ordner, jahr);
    }

    /** Bricht nach dem aktuellen Bericht ab */
    public abbrechen(): void
    {
        this.abbruch?.abort();
    }

    /**
     * Erzeugt die Altberichte aller abgeschlossenen Ereignisse (optional nur eines Jahres) im angegebenen Ordner,
     * der bereits Schreibberechtigung haben muss. Im Testmodus im Unterordner "Testmodus".
     */
    public async erzeugen(basis: FileSystemDirectoryHandle, jahr?: number | null, erstellt = new Date()): Promise<IAltberichteErgebnis>
    {
        const abbruch = new AbortController();
        this.abbruch = abbruch;
        this.laeuft.set(true);
        this.ergebnis.set(null);

        const praefix = this.database.testMode ? [TESTMODUS_ORDNER] : [];
        const ergebnis: IAltberichteErgebnis = {
            pfad: [basis.name, ...praefix].join('/'),
            ereignisse: 0,
            erstellt: 0,
            uebersprungen: 0,
            fehlgeschlagen: 0,
            fehler: [],
            abgebrochen: false
        };

        try
        {
            const eintraege = (await this.abgeschlosseneEreignisse()).filter(eintrag => jahr == null || eintrag.jahr === jahr);
            ergebnis.ereignisse = eintraege.length;

            for (const [i, eintrag] of eintraege.entries())
            {
                if (abbruch.signal.aborted) break;
                this.fortschritt.set({ aktuell: i + 1, gesamt: eintraege.length, ereignis: `Ereignis ${eintrag.id}` });

                let bezeichnung = `Ereignis ${eintrag.id}`;
                try
                {
                    const ereignis = await this.database.db.ereignisse.get(eintrag.id);
                    if (!ereignis) throw new Error('Ereignis nicht gefunden');
                    bezeichnung = altEreignisBezeichnung(ereignis);
                    this.fortschritt.set({ aktuell: i + 1, gesamt: eintraege.length, ereignis: bezeichnung });
                    await this.ereignisAblegen(basis, praefix, ereignis, erstellt, ergebnis, abbruch.signal);
                }
                catch (error)
                {
                    ergebnis.fehlgeschlagen++;
                    ergebnis.fehler.push({ ereignis: bezeichnung, fehler: errorMessage(error) });
                }
            }
        }
        catch (error)
        {
            ergebnis.fehlgeschlagen++;
            ergebnis.fehler.push({ ereignis: 'Alle Ereignisse', fehler: errorMessage(error) });
        }
        finally
        {
            ergebnis.abgebrochen = abbruch.signal.aborted;
            this.ergebnis.set(ergebnis);
            this.fortschritt.set(null);
            this.laeuft.set(false);
            this.abbruch = null;
        }
        return ergebnis;
    }

    private async ereignisAblegen(
        basis: FileSystemDirectoryHandle,
        praefix: Array<string>,
        ereignis: IEreignis,
        erstellt: Date,
        ergebnis: IAltberichteErgebnis,
        abbruch: AbortSignal
    ): Promise<void>
    {
        if (abbruch.aborted) return;
        const berichte = altberichte(ereignis);

        let ordner = basis;
        for (const name of [...praefix, ...ereignisPfad(ereignis)])
            ordner = await ordner.getDirectoryHandle(name, { create: true });

        for (const bericht of berichte)
        {
            if (abbruch.aborted) return;
            try
            {
                if (await dateiVorhanden(ordner, bericht.dateiname))
                {
                    ergebnis.uebersprungen++;
                    continue;
                }

                // Oberfläche zwischen den Berichten kurz zum Zug kommen lassen (Fortschritt, Abbrechen)
                await new Promise(resolve => setTimeout(resolve));
                const { renderAltbericht } = await import('./altbericht-render');
                const inhalt = renderAltbericht(ereignis, bericht, erstellt).output('blob');
                await dateiSchreiben(ordner, bericht.dateiname, inhalt);
                ergebnis.erstellt++;
            }
            catch (error)
            {
                ergebnis.fehlgeschlagen++;
                ergebnis.fehler.push({ ereignis: altEreignisBezeichnung(ereignis), datei: bericht.dateiname, fehler: errorMessage(error) });
            }
        }
    }

    /** Ids, Jahr und Nummer aller abgeschlossenen Ereignisse, sortiert nach Ereignisnummer */
    private async abgeschlosseneEreignisse(): Promise<Array<IEreignisEintrag>>
    {
        const eintraege: Array<IEreignisEintrag> = [];
        // each() statt toArray(): es werden nur die Eckdaten behalten, nicht alle Füllungen
        await this.database.db.ereignisse.each(ereignis =>
        {
            if (ereignis.datetimeEnd == null || ereignis.id == null) return;
            eintraege.push({
                id: ereignis.id,
                jahr: Number(jahresOrdner(ereignis)),
                nummer: ereignis.nummer ?? 0,
                start: new Date(ereignis.datetimeStart).getTime()
            });
        });
        return eintraege.sort((a, b) => a.jahr - b.jahr || a.nummer - b.nummer || a.start - b.start || a.id - b.id);
    }
}

/** Ob im Ordner bereits eine Datei (oder ein Eintrag) dieses Namens existiert */
export async function dateiVorhanden(ordner: FileSystemDirectoryHandle, name: string): Promise<boolean>
{
    try
    {
        await ordner.getFileHandle(name);
        return true;
    }
    catch (error)
    {
        if (error instanceof DOMException && error.name === 'NotFoundError') return false;
        // Ein Ordner gleichen Namens wird ebenfalls nicht angetastet
        if (error instanceof DOMException && error.name === 'TypeMismatchError') return true;
        throw error;
    }
}

/**
 * Schreibt eine neue Datei. Schlägt das Schreiben fehl, wird die (leere) Datei wieder entfernt, damit sie beim
 * nächsten Durchlauf nicht als vorhanden übersprungen wird.
 */
async function dateiSchreiben(ordner: FileSystemDirectoryHandle, name: string, inhalt: Blob): Promise<void>
{
    const handle = await ordner.getFileHandle(name, { create: true });
    try
    {
        const stream = await handle.createWritable();
        try
        {
            await stream.write(inhalt);
            await stream.close();
        }
        catch (error)
        {
            await stream.abort().catch(() => undefined);
            throw error;
        }
    }
    catch (error)
    {
        await ordner.removeEntry?.(name).catch(() => undefined);
        throw error;
    }
}
