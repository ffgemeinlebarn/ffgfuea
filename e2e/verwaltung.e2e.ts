import { addPerson, barcode, expect, feuerwehrPanel, gotoApp, personCard, seedFeuerwehr, snackbar, test } from './fixtures';

test.describe('Verwaltung', () =>
{
    test.beforeEach(async ({ page }) =>
    {
        await gotoApp(page, '/verwaltung');
    });

    test('fügt eine Feuerwehr über die Synchronisierung hinzu', async ({ page }) =>
    {
        const panel = await seedFeuerwehr(page, 12345);
        await panel.locator('mat-expansion-panel-header').click();

        const zeilen = panel.locator('tr[mat-row]');
        await expect(zeilen).toHaveCount(12);
        await expect(zeilen.first()).toContainText(barcode(12345, 1));
        await expect(zeilen.last()).toContainText(barcode(12345, 12));
        await expect(panel.locator('.quelle', { hasText: 'MAT' })).toHaveCount(12);
        // MAT Flaschen sind nicht bearbeitbar
        await expect(panel.getByRole('button', { name: 'Flasche bearbeiten' })).toHaveCount(0);
    });

    test('Füllpersonal hinzufügen, bearbeiten und löschen', async ({ page }) =>
    {
        await addPerson(page, 'Max', 'Muster');
        const anna = await addPerson(page, 'Anna', 'Huber');

        // Eingabefelder werden nach dem Hinzufügen geleert
        const neu = page.locator('mat-card').filter({ hasText: 'Füllpersonal hinzufügen' });
        await expect(neu.getByLabel('Vorname')).toHaveValue('');
        await expect(neu.getByLabel('Nachname')).toHaveValue('');

        await anna.getByRole('button', { name: 'Person bearbeiten' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Anna Huber' })).toBeVisible();
        await dialog.getByLabel('Nachname').fill('Maier');
        await dialog.getByRole('button', { name: 'Speichern' }).click();
        await expect(dialog).toBeHidden();
        await expect(personCard(page, 'Anna Maier')).toBeVisible();
        await expect(personCard(page, 'Anna Huber')).toHaveCount(0);

        await personCard(page, 'Max Muster').getByRole('button', { name: 'Löschen' }).click();
        await expect(personCard(page, 'Max Muster')).toHaveCount(0);
        await expect(personCard(page, 'Anna Maier')).toBeVisible();
    });

    test('manuelle Flasche hinzufügen, bearbeiten und löschen', async ({ page }) =>
    {
        const panel = await seedFeuerwehr(page, 12345);
        await panel.locator('mat-expansion-panel-header').click();

        // Hinzufügen, mit Prüfung auf doppelten Barcode
        await panel.getByRole('button', { name: 'Flasche hinzufügen' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Flasche hinzufügen' })).toBeVisible();

        await dialog.getByLabel('Barcode').fill(barcode(12345, 1));
        await dialog.getByRole('button', { name: 'Speichern' }).click();
        await expect(dialog.locator('mat-error')).toHaveText('Der Barcode ist bereits der Flasche Nr. 1 der Feuerwehr Feuerwehr Nr. 12345 zugeordnet.');
        await expect(dialog).toBeVisible();

        await dialog.getByLabel('Barcode').fill('12a45');
        await expect(dialog.locator('mat-error')).toHaveText('Der Barcode darf nur aus Ziffern bestehen.');

        await dialog.getByLabel('Barcode').fill('9900001');
        await expect(dialog.locator('mat-error')).toHaveCount(0);
        await dialog.getByLabel('Nr. (Kartei)').fill('99');
        await dialog.getByLabel('Flaschen Nr.').fill('M-17');
        await dialog.getByLabel('Typen Bezeichnung').fill('Composite 6,8 l / 300 bar');
        await dialog.getByRole('button', { name: 'Speichern' }).click();
        await expect(dialog).toBeHidden();
        await expect(snackbar(page, 'Flasche hinzugefügt')).toBeVisible();

        const header = panel.locator('mat-expansion-panel-header');
        await expect(header).toContainText('13 Flaschen, davon 1 manuell');

        // Herkunft: 12 aus MAT, 1 manuell
        const manuell = panel.locator('tr[mat-row]').filter({ hasText: '9900001' });
        await expect(manuell.locator('.quelle')).toHaveText('Manuell');
        await expect(manuell).toContainText('M-17');
        await expect(manuell).toContainText('Composite 6,8 l / 300 bar');
        await expect(panel.locator('.quelle', { hasText: 'MAT' })).toHaveCount(12);
        await expect(panel.getByRole('button', { name: 'Flasche bearbeiten' })).toHaveCount(1);

        // Bearbeiten: der eigene Barcode ist kein Duplikat, ein fremder schon
        await manuell.getByRole('button', { name: 'Flasche bearbeiten' }).click();
        await expect(dialog.getByRole('heading', { name: 'Flasche bearbeiten' })).toBeVisible();
        await expect(dialog.getByLabel('Barcode')).toHaveValue('9900001');
        await dialog.getByLabel('Barcode').fill(barcode(12345, 2));
        // Fehler erscheinen erst, wenn das Feld berührt wurde
        await dialog.getByLabel('Barcode').blur();
        await expect(dialog.locator('mat-error')).toContainText('bereits der Flasche Nr. 2');
        await dialog.getByLabel('Barcode').fill('9900001');
        await dialog.getByLabel('Flaschen Nr.').fill('M-18');
        await dialog.getByRole('button', { name: 'Speichern' }).click();
        await expect(dialog).toBeHidden();
        await expect(snackbar(page, 'Flasche gespeichert')).toBeVisible();
        await expect(manuell).toContainText('M-18');
        await expect(header).toContainText('13 Flaschen, davon 1 manuell');

        // Löschen mit Bestätigung, zuerst abbrechen
        await manuell.getByRole('button', { name: 'Flasche löschen' }).click();
        await expect(dialog).toContainText('Soll die Flasche mit dem Barcode 9900001 wirklich gelöscht werden?');
        await dialog.getByRole('button', { name: 'Abbrechen' }).click();
        await expect(dialog).toBeHidden();
        await expect(manuell).toBeVisible();

        await manuell.getByRole('button', { name: 'Flasche löschen' }).click();
        await dialog.getByRole('button', { name: 'Löschen' }).click();
        await expect(dialog).toBeHidden();
        await expect(snackbar(page, 'Flasche gelöscht')).toBeVisible();
        await expect(manuell).toHaveCount(0);
        await expect(header).toContainText('12 Flaschen');
        await expect(header).not.toContainText('manuell');
    });

    test('manuelle Flaschen bleiben bei der Synchronisierung erhalten', async ({ page }) =>
    {
        const panel = await seedFeuerwehr(page, 12345);
        await panel.locator('mat-expansion-panel-header').click();
        await panel.getByRole('button', { name: 'Flasche hinzufügen' }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Barcode').fill('9900001');
        await dialog.getByRole('button', { name: 'Speichern' }).click();
        await expect(dialog).toBeHidden();

        // Erneute Synchronisierung beim Laden der App
        await gotoApp(page, '/verwaltung');
        await expect(feuerwehrPanel(page, 12345).locator('mat-expansion-panel-header')).toContainText('13 Flaschen, davon 1 manuell');
    });
});
