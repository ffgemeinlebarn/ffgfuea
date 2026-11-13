import { DOCUMENT, inject, Injectable } from '@angular/core';

/**
 * Wie gedruckt wurde:
 * - druckdialog: Der Druckdialog des Browsers wurde für das PDF geöffnet
 * - tab: Das PDF wurde in einem neuen Tab geöffnet und kann dort gedruckt werden
 * - blockiert: Der Browser hat den neuen Tab blockiert, das PDF muss über url geöffnet werden
 */
export interface IDruckErgebnis
{
    art: 'druckdialog' | 'tab' | 'blockiert';
    url: string;
}

/**
 * Druckt ein PDF über einen versteckten iframe, ohne die Seite zu verlassen.
 * Klappt das nicht, wird das PDF in einem neuen Tab geöffnet, damit es im PDF-Viewer gedruckt werden kann.
 */
@Injectable({
    providedIn: 'root'
})
export class PdfDruckService
{
    private document = inject(DOCUMENT);

    /** So lange darf das Laden des PDFs im iframe dauern, danach wird es in einem Tab geöffnet */
    public ladeZeit = 10000;

    private iframe: HTMLIFrameElement | null = null;
    private url: string | null = null;

    public async drucken(pdf: Blob): Promise<IDruckErgebnis>
    {
        // Der iframe des letzten Drucks bleibt bis jetzt erhalten, sonst bricht die Druckvorschau ab
        this.aufraeumen();
        const url = this.url = URL.createObjectURL(pdf);

        try
        {
            await this.imIframeDrucken(url);
            return { art: 'druckdialog', url };
        }
        catch
        {
            this.iframeEntfernen();
            const tab = this.document.defaultView?.open(url, '_blank');
            return { art: tab ? 'tab' : 'blockiert', url };
        }
    }

    private imIframeDrucken(url: string): Promise<void>
    {
        return new Promise<void>((resolve, reject) =>
        {
            const iframe = this.document.createElement('iframe');
            iframe.className = 'ffg-druck-frame';
            iframe.title = 'Berichte drucken';
            iframe.setAttribute('aria-hidden', 'true');
            // Nicht display: none, sonst lädt Chrome den PDF-Viewer nicht
            iframe.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0; visibility: hidden;';

            const timer = setTimeout(() => reject(new Error('Das PDF konnte nicht zum Drucken geladen werden')), this.ladeZeit);
            iframe.addEventListener('load', () =>
            {
                clearTimeout(timer);
                try
                {
                    const fenster = iframe.contentWindow;
                    if (!fenster) throw new Error('Kein Zugriff auf das PDF');
                    fenster.focus();
                    fenster.print();
                    resolve();
                }
                catch (error)
                {
                    reject(error);
                }
            }, { once: true });

            iframe.src = url;
            this.document.body.appendChild(iframe);
            this.iframe = iframe;
        });
    }

    private iframeEntfernen(): void
    {
        this.iframe?.remove();
        this.iframe = null;
    }

    private aufraeumen(): void
    {
        this.iframeEntfernen();
        if (this.url) URL.revokeObjectURL(this.url);
        this.url = null;
    }
}
