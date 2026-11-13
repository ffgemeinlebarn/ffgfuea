// Erzeugt einen Altbericht im Layout des früheren Druckdialogs als Vektor-PDF mit jsPDF.
// Wird nur über import() aus dem AltberichteService geladen, damit jsPDF nicht im initialen Bundle landet.
//
// Nachgebildet sind die Druck-Styles von damals (styles.scss, Klasse .print, mit der Typografie von
// Angular Material): A4 hoch, Ränder wie beim Drucken aus Chrome (1 cm), Monospace-Schrift, Tabellen nur mit
// waagrechten Linien, Zellen vertikal zentriert. Maße in mm, 1 CSS-Pixel = 0,2646 mm.
import { jsPDF } from 'jspdf';
import { autoTable, RowInput, UserOptions, __createTable } from 'jspdf-autotable';
import { IEreignis } from '../shared/interfaces/i-ereignis';
import { IFuellung } from '../shared/interfaces/i-fuellung';
import { formatEreignisNummer } from '../shared/models/ereignis-nummer/ereignis-nummer';
import { IFeuerwehrFuellungen } from '../shared/reports/report-data';
import { ALT_KOPF, ALT_KOPF_ZUSATZ, ALT_NACHTRAEGLICH, altEreignisText, IAltbericht } from './altbericht-daten';

const PX = 25.4 / 96;
/** Schriftgröße in pt aus mm */
const PT = 72 / 25.4;

const RAND = { top: 10, right: 10, bottom: 10, left: 10 };
/** 'Cascadia Code', monospace: die einzige eingebaute Monospace-Schrift von jsPDF ist Courier */
const SCHRIFT = 'courier';
const LINIE = 1 * PX;

/** Zeilenhöhe von Absätzen und Tabellenzellen: 20px (mat-typography body-1) */
const ZEILE = 20 * PX;
const TEXT_GROESSE = 3.1;

const H1 = { groesse: 6, zeile: 32 * PX, abstandUnten: 3 };
const TITEL = { groesse: 5, zeile: ZEILE, abstandUnten: 10 };
const H2 = { groesse: 5, zeile: 32 * PX, abstandOben: 10, abstandUnten: 16 * PX };
const H3 = { groesse: 4, zeile: 28 * PX, abstandUnten: 16 * PX };
const KOPF_PADDING = 4;
const FUELLUNG_ABSTAND = 10;

/** Spaltenbreiten der Füllungen in mm, bei 100 % Tabellenbreite proportional gestreckt */
const SPALTEN = ['Datum', 'Feuerwehr', 'Flasche', 'Type'];
const SPALTEN_BREITEN = [25, 32, 58, 65];
const LABEL_BREITE = 90;

const UNTERSCHRIFT = {
    abstandOben: 20 * PX,
    paddingOben: 120 * PX,
    linie: 2 * PX,
    textAbstand: 10 * PX,
    groesse: 14 * PX,
    breite: 0.4,
    text: 'Unterschrift des Füllpersonals'
};

/**
 * Rendert einen Altbericht (Gesamtbericht oder Bericht einer Feuerwehr) wie der alte Druckdialog.
 * "Gedruckt" ist der Zeitpunkt der Erzeugung, gekennzeichnet als nachträglich erstellt.
 */
export function renderAltbericht(ereignis: IEreignis, bericht: IAltbericht, erstellt: Date): jsPDF
{
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({
        title: [ALT_KOPF, formatEreignisNummer(ereignis), bericht.titel, ALT_NACHTRAEGLICH].filter(teil => !!teil).join(' '),
        subject: altEreignisText(ereignis),
        creator: 'FFGFÜA'
    });
    doc.setLanguage('de-AT');
    doc.setTextColor(0);
    doc.setDrawColor(0);

    const breite = doc.internal.pageSize.getWidth() - RAND.left - RAND.right;

    // Kopf: Überschrift, Name des Berichts und Tabelle mit den Daten des Ereignisses
    let y = RAND.top + KOPF_PADDING;
    doc.setFont(SCHRIFT, 'bold');
    doc.setFontSize(H1.groesse * PT);
    doc.text(ALT_KOPF, RAND.left, y + H1.zeile / 2, { baseline: 'middle' });
    const kopfBreite = doc.getTextWidth(`${ALT_KOPF} `);
    doc.setFont(SCHRIFT, 'normal');
    doc.text(ALT_KOPF_ZUSATZ, RAND.left + kopfBreite, y + H1.zeile / 2, { baseline: 'middle' });
    y += H1.zeile + H1.abstandUnten;

    y = absatz(doc, bericht.titel, TITEL.groesse, TITEL.zeile, y, breite, 'normal') + TITEL.abstandUnten;

    doc.setLineHeightFactor(ZEILE / TEXT_GROESSE);
    autoTable(doc, {
        ...tabellenOptionen(),
        startY: y,
        body: kopfZeilen(ereignis, erstellt),
        columnStyles: { 0: { cellWidth: LABEL_BREITE, fontStyle: 'bold' } }
    });
    y = endeLetzterTabelle(doc, y) + KOPF_PADDING;

    // Füllungen pro Feuerwehr, eine Feuerwehr wird möglichst nicht auf zwei Seiten aufgeteilt
    y += H2.abstandOben;
    y = absatz(doc, 'Füllungen', H2.groesse, H2.zeile, y, breite, 'bold');
    let abstand = H2.abstandUnten;

    for (const gruppe of bericht.gruppen)
    {
        const tabelle = fuellungsTabelle(gruppe, breite);
        const titel = doc.setFont(SCHRIFT, 'bold').setFontSize(H3.groesse * PT).splitTextToSize(gruppe.feuerwehr.name, breite) as Array<string>;
        const titelHoehe = titel.length * H3.zeile + H3.abstandUnten;
        y = vermeideUmbruch(doc, y + abstand, titelHoehe + tabellenHoehe(doc, tabelle));

        y = absatz(doc, gruppe.feuerwehr.name, H3.groesse, H3.zeile, y, breite, 'bold') + H3.abstandUnten;
        doc.setLineHeightFactor(ZEILE / TEXT_GROESSE);
        autoTable(doc, { ...tabelle, startY: y });
        y = endeLetzterTabelle(doc, y);
        abstand = FUELLUNG_ABSTAND;
    }

    // Unterschriftsfeld: Abstände kollabieren wie in CSS, das Feld bleibt beisammen
    const hoehe = UNTERSCHRIFT.paddingOben + ZEILE + UNTERSCHRIFT.linie + UNTERSCHRIFT.textAbstand + ZEILE;
    y = vermeideUmbruch(doc, y + Math.max(abstand, UNTERSCHRIFT.abstandOben), hoehe);
    // Vor der Linie steht im alten Layout ein &nbsp; und damit eine leere Zeile
    const linieY = y + UNTERSCHRIFT.paddingOben + ZEILE + UNTERSCHRIFT.linie / 2;
    doc.setLineWidth(UNTERSCHRIFT.linie);
    doc.line(RAND.left, linieY, RAND.left + breite * UNTERSCHRIFT.breite, linieY);
    doc.setFont(SCHRIFT, 'normal');
    doc.setFontSize(UNTERSCHRIFT.groesse * PT);
    doc.text(UNTERSCHRIFT.text, RAND.left, linieY + UNTERSCHRIFT.linie / 2 + UNTERSCHRIFT.textAbstand + ZEILE / 2, { baseline: 'middle' });

    return doc;
}

/** Text in Zeilen der angegebenen Höhe, vertikal zentriert wie bei CSS line-height. Liefert die y-Position danach */
function absatz(doc: jsPDF, text: string, groesse: number, zeile: number, y: number, breite: number, stil: 'normal' | 'bold'): number
{
    doc.setFont(SCHRIFT, stil);
    doc.setFontSize(groesse * PT);
    const zeilen: Array<string> = doc.splitTextToSize(text, breite);
    zeilen.forEach((inhalt, i) => doc.text(inhalt, RAND.left, y + i * zeile + zeile / 2, { baseline: 'middle' }));
    return y + zeilen.length * zeile;
}

function kopfZeilen(ereignis: IEreignis, erstellt: Date): Array<RowInput>
{
    return [
        ['Gedruckt:', `${datum(erstellt)} ${zeit(erstellt, true)} Uhr ${ALT_NACHTRAEGLICH}`],
        ['Ereignis:', altEreignisText(ereignis)],
        ['Beginn:', `${datum(ereignis.datetimeStart)} ${zeit(ereignis.datetimeStart)} Uhr`],
        ['Ende:', ereignis.datetimeEnd ? `${datum(ereignis.datetimeEnd)} ${zeit(ereignis.datetimeEnd)} Uhr` : 'noch nicht beendet'],
        // Im alten Layout stand hier "Füllersonal:"
        ['Füllpersonal:', (ereignis.personen ?? []).map(person => `${person.vorname} ${person.nachname}`).join(', ')]
    ];
}

function tabellenOptionen(): UserOptions
{
    return {
        theme: 'plain',
        margin: RAND,
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        styles: {
            font: SCHRIFT,
            fontSize: TEXT_GROESSE * PT,
            textColor: 0,
            lineColor: 0,
            lineWidth: { top: LINIE, bottom: LINIE },
            // padding: 2mm 0mm, rechts etwas Luft, damit Texte benachbarter Spalten nicht aneinanderstoßen
            cellPadding: { top: 2, bottom: 2, left: 0, right: 1.5 },
            overflow: 'linebreak',
            valign: 'middle'
        },
        headStyles: { fontStyle: 'bold' }
    };
}

function fuellungsTabelle(gruppe: IFeuerwehrFuellungen, breite: number): UserOptions
{
    const summe = SPALTEN_BREITEN.reduce((a, b) => a + b, 0);
    const columnStyles: UserOptions['columnStyles'] = {};
    SPALTEN_BREITEN.forEach((spalte, i) => columnStyles[i] = { cellWidth: spalte / summe * breite });
    return {
        ...tabellenOptionen(),
        head: [SPALTEN],
        body: gruppe.fuellungen.map(fuellungsZeile),
        columnStyles
    };
}

function fuellungsZeile(fuellung: IFuellung): RowInput
{
    const flasche = fuellung.flasche;
    return [
        `${datum(fuellung.datetime)}\n${zeit(fuellung.datetime)} Uhr`,
        flasche.feuerwehr?.name ?? '',
        `${wert(flasche.karteiNr)} (Code: ${wert(flasche.barcode)})\nFlaschen Nr.: ${wert(flasche.flaschennummer)}`,
        `${wert(flasche.typenBezeichnung)}\n(${leerzeichen(`${wert(flasche.typenInfo1)} ${wert(flasche.typenInfo2)} ${wert(flasche.typenInfo3)}`)})`
    ];
}

/** Leere Werte wie bei der Interpolation in Angular-Templates */
function wert(inhalt: string | number | null | undefined): string
{
    return inhalt == null ? '' : String(inhalt);
}

/**
 * Mehrere Leerzeichen zu einem zusammenfassen wie beim Rendern von HTML. Zusätzlich ohne Leerzeichen am Rand,
 * im alten Layout stand bei fehlender Zusatzinfo z.B. "(300 bar 6,8 l )".
 */
function leerzeichen(text: string): string
{
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Beginnt einen Block auf einer neuen Seite, wenn er dort vollständig Platz hat, auf der aktuellen aber nicht
 * (wie page-break-inside: avoid). Liefert die y-Position, an der der Block beginnt.
 */
function vermeideUmbruch(doc: jsPDF, y: number, hoehe: number): number
{
    const unten = doc.internal.pageSize.getHeight() - RAND.bottom;
    const ganzeSeite = unten - RAND.top;
    // Ein zu großer Block beginnt trotzdem auf der aktuellen Seite, sofern dort noch etwas Platz ist
    const mindestens = 40;
    if (y + hoehe <= unten) return y;
    if (hoehe <= ganzeSeite || unten - y < mindestens)
    {
        doc.addPage();
        return RAND.top;
    }
    return y;
}

/** Höhe einer Tabelle in mm, ohne sie zu zeichnen */
function tabellenHoehe(doc: jsPDF, options: UserOptions): number
{
    doc.setLineHeightFactor(ZEILE / TEXT_GROESSE);
    const table = __createTable(doc, { ...options, startY: RAND.top });
    return table.getHeadHeight(table.columns)
        + table.body.reduce((summe, row) => summe + row.height, 0)
        + table.getFootHeight(table.columns);
}

function endeLetzterTabelle(doc: jsPDF, fallback: number): number
{
    return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;
}

function pad(zahl: number): string
{
    return String(zahl).padStart(2, '0');
}

/** dd.MM.yyyy wie die DatePipe im alten Layout */
function datum(wert: Date | string): string
{
    const d = new Date(wert);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** HH:mm bzw. HH:mm:ss */
function zeit(wert: Date | string, sekunden = false): string
{
    const d = new Date(wert);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}${sekunden ? `:${pad(d.getSeconds())}` : ''}`;
}
