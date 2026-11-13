import { DatePipe } from '@angular/common';
import { Component, computed, DOCUMENT, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { IEreignis } from '../../interfaces/i-ereignis';
import { FeuerwehrberichtComponent } from '../../reports/feuerwehrbericht/feuerwehrbericht.component';
import { GesamtberichtComponent } from '../../reports/gesamtbericht/gesamtbericht.component';
import { anzahlFuellungen, ereignisBezeichnung, groupFuellungenByFeuerwehr, IFeuerwehrFuellungen } from '../../reports/report-data';

export interface IReport
{
    id: string;
    name: string;
    beschreibung: string;
    /** Nur bei Berichten für eine einzelne Feuerwehr */
    gruppe?: IFeuerwehrFuellungen;
}

@Component({
    selector: 'ffg-print-reports',
    templateUrl: './print-reports.component.html',
    styleUrls: ['./print-reports.component.scss'],
    imports: [
        MatDialogTitle, MatDialogContent, MatDialogActions, MatCheckbox, MatButton, MatDivider, DatePipe,
        GesamtberichtComponent, FeuerwehrberichtComponent
    ]
})
export class PrintReportsComponent
{
    private document = inject(DOCUMENT);
    private dialog = inject<MatDialogRef<PrintReportsComponent>>(MatDialogRef);
    public readonly data = inject<IEreignis>(MAT_DIALOG_DATA);

    private printElement = viewChild.required<ElementRef<HTMLElement>>('printContent');

    public readonly printedDateTime = new Date();
    public readonly bezeichnung = ereignisBezeichnung(this.data);
    public readonly anzahl = anzahlFuellungen(this.data.fuellungen?.length ?? 0);
    public readonly reports: Array<IReport> = this.createReports();

    private readonly selectedIds = signal<ReadonlySet<string>>(new Set(this.reports.map(report => report.id)));

    public readonly selectedReports = computed(() => this.reports.filter(report => this.selectedIds().has(report.id)));
    public readonly allSelected = computed(() => this.selectedReports().length === this.reports.length);
    public readonly noneSelected = computed(() => this.selectedReports().length === 0);

    private createReports(): Array<IReport>
    {
        const gruppen = groupFuellungenByFeuerwehr(this.data.fuellungen ?? []);

        return [
            {
                id: 'gesamt',
                name: GesamtberichtComponent.titel,
                beschreibung: `Übersicht aller Feuerwehren · ${this.anzahl} · Querformat`
            },
            ...gruppen.map((gruppe): IReport => ({
                id: `feuerwehr-${gruppe.feuerwehr.feuerwehrNummer}`,
                name: FeuerwehrberichtComponent.titel(gruppe.feuerwehr.name),
                beschreibung: `${anzahlFuellungen(gruppe.fuellungen.length)} · Hochformat`,
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

    public close(): void
    {
        this.dialog.close();
    }

    public print(): void
    {
        if (this.noneSelected()) return;

        // Der geöffnete Dialog fixiert das Dokument (Scroll-Sperre), das würde den Ausdruck abschneiden
        this.document.documentElement.classList.remove('cdk-global-scrollblock');
        this.document.body.innerHTML = this.printElement().nativeElement.innerHTML;
        this.document.defaultView?.print();
        this.document.defaultView?.location.reload();
    }
}
