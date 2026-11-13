import { TestBed } from '@angular/core/testing';
import { FakeDirectoryHandle, FakeFileHandle, installDirectoryPicker, removeDirectoryPicker } from 'src/app/testing/file-system';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { EreignisType } from '../shared/enums/ereignis-type';
import { IEreignis } from '../shared/interfaces/i-ereignis';
import { IFlasche } from '../shared/interfaces/i-flasche';
import { DatabaseService } from '../shared/services/database/database.service';
import { OrdnerStore } from '../shared/services/pdf-ablage/ordner-store';
import { AltberichteService } from './altberichte.service';

describe('AltberichteService', () =>
{
    const ff1 = createFeuerwehr(1, ['11111']);
    const ff2 = createFeuerwehr(2, ['22221']);
    const ende = (jahr: number) => new Date(jahr, 4, 1, 12, 0);

    function ereignis(jahr: number, nummer: number, overrides: Partial<IEreignis> = {}): IEreignis
    {
        return createEreignis({
            type: EreignisType.Einsatz,
            jahr,
            nummer,
            ort: 'Tulln',
            datetimeStart: new Date(jahr, 4, 1, 10, 0),
            datetimeEnd: ende(jahr),
            fuellungen: [createFuellung(ff1.flaschen[0]), createFuellung(ff2.flaschen[0])],
            ...overrides
        });
    }

    const pfad2026 = ['2026', '2026-001_Einsatz_Tulln'];
    const dateien2026 = ['2026-001_Gesamtbericht.pdf', '2026-001_Feuerwehr_FF_1.pdf', '2026-001_Feuerwehr_FF_2.pdf'];

    let gespeichert: FileSystemDirectoryHandle | undefined;
    let ordner: FakeDirectoryHandle;

    beforeEach(() =>
    {
        ordner = new FakeDirectoryHandle('Berichte');
        gespeichert = undefined;
        installDirectoryPicker(async () => ordner);
        TestBed.configureTestingModule({
            providers: [{ provide: OrdnerStore, useValue: { get: async () => gespeichert, set: vi.fn(), delete: vi.fn() } }]
        });
    });

    afterEach(() =>
    {
        removeDirectoryPicker();
        vi.restoreAllMocks();
    });

    async function speichern(...ereignisse: Array<IEreignis>): Promise<void>
    {
        await TestBed.inject(DatabaseService).db.ereignisse.bulkAdd(ereignisse);
    }

    function service(): AltberichteService
    {
        return TestBed.inject(AltberichteService);
    }

    it('legt für jedes abgeschlossene Ereignis Gesamtbericht und Feuerwehrberichte ab', async () =>
    {
        await speichern(ereignis(2026, 1), ereignis(2025, 3, { type: EreignisType.Uebung, ort: 'Groß Schweinbarth', fuellungen: [createFuellung(ff2.flaschen[0])] }));

        const ergebnis = await service().erzeugen(ordner.asHandle());

        expect(ergebnis).toEqual({ pfad: 'Berichte', ereignisse: 2, erstellt: 5, uebersprungen: 0, fehlgeschlagen: 0, fehler: [], abgebrochen: false });
        expect([...ordner.pfad(...pfad2026)!.dateien.keys()]).toEqual(dateien2026);
        expect([...ordner.pfad('2025', '2025-003_Uebung_Gross_Schweinbarth')!.dateien.keys()])
            .toEqual(['2025-003_Gesamtbericht.pdf', '2025-003_Feuerwehr_FF_2.pdf']);
        const pdf = ordner.pfad(...pfad2026)!.dateien.get(dateien2026[0])!.inhalt!;
        expect(pdf.type).toBe('application/pdf');
        expect(await pdf.text()).toMatch(/^%PDF-/);
        expect(service().ergebnis()).toEqual(ergebnis);
        expect(service().laeuft()).toBe(false);
    });

    it('lässt laufende Ereignisse aus', async () =>
    {
        await speichern(ereignis(2026, 1), ereignis(2026, 2, { datetimeEnd: null }));

        const ergebnis = await service().erzeugen(ordner.asHandle());

        expect(ergebnis.ereignisse).toBe(1);
        expect([...ordner.pfad('2026')!.ordner.keys()]).toEqual(['2026-001_Einsatz_Tulln']);
    });

    it('überschreibt vorhandene Dateien nicht, sondern überspringt sie', async () =>
    {
        await speichern(ereignis(2026, 1));
        const ziel = await (await ordner.getDirectoryHandle('2026', { create: true })).getDirectoryHandle(pfad2026[1], { create: true });
        const vorhanden = new FakeFileHandle(dateien2026[0], new Blob(['neuer Bericht']));
        ziel.dateien.set(dateien2026[0], vorhanden);

        const ergebnis = await service().erzeugen(ordner.asHandle());

        expect(ergebnis).toMatchObject({ erstellt: 2, uebersprungen: 1, fehlgeschlagen: 0 });
        expect(await vorhanden.inhalt?.text()).toBe('neuer Bericht');
        expect(vorhanden.schreibvorgaenge).toBe(0);

        // Ein zweiter Durchlauf überspringt alles
        expect(await service().erzeugen(ordner.asHandle())).toMatchObject({ erstellt: 0, uebersprungen: 3 });
    });

    it('erzeugt auf Wunsch nur die Ereignisse eines Jahres', async () =>
    {
        await speichern(ereignis(2026, 1), ereignis(2025, 1));

        const ergebnis = await service().erzeugen(ordner.asHandle(), 2025);

        expect(ergebnis.ereignisse).toBe(1);
        expect([...ordner.ordner.keys()]).toEqual(['2025']);
    });

    it('liefert die Jahre der abgeschlossenen Ereignisse', async () =>
    {
        await speichern(ereignis(2025, 1), ereignis(2026, 1), ereignis(2026, 2), ereignis(2024, 1, { datetimeEnd: null }));

        expect(await service().jahre()).toEqual([{ jahr: 2026, anzahl: 2 }, { jahr: 2025, anzahl: 1 }]);
    });

    it('legt im Testmodus im Unterordner Testmodus ab', async () =>
    {
        localStorage.setItem('testMode', 'true');
        await speichern(ereignis(2026, 1));

        const ergebnis = await service().erzeugen(ordner.asHandle());

        expect(ergebnis.pfad).toBe('Berichte/Testmodus');
        expect([...ordner.ordner.keys()]).toEqual(['Testmodus']);
        expect(ordner.pfad('Testmodus', ...pfad2026)?.dateien.size).toBe(3);
    });

    it('bricht nach dem aktuellen Bericht ab', async () =>
    {
        await speichern(ereignis(2026, 1), ereignis(2026, 2), ereignis(2026, 3));
        const altberichte = service();
        const fortschritte: Array<number> = [];
        const set = altberichte.fortschritt.set.bind(altberichte.fortschritt);
        vi.spyOn(altberichte.fortschritt, 'set').mockImplementation(fortschritt =>
        {
            set(fortschritt);
            if (fortschritt) fortschritte.push(fortschritt.aktuell);
            // Abbrechen, sobald das zweite Ereignis beginnt
            if (fortschritt?.aktuell === 2) altberichte.abbrechen();
        });

        const ergebnis = await altberichte.erzeugen(ordner.asHandle());

        expect(ergebnis).toMatchObject({ ereignisse: 3, erstellt: 3, abgebrochen: true });
        expect(Math.max(...fortschritte)).toBe(2);
        expect([...ordner.pfad('2026')!.ordner.keys()]).toEqual(['2026-001_Einsatz_Tulln']);
        expect(altberichte.laeuft()).toBe(false);
        expect(altberichte.fortschritt()).toBeNull();
    });

    it('sammelt Fehler und macht mit den übrigen Berichten weiter', async () =>
    {
        const kaputt = { feuerwehr: undefined } as unknown as IFlasche;
        await speichern(ereignis(2026, 1), ereignis(2026, 2, { fuellungen: [createFuellung(kaputt)] }), ereignis(2026, 3));
        const original = FakeDirectoryHandle.prototype.getFileHandle;
        vi.spyOn(FakeDirectoryHandle.prototype, 'getFileHandle').mockImplementation(async function (this: FakeDirectoryHandle, name, options)
        {
            if (options?.create && name === '2026-003_Feuerwehr_FF_1.pdf') throw new DOMException('Datenträger voll', 'QuotaExceededError');
            return original.call(this, name, options);
        });

        const ergebnis = await service().erzeugen(ordner.asHandle());

        expect(ergebnis).toMatchObject({ ereignisse: 3, erstellt: 5, uebersprungen: 0, fehlgeschlagen: 2, abgebrochen: false });
        expect(ergebnis.fehler).toEqual([
            { ereignis: '2026-002 Einsatz in Tulln', fehler: expect.any(String) },
            { ereignis: '2026-003 Einsatz in Tulln', datei: '2026-003_Feuerwehr_FF_1.pdf', fehler: 'QuotaExceededError: Datenträger voll' }
        ]);
        expect([...ordner.pfad('2026', '2026-003_Einsatz_Tulln')!.dateien.keys()])
            .toEqual(['2026-003_Gesamtbericht.pdf', '2026-003_Feuerwehr_FF_2.pdf']);
    });

    describe('Start aus den Einstellungen', () =>
    {
        it('verlangt einen gewählten Ordner und lädt nichts herunter', async () =>
        {
            await speichern(ereignis(2026, 1));
            const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
            const altberichte = service();

            expect(await altberichte.starten()).toBeNull();

            expect(altberichte.hinweis()).toContain('zuerst unter „PDF-Ablage“ einen Ordner auswählen');
            expect(click).not.toHaveBeenCalled();
            expect(altberichte.ergebnis()).toBeNull();
        });

        it('fragt die Berechtigung an, bevor die Berichte erzeugt werden', async () =>
        {
            await speichern(ereignis(2026, 1));
            ordner.berechtigung = 'prompt';
            gespeichert = ordner.asHandle();
            const altberichte = service();
            const erzeugen = vi.spyOn(altberichte, 'erzeugen');

            const ergebnis = await altberichte.starten(2026);

            expect(ordner.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
            expect(ordner.requestPermission.mock.invocationCallOrder[0]).toBeLessThan(erzeugen.mock.invocationCallOrder[0]);
            expect(ergebnis?.erstellt).toBe(3);
        });

        it('erzeugt ohne Berechtigung nichts', async () =>
        {
            await speichern(ereignis(2026, 1));
            ordner.berechtigung = 'prompt';
            ordner.anfrageErgebnis = 'denied';
            gespeichert = ordner.asHandle();
            const altberichte = service();

            expect(await altberichte.starten()).toBeNull();

            expect(altberichte.hinweis()).toBe('Keine Schreibberechtigung für den Ordner „Berichte“');
            expect(ordner.ordner.size).toBe(0);
        });
    });
});
