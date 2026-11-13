import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeDirectoryHandle, installDirectoryPicker, removeDirectoryPicker } from 'src/app/testing/file-system';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { DatabaseService } from 'src/app/shared/services/database/database.service';
import { NotificationService } from 'src/app/shared/services/notification/notification.service';
import { OrdnerStore } from 'src/app/shared/services/pdf-ablage/ordner-store';
import { PdfAblageService } from 'src/app/shared/services/pdf-ablage/pdf-ablage.service';
import { AltberichteService } from '../altberichte.service';
import { AltberichteCardComponent } from './altberichte-card.component';

describe('AltberichteCardComponent', () =>
{
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
        vi.spyOn(TestBed.inject(NotificationService), 'show').mockImplementation(() => undefined);
    });

    afterEach(() =>
    {
        removeDirectoryPicker();
        vi.restoreAllMocks();
    });

    async function render(): Promise<ComponentFixture<AltberichteCardComponent>>
    {
        const fixture = TestBed.createComponent(AltberichteCardComponent);
        await TestBed.inject(PdfAblageService).geladen;
        await fixture.whenStable();
        return fixture;
    }

    const text = (fixture: ComponentFixture<unknown>): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
    const starten = (fixture: ComponentFixture<unknown>): HTMLButtonElement => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.starten')!;

    it('zeigt Titel, Erklärung und Schaltfläche', async () =>
    {
        gespeichert = ordner.asHandle();
        const fixture = await render();

        expect(text(fixture)).toContain('Altberichte (Übergangslösung)');
        expect(text(fixture)).toContain('Vorhandene Dateien werden nicht überschrieben');
        expect(starten(fixture).textContent).toContain('Alte Berichte als PDF erzeugen und ablegen');
        expect(starten(fixture).disabled).toBe(false);
        expect((fixture.nativeElement as HTMLElement).querySelector('.kein-ordner')).toBeNull();
    });

    it('weist ohne Ordner darauf hin, zuerst einen zu wählen', async () =>
    {
        const fixture = await render();

        expect((fixture.nativeElement as HTMLElement).querySelector('.kein-ordner')?.textContent).toContain('Bitte zuerst oben unter „PDF-Ablage“ einen Ordner auswählen');
        expect(starten(fixture).disabled).toBe(true);
    });

    it('zeigt Fortschritt und Abbrechen während der Erzeugung', async () =>
    {
        gespeichert = ordner.asHandle();
        const fixture = await render();
        const altberichte = TestBed.inject(AltberichteService);
        const abbrechen = vi.spyOn(altberichte, 'abbrechen');

        altberichte.laeuft.set(true);
        altberichte.fortschritt.set({ aktuell: 2, gesamt: 8, ereignis: '2026-002 Einsatz in Tulln' });
        await fixture.whenStable();

        expect((fixture.nativeElement as HTMLElement).querySelector('.fortschritt p')!.textContent).toContain('Ereignis 2 von 8: 2026-002 Einsatz in Tulln');
        expect((fixture.nativeElement as HTMLElement).querySelector('mat-progress-bar')!.getAttribute('aria-valuenow')).toBe('25');
        expect(starten(fixture).disabled).toBe(true);

        (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.abbrechen')!.click();
        expect(abbrechen).toHaveBeenCalled();
    });

    it('zeigt die Zusammenfassung samt Fehlern', async () =>
    {
        gespeichert = ordner.asHandle();
        const fixture = await render();

        TestBed.inject(AltberichteService).ergebnis.set({
            pfad: 'Berichte',
            ereignisse: 4,
            erstellt: 9,
            uebersprungen: 2,
            fehlgeschlagen: 1,
            fehler: [{ ereignis: '2026-003 Einsatz in Tulln', datei: '2026-003_Gesamtbericht.pdf', fehler: 'Datenträger voll' }],
            abgebrochen: true
        });
        await fixture.whenStable();

        const ergebnis = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.ergebnis')!;
        expect(ergebnis.textContent).toContain('Abgebrochen');
        expect(ergebnis.querySelector('.erstellt')?.textContent).toContain('9 PDFs erstellt');
        expect(ergebnis.querySelector('.uebersprungen')?.textContent).toContain('2 übersprungen');
        expect(ergebnis.querySelector('.fehlgeschlagen')?.textContent).toContain('1 fehlgeschlagen');
        expect(ergebnis.querySelector('.fehler')?.textContent).toContain('2026-003 Einsatz in Tulln – 2026-003_Gesamtbericht.pdf: Datenträger voll');
    });

    it('erzeugt die Berichte per Klick und bietet die Jahre zur Auswahl an', async () =>
    {
        const ff = createFeuerwehr(1, ['11111']);
        await TestBed.inject(DatabaseService).db.ereignisse.add(createEreignis({
            jahr: 2026,
            nummer: 1,
            datetimeEnd: new Date(2026, 4, 1, 12),
            fuellungen: [createFuellung(ff.flaschen[0])]
        }));
        gespeichert = ordner.asHandle();
        const fixture = await render();
        await vi.waitFor(() => expect(fixture.componentInstance.jahre()).toEqual([{ jahr: 2026, anzahl: 1 }]));

        starten(fixture).click();
        await vi.waitFor(() => expect(TestBed.inject(AltberichteService).ergebnis()).not.toBeNull());
        await fixture.whenStable();

        expect((fixture.nativeElement as HTMLElement).querySelector('.ergebnis')!.textContent).toContain('Fertig');
        expect((fixture.nativeElement as HTMLElement).querySelector('.erstellt')!.textContent).toContain('2 PDFs erstellt');
        expect(ordner.pfad('2026', '2026-001_Uebung_Gemeinlebarn')?.dateien.size).toBe(2);
    });
});
