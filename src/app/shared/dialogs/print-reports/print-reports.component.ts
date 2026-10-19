import { Component, DOCUMENT, ElementRef, inject, viewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EreignisType } from '../../enums/ereignis-type';
import { IEreignis } from '../../interfaces/i-ereignis';
import { IFeuerwehr } from '../../interfaces/i-feuerwehr';
import { IFuellung } from '../../interfaces/i-fuellung';
import { MatList, MatListItem } from '@angular/material/list';
import { DatePipe } from '@angular/common';
import { MatRipple } from '@angular/material/core';
import { MatCheckbox } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';

interface IFeuerwehrFuellungen extends IFeuerwehr
{
    fuellungen: Array<IFuellung>;
}

interface IReport
{
    name: string;
    type: 'gesamt' | 'feuerwehr';
    data: Array<IFeuerwehrFuellungen>;
    print: boolean;
}

@Component({
    selector: 'ffg-print-reports',
    templateUrl: './print-reports.component.html',
    styleUrls: ['./print-reports.component.scss'],
    imports: [MatList, MatListItem, MatRipple, MatCheckbox, FormsModule, MatButton, DatePipe]
})
export class PrintReportsComponent
{
    private document = inject(DOCUMENT);
    private dialog = inject<MatDialogRef<PrintReportsComponent>>(MatDialogRef);
    data = inject<IEreignis>(MAT_DIALOG_DATA);

    private printElement = viewChild.required<ElementRef<HTMLElement>>('printContent');

    public EreignisType = EreignisType;
    public printedDateTime = new Date();
    public reports: Array<IReport> = this.createReports();

    private createReports(): Array<IReport>
    {
        const fuellungenPerFeuerwehr = new Map<number, IFeuerwehrFuellungen>();

        for (const fuellung of this.data.fuellungen)
        {
            const feuerwehr = fuellung.flasche.feuerwehr;
            if (!fuellungenPerFeuerwehr.has(feuerwehr.feuerwehrNummer))
            {
                fuellungenPerFeuerwehr.set(feuerwehr.feuerwehrNummer, { ...feuerwehr, fuellungen: [] });
            }
            fuellungenPerFeuerwehr.get(feuerwehr.feuerwehrNummer).fuellungen.push(fuellung);
        }

        const feuerwehren = [...fuellungenPerFeuerwehr.values()];

        return [
            { name: 'Gesamtbericht', type: 'gesamt', data: feuerwehren, print: true },
            ...feuerwehren.map((feuerwehr): IReport => ({
                name: `Bericht für die Feuerwehr ${feuerwehr.name}`,
                type: 'feuerwehr',
                data: [feuerwehr],
                print: true
            }))
        ];
    }

    public close(): void
    {
        this.dialog.close();
    }

    public print()
    {
        this.document.body.innerHTML = this.printElement().nativeElement.innerHTML;
        this.document.defaultView.print();
        this.document.defaultView.location.reload();
    }
}
