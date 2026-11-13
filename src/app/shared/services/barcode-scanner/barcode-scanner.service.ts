import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

/** Kürzere Eingaben sind Tastatureingaben und keine Barcodes */
const MIN_BARCODE_LENGTH = 5;

const isDigit = (value: string) => /^\d$/.test(value);

/**
 * Erkennt Eingaben eines Barcode-Scanners, der sich wie eine Tastatur verhält:
 * eine Folge von Ziffern, abgeschlossen mit Enter
 */
@Injectable({
    providedIn: 'root'
})
export class BarcodeScannerService
{
    private buffer = '';
    private readonly scanned = new Subject<string>();

    public readonly active = signal(true);
    public readonly barcodes = this.scanned.asObservable();

    public constructor()
    {
        const body = inject(DOCUMENT).body;
        const listener = (event: KeyboardEvent) => this.onKeydown(event.key);
        body.addEventListener('keydown', listener);
        inject(DestroyRef).onDestroy(() => body.removeEventListener('keydown', listener));
    }

    private onKeydown(key: string)
    {
        if (!this.active()) return;

        if (isDigit(key))
        {
            this.buffer += key;
        }
        else if (key === 'Enter')
        {
            if (this.buffer.length < MIN_BARCODE_LENGTH) return;
            const barcode = this.buffer;
            this.buffer = '';
            this.scanned.next(barcode);
        }
        else
        {
            this.buffer = '';
        }
    }
}
