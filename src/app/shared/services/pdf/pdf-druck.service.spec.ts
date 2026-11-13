import { TestBed } from '@angular/core/testing';
import { PdfDruckService } from './pdf-druck.service';

describe('PdfDruckService', () =>
{
    const pdf = new Blob(['%PDF-1.3'], { type: 'application/pdf' });
    let service: PdfDruckService;
    let urls: number;
    let open: ReturnType<typeof vi.spyOn>;

    beforeEach(() =>
    {
        urls = 0;
        URL.createObjectURL = vi.fn(() => `blob:pdf-${++urls}`);
        URL.revokeObjectURL = vi.fn();
        open = vi.spyOn(window, 'open').mockReturnValue(null);
        service = TestBed.inject(PdfDruckService);
    });

    afterEach(() =>
    {
        document.querySelectorAll('iframe.ffg-druck-frame').forEach(iframe => iframe.remove());
        vi.restoreAllMocks();
    });

    const frames = (): Array<HTMLIFrameElement> => [...document.querySelectorAll<HTMLIFrameElement>('iframe.ffg-druck-frame')];

    /** Simuliert das Laden des PDFs im iframe, print des iframes ist dabei gemockt */
    function laden(iframe: HTMLIFrameElement, print: () => void = () => undefined): ReturnType<typeof vi.fn>
    {
        const mock = vi.fn(print);
        vi.spyOn(iframe.contentWindow!, 'print').mockImplementation(mock);
        vi.spyOn(iframe.contentWindow!, 'focus').mockImplementation(() => undefined);
        iframe.dispatchEvent(new Event('load'));
        return mock;
    }

    it('druckt das PDF über einen versteckten iframe', async () =>
    {
        const ergebnis = service.drucken(pdf);

        const [iframe] = frames();
        expect(iframe.src).toBe('blob:pdf-1');
        expect(iframe.style.visibility).toBe('hidden');
        expect(URL.createObjectURL).toHaveBeenCalledWith(pdf);
        const print = laden(iframe);

        expect(await ergebnis).toEqual({ art: 'druckdialog', url: 'blob:pdf-1' });
        expect(print).toHaveBeenCalledTimes(1);
        expect(open).not.toHaveBeenCalled();
        // Bleibt bis zum nächsten Druck, sonst bricht die Druckvorschau ab
        expect(frames()).toEqual([iframe]);
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    it('räumt den iframe des letzten Drucks beim nächsten Druck weg', async () =>
    {
        const erster = service.drucken(pdf);
        laden(frames()[0]);
        await erster;

        const zweiter = service.drucken(pdf);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1');
        expect(frames().map(iframe => iframe.src)).toEqual(['blob:pdf-2']);
        laden(frames()[0]);
        expect((await zweiter).art).toBe('druckdialog');
    });

    it('öffnet das PDF in einem neuen Tab, wenn das Drucken im iframe scheitert', async () =>
    {
        open.mockReturnValue({} as Window);
        const ergebnis = service.drucken(pdf);

        laden(frames()[0], () => { throw new DOMException('Blocked', 'SecurityError'); });

        expect(await ergebnis).toEqual({ art: 'tab', url: 'blob:pdf-1' });
        expect(open).toHaveBeenCalledWith('blob:pdf-1', '_blank');
        expect(frames()).toEqual([]);
        // Der Tab braucht die URL noch
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    it('öffnet das PDF in einem neuen Tab, wenn es im iframe nicht lädt', async () =>
    {
        vi.useFakeTimers();
        try
        {
            open.mockReturnValue({} as Window);
            service.ladeZeit = 1000;
            const ergebnis = service.drucken(pdf);

            await vi.advanceTimersByTimeAsync(1000);

            expect(await ergebnis).toEqual({ art: 'tab', url: 'blob:pdf-1' });
            expect(frames()).toEqual([]);
        }
        finally
        {
            vi.useRealTimers();
        }
    });

    it('meldet einen blockierten Tab, damit das PDF per Link geöffnet werden kann', async () =>
    {
        const ergebnis = service.drucken(pdf);

        laden(frames()[0], () => { throw new Error('print blockiert'); });

        expect(await ergebnis).toEqual({ art: 'blockiert', url: 'blob:pdf-1' });
    });
});
