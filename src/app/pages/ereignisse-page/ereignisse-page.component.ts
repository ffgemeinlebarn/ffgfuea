import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EditEreignisComponent } from 'src/app/shared/dialogs/edit-ereignis/edit-ereignis.component';
import { PrintReportsComponent } from 'src/app/shared/dialogs/print-reports/print-reports.component';
import { EreignisType } from 'src/app/shared/enums/ereignis-type';
import { IEreignis } from 'src/app/shared/interfaces/i-ereignis';
import { EreignisseService } from 'src/app/shared/services/ereignisse/ereignisse.service';
import { DatePipe } from '@angular/common';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription } from '@angular/material/expansion';
import { MatButton } from '@angular/material/button';
import { MatList } from '@angular/material/list';
import { FuellungItemComponent } from '../../shared/components/fuellung-item/fuellung-item.component';

@Component({
    selector: 'ffg-ereignisse-page',
    templateUrl: './ereignisse-page.component.html',
    styleUrls: ['./ereignisse-page.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatButton, MatList, FuellungItemComponent, DatePipe]
})
export class EreignissePageComponent implements OnInit
{
    ereignisse = inject(EreignisseService);
    dialog = inject(MatDialog);

    public EreignisType = EreignisType;
    public async ngOnInit(): Promise<void> { }

    public async openPrintReportings(ereignis: IEreignis)
    {
        this.dialog.open(PrintReportsComponent, { width: '500px', data: ereignis });
    }

    public async openEditEreignis(ereignis: IEreignis)
    {
        this.dialog.open(EditEreignisComponent, { width: '500px', data: ereignis });
    }
}
