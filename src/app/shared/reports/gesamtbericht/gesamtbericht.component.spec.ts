import { TestBed } from '@angular/core/testing';
import { IEreignis } from 'src/app/shared/interfaces/i-ereignis';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { GesamtberichtComponent } from './gesamtbericht.component';

describe('GesamtberichtComponent', () =>
{
    const ff1 = createFeuerwehr(1, ['11111', '11112']);
    const ff2 = createFeuerwehr(2, ['22221']);

    async function render(ereignis: IEreignis): Promise<HTMLElement>
    {
        const fixture = TestBed.createComponent(GesamtberichtComponent);
        fixture.componentRef.setInput('ereignis', ereignis);
        fixture.componentRef.setInput('gedruckt', new Date(2026, 4, 1, 18, 30));
        await fixture.whenStable();
        return fixture.nativeElement;
    }

    const texts = (element: Element, selector: string) =>
        [...element.querySelectorAll(selector)].map(e => e.textContent?.replace(/\s+/g, ' ').trim());

    it('zeigt pro Feuerwehr einen Block mit Füllungen, Summe und Unterschriftsfeld', async () =>
    {
        const element = await render(createEreignis({
            fuellungen: [createFuellung(ff2.flaschen[0]), createFuellung(ff1.flaschen[0]), createFuellung(ff1.flaschen[1])],
            personen: [{ vorname: 'Max', nachname: 'Muster' }]
        }));

        const bloecke = element.querySelectorAll('tbody.feuerwehr');
        expect(bloecke.length).toBe(2);
        expect(texts(element, '.feuerwehr-name')).toEqual(['FF 1', 'FF 2']);
        expect(bloecke[0].querySelectorAll('tr.fuellung').length).toBe(2);
        expect(bloecke[1].querySelectorAll('tr.fuellung').length).toBe(1);
        expect(texts(element, 'tbody.feuerwehr .summe')).toEqual(['Summe FF 1: 2 Füllungen', 'Summe FF 2: 1 Füllung']);
        expect(texts(element, 'tbody.feuerwehr ffg-unterschrift .label'))
            .toEqual(['Übernommen von Feuerwehr FF 1', 'Übernommen von Feuerwehr FF 2']);
        expect(texts(bloecke[0], 'ffg-unterschrift .feld')).toEqual(['Name', 'Unterschrift', 'Datum']);
    });

    it('zeigt Kopf, Gesamtsumme und das Unterschriftsfeld des Füllpersonals', async () =>
    {
        const element = await render(createEreignis({
            fuellungen: [createFuellung(ff1.flaschen[0]), createFuellung(ff2.flaschen[0])],
            personen: [{ vorname: 'Max', nachname: 'Muster' }]
        }));

        const kopf = element.querySelector('ffg-report-header')?.textContent;
        expect(kopf).toContain('Gesamtbericht');
        expect(kopf).toContain('Gemeinlebarn');
        expect(kopf).toContain('01.05.2026 10:00 Uhr');
        expect(kopf).toContain('noch nicht beendet');
        expect(kopf).toContain('Max Muster');
        expect(kopf).toContain('01.05.2026 18:30 Uhr');

        expect(texts(element, '.summen tfoot .gesamt td')).toEqual(['Gesamt (2 Feuerwehren)', '2']);
        expect(texts(element, '.abschluss > ffg-unterschrift .label')).toEqual(['Füllpersonal']);
    });

    it('weist auf fehlende Füllungen hin', async () =>
    {
        const element = await render(createEreignis());

        expect(element.querySelectorAll('tbody.feuerwehr').length).toBe(0);
        expect(element.querySelector('.leer')?.textContent).toContain('Keine Füllungen erfasst');
        expect(texts(element, '.summen tfoot .gesamt td')).toEqual(['Gesamt (0 Feuerwehren)', '0']);
    });
});
