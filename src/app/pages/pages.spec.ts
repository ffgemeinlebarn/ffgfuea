import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { DataService } from '../shared/services/data/data.service';
import { SyncApi } from '../shared/services/sync-api/sync-api';
import { EreignissePageComponent } from './ereignisse-page/ereignisse-page.component';
import { OperatingPageComponent } from './operating-page/operating-page.component';
import { SettingsPageComponent } from './settings-page/settings-page.component';
import { StartPageComponent } from './start-page/start-page.component';
import { StatisticsPageComponent } from './statistics-page/statistics-page.component';
import { VerwaltungPageComponent } from './verwaltung-page/verwaltung-page.component';

describe('Seiten', () =>
{
    let data: DataService;
    let navigate: ReturnType<typeof vi.spyOn>;
    const feuerwehr = createFeuerwehr(12345, ['1234501', '1234502']);

    beforeEach(async () =>
    {
        TestBed.configureTestingModule({
            providers: [provideRouter([]), { provide: SyncApi, useValue: {} }]
        });
        navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        data = TestBed.inject(DataService);
        await data.saveFeuerwehr(feuerwehr);
        await data.savePerson({ vorname: 'Max', nachname: 'Muster' });
    });

    async function render<T>(component: new (...args: Array<unknown>) => T)
    {
        const fixture = TestBed.createComponent(component);
        await fixture.whenStable();
        await vi.waitFor(() => fixture.whenStable());
        return fixture;
    }

    it('Startseite bietet das Füllpersonal an', async () =>
    {
        const fixture = await render(StartPageComponent);

        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Neuen Einsatz oder neue Übung erstellen');
        expect(fixture.componentInstance.data.personen()[0].vorname).toBe('Max');
        expect(navigate).not.toHaveBeenCalled();
    });

    it('Startseite leitet bei offenem Ereignis weiter', async () =>
    {
        await data.saveEreignis(createEreignis());

        await render(StartPageComponent);

        await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(['operating']));
    });

    it('Operating-Seite zeigt das laufende Ereignis', async () =>
    {
        await data.saveEreignis(createEreignis({ ort: 'Tulln', fuellungen: [createFuellung(feuerwehr.flaschen[0])] }));

        const fixture = await render(OperatingPageComponent);

        await vi.waitFor(() => expect((fixture.nativeElement as HTMLElement).textContent).toContain('Tulln'));
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aktuelle Übung 2026-001');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Barcode: 1234501');
    });

    it('Operating-Seite leitet ohne offenes Ereignis zur Startseite', async () =>
    {
        await render(OperatingPageComponent);

        await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(['/']));
    });

    it('Ereignisse-Seite listet die Ereignisse', async () =>
    {
        await data.saveEreignis(createEreignis({ ort: 'Tulln', datetimeEnd: new Date() }));

        const fixture = await render(EreignissePageComponent);

        const titles = [...(fixture.nativeElement as HTMLElement).querySelectorAll('mat-panel-title')].map((title: Element) => title.textContent.trim());
        expect(titles).toEqual(['2026-001Übung in Tulln']);
        expect((fixture.nativeElement as HTMLElement).querySelector('.ereignis-nummer')!.textContent).toBe('2026-001');
    });

    it('Statistik-Seite zeigt die Jahre', async () =>
    {
        await data.saveEreignis(createEreignis({ datetimeStart: new Date(2024, 2, 1), datetimeEnd: new Date() }));

        const fixture = await render(StatisticsPageComponent);

        expect((fixture.nativeElement as HTMLElement).textContent).toContain('2024');
    });

    it('Verwaltung zeigt Feuerwehren samt Flaschentabelle und Füllpersonal', async () =>
    {
        const fixture = await render(VerwaltungPageComponent);
        const element = fixture.nativeElement as HTMLElement;

        expect(element.textContent).toContain('12345 - FF 12345');
        expect(element.textContent).toContain('Max Muster');
        expect(element.querySelectorAll('tr[mat-row]').length).toBe(2);
    });

    it('Verwaltung zeigt die Quelle der Flaschen und bietet nur manuelle Flaschen zur Bearbeitung an', async () =>
    {
        await data.saveFeuerwehr(createFeuerwehr(2, ['2000001'], ['2000002']));

        const fixture = await render(VerwaltungPageComponent);
        const element = fixture.nativeElement as HTMLElement;
        const zeilen = Array.from(element.querySelectorAll('tr[mat-row]'));
        const quellen = zeilen.map(zeile => zeile.querySelector('.quelle')?.textContent?.trim());
        const bearbeitbar = zeilen.map(zeile => zeile.querySelectorAll('.aktionen button').length);

        expect(quellen).toEqual(['MAT', 'Manuell', 'MAT', 'MAT']);
        expect(bearbeitbar).toEqual([0, 2, 0, 0]);
        expect(element.textContent).toContain('2 Flaschen, davon 1 manuell');
        expect(element.textContent).toContain('Flasche hinzufügen');
    });

    it('Verwaltung fügt Füllpersonal hinzu und leert die Eingabe', async () =>
    {
        const fixture = await render(VerwaltungPageComponent);
        fixture.componentInstance.vorname.set('Anna');
        fixture.componentInstance.nachname.set('Huber');

        await fixture.componentInstance.addPerson();
        await fixture.whenStable();

        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Anna Huber');
        expect(fixture.componentInstance.vorname()).toBe('');
    });

    it('Einstellungen zeigen den Testmodus nur ohne laufendes Ereignis', async () =>
    {
        let fixture = await render(SettingsPageComponent);
        await vi.waitFor(() => expect((fixture.nativeElement as HTMLElement).textContent).toContain('Test Modus'));
        fixture.destroy();

        await data.saveEreignis(createEreignis());
        fixture = await render(SettingsPageComponent);
        await new Promise(resolve => setTimeout(resolve, 50));
        await fixture.whenStable();
        expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Test Modus');
    });

    it('Einstellungen zeigen die Zusammenfassung einer ausgewählten Importdatei', async () =>
    {
        const fixture = await render(SettingsPageComponent);
        const backup = {
            format: 'ffgfuea-export',
            version: 1,
            exportedAt: '2026-10-20T08:00:00.000Z',
            feuerwehren: [feuerwehr],
            personen: [],
            ereignisse: [createEreignis({ datetimeEnd: new Date(), fuellungen: [createFuellung(feuerwehr.flaschen[0])] })]
        };

        await fixture.componentInstance.selectFile(new File([JSON.stringify(backup)], 'sicherung.json'));
        await fixture.whenStable();

        expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 Feuerwehren mit 2 Flaschen');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 Einsätze & Übungen mit 1 Füllungen');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Import durchführen');
    });

    it('Einstellungen zeigen Probleme einer ungültigen Importdatei', async () =>
    {
        const fixture = await render(SettingsPageComponent);

        await fixture.componentInstance.selectFile(new File(['{}'], 'falsch.json'));
        await fixture.whenStable();

        expect((fixture.nativeElement as HTMLElement).textContent).toContain('falsch.json kann nicht importiert werden');
        expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Import durchführen');
    });
});
