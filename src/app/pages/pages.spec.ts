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

        expect(fixture.nativeElement.textContent).toContain('Neuen Einsatz oder neue Übung erstellen');
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

        await vi.waitFor(() => expect(fixture.nativeElement.textContent).toContain('Tulln'));
        expect(fixture.nativeElement.textContent).toContain('Barcode: 1234501');
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

        expect(fixture.nativeElement.textContent).toContain('Übung in Tulln');
    });

    it('Statistik-Seite zeigt die Jahre', async () =>
    {
        await data.saveEreignis(createEreignis({ datetimeStart: new Date(2024, 2, 1), datetimeEnd: new Date() }));

        const fixture = await render(StatisticsPageComponent);

        expect(fixture.nativeElement.textContent).toContain('2024');
    });

    it('Verwaltung zeigt Feuerwehren samt Flaschentabelle und Füllpersonal', async () =>
    {
        const fixture = await render(VerwaltungPageComponent);
        const element: HTMLElement = fixture.nativeElement;

        expect(element.textContent).toContain('12345 - FF 12345');
        expect(element.textContent).toContain('Max Muster');
        expect(element.querySelectorAll('tr[mat-row]').length).toBe(2);
    });

    it('Verwaltung fügt Füllpersonal hinzu und leert die Eingabe', async () =>
    {
        const fixture = await render(VerwaltungPageComponent);
        fixture.componentInstance.vorname.set('Anna');
        fixture.componentInstance.nachname.set('Huber');

        await fixture.componentInstance.addPerson();
        await fixture.whenStable();

        expect(fixture.nativeElement.textContent).toContain('Anna Huber');
        expect(fixture.componentInstance.vorname()).toBe('');
    });

    it('Einstellungen zeigen den Testmodus nur ohne laufendes Ereignis', async () =>
    {
        let fixture = await render(SettingsPageComponent);
        await vi.waitFor(() => expect(fixture.nativeElement.textContent).toContain('Test Modus'));
        fixture.destroy();

        await data.saveEreignis(createEreignis());
        fixture = await render(SettingsPageComponent);
        await new Promise(resolve => setTimeout(resolve, 50));
        await fixture.whenStable();
        expect(fixture.nativeElement.textContent).not.toContain('Test Modus');
    });
});
