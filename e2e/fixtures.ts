import AxeBuilder from '@axe-core/playwright';
import { expect, Locator, Page, test as base, TestInfo } from '@playwright/test';

export { expect } from '@playwright/test';

/** Ereignisnummern werden im Jahr des Beginns vergeben, die erste in einer leeren Datenbank ist JJJJ-001 */
export const JAHR = new Date().getFullYear();
export const ereignisNummer = (nummer: number) => `${JAHR}-${String(nummer).padStart(3, '0')}`;

/** Barcode der i-ten (1-12) Flasche einer mit der FakeSyncApi synchronisierten Feuerwehr */
export const barcode = (feuerwehrNummer: number, i: number) => `${feuerwehrNummer}${String(i).padStart(2, '0')}`;

/** Die Snackbar der App mit der angegebenen Meldung (eine ausgeblendete vorherige Meldung kann noch im DOM sein) */
export const snackbar = (page: Page, text: string | RegExp): Locator =>
    page.locator('mat-snack-bar-container').filter({ hasText: text });

/**
 * Öffnet eine Seite der App und wartet, bis die Synchronisierung beim Start fertig ist.
 * Die FakeSyncApi meldet bei jedem Start einen neuen Datensatz, daher läuft die Synchronisierung
 * (mit blockierendem Overlay) bei jedem Laden der App, auch ohne gespeicherte Feuerwehren.
 */
export async function gotoApp(page: Page, path = '/'): Promise<void>
{
    await waitForSync(page, () => page.goto(path));
}

/** Lädt die App neu und wartet auf die Synchronisierung */
export async function reloadApp(page: Page): Promise<void>
{
    await waitForSync(page, () => page.reload());
}

/** Führt eine Aktion aus, die die App (neu) lädt, und wartet, bis die Synchronisierung beendet und das Overlay weg ist */
async function waitForSync(page: Page, action: () => Promise<unknown>): Promise<void>
{
    // Nach einer erfolgreichen Synchronisierung merkt sich die App den Stand (syncLastEdit) im LocalStorage.
    // Die FakeSyncApi liefert dafür den aktuellen Zeitpunkt, der Stand ist also jünger als der Start der Aktion.
    const start = Date.now();
    await action();
    await expect.poll(
        () => page.evaluate(() => Date.parse(localStorage.getItem('syncLastEdit') ?? '') || 0),
        { message: 'Synchronisierung beim Start der App', timeout: 30_000 }
    ).toBeGreaterThanOrEqual(start);
    await expect(page.locator('.progress')).toBeHidden();
}

/** Navigation über die Toolbar, ohne die App neu zu laden */
export async function navigate(page: Page, ziel: 'Füllen' | 'Einsätze & Übungen' | 'Verwaltung' | 'Statistik' | 'Einstellungen'): Promise<void>
{
    const name = ziel === 'Verwaltung' ? 'Feuerwehren, Flaschen & Füllpersonal verwalten' : ziel;
    await page.locator('mat-toolbar').getByRole('button', { name }).click();
}

/** Fügt in der Verwaltung eine Feuerwehr über die (Fake-)Synchronisierung hinzu: "Feuerwehr Nr. N" mit 12 Flaschen */
export async function seedFeuerwehr(page: Page, feuerwehrNummer: number): Promise<Locator>
{
    await expectVerwaltung(page);
    await page.getByLabel('Feuerwehrnummer').fill(String(feuerwehrNummer));
    await page.getByRole('button', { name: 'Zur Synchroniserung hinzufügen' }).click();
    const panel = feuerwehrPanel(page, feuerwehrNummer);
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.locator('mat-expansion-panel-header')).toContainText('12 Flaschen');
    return panel;
}

export function feuerwehrPanel(page: Page, feuerwehrNummer: number): Locator
{
    return page.locator('mat-expansion-panel').filter({ hasText: `${feuerwehrNummer} - Feuerwehr Nr. ${feuerwehrNummer}` });
}

/** Fügt in der Verwaltung Füllpersonal hinzu */
export async function addPerson(page: Page, vorname: string, nachname: string): Promise<Locator>
{
    await expectVerwaltung(page);
    const card = page.locator('mat-card').filter({ hasText: 'Füllpersonal hinzufügen' });
    await card.getByLabel('Vorname').fill(vorname);
    await card.getByLabel('Nachname').fill(nachname);
    await card.getByRole('button', { name: 'Person hinzufügen' }).click();
    const person = personCard(page, `${vorname} ${nachname}`);
    await expect(person).toBeVisible();
    return person;
}

export function personCard(page: Page, name: string): Locator
{
    return page.locator('mat-card').filter({ has: page.getByText(name, { exact: true }) }).filter({ hasText: 'Person bearbeiten' });
}

async function expectVerwaltung(page: Page): Promise<void>
{
    if (!page.url().endsWith('/verwaltung')) await navigate(page, 'Verwaltung');
    await expect(page.getByRole('heading', { name: 'Füllpersonal', exact: true })).toBeVisible();
}

export interface IEreignisOptionen
{
    type?: 'Übung' | 'Einsatz';
    ort?: string;
    personen?: Array<string>;
}

/**
 * Erstellt auf der Startseite ein neues Ereignis und wartet auf den Füllbetrieb.
 * Liefert die vergebene Ereignisnummer (JJJJ-NNN).
 */
export async function startEreignis(page: Page, optionen: IEreignisOptionen = {}): Promise<string>
{
    await page.locator('mat-toolbar svg.logo').click();
    await expect(page.getByRole('heading', { name: 'Neuen Einsatz oder neue Übung erstellen' })).toBeVisible();

    if (optionen.type && optionen.type !== 'Übung')
    {
        await startStep(page, 'Übung oder Einsatz').getByRole('combobox').click();
        await page.getByRole('option', { name: optionen.type }).click();
    }

    if (optionen.personen?.length)
    {
        await page.getByRole('combobox', { name: 'Personen' }).click();
        for (const person of optionen.personen)
            await page.getByRole('option', { name: person }).click();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('listbox')).toBeHidden();
    }

    if (optionen.ort)
        await startStep(page, 'Katastralgemeinde').getByRole('textbox').fill(optionen.ort);

    await page.getByRole('button', { name: 'Start' }).click();
    await page.waitForURL('**/operating');

    const titel = page.getByRole('heading', { name: /^Aktuelle(r Einsatz| Übung) \d{4}-\d{3}/ });
    await expect(titel).toBeVisible();
    const nummer = (await titel.textContent())?.match(/\d{4}-\d{3,}/)?.[0];
    if (!nummer) throw new Error('Keine Ereignisnummer gefunden');
    return nummer;
}

function startStep(page: Page, untertitel: string): Locator
{
    return page.locator('mat-card').filter({ hasText: untertitel });
}

/** Kachel im Füllbetrieb mit dem angegebenen Text */
export function tile(page: Page, text: string | RegExp): Locator
{
    return page.locator('mat-grid-tile mat-card').filter({ hasText: text });
}

/** Zahl einer Zähler-Kachel im Füllbetrieb, z.B. "Gesamtanzahl der gefüllten Flaschen" */
export function counter(page: Page, beschriftung: string): Locator
{
    return page.locator('mat-grid-tile mat-card')
        .filter({ has: page.getByText(beschriftung, { exact: true }) })
        .locator('h1');
}

/** Schaltet die Eingabebestätigung im Füllbetrieb ein oder aus */
export async function setConfirmFuellung(page: Page, aktiv: boolean): Promise<void>
{
    const kachel = tile(page, 'Eingabebestätigung ist');
    const soll = aktiv ? 'aktiviert' : 'deaktiviert';
    if (!(await kachel.textContent())?.includes(`ist ${soll}`))
        await kachel.click();
    await expect(kachel).toContainText(`Eingabebestätigung ist ${soll}`);
}

/**
 * Simuliert den Barcode-Scanner: Ziffern und Enter als Tastatureingabe, außerhalb eines Eingabefelds
 */
export async function scan(page: Page, code: string): Promise<void>
{
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.type(code);
    await page.keyboard.press('Enter');
}

/** Die Liste "Zuletzt gefüllte Flaschen" im Füllbetrieb */
export function fuellungen(page: Page): Locator
{
    return page.locator('mat-grid-tile mat-card').filter({ hasText: 'Zuletzt gefüllte Flaschen' }).locator('ffg-fuellung-item');
}

/** Scannt eine Flasche und bestätigt die Füllung im Dialog, wenn die Eingabebestätigung aktiv ist */
export async function fuellen(page: Page, code: string, bestaetigen: boolean): Promise<void>
{
    const anzahl = await fuellungen(page).count();
    await scan(page, code);
    if (bestaetigen)
    {
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText(`Barcode: ${code}`);
        await dialog.getByRole('button', { name: 'Füllung bestätigen' }).click();
        await expect(dialog).toBeHidden();
    }
    await expect(fuellungen(page)).toHaveCount(anzahl + 1);
    await expect(fuellungen(page).first()).toContainText(`Barcode: ${code}`);
}

/** Schließt das laufende Ereignis über die Kachel ab, optional mit "Abschließen & Berichte drucken" */
export async function abschliessen(page: Page, drucken = false): Promise<void>
{
    await tile(page, 'Abschließen').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: drucken ? 'Abschließen & Berichte drucken' : 'Ereignis abschließen' }).click();
    await expect(page.getByRole('heading', { name: 'Neuen Einsatz oder neue Übung erstellen' })).toBeVisible();
}

/**
 * Ersetzt die Ordnerauswahl der File System Access API durch einen Ordner "Berichte" im
 * Origin Private File System, damit Tests ohne nativen Dialog in einen Ordner schreiben können.
 */
export async function stubDirectoryPicker(page: Page): Promise<void>
{
    await page.addInitScript(() =>
    {
        Object.defineProperty(window, 'showDirectoryPicker', {
            configurable: true,
            value: async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Berichte', { create: true })
        });
    });
}

/** Alle Dateien im Origin Private File System als Pfade, z.B. "Berichte/2026/2026-001_Uebung/2026-001_Gesamtbericht.pdf" */
export async function listOpfs(page: Page): Promise<Array<string>>
{
    return page.evaluate(async () =>
    {
        type Ordner = FileSystemDirectoryHandle & { entries(): AsyncIterable<[string, FileSystemHandle]> };
        const pfade: Array<string> = [];
        const lesen = async (ordner: Ordner, pfad: string) =>
        {
            for await (const [name, handle] of ordner.entries())
            {
                if (handle.kind === 'directory') await lesen(handle, `${pfad}${name}/`);
                else pfade.push(`${pfad}${name}`);
            }
        };
        await lesen(await navigator.storage.getDirectory(), '');
        return pfade.sort();
    });
}

/** Unterdrückt den Druckdialog (window.print) in allen Fenstern und iframes der Seite */
export async function stubPrint(page: Page): Promise<void>
{
    await page.addInitScript(() =>
    {
        window.print = () => undefined;
    });
}

interface IFixtures
{
    /** Fehler der Seite (pageerror), am Ende des Tests muss die Liste leer sein */
    pageErrors: Array<string>;
}

export const test = base.extend<IFixtures>({
    pageErrors: [async ({ page }, use) =>
    {
        const errors: Array<string> = [];
        page.on('pageerror', error => errors.push(error.message));
        await use(errors);
        expect(errors, 'Unbehandelte Fehler in der App').toEqual([]);
    }, { auto: true }]
});

/** WCAG-Stufen, gegen die axe prüft (A und AA bis WCAG 2.2) */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Prüft die aktuelle Seite (oder einen Ausschnitt) mit axe-core auf Verstöße gegen WCAG A/AA.
 * Das vollständige Ergebnis hängt als JSON am Test (HTML-Bericht), die Meldung listet Regel, Hilfe-Link und Elemente.
 */
export async function expectBarrierefrei(page: Page, testInfo: TestInfo, name: string, bereich?: string): Promise<void>
{
    // Ein- und Ausblend-Animationen (Dialoge, Snackbar) abwarten, sonst misst axe Kontraste bei halber Deckkraft
    await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
    let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
    if (bereich) builder = builder.include(bereich);
    const ergebnis = await builder.analyze();
    await testInfo.attach(`axe-${name}.json`, { body: JSON.stringify(ergebnis.violations, null, 2), contentType: 'application/json' });
    const verstoesse = ergebnis.violations.map(v =>
        `${v.impact ?? '?'} ${v.id}: ${v.help} (${v.helpUrl})\n` + v.nodes.slice(0, 5).map(n => `    ${n.target.join(' ')}`).join('\n')
    );
    // soft: ein Lauf meldet die Verstöße aller geprüften Seiten, nicht nur der ersten
    expect.soft(verstoesse, `Barrierefreiheit (axe, WCAG A/AA): ${name}`).toEqual([]);
}
