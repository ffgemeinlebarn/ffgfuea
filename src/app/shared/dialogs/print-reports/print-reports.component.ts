import { Component, ElementRef, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EreignisType } from '../../enums/ereignis-type';
import { EreignisseService } from '../../services/ereignisse/ereignisse.service';
import { ViewChild } from '@angular/core';
import { IEreignis } from '../../interfaces/i-ereignis';
import { MatList, MatListItem } from '@angular/material/list';
import { DatePipe } from '@angular/common';
import { MatRipple } from '@angular/material/core';
import { MatCheckbox } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'ffg-print-reports',
    templateUrl: './print-reports.component.html',
    styleUrls: ['./print-reports.component.scss'],
    providers: [
        { provide: Window, useValue: window }
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatList, MatListItem, MatRipple, MatCheckbox, FormsModule, MatButton, DatePipe]
})
export class PrintReportsComponent implements OnInit
{
    window = inject(Window);
    dialog = inject<MatDialogRef<PrintReportsComponent>>(MatDialogRef);
    data = inject<IEreignis>(MAT_DIALOG_DATA);
    ereignisse = inject(EreignisseService);

    @ViewChild('printContent') public printElement: ElementRef;

    public EreignisType = EreignisType;
    public printedDateTime = null;

    public fuellungenPerFeuerwehr = [];
    public reports = [];

    public async ngOnInit(): Promise<void>
    {
        this.printedDateTime = new Date();

        this.data.fuellungen.forEach((fuellung) =>
        {
            if (!this.fuellungenPerFeuerwehr.find(ff => ff.feuerwehrNummer === fuellung.flasche.feuerwehr.feuerwehrNummer))
            {
                this.fuellungenPerFeuerwehr.push(fuellung.flasche.feuerwehr);
            }
        });

        this.fuellungenPerFeuerwehr.forEach(feuerwehr => feuerwehr.fuellungen = this.data.fuellungen.filter(fuellung => fuellung.flasche.feuerwehr.feuerwehrNummer === feuerwehr.feuerwehrNummer));

        this.reports = [
            {
                name: 'Gesamtbericht',
                type: 'gesamt',
                data: this.fuellungenPerFeuerwehr,
                print: true
            }
        ];

        this.fuellungenPerFeuerwehr.forEach(feuerwehr =>
        {
            this.reports.push({
                name: `Bericht für die Feuerwehr ${feuerwehr.name}`,
                type: 'feuerwehr',
                data: [feuerwehr],
                print: true
            });
        });
    }

    public close(): void
    {
        this.dialog.close();
    }

    public print()
    {
        this.window.document.body.innerHTML = this.printElement.nativeElement.innerHTML;
        this.window.print();
        this.window.location.reload();
    }

    public onReportPrintBoolChange(change: any)
    {
        console.log(change);
    }
}
