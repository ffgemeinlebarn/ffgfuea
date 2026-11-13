import {
    abschliessen, addPerson, barcode, counter, ereignisNummer, expect, fuellen, fuellungen, gotoApp, navigate, reloadApp, scan,
    seedFeuerwehr, setConfirmFuellung, snackbar, startEreignis, test, tile
} from './fixtures';

test.describe('Füllen', () =>
{
    test.beforeEach(async ({ page }) =>
    {
        await gotoApp(page, '/verwaltung');
        await seedFeuerwehr(page, 12345);
        await seedFeuerwehr(page, 23456);
        await addPerson(page, 'Max', 'Muster');
        await addPerson(page, 'Anna', 'Huber');
    });

    test('Übung erstellen, Flaschen scannen und Füllung entfernen', async ({ page }) =>
    {
        const nummer = await startEreignis(page, { ort: 'Gemeinlebarn', personen: ['Max Muster', 'Anna Huber'] });
        expect(nummer).toBe(ereignisNummer(1));

        const info = tile(page, 'Aktuelle Übung');
        await expect(info).toContainText(`Aktuelle Übung ${nummer}`);
        await expect(info).toContainText('Ort: Gemeinlebarn');
        await expect(info).toContainText('Max Muster');
        await expect(info).toContainText('Anna Huber');

        const gesamt = counter(page, 'Gesamtanzahl der gefüllten Flaschen');
        const feuerwehren = counter(page, 'Feuerwehren');
        await expect(gesamt).toHaveText('0');
        await expect(feuerwehren).toHaveText('0');
        await expect(tile(page, 'Barcodescanner-Eingabe ist')).toContainText('aktiviert');

        // Mit Eingabebestätigung (Standard)
        await setConfirmFuellung(page, true);
        await fuellen(page, barcode(12345, 1), true);
        await expect(gesamt).toHaveText('1');
        await expect(feuerwehren).toHaveText('1');

        // Im Bestätigungsdialog verworfen
        await scan(page, barcode(12345, 2));
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText('Feuerwehr Feuerwehr Nr. 12345');
        await dialog.getByRole('button', { name: 'nicht hinzufügen' }).click();
        await expect(dialog).toBeHidden();
        await expect(fuellungen(page)).toHaveCount(1);
        await expect(gesamt).toHaveText('1');

        // Unbekannter Barcode
        await scan(page, '99999');
        await expect(snackbar(page, 'Keine Flasche für den Barcode 99999 gefunden!')).toBeVisible();
        await expect(dialog).toBeHidden();
        await expect(gesamt).toHaveText('1');

        // Ohne Eingabebestätigung
        await setConfirmFuellung(page, false);
        await fuellen(page, barcode(12345, 2), false);
        await fuellen(page, barcode(23456, 1), false);
        await expect(dialog).toBeHidden();
        await expect(gesamt).toHaveText('3');
        await expect(feuerwehren).toHaveText('2');

        // Neueste Füllung zuerst
        await expect(fuellungen(page)).toHaveCount(3);
        await expect(fuellungen(page).nth(0)).toContainText('Feuerwehr Nr. 23456 - Nr. 1');
        await expect(fuellungen(page).nth(2)).toContainText(`Barcode: ${barcode(12345, 1)}`);

        // Füllung entfernen, zuerst abbrechen
        await fuellungen(page).first().click();
        await expect(dialog.getByRole('heading', { name: 'Füllung entfernen' })).toBeVisible();
        await dialog.getByRole('button', { name: 'Zurück' }).click();
        await expect(dialog).toBeHidden();
        await expect(fuellungen(page)).toHaveCount(3);

        await fuellungen(page).first().click();
        await dialog.getByRole('button', { name: 'Füllung löschen' }).click();
        await expect(dialog).toBeHidden();
        await expect(snackbar(page, 'Füllung entfernt!')).toBeVisible();
        await expect(fuellungen(page)).toHaveCount(2);
        await expect(gesamt).toHaveText('2');
        await expect(feuerwehren).toHaveText('1');
    });

    test('Abschließen, Ereignisliste und fortlaufende Ereignisnummer', async ({ page }) =>
    {
        const erste = await startEreignis(page, { ort: 'Gemeinlebarn', personen: ['Max Muster'] });
        await setConfirmFuellung(page, false);
        await fuellen(page, barcode(12345, 1), false);
        await fuellen(page, barcode(12345, 2), false);
        await fuellen(page, barcode(23456, 3), false);

        // Abschließen zuerst abbrechen
        await tile(page, 'Abschließen').click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Ereignis abschließen' })).toBeVisible();
        await dialog.getByRole('button', { name: 'Zurück' }).click();
        await expect(dialog).toBeHidden();
        await expect(page).toHaveURL(/\/operating$/);

        await abschliessen(page);
        await expect(page).toHaveURL(/\/$/);

        // Ein zweites Ereignis bekommt die nächste Nummer
        const zweite = await startEreignis(page, { type: 'Einsatz', ort: 'Tulln', personen: ['Anna Huber'] });
        expect(erste).toBe(ereignisNummer(1));
        expect(zweite).toBe(ereignisNummer(2));
        await expect(tile(page, 'Aktueller Einsatz')).toContainText(`Aktueller Einsatz ${zweite}`);
        await setConfirmFuellung(page, false);
        await fuellen(page, barcode(23456, 4), false);

        await navigate(page, 'Einsätze & Übungen');
        await expect(page.getByRole('heading', { name: 'Ereignisse' })).toBeVisible();

        const panels = page.locator('mat-expansion-panel');
        await expect(panels).toHaveCount(2);
        const uebung = panels.filter({ hasText: `${erste}Übung in Gemeinlebarn` });
        const einsatz = panels.filter({ hasText: `${zweite}Einsatz in Tulln` });
        await expect(uebung).toBeVisible();
        await expect(einsatz).toBeVisible();

        await uebung.locator('mat-expansion-panel-header').click();
        const daten = uebung.locator('table');
        await expect(daten.getByRole('row', { name: /Nummer:/ })).toContainText(erste);
        await expect(daten.getByRole('row', { name: /Anzahl der Füllungen:/ })).toContainText('3');
        await expect(daten.getByRole('row', { name: /Füllersonal:/ })).toContainText('Max Muster');
        await expect(daten.getByRole('row', { name: /Ende:/ })).toContainText(' Uhr');
        await expect(uebung.locator('ffg-fuellung-item')).toHaveCount(3);
        await expect(uebung.locator('ffg-fuellung-item').last()).toContainText(`Barcode: ${barcode(12345, 1)}`);

        await einsatz.locator('mat-expansion-panel-header').click();
        await expect(einsatz.locator('table').getByRole('row', { name: /Ende:/ })).toContainText('noch nicht beendet');
        await expect(einsatz.locator('ffg-fuellung-item')).toHaveCount(1);
    });

    test('das laufende Ereignis bleibt nach dem Neuladen erhalten', async ({ page }) =>
    {
        const nummer = await startEreignis(page, { ort: 'Gemeinlebarn', personen: ['Max Muster'] });
        await setConfirmFuellung(page, false);
        await fuellen(page, barcode(12345, 1), false);
        await fuellen(page, barcode(23456, 1), false);

        await reloadApp(page);
        await expect(page).toHaveURL(/\/operating$/);
        await expect(tile(page, 'Aktuelle Übung')).toContainText(`Aktuelle Übung ${nummer}`);
        await expect(counter(page, 'Gesamtanzahl der gefüllten Flaschen')).toHaveText('2');
        await expect(fuellungen(page)).toHaveCount(2);

        // Die Startseite leitet zum laufenden Ereignis weiter
        await gotoApp(page, '/');
        await expect(page).toHaveURL(/\/operating$/);
        await expect(tile(page, 'Aktuelle Übung')).toContainText(nummer);

        // Nach dem Neuladen wird weiter gescannt
        await setConfirmFuellung(page, false);
        await fuellen(page, barcode(12345, 2), false);
        await expect(counter(page, 'Gesamtanzahl der gefüllten Flaschen')).toHaveText('3');
    });
});
