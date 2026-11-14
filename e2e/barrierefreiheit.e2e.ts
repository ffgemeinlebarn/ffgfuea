import { addPerson, barcode, expect, expectBarrierefrei, fuellen, gotoApp, navigate, seedFeuerwehr, setConfirmFuellung, startEreignis, test, tile } from './fixtures';

/**
 * Barrierefreiheit (axe-core, WCAG A/AA) aller Seiten mit realistischen Daten und der wichtigsten Dialoge.
 * Bei einem Verstoß: Meldung und Anhang axe-<seite>.json im HTML-Bericht zeigen Regel, Elemente und Hilfe-Link.
 */
test.describe('Barrierefreiheit', () =>
{
    test('alle Seiten und der Berichte-Dialog ohne WCAG-Verstöße', async ({ page }, testInfo) =>
    {
        await gotoApp(page);
        await expectBarrierefrei(page, testInfo, 'Start (leer)');

        await navigate(page, 'Verwaltung');
        await seedFeuerwehr(page, 12345);
        await addPerson(page, 'Maria', 'Muster');
        await expectBarrierefrei(page, testInfo, 'Verwaltung');

        await startEreignis(page, { personen: ['Maria Muster'], ort: 'Gemeinlebarn' });
        await setConfirmFuellung(page, false);
        await fuellen(page, barcode(12345, 1), false);
        await expectBarrierefrei(page, testInfo, 'Füllbetrieb');

        await tile(page, 'Berichte').click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expectBarrierefrei(page, testInfo, 'Berichte-Dialog', 'mat-dialog-container');
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();

        await navigate(page, 'Einsätze & Übungen');
        await expectBarrierefrei(page, testInfo, 'Einsätze & Übungen');

        await navigate(page, 'Statistik');
        await expectBarrierefrei(page, testInfo, 'Statistik');

        await navigate(page, 'Einstellungen');
        await expectBarrierefrei(page, testInfo, 'Einstellungen');
    });
});
