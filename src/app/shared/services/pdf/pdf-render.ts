// Erzeugt die Berichte als Vektor-PDF mit jsPDF. Wird nur über import() aus dem PdfService geladen,
// damit jsPDF nicht im initialen Bundle landet. Jeder Bericht kann ein eigenes Dokument bekommen oder an ein
// bestehendes angehängt werden (Sammel-PDF zum Drucken mit Seiten in Hoch- und Querformat).
import { jsPDF } from 'jspdf';
import { autoTable, CellDef, CellHookData, RowInput, Styles, UserOptions, __createTable } from 'jspdf-autotable';
import { IEreignis } from '../../interfaces/i-ereignis';
import { IFuellung } from '../../interfaces/i-fuellung';
import { formatEreignisNummer } from '../../models/ereignis-nummer/ereignis-nummer';
import
{
    anzahlFuellungen, BERICHT_KOPF, BERICHT_KOPF_ZUSATZ, ereignisBezeichnung, ereignisTyp, feuerwehrberichtTitel, flaschenTyp,
    GESAMTBERICHT_TITEL, groupFuellungenByFeuerwehr, IFeuerwehrFuellungen, personenNamen
} from '../../reports/report-data';

type Ausrichtung = 'landscape' | 'portrait';

/** Seitenränder in mm, unten inklusive Fußzeile */
const RAND = { top: 12, right: 12, bottom: 18, left: 12 };
const SCHRIFT = 'helvetica';
const GRAU: [number, number, number] = [68, 68, 68];
const LINIE = 0.3;
const LINIE_FEIN = 0.15;

const SPALTEN = ['Nr.', 'Zeit', 'Karteinr.', 'Barcode', 'Flaschennr.', 'Type'];
/** Breiten der Spalten Nr. bis Flaschennr. in mm, Type bekommt den Rest der A4-Seite */
const SPALTEN_BREITEN: Record<Ausrichtung, Array<number>> = {
    landscape: [10, 35, 20, 40, 40],
    portrait: [9, 35, 17, 30, 30]
};

/** Spalte mit Datum und Uhrzeit der Füllung */
const SPALTE_ZEIT = 1;

const UNTERSCHRIFT_HOEHE = 20;
/** Breite der Unterschriftslinie */
const UNTERSCHRIFT_BREITE = 90;

interface ISeite
{
    breite: number;
    hoehe: number;
    inhaltBreite: number;
}

/**
 * Gesamtbericht im A4-Querformat: alle Füllungen gruppiert nach Feuerwehr, mit Summen und Unterschriftsfeldern.
 * Mit ziel wird der Bericht auf neuen Seiten an dieses Dokument angehängt.
 */
export function renderGesamtbericht(ereignis: IEreignis, erstellt: Date, ziel?: jsPDF): jsPDF
{
    const { doc, ersteSeite } = beginneBericht(ziel, 'landscape', GESAMTBERICHT_TITEL, ereignis);
    const seite = seiteVon(doc);
    let y = drawKopf(doc, ereignis, GESAMTBERICHT_TITEL, erstellt);

    const gruppen = groupFuellungenByFeuerwehr(ereignis.fuellungen ?? []);
    if (gruppen.length === 0)
    {
        autoTable(doc, {
            ...tabellenOptionen('landscape'),
            startY: y,
            head: [kopfzeile()],
            body: [[leerZelle()]]
        });
        y = endeLetzterTabelle(doc, y);
    }

    for (const gruppe of gruppen)
    {
        const name = gruppe.feuerwehr.name;
        const options: UserOptions = {
            ...tabellenOptionen('landscape'),
            // Name der Feuerwehr und Spaltenköpfe werden auf jeder Seite wiederholt
            head: [
                [{
                    content: name,
                    colSpan: SPALTEN.length,
                    styles: { fontSize: 11, fontStyle: 'bold', fillColor: false, cellPadding: { top: 4, bottom: 1.2, left: 1.5, right: 1.5 }, lineWidth: { bottom: LINIE } }
                }],
                kopfzeile()
            ],
            body: gruppe.fuellungen.map(fuellungsZeile),
            // Summe und Unterschriftsfeld bleiben zumindest bei der letzten Füllung
            foot: [
                [summenZelle(`Summe ${name}: ${anzahlFuellungen(gruppe.fuellungen.length)}`)],
                [unterschriftZelle(`Übernommen von Feuerwehr ${name}`)]
            ],
            willDrawCell: zeitZelleLeeren,
            didDrawCell: data => drawZelle(data)
        };
        y = startImGanzen(doc, options, y);
        autoTable(doc, { ...options, startY: y });
        y = endeLetzterTabelle(doc, y);
    }

    // Abschluss: Summen pro Feuerwehr und Unterschrift des Füllpersonals nebeneinander
    const spaltenBreite = (seite.inhaltBreite - 15) / 2;
    const gesamt = gruppen.reduce((summe, gruppe) => summe + gruppe.fuellungen.length, 0);
    const summen: UserOptions = {
        ...basisOptionen(),
        tableWidth: spaltenBreite,
        margin: { ...RAND, right: seite.breite - RAND.left - spaltenBreite },
        head: [['Feuerwehr', { content: 'Füllungen', styles: { halign: 'right' } }]],
        body: gruppen.map(gruppe => [gruppe.feuerwehr.name, gruppe.fuellungen.length]),
        foot: [[
            `Gesamt (${gruppen.length} ${gruppen.length === 1 ? 'Feuerwehr' : 'Feuerwehren'})`,
            { content: gesamt, styles: { halign: 'right' } }
        ]],
        footStyles: { fontStyle: 'bold', fillColor: false, textColor: 0, lineColor: 0, lineWidth: { top: LINIE, bottom: LINIE } },
        columnStyles: { 1: { cellWidth: 25, halign: 'right' } }
    };
    const abschlussHoehe = Math.max(tabellenHoehe(doc, summen), UNTERSCHRIFT_HOEHE);
    y += 6;
    if (y + abschlussHoehe > seite.hoehe - RAND.bottom)
    {
        doc.addPage('a4', 'landscape');
        y = RAND.top;
    }
    const startSeite = doc.getCurrentPageInfo().pageNumber;
    autoTable(doc, { ...summen, startY: y });
    const endeSeite = doc.getCurrentPageInfo().pageNumber;
    doc.setPage(startSeite);
    drawUnterschrift(doc, seite.breite - RAND.right - UNTERSCHRIFT_BREITE, y, UNTERSCHRIFT_BREITE, 'Füllpersonal');
    doc.setPage(endeSeite);

    drawFusszeilen(doc, ereignis, GESAMTBERICHT_TITEL, ersteSeite);
    return doc;
}

/** Bericht für eine einzelne Feuerwehr im A4-Hochformat, mit ziel an dieses Dokument angehängt */
export function renderFeuerwehrbericht(ereignis: IEreignis, gruppe: IFeuerwehrFuellungen, erstellt: Date, ziel?: jsPDF): jsPDF
{
    const titel = feuerwehrberichtTitel(gruppe.feuerwehr.name);
    const { doc, ersteSeite } = beginneBericht(ziel, 'portrait', titel, ereignis);
    const y = drawKopf(doc, ereignis, titel, erstellt);

    autoTable(doc, {
        ...tabellenOptionen('portrait'),
        startY: y,
        head: [kopfzeile()],
        body: gruppe.fuellungen.length ? gruppe.fuellungen.map(fuellungsZeile) : [[leerZelle()]],
        // Summe und Unterschriftsfeld bleiben zumindest bei der letzten Füllung
        foot: [
            [summenZelle(`Summe: ${anzahlFuellungen(gruppe.fuellungen.length)}`)],
            // Die Feuerwehr unterschreibt nur am Gesamtbericht
            [unterschriftZelle('Füllpersonal', 8)]
        ],
        willDrawCell: zeitZelleLeeren,
        didDrawCell: data => drawZelle(data)
    });

    drawFusszeilen(doc, ereignis, titel, ersteSeite);
    return doc;
}

/** Titel des Sammel-PDFs mit mehreren Berichten */
export const SAMMEL_TITEL = 'Berichte';

/**
 * Setzt die Dokumenteigenschaften (Titel im PDF-Viewer) passend zu den enthaltenen Berichten,
 * z.B. "Füllbericht 2026-007 Gesamtbericht" oder bei mehreren "Füllbericht 2026-007 Berichte"
 */
export function setTitel(doc: jsPDF, ereignis: IEreignis, titel: string): void
{
    doc.setProperties({
        title: [BERICHT_KOPF, formatEreignisNummer(ereignis), titel].filter(teil => !!teil).join(' '),
        subject: ereignisBezeichnung(ereignis),
        creator: 'FFGFÜA'
    });
}

/**
 * Neues Dokument oder neue Seite im bestehenden Dokument im gewünschten Format.
 * Seiten, die jspdf-autotable danach anhängt, übernehmen dieses Format.
 */
function beginneBericht(ziel: jsPDF | undefined, ausrichtung: Ausrichtung, titel: string, ereignis: IEreignis): { doc: jsPDF; ersteSeite: number }
{
    if (ziel)
    {
        ziel.addPage('a4', ausrichtung);
        ziel.setFont(SCHRIFT, 'normal');
        return { doc: ziel, ersteSeite: ziel.getNumberOfPages() };
    }

    const doc = new jsPDF({ orientation: ausrichtung, unit: 'mm', format: 'a4', compress: true });
    setTitel(doc, ereignis, titel);
    doc.setLanguage('de-AT');
    doc.setFont(SCHRIFT, 'normal');
    return { doc, ersteSeite: 1 };
}

function seiteVon(doc: jsPDF): ISeite
{
    const breite = doc.internal.pageSize.getWidth();
    return { breite, hoehe: doc.internal.pageSize.getHeight(), inhaltBreite: breite - RAND.left - RAND.right };
}

/** Kopf mit Titel und den Daten des Ereignisses, liefert die y-Position danach */
function drawKopf(doc: jsPDF, ereignis: IEreignis, titel: string, erstellt: Date): number
{
    const seite = seiteVon(doc);
    const rechts = seite.breite - RAND.right;
    // Etwas Luft über der Überschrift
    let y = RAND.top + 9;

    doc.setTextColor(0);
    doc.setFont(SCHRIFT, 'bold');
    doc.setFontSize(13);
    doc.text(BERICHT_KOPF, RAND.left, y);
    const kopfBreite = doc.getTextWidth(BERICHT_KOPF + ' ');
    doc.setFont(SCHRIFT, 'normal');
    doc.text(BERICHT_KOPF_ZUSATZ, RAND.left + kopfBreite, y);
    const zeileBreite = kopfBreite + doc.getTextWidth(BERICHT_KOPF_ZUSATZ);

    doc.setFont(SCHRIFT, 'bold');
    doc.setFontSize(10.5);
    // Passt der Titel nicht mehr neben die Überschrift, kommt er in eine eigene Zeile
    const titelZeilen: Array<string> = doc.splitTextToSize(titel, seite.inhaltBreite);
    if (zeileBreite + 6 + doc.getTextWidth(titelZeilen[0]) > seite.inhaltBreite || titelZeilen.length > 1)
    {
        y += 6;
        doc.text(titelZeilen, RAND.left, y);
        y += (titelZeilen.length - 1) * 4.5;
    }
    else
    {
        doc.text(titel, rechts, y, { align: 'right' });
    }

    y += 2.5;
    linie(doc, RAND.left, y, rechts, y, LINIE);
    y += 2.5;

    const ende = ereignis.datetimeEnd ?? 'noch nicht beendet';
    const zeilen: Array<Array<[string, string | Date, number]>> = [
        [
            ['Ereignis-Nr.', formatEreignisNummer(ereignis) || '–', 1],
            ['Ereignis', ereignisTyp(ereignis), 1],
            ['Ort', ereignis.ort || '–', 1],
            ['Beginn', ereignis.datetimeStart, 1],
            ['Ende', ende, 1]
        ],
        [
            ['Füllpersonal', personenNamen(ereignis.personen ?? []) || '–', 4],
            ['Erstellt', erstellt, 1]
        ]
    ];

    const abstand = 4;
    const spalte = (seite.inhaltBreite - 4 * abstand) / 5;
    for (const zeile of zeilen)
    {
        let x = RAND.left;
        let hoehe = 0;
        for (const [label, wert, spannweite] of zeile)
        {
            const breite = spannweite * spalte + (spannweite - 1) * abstand;
            doc.setFont(SCHRIFT, 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...GRAU);
            doc.text(label.toUpperCase(), x, y + 2.5);
            doc.setFontSize(9);
            doc.setTextColor(0);
            let zeilenAnzahl = 1;
            if (wert instanceof Date)
            {
                drawDatumZeit(doc, wert, x, y + 6.3);
            }
            else
            {
                const werte: Array<string> = doc.splitTextToSize(wert, breite);
                doc.text(werte, x, y + 6.3);
                zeilenAnzahl = werte.length;
            }
            hoehe = Math.max(hoehe, 3.2 + zeilenAnzahl * 4);
            x += breite + abstand;
        }
        y += hoehe + 2;
    }

    y += 0.5;
    linie(doc, RAND.left, y, rechts, y, LINIE);
    return y + 6;
}

/** Fußzeilen der Seiten ab ersteSeite, die Seitenzahlen zählen nur innerhalb des Berichts */
function drawFusszeilen(doc: jsPDF, ereignis: IEreignis, titel: string, ersteSeite: number): void
{
    const letzteSeite = doc.getNumberOfPages();
    const seiten = letzteSeite - ersteSeite + 1;
    const nummer = formatEreignisNummer(ereignis);
    const links = [nummer ? `${BERICHT_KOPF} ${nummer}` : BERICHT_KOPF, titel].join(' · ');

    for (let i = 1; i <= seiten; i++)
    {
        doc.setPage(ersteSeite + i - 1);
        const seite = seiteVon(doc);
        const y = seite.hoehe - 8;
        linie(doc, RAND.left, y - 4, seite.breite - RAND.right, y - 4, LINIE_FEIN, 153);
        doc.setFont(SCHRIFT, 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAU);
        doc.text(links, RAND.left, y);
        doc.text(`Seite ${i} von ${seiten}`, seite.breite - RAND.right, y, { align: 'right' });
    }
    doc.setTextColor(0);
}

/** Unterschriftsfeld: Bezeichnung und eine Linie für die Unterschrift */
function drawUnterschrift(doc: jsPDF, x: number, y: number, breite: number, label: string): void
{
    doc.setFont(SCHRIFT, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(label, x, y + 3.2);

    const linieY = y + 15.5;
    linie(doc, x, linieY, x + breite, linieY, LINIE);
    doc.setFont(SCHRIFT, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAU);
    doc.text('Unterschrift', x, linieY + 3.3);
    doc.setTextColor(0);
}

/** Datum normal, Uhrzeit fett, z.B. 01.05.2026 **10:00 Uhr** */
function drawDatumZeit(doc: jsPDF, wert: Date | string, x: number, y: number): void
{
    const datum = formatDatum(wert) + ' ';
    doc.setFont(SCHRIFT, 'normal');
    doc.text(datum, x, y);
    const datumBreite = doc.getTextWidth(datum);
    doc.setFont(SCHRIFT, 'bold');
    doc.text(formatUhrzeit(wert), x + datumBreite, y);
    doc.setFont(SCHRIFT, 'normal');
}

function linie(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, staerke: number, farbe = 0): void
{
    doc.setLineWidth(staerke);
    doc.setDrawColor(farbe);
    doc.line(x1, y1, x2, y2);
}

function basisOptionen(): UserOptions
{
    return {
        theme: 'plain',
        margin: RAND,
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        showFoot: 'lastPage',
        styles: {
            font: SCHRIFT,
            fontSize: 9,
            textColor: 0,
            cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
            lineColor: 153,
            lineWidth: { bottom: LINIE_FEIN },
            overflow: 'linebreak',
            valign: 'top'
        },
        headStyles: { fontSize: 8, fontStyle: 'bold', fillColor: 238, lineColor: 0, lineWidth: { top: LINIE, bottom: LINIE } }
    };
}

/** Optionen der Tabelle der Füllungen mit den Spalten Nr., Zeit, Karteinr., Barcode, Flaschennr., Type */
function tabellenOptionen(ausrichtung: Ausrichtung): UserOptions
{
    const breiten = SPALTEN_BREITEN[ausrichtung];
    const columnStyles: Record<string, Partial<Styles>> = {};
    breiten.forEach((breite, i) => columnStyles[i] = { cellWidth: breite });
    columnStyles[0].halign = 'right';
    // Feste Breite auch für Type, sonst verteilt jspdf-autotable die Breite bei leeren Tabellen anders
    const inhaltBreite = (ausrichtung === 'landscape' ? 297 : 210) - RAND.left - RAND.right;
    columnStyles[SPALTEN.length - 1] = { cellWidth: inhaltBreite - breiten.reduce((summe, breite) => summe + breite, 0) };

    return {
        ...basisOptionen(),
        columnStyles,
        footStyles: { fontStyle: 'bold', fillColor: false, textColor: 0, lineColor: 0, lineWidth: 0 }
    };
}

function kopfzeile(): Array<CellDef>
{
    return SPALTEN.map((spalte, i) => ({ content: spalte, styles: i === 0 ? { halign: 'right' } : {} }));
}

function fuellungsZeile(fuellung: IFuellung, index: number): RowInput
{
    const flasche = fuellung.flasche;
    return [
        index + 1,
        // Inhalt ist der Text für die Breitenberechnung, gezeichnet wird in drawZelle
        zeitZelle(fuellung.datetime),
        flasche.karteiNr ?? '',
        flasche.barcode ?? '',
        flasche.flaschennummer ?? '',
        flaschenTyp(flasche)
    ];
}

function leerZelle(): CellDef
{
    return {
        content: 'Keine Füllungen erfasst',
        colSpan: SPALTEN.length,
        styles: { fontStyle: 'italic', halign: 'center', cellPadding: { top: 4, bottom: 4, left: 1.5, right: 1.5 } }
    };
}

function summenZelle(text: string): CellDef
{
    return { content: text, colSpan: SPALTEN.length, styles: { lineWidth: { top: LINIE, bottom: LINIE } } };
}

/** Platzhalter für ein Unterschriftsfeld, das in drawUnterschriftZelle gezeichnet wird */
function unterschriftZelle(label: string, abstandOben = 2): CellDef
{
    return {
        content: label,
        colSpan: SPALTEN.length,
        styles: {
            // Der Text wird nicht gezeichnet (siehe drawUnterschriftZelle), nur die Höhe zählt
            textColor: 255,
            fontSize: 1,
            minCellHeight: abstandOben + UNTERSCHRIFT_HOEHE + 3,
            cellPadding: { top: abstandOben, bottom: 3, left: 0, right: 0 }
        }
    };
}

/** Zelle mit Datum und Uhrzeit, der Text dient jspdf-autotable nur zur Berechnung der Größe */
interface IZeitZelle extends CellDef
{
    datum: Date;
}

function zeitZelle(wert: Date | string): IZeitZelle
{
    return { content: datumZeitText(wert), datum: new Date(wert) };
}

function zeitVon(data: CellHookData): Date | null
{
    if (data.section !== 'body' || data.column.index !== SPALTE_ZEIT) return null;
    const raw = data.cell.raw as Partial<IZeitZelle> | null;
    return raw?.datum instanceof Date ? raw.datum : null;
}

/** Die Zeit-Zelle zeichnet drawZelle mit fetter Uhrzeit */
function zeitZelleLeeren(data: CellHookData): void
{
    if (zeitVon(data)) data.cell.text = [];
}

function drawZelle(data: CellHookData): void
{
    const cell = data.cell;
    const doc = data.doc as jsPDF;

    const zeit = zeitVon(data);
    if (zeit)
    {
        // Grundlinie wie bei jspdf-autotable: oberer Innenabstand plus Schriftgröße
        const y = cell.y + cell.padding('top') + (cell.styles.fontSize / doc.internal.scaleFactor) * 0.85;
        doc.setFontSize(cell.styles.fontSize);
        doc.setTextColor(0);
        drawDatumZeit(doc, zeit, cell.x + cell.padding('left'), y);
        return;
    }

    if (data.section !== 'foot' || data.row.index === 0) return;
    const breite = Math.min(UNTERSCHRIFT_BREITE, cell.width);
    const label = Array.isArray(cell.raw) ? '' : String((cell.raw as CellDef).content ?? '');
    drawUnterschrift(doc, cell.x + cell.width - breite, cell.y + cell.padding('top'), breite, label);
}

/** Höhe einer Tabelle in mm, ohne sie zu zeichnen */
function tabellenHoehe(doc: jsPDF, options: UserOptions): number
{
    const table = __createTable(doc, { ...options, startY: RAND.top });
    return table.getHeadHeight(table.columns)
        + table.body.reduce((summe, row) => summe + row.height, 0)
        + table.getFootHeight(table.columns);
}

/**
 * Beginnt eine Tabelle auf einer neuen Seite, wenn sie dort vollständig Platz hat, auf der aktuellen aber nicht
 * (wie break-inside: avoid). Längere Tabellen beginnen auf der aktuellen Seite, sofern dort noch ein paar Zeilen
 * Platz haben. Liefert die y-Position, an der die Tabelle beginnt.
 */
function startImGanzen(doc: jsPDF, options: UserOptions, y: number): number
{
    const seite = seiteVon(doc);
    const verfuegbar = seite.hoehe - RAND.bottom - y;
    const ganzeSeite = seite.hoehe - RAND.bottom - RAND.top;
    const hoehe = tabellenHoehe(doc, options);
    const mindestens = 60;

    if (hoehe <= verfuegbar) return y;
    if (hoehe <= ganzeSeite || verfuegbar < mindestens)
    {
        doc.addPage();
        return RAND.top;
    }
    return y;
}

function endeLetzterTabelle(doc: jsPDF, fallback: number): number
{
    return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;
}

function pad(zahl: number): string
{
    return String(zahl).padStart(2, '0');
}

/** z.B. 01.05.2026 */
export function formatDatum(wert: Date | string): string
{
    const datum = new Date(wert);
    return `${pad(datum.getDate())}.${pad(datum.getMonth() + 1)}.${datum.getFullYear()}`;
}

/** z.B. 10:00 Uhr */
export function formatUhrzeit(wert: Date | string): string
{
    const datum = new Date(wert);
    return `${pad(datum.getHours())}:${pad(datum.getMinutes())} Uhr`;
}

/** z.B. 01.05.2026 10:00 Uhr */
export function datumZeitText(wert: Date | string): string
{
    return `${formatDatum(wert)} ${formatUhrzeit(wert)}`;
}
