import { readFile } from 'node:fs/promises';
import { Download, Locator, Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import {
    abschliessen, addPerson, barcode, expect, fuellen, gotoApp, JAHR, listOpfs, navigate, seedFeuerwehr, setConfirmFuellung,
    snackbar, startEreignis, stubDirectoryPicker, stubPrint, test, tile
} from './fixtures';

/** Ereignis mit Füllungen von zwei Feuerwehren im Füllbetrieb */
async function ereignisMitFuellungen(page: Page): Promise<string>
{
    await gotoApp(page, '/verwaltung');
    await seedFeuerwehr(page, 12345);
    await seedFeuerwehr(page, 23456);
    await addPerson(page, 'Max', 'Muster');

    const nummer = await startEreignis(page, { ort: 'Gemeinlebarn', personen: ['Max Muster'] });
    await setConfirmFuellung(page, false);
    await fuellen(page, barcode(12345, 1), false);
    await fuellen(page, barcode(12345, 2), false);
    await fuellen(page, barcode(23456, 1), false);
    return nummer;
}

/** Öffnet die Berichte eines Ereignisses unter "Einsätze & Übungen", nur dort gibt es "Als PDF speichern" */
async function berichteAusListe(page: Page, nummer: string): Promise<Locator>
{
    await navigate(page, 'Einsätze & Übungen');
    const panel = page.locator('mat-expansion-panel').filter({ hasText: nummer });
    await panel.locator('mat-expansion-panel-header').click();
    await panel.getByRole('button', { name: 'Berichte' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Berichte' })).toBeVisible();
    return dialog;
}

async function seiten(download: Download): Promise<Array<{ breite: number; hoehe: number }>>
{
    const pfad = await download.path();
    const pdf = await PDFDocument.load(await readFile(pfad));
    return pdf.getPages().map(seite => ({ breite: seite.getWidth(), hoehe: seite.getHeight() }));
}

test.describe('Berichte', () =>
{
    test.beforeEach(async ({ page }) =>
    {
        await stubPrint(page);
    });

    test('Auswahl und Schnellauswahl', async ({ page }) =>
    {
        const nummer = await ereignisMitFuellungen(page);
        await tile(page, 'Berichte').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Berichte' })).toBeVisible();
        await expect(dialog.locator('.ereignis')).toContainText(nummer);
        await expect(dialog.locator('.ereignis')).toContainText('Gemeinlebarn');

        // Im Füllbetrieb nur Schließen und Drucken, der Hinweis erwähnt keinen Download
        await expect(dialog.getByRole('button', { name: 'Als PDF speichern' })).toHaveCount(0);
        await expect(dialog.locator('.ablage')).toContainText('Kein Ablageordner gewählt');
        await expect(dialog.locator('.ablage')).toContainText('Einstellungen → PDF-Ablage');
        await expect(dialog.locator('.ablage')).not.toContainText('herunter');

        const anzahl = dialog.locator('.anzahl');
        const gesamtbericht = dialog.getByRole('checkbox', { name: /Gesamtbericht/ });
        const fw1 = dialog.getByRole('checkbox', { name: /Feuerwehr Nr\. 12345/ });
        const fw2 = dialog.getByRole('checkbox', { name: /Feuerwehr Nr\. 23456/ });
        const alle = dialog.getByRole('checkbox', { name: 'Alle' });

        await expect(anzahl).toHaveText('3 von 3 ausgewählt');
        await expect(fw1).toBeChecked();
        await expect(dialog.locator('li.gesamt')).toContainText('Querformat');
        await expect(dialog.locator('li.feuerwehr').first()).toContainText('Hochformat');
        await expect(dialog.locator('li.feuerwehr', { hasText: '12345' })).toContainText('2 Füllungen');

        const schnellauswahl = async (eintrag: string) =>
        {
            await dialog.getByRole('button', { name: 'Schnellauswahl' }).click();
            await page.getByRole('menuitem', { name: eintrag }).click();
        };

        await schnellauswahl('Nur Gesamtbericht');
        await expect(anzahl).toHaveText('1 von 3 ausgewählt');
        await expect(gesamtbericht).toBeChecked();
        await expect(fw1).not.toBeChecked();
        await expect(fw2).not.toBeChecked();

        await schnellauswahl('Alle Feuerwehrberichte');
        await expect(anzahl).toHaveText('2 von 3 ausgewählt');
        await expect(gesamtbericht).not.toBeChecked();
        await expect(fw1).toBeChecked();
        await expect(fw2).toBeChecked();

        // Einzelne Auswahl
        await fw2.uncheck();
        await expect(anzahl).toHaveText('1 von 3 ausgewählt');

        // "Alle" ab- und anwählen, ohne Auswahl ist Drucken gesperrt
        await alle.check();
        await expect(anzahl).toHaveText('3 von 3 ausgewählt');
        await alle.uncheck();
        await expect(anzahl).toHaveText('0 von 3 ausgewählt');
        await expect(dialog.getByRole('button', { name: 'Drucken' })).toBeDisabled();

        await schnellauswahl('Alle Berichte');
        await expect(anzahl).toHaveText('3 von 3 ausgewählt');
        await expect(dialog.getByRole('button', { name: 'Drucken' })).toBeEnabled();

        await dialog.getByRole('button', { name: 'Schließen' }).click();
        await expect(dialog).toBeHidden();
    });

    test('Als PDF speichern lädt die PDFs ohne Ordner herunter', async ({ page }) =>
    {
        const nummer = await ereignisMitFuellungen(page);
        const dialog = await berichteAusListe(page, nummer);
        await expect(dialog.locator('.ablage')).toContainText('Kein Ablageordner gewählt');
        await expect(dialog.locator('.ablage')).toContainText('Als PDF speichern lädt die PDFs herunter');

        const downloads: Array<Download> = [];
        page.on('download', download => downloads.push(download));
        await dialog.getByRole('button', { name: 'Als PDF speichern' }).click();

        await expect(snackbar(page, '3 PDFs heruntergeladen')).toBeVisible();
        await expect.poll(() => downloads.length).toBe(3);
        expect(downloads.map(download => download.suggestedFilename()).sort()).toEqual([
            `${nummer}_Feuerwehr_Feuerwehr_Nr._12345.pdf`,
            `${nummer}_Feuerwehr_Feuerwehr_Nr._23456.pdf`,
            `${nummer}_Gesamtbericht.pdf`
        ]);

        const gesamtbericht = downloads.find(download => download.suggestedFilename().endsWith('_Gesamtbericht.pdf'))!;
        const gesamtSeiten = await seiten(gesamtbericht);
        expect(gesamtSeiten).toHaveLength(1);
        // A4 quer
        expect(gesamtSeiten[0].breite).toBeGreaterThan(gesamtSeiten[0].hoehe);

        const feuerwehrbericht = downloads.find(download => download.suggestedFilename().endsWith('_12345.pdf'))!;
        const feuerwehrSeiten = await seiten(feuerwehrbericht);
        expect(feuerwehrSeiten).toHaveLength(1);
        // A4 hoch
        expect(feuerwehrSeiten[0].hoehe).toBeGreaterThan(feuerwehrSeiten[0].breite);
    });

    test('nur den Gesamtbericht als PDF speichern', async ({ page }) =>
    {
        const nummer = await ereignisMitFuellungen(page);
        const dialog = await berichteAusListe(page, nummer);
        await dialog.getByRole('checkbox', { name: 'Alle' }).uncheck();
        await expect(dialog.getByRole('button', { name: 'Als PDF speichern' })).toBeDisabled();
        await dialog.getByRole('button', { name: 'Schnellauswahl' }).click();
        await page.getByRole('menuitem', { name: 'Nur Gesamtbericht' }).click();

        const download = page.waitForEvent('download');
        await dialog.getByRole('button', { name: 'Als PDF speichern' }).click();
        expect((await download).suggestedFilename()).toBe(`${nummer}_Gesamtbericht.pdf`);
        await expect(snackbar(page, '1 PDF heruntergeladen')).toBeVisible();
    });

    test('Abschließen & Drucken legt alle PDFs im gewählten Ordner ab', async ({ page }) =>
    {
        // Ordnerauswahl durch einen Ordner "Berichte" im Origin Private File System ersetzen
        await stubDirectoryPicker(page);
        await gotoApp(page, '/settings');

        const ablage = page.locator('mat-card').filter({ has: page.getByRole('heading', { name: 'PDF-Ablage', exact: true }) });
        await expect(ablage).toContainText('keiner ausgewählt');
        await ablage.getByRole('button', { name: 'Ordner auswählen' }).click();
        await expect(snackbar(page, 'PDFs werden im Ordner „Berichte“ abgelegt')).toBeVisible();
        await expect(ablage.locator('.ordner')).toContainText('Ordner: Berichte');
        await expect(ablage.getByRole('switch', { name: 'Beim Abschließen & Drucken alle Berichte ablegen' })).toBeChecked();

        const nummer = await ereignisMitFuellungen(page);
        const ordner = `Berichte/${JAHR}/${nummer}_Uebung_Gemeinlebarn`;

        await abschliessen(page, true);

        // Der Berichte-Dialog öffnet erst, nachdem alle PDFs abgelegt sind
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Berichte' })).toBeVisible();
        // Mit gewähltem Ordner kein Hinweis
        await expect(dialog.locator('.ablage')).toHaveCount(0);
        await expect(snackbar(page, `3 PDFs gespeichert in ${ordner}`)).toBeVisible();

        expect(await listOpfs(page)).toEqual([
            `${ordner}/${nummer}_Feuerwehr_Feuerwehr_Nr._12345.pdf`,
            `${ordner}/${nummer}_Feuerwehr_Feuerwehr_Nr._23456.pdf`,
            `${ordner}/${nummer}_Gesamtbericht.pdf`
        ]);

        // Die abgelegten Dateien sind gültige PDFs
        const gesamtbericht = await page.evaluate(async (pfad) =>
        {
            let ordner = await navigator.storage.getDirectory();
            const teile = pfad.split('/');
            for (const teil of teile.slice(0, -1)) ordner = await ordner.getDirectoryHandle(teil);
            const datei = await (await ordner.getFileHandle(teile.at(-1)!)).getFile();
            return Array.from(new Uint8Array(await datei.arrayBuffer()));
        }, `${ordner}/${nummer}_Gesamtbericht.pdf`);
        const pdf = await PDFDocument.load(new Uint8Array(gesamtbericht));
        expect(pdf.getPageCount()).toBe(1);
        expect(pdf.getPage(0).getWidth()).toBeGreaterThan(pdf.getPage(0).getHeight());

        // Das abgeschlossene Ereignis steht in der Liste
        await dialog.getByRole('button', { name: 'Schließen' }).click();
        await expect(dialog).toBeHidden();
        await navigate(page, 'Einsätze & Übungen');
        await expect(page.locator('mat-expansion-panel').filter({ hasText: nummer })).toBeVisible();
    });
});
