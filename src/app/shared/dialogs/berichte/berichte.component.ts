import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { IEreignis } from '../../interfaces/i-ereignis';
import { EreignisNummerPipe } from '../../pipes/ereignis-nummer/ereignis-nummer.pipe';
import { anzahlFuellungen, ereignisTyp, GESAMTBERICHT_TITEL, groupFuellungenByFeuerwehr, IFeuerwehrFuellungen } from '../../reports/report-data';
import { NotificationDuration, NotificationService } from '../../services/notification/notification.service';
import { IAblageZiel, PdfAblageService } from '../../services/pdf-ablage/pdf-ablage.service';
import { IDruckErgebnis, PdfDruckService } from '../../services/pdf/pdf-druck.service';
import { IBerichtAuswahl, PdfService } from '../../services/pdf/pdf.service';
import { errorMessage } from '../../utils/error-message';

export interface IReport
{
    id: string;
    name: string;
    beschreibung: string;
    ausrichtung: 'Querformat' | 'Hochformat';
    /** Nur bei Berichten für eine einzelne Feuerwehr */
    gruppe?: IFeuerwehrFuellungen;
}

/** Daten für den Dialog */
export interface IBerichteDaten
{
    ereignis: IEreignis;
    /** Zusätzlich „Als PDF speichern“ anbieten (selten gebraucht, daher nur unter „Einsätze & Übungen“) */
    pdfSpeichern?: boolean;
}

/** Schnellauswahl im Menü */
export type BerichtVorauswahl = 'alle' | 'gesamt' | 'feuerwehren';

/**
 * Berichte eines Ereignisses: Auswahl von Gesamtbericht und Feuerwehrberichten, die gedruckt
 * oder (nur mit pdfSpeichern) als PDF gespeichert werden. Mit gewähltem Ordner wird jedes erzeugte PDF dort abgelegt.
 */
@Component({
    selector: 'ffg-berichte',
    templateUrl: './berichte.component.html',
    styleUrls: ['./berichte.component.scss'],
    imports: [
        MatDialogTitle, MatDialogContent, MatDialogActions, MatCheckbox, MatButton, MatDivider, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger,
        MatProgressBar, DatePipe, EreignisNummerPipe
    ]
})
export class BerichteComponent
{
    private dialog = inject<MatDialogRef<BerichteComponent>>(MatDialogRef);
    private notification = inject(NotificationService);
    private pdf = inject(PdfService);
    private druck = inject(PdfDruckService);
    public readonly ablage = inject(PdfAblageService);
    private readonly daten = inject<IBerichteDaten>(MAT_DIALOG_DATA);
    public readonly ereignis = this.daten.ereignis;
    public readonly pdfSpeichern = this.daten.pdfSpeichern ?? false;

    public readonly typ = ereignisTyp(this.ereignis);
    public readonly anzahl = anzahlFuellungen(this.ereignis.fuellungen?.length ?? 0);
    public readonly reports: Array<IReport> = this.createReports();
    public readonly gesamtbericht = this.reports[0];
    public readonly feuerwehrberichte = this.reports.slice(1);

    private readonly selectedIds = signal<ReadonlySet<string>>(new Set(this.reports.map(report => report.id)));

    public readonly selectedReports = computed(() => this.reports.filter(report => this.selectedIds().has(report.id)));
    public readonly allSelected = computed(() => this.selectedReports().length === this.reports.length);
    public readonly noneSelected = computed(() => this.selectedReports().length === 0);

    /** Was gerade passiert, null wenn nichts läuft */
    public readonly status = signal<string | null>(null);
    public readonly busy = computed(() => this.status() !== null);
    private readonly schritte = signal({ fertig: 0, gesamt: 0 });
    public readonly fortschritt = computed(() =>
    {
        const { fertig, gesamt } = this.schritte();
        return gesamt ? Math.round(100 * fertig / gesamt) : 0;
    });

    /** PDF zum Öffnen, wenn der Browser das Drucken und den neuen Tab blockiert hat */
    public readonly druckLink = signal<string | null>(null);

    private createReports(): Array<IReport>
    {
        const gruppen = groupFuellungenByFeuerwehr(this.ereignis.fuellungen ?? []);
        const feuerwehren = `${gruppen.length} ${gruppen.length === 1 ? 'Feuerwehr' : 'Feuerwehren'}`;

        return [
            {
                id: 'gesamt',
                name: GESAMTBERICHT_TITEL,
                beschreibung: `${this.anzahl} · ${feuerwehren}`,
                ausrichtung: 'Querformat'
            },
            ...gruppen.map((gruppe): IReport => ({
                id: `feuerwehr-${gruppe.feuerwehr.feuerwehrNummer}`,
                name: gruppe.feuerwehr.name,
                beschreibung: anzahlFuellungen(gruppe.fuellungen.length),
                ausrichtung: 'Hochformat',
                gruppe
            }))
        ];
    }

    public isSelected(report: IReport): boolean
    {
        return this.selectedIds().has(report.id);
    }

    public toggle(report: IReport, selected: boolean): void
    {
        this.selectedIds.update(ids =>
        {
            const result = new Set(ids);
            if (selected) result.add(report.id);
            else result.delete(report.id);
            return result;
        });
    }

    public selectAll(selected: boolean): void
    {
        this.selectedIds.set(new Set(selected ? this.reports.map(report => report.id) : []));
    }

    public vorauswahl(art: BerichtVorauswahl): void
    {
        const reports = art === 'alle' ? this.reports : art === 'gesamt' ? [this.gesamtbericht] : this.feuerwehrberichte;
        this.selectedIds.set(new Set(reports.map(report => report.id)));
    }

    public close(): void
    {
        if (!this.busy()) this.dialog.close();
    }

    /**
     * Druckt die ausgewählten Berichte als ein PDF. Mit gewähltem Ordner wird zusätzlich
     * jeder Bericht als eigenes PDF abgelegt, ohne Ordner wird nur gedruckt.
     */
    public async print(): Promise<void>
    {
        const auswahl = this.auswahl();
        if (!auswahl) return;

        this.beginnen('Berichte werden erstellt …', auswahl.length);
        this.druckLink.set(null);
        try
        {
            // Berechtigung für den Ordner zuerst, solange der Klick noch als Benutzeraktion gilt
            const ziel = await this.ablage.zielErmitteln();
            if (ziel.ordner) this.schritte.update(s => ({ ...s, gesamt: s.gesamt + auswahl.length }));

            const erstellt = new Date();
            const pdf = await this.pdf.createSammelPdf(this.ereignis, auswahl, erstellt, () => this.schritt());

            this.status.set('Druckdialog wird geöffnet …');
            const druck = await this.druck.drucken(pdf);
            if (druck.art === 'blockiert') this.druckLink.set(druck.url);

            const ablage = await this.ablegen(auswahl, ziel, erstellt);
            this.melden([druckMeldung(druck), ablage]);
        }
        catch (error)
        {
            this.notification.showError(error, 'Berichte konnten nicht gedruckt werden', NotificationDuration.long);
        }
        finally
        {
            this.beenden();
        }
    }

    /**
     * Speichert die ausgewählten Berichte als einzelne PDFs im gewählten Ordner, sonst als Download
     */
    public async savePdf(): Promise<void>
    {
        const auswahl = this.auswahl();
        if (!auswahl) return;

        this.beginnen('PDFs werden erstellt …', auswahl.length);
        try
        {
            const ergebnis = await this.ablage.speichern(this.ereignis, auswahl, { erstellt: new Date(), fortschritt: () => this.schritt() });
            if (ergebnis) this.melden([this.ablage.meldung(ergebnis)]);
        }
        catch (error)
        {
            this.notification.showError(error, 'PDFs konnten nicht gespeichert werden', NotificationDuration.long);
        }
        finally
        {
            this.beenden();
        }
    }

    /** Legt die gedruckten Berichte im Ordner ab und liefert die Meldung dazu */
    private async ablegen(auswahl: Array<IBerichtAuswahl>, ziel: IAblageZiel, erstellt: Date): Promise<string>
    {
        if (!ziel.ordner) return ziel.hinweis ? `PDFs wurden nicht abgelegt: ${ziel.hinweis}` : '';

        this.status.set('PDFs werden im Ordner abgelegt …');
        try
        {
            const ergebnis = await this.ablage.speichern(this.ereignis, auswahl, { ziel, download: false, erstellt, fortschritt: () => this.schritt() });
            return ergebnis ? this.ablage.meldung(ergebnis) : '';
        }
        catch (error)
        {
            return `PDFs konnten nicht abgelegt werden: ${errorMessage(error)}`;
        }
    }

    /** Auswahl für Drucken und Speichern, null wenn nichts ausgewählt ist oder gerade gearbeitet wird */
    private auswahl(): Array<IBerichtAuswahl> | null
    {
        if (this.noneSelected() || this.busy()) return null;
        return this.selectedReports().map(report => (report.gruppe ? { gruppe: report.gruppe } : {}));
    }

    private beginnen(status: string, schritte: number): void
    {
        this.status.set(status);
        this.schritte.set({ fertig: 0, gesamt: schritte });
        this.dialog.disableClose = true;
    }

    private schritt(): void
    {
        this.schritte.update(s => ({ ...s, fertig: s.fertig + 1 }));
    }

    private beenden(): void
    {
        this.status.set(null);
        this.dialog.disableClose = false;
    }

    private melden(meldungen: Array<string>): void
    {
        const text = meldungen.filter(meldung => !!meldung).join(' · ');
        if (text) this.notification.show(text, NotificationDuration.long);
    }
}

function druckMeldung(druck: IDruckErgebnis): string
{
    switch (druck.art)
    {
        case 'druckdialog': return '';
        case 'tab': return 'PDF in neuem Tab geöffnet, bitte dort drucken';
        case 'blockiert': return 'Neuer Tab wurde blockiert, bitte „PDF öffnen“ verwenden';
    }
}
