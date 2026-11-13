import { readFile } from 'node:fs/promises';
import type { IBackup } from '../src/app/shared/services/backup/backup-format';
import {
    abschliessen, addPerson, barcode, ereignisNummer, expect, feuerwehrPanel, fuellen, gotoApp, navigate, personCard, seedFeuerwehr,
    JAHR, listOpfs, setConfirmFuellung, snackbar, startEreignis, stubDirectoryPicker, test
} from './fixtures';

test.describe('Einstellungen', () =>
{
    test('JSON-Export und Import in eine leere App (Zusammenführen)', async ({ page, browser }, testInfo) =>
    {
        // Daten anlegen und exportieren
        await gotoApp(page, '/verwaltung');
        await seedFeuerwehr(page, 12345);
        await addPerson(page, 'Max', 'Muster');
        await addPerson(page, 'Anna', 'Huber');
        const nummer = await startEreignis(page, { ort: 'Gemeinlebarn', personen: ['Max Muster'] });
        await setConfirmFuellung(page, false);
        await fuellen(page, barcode(12345, 1), false);
        await fuellen(page, barcode(12345, 2), false);
        await abschliessen(page);

        await navigate(page, 'Einstellungen');
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export herunterladen' }).click();
        const exportDatei = await download;
        expect(exportDatei.suggestedFilename()).toMatch(/^ffgfuea-export_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$/);

        const pfad = testInfo.outputPath(exportDatei.suggestedFilename());
        await exportDatei.saveAs(pfad);
        const backup = JSON.parse(await readFile(pfad, 'utf-8')) as IBackup;
        expect(backup).toMatchObject({ format: 'ffgfuea-export', version: 1, testMode: false });
        expect(backup.feuerwehren).toHaveLength(1);
        expect(backup.feuerwehren[0].flaschen).toHaveLength(12);
        expect(backup.personen).toHaveLength(2);
        expect(backup.ereignisse).toHaveLength(1);
        expect(backup.ereignisse[0].fuellungen).toHaveLength(2);

        // Neuer Browser-Kontext, also leere Datenbank, mit einer anderen Feuerwehr
        const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, locale: 'de-AT', viewport: { width: 1600, height: 1000 } });
        try
        {
            const neu = await context.newPage();
            // Sonst rendert die Seite im Hintergrund nicht zuverlässig (requestAnimationFrame wird gedrosselt)
            await neu.bringToFront();
            await gotoApp(neu, '/verwaltung');
            await seedFeuerwehr(neu, 23456);

            await navigate(neu, 'Einstellungen');
            const importKarte = neu.locator('mat-card').filter({ has: neu.getByRole('heading', { name: 'Import', exact: true }) });
            // Direkt am (versteckten) Datei-Input setzen, der Button öffnet nur dessen Dateiauswahl
            await expect(importKarte.getByRole('button', { name: 'Datei auswählen' })).toBeEnabled();
            // Inhalt statt Pfad übergeben: Der Ausgabeordner enthält Umlaute aus dem Testnamen,
            // mit solchen Pfaden setzt Playwright die Datei nicht
            await importKarte.locator('input[type="file"]').setInputFiles({
                name: exportDatei.suggestedFilename(),
                mimeType: 'application/json',
                buffer: await readFile(pfad)
            });

            const zusammenfassung = importKarte.locator('.summary');
            await expect(zusammenfassung).toContainText('1 Feuerwehren mit 12 Flaschen');
            await expect(zusammenfassung).toContainText('2 Personen');
            await expect(zusammenfassung).toContainText('1 Einsätze & Übungen mit 2 Füllungen');
            await expect(importKarte.getByRole('radio', { name: /^Zusammenführen/ })).toBeChecked();

            await importKarte.getByRole('button', { name: 'Import durchführen' }).click();
            await expect(snackbar(neu, 'Import abgeschlossen: 1 Ereignisse, 2 Personen und 1 Feuerwehren übernommen')).toBeVisible();
            await expect(zusammenfassung).toBeHidden();

            // Importierte und bereits vorhandene Daten
            await navigate(neu, 'Verwaltung');
            await expect(feuerwehrPanel(neu, 12345)).toBeVisible();
            await expect(feuerwehrPanel(neu, 23456)).toBeVisible();
            await expect(personCard(neu, 'Max Muster')).toBeVisible();
            await expect(personCard(neu, 'Anna Huber')).toBeVisible();

            await navigate(neu, 'Einsätze & Übungen');
            const ereignis = neu.locator('mat-expansion-panel').filter({ hasText: `${nummer}Übung in Gemeinlebarn` });
            await expect(ereignis).toBeVisible();
            await ereignis.locator('mat-expansion-panel-header').click();
            await expect(ereignis.locator('ffg-fuellung-item')).toHaveCount(2);

            // Ein neues Ereignis bekommt die nächste Nummer nach dem importierten
            expect(await startEreignis(neu, { ort: 'Tulln' })).toBe(ereignisNummer(2));
        }
        finally
        {
            await context.close();
        }
    });

    test('der Testmodus verwendet eine eigene Datenbank', async ({ page }) =>
    {
        await gotoApp(page, '/verwaltung');
        await addPerson(page, 'Max', 'Muster');

        await navigate(page, 'Einstellungen');
        const testmodus = page.getByRole('switch', { name: 'Testmodus' });
        await expect(testmodus).not.toBeChecked();
        // ngModel übernimmt den Startwert erst nach dem Rendern, daher klicken, bis der Schalter an ist
        await expect(async () =>
        {
            await testmodus.click();
            await expect(testmodus).toBeChecked({ timeout: 1000 });
        }).toPass();
        await page.getByRole('button', { name: 'Speichern' }).click();
        await expect(page.getByText('Der Testmodus ist aktiviert!')).toBeVisible();

        await navigate(page, 'Verwaltung');
        await expect(page.getByRole('heading', { name: 'Füllpersonal', exact: true })).toBeVisible();
        await expect(personCard(page, 'Max Muster')).toHaveCount(0);

        await page.getByRole('button', { name: 'Testmodus in den Einstellungen deaktivieren' }).click();
        await expect(async () =>
        {
            await testmodus.click();
            await expect(testmodus).not.toBeChecked({ timeout: 1000 });
        }).toPass();
        await page.getByRole('button', { name: 'Speichern' }).click();
        await expect(page.getByText('Der Testmodus ist aktiviert!')).toBeHidden();

        await navigate(page, 'Verwaltung');
        await expect(personCard(page, 'Max Muster')).toBeVisible();
    });

    test('Altberichte werden im Ordner abgelegt und vorhandene übersprungen', async ({ page }) =>
    {
        await stubDirectoryPicker(page);
        await gotoApp(page, '/verwaltung');
        await seedFeuerwehr(page, 12345);
        await seedFeuerwehr(page, 23456);
        const nummer = await startEreignis(page, { type: 'Einsatz', ort: 'Tulln' });
        await setConfirmFuellung(page, false);
        await fuellen(page, barcode(12345, 1), false);
        await fuellen(page, barcode(23456, 1), false);
        await abschliessen(page);

        await navigate(page, 'Einstellungen');
        const karte = page.locator('mat-card').filter({ has: page.getByRole('heading', { name: 'Altberichte (Übergangslösung)' }) });
        const starten = karte.getByRole('button', { name: 'Alte Berichte als PDF erzeugen und ablegen' });
        await expect(karte).toContainText('Bitte zuerst oben unter „PDF-Ablage“ einen Ordner auswählen.');
        await expect(starten).toBeDisabled();

        await page.getByRole('button', { name: 'Ordner auswählen' }).click();
        await expect(starten).toBeEnabled();

        await starten.click();
        await expect(snackbar(page, 'Altberichte: 3 PDFs erstellt, 0 übersprungen')).toBeVisible();
        const ergebnis = karte.locator('.ergebnis');
        await expect(ergebnis.locator('.erstellt')).toHaveText('3 PDFs erstellt');
        await expect(ergebnis.locator('.fehlgeschlagen')).toHaveText('0 fehlgeschlagen');

        const ordner = `Berichte/${JAHR}/${nummer}_Einsatz_Tulln`;
        expect(await listOpfs(page)).toEqual([
            `${ordner}/${nummer}_Feuerwehr_Feuerwehr_Nr._12345.pdf`,
            `${ordner}/${nummer}_Feuerwehr_Feuerwehr_Nr._23456.pdf`,
            `${ordner}/${nummer}_Gesamtbericht.pdf`
        ]);

        // Ein zweiter Durchlauf überschreibt nichts
        await starten.click();
        await expect(snackbar(page, 'Altberichte: 0 PDFs erstellt, 3 übersprungen')).toBeVisible();
        await expect(ergebnis.locator('.uebersprungen')).toHaveText('3 übersprungen (bereits vorhanden)');
    });
});
