import { TestBed } from '@angular/core/testing';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { captureDownloads, FakeDirectoryHandle, FakeFileHandle, installDirectoryPicker, removeDirectoryPicker } from 'src/app/testing/file-system';
import { EreignisType } from '../../enums/ereignis-type';
import { PdfService } from '../pdf/pdf.service';
import { OrdnerStore } from './ordner-store';
import { PdfAblageService } from './pdf-ablage.service';

describe('PdfAblageService', () =>
{
    const ff1 = createFeuerwehr(1, ['11111']);
    const ff2 = createFeuerwehr(2, ['22221']);
    const ereignis = createEreignis({
        type: EreignisType.Einsatz,
        jahr: 2026,
        nummer: 7,
        ort: 'Großweikersdorf',
        fuellungen: [createFuellung(ff1.flaschen[0]), createFuellung(ff2.flaschen[0])]
    });
    const ereignisOrdner = ['2026', '2026-007_Einsatz_Grossweikersdorf'];
    const alleDateien = ['2026-007_Gesamtbericht.pdf', '2026-007_Feuerwehr_FF_1.pdf', '2026-007_Feuerwehr_FF_2.pdf'];

    let gespeichert: FileSystemDirectoryHandle | undefined;
    let store: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

    beforeEach(() =>
    {
        gespeichert = undefined;
        store = {
            get: vi.fn(async () => gespeichert),
            set: vi.fn(async (handle: FileSystemDirectoryHandle) => { gespeichert = handle; }),
            delete: vi.fn(async () => { gespeichert = undefined; })
        };
        TestBed.configureTestingModule({ providers: [{ provide: OrdnerStore, useValue: store }] });
    });

    afterEach(() =>
    {
        removeDirectoryPicker();
        vi.restoreAllMocks();
    });

    async function createService(ordner?: FakeDirectoryHandle): Promise<PdfAblageService>
    {
        gespeichert = ordner?.asHandle();
        const service = TestBed.inject(PdfAblageService);
        service.downloadPause = 0;
        await service.geladen;
        return service;
    }

    describe('Ordnerauswahl', () =>
    {
        beforeEach(() => installDirectoryPicker(async () => new FakeDirectoryHandle('Neu')));

        it('lädt den gespeicherten Ordner', async () =>
        {
            const service = await createService(new FakeDirectoryHandle('Berichte'));

            expect(service.unterstuetzt).toBe(true);
            expect(service.ordnerName()).toBe('Berichte');
        });

        it('merkt sich einen gewählten Ordner', async () =>
        {
            const service = await createService();

            expect(await service.ordnerWaehlen()).toBe(true);

            expect(service.ordnerName()).toBe('Neu');
            expect(store.set).toHaveBeenCalledWith(service.ordner());
        });

        it('behält den Ordner, wenn die Auswahl abgebrochen wird', async () =>
        {
            const service = await createService(new FakeDirectoryHandle('Berichte'));
            installDirectoryPicker(async () => { throw new DOMException('abgebrochen', 'AbortError'); });

            expect(await service.ordnerWaehlen()).toBe(false);

            expect(service.ordnerName()).toBe('Berichte');
            expect(store.set).not.toHaveBeenCalled();
        });

        it('entfernt den Ordner', async () =>
        {
            const service = await createService(new FakeDirectoryHandle('Berichte'));

            await service.ordnerEntfernen();

            expect(service.ordner()).toBeNull();
            expect(store.delete).toHaveBeenCalled();
        });

        it('bietet ohne Unterstützung des Browsers keinen Ordner an', async () =>
        {
            removeDirectoryPicker();
            const service = await createService(new FakeDirectoryHandle('Berichte'));

            expect(service.unterstuetzt).toBe(false);
            expect(service.ordner()).toBeNull();
            await expect(service.ordnerWaehlen()).rejects.toThrow('unterstützt keine Ordnerauswahl');
        });
    });

    describe('Speichern im Ordner', () =>
    {
        let ordner: FakeDirectoryHandle;

        beforeEach(() =>
        {
            installDirectoryPicker(async () => ordner);
            ordner = new FakeDirectoryHandle('Berichte');
        });

        it('legt Jahres- und Ereignisordner an und schreibt ein PDF pro Bericht', async () =>
        {
            const downloads = captureDownloads();
            const service = await createService(ordner);

            const ergebnis = await service.speichern(ereignis);

            const ziel = ordner.pfad(...ereignisOrdner)!;
            expect([...ordner.ordner.keys()]).toEqual(['2026']);
            expect([...ziel.dateien.keys()]).toEqual(alleDateien);
            for (const datei of ziel.dateien.values())
            {
                expect(datei.inhalt?.type).toBe('application/pdf');
                expect(await datei.inhalt?.text()).toMatch(/^%PDF-/);
            }
            expect(ergebnis).toEqual({ art: 'ordner', pfad: 'Berichte/2026/2026-007_Einsatz_Grossweikersdorf', dateien: alleDateien });
            expect(service.meldung(ergebnis!)).toBe('3 PDFs gespeichert in Berichte/2026/2026-007_Einsatz_Grossweikersdorf');
            expect(downloads).toEqual([]);
        });

        it('überschreibt vorhandene Dateien', async () =>
        {
            const ziel = await (await ordner.getDirectoryHandle('2026', { create: true })).getDirectoryHandle(ereignisOrdner[1], { create: true });
            ziel.dateien.set(alleDateien[0], new FakeFileHandle(alleDateien[0], new Blob(['alt'])));
            const service = await createService(ordner);

            await service.speichern(ereignis);
            await service.speichern(ereignis);

            const datei = ziel.dateien.get(alleDateien[0])!;
            expect(await datei.inhalt?.text()).toMatch(/^%PDF-/);
            expect(datei.schreibvorgaenge).toBe(2);
            expect(ziel.dateien.size).toBe(3);
        });

        it('speichert nur die ausgewählten Berichte', async () =>
        {
            const service = await createService(ordner);
            const [gesamt] = TestBed.inject(PdfService).alleBerichte(ereignis);

            const ergebnis = await service.speichern(ereignis, [gesamt]);

            expect(ergebnis?.dateien).toEqual(['2026-007_Gesamtbericht.pdf']);
            expect(service.meldung(ergebnis!)).toBe('1 PDF gespeichert in Berichte/2026/2026-007_Einsatz_Grossweikersdorf');
        });

        it('fragt eine fehlende Berechtigung an', async () =>
        {
            ordner.berechtigung = 'prompt';
            const service = await createService(ordner);

            const ergebnis = await service.speichern(ereignis);

            expect(ordner.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
            expect(ordner.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
            expect(ergebnis?.art).toBe('ordner');
            expect(ordner.pfad(...ereignisOrdner)?.dateien.size).toBe(3);
        });

        it('fragt eine erteilte Berechtigung nicht erneut an', async () =>
        {
            const service = await createService(ordner);

            await service.speichern(ereignis);

            expect(ordner.queryPermission).toHaveBeenCalled();
            expect(ordner.requestPermission).not.toHaveBeenCalled();
        });

        it('lädt ohne Berechtigung herunter und weist darauf hin', async () =>
        {
            const downloads = captureDownloads();
            ordner.berechtigung = 'prompt';
            ordner.anfrageErgebnis = 'denied';
            const service = await createService(ordner);

            const ergebnis = await service.speichern(ereignis);

            expect(ordner.ordner.size).toBe(0);
            expect(downloads).toEqual(alleDateien);
            expect(service.meldung(ergebnis!)).toBe('Keine Schreibberechtigung für den Ordner „Berichte“. 3 PDFs heruntergeladen');
        });

        it('speichert ohne Berechtigung gar nicht, wenn kein Download gewünscht ist', async () =>
        {
            const downloads = captureDownloads();
            ordner.berechtigung = 'denied';
            ordner.anfrageErgebnis = 'denied';
            const service = await createService(ordner);

            expect(await service.speichern(ereignis, undefined, { download: false })).toBeNull();
            expect(downloads).toEqual([]);
        });

        it('verwendet ein vorab ermitteltes Ziel ohne erneute Abfrage', async () =>
        {
            const service = await createService(ordner);
            const ziel = await service.zielErmitteln();
            ordner.queryPermission.mockClear();

            await service.speichern(ereignis, undefined, { ziel });

            expect(ordner.queryPermission).not.toHaveBeenCalled();
            expect(ordner.pfad(...ereignisOrdner)?.dateien.size).toBe(3);
        });

        it('legt PDFs aus der Testdatenbank in einem eigenen Unterordner ab', async () =>
        {
            localStorage.setItem('testMode', 'true');
            const service = await createService(ordner);

            const ergebnis = await service.speichern(ereignis);

            expect([...ordner.ordner.keys()]).toEqual(['Testmodus']);
            expect(ordner.pfad('Testmodus', ...ereignisOrdner)?.dateien.size).toBe(3);
            expect(ergebnis?.pfad).toBe('Berichte/Testmodus/2026/2026-007_Einsatz_Grossweikersdorf');
        });
    });

    describe('Download ohne Ordner', () =>
    {
        it('lädt die PDFs einzeln mit der Ereignisnummer im Namen herunter', async () =>
        {
            const downloads = captureDownloads();
            const service = await createService();

            const ergebnis = await service.speichern(ereignis);

            expect(downloads).toEqual(alleDateien);
            expect(ergebnis).toEqual({ art: 'download', pfad: '', dateien: alleDateien, hinweis: undefined });
            expect(service.meldung(ergebnis!)).toBe('3 PDFs heruntergeladen');
        });

        it('lädt auch ohne Unterstützung des Browsers herunter', async () =>
        {
            const downloads = captureDownloads();
            const service = await createService(new FakeDirectoryHandle('Berichte'));

            await service.speichern(ereignis);

            expect(service.unterstuetzt).toBe(false);
            expect(downloads).toEqual(alleDateien);
        });

        it('kennzeichnet Downloads aus der Testdatenbank', async () =>
        {
            localStorage.setItem('testMode', 'true');
            const downloads = captureDownloads();
            const service = await createService();

            await service.speichern(ereignis);

            expect(downloads).toEqual(alleDateien.map(name => `Testmodus_${name}`));
        });

        it('speichert nichts, wenn kein Download gewünscht ist', async () =>
        {
            const downloads = captureDownloads();
            const service = await createService();

            expect(await service.speichern(ereignis, undefined, { download: false })).toBeNull();
            expect(downloads).toEqual([]);
        });
    });
});

describe('OrdnerStore', () =>
{
    it('speichert den Ordner in einer eigenen Datenbank', async () =>
    {
        const store = TestBed.inject(OrdnerStore);
        const handle = { kind: 'directory', name: 'Berichte' } as unknown as FileSystemDirectoryHandle;

        expect(await store.get()).toBeUndefined();
        await store.set(handle);
        expect((await store.get())?.name).toBe('Berichte');

        const datenbanken = await indexedDB.databases();
        expect(datenbanken.map(db => db.name)).toContain('ffgfuea_dateiablage');

        await store.delete();
        expect(await store.get()).toBeUndefined();
    });
});
