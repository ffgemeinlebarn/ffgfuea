import { Component, inject } from '@angular/core';
import { EditEreignisComponent } from 'src/app/shared/dialogs/edit-ereignis/edit-ereignis.component';
import { PrintReportsComponent } from 'src/app/shared/dialogs/print-reports/print-reports.component';
import { EreignisType } from 'src/app/shared/enums/ereignis-type';
import { IEreignis } from 'src/app/shared/interfaces/i-ereignis';
import { DataService } from 'src/app/shared/services/data/data.service';
import { DialogService } from 'src/app/shared/services/dialog/dialog.service';
import { DatePipe } from '@angular/common';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription } from '@angular/material/expansion';
import { MatButton } from '@angular/material/button';
import { MatList } from '@angular/material/list';
import { FuellungItemComponent } from '../../shared/components/fuellung-item/fuellung-item.component';

@Component({
    selector: 'ffg-ereignisse-page',
    templateUrl: './ereignisse-page.component.html',
    styleUrls: ['./ereignisse-page.component.scss'],
    imports: [MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatButton, MatList, FuellungItemComponent, DatePipe]
})
export class EreignissePageComponent
{
    data = inject(DataService);
    private dialogs = inject(DialogService);

    public EreignisType = EreignisType;

    public openPrintReportings(ereignis: IEreignis)
    {
        this.dialogs.open(PrintReportsComponent, ereignis);
    }

    public openEditEreignis(ereignis: IEreignis)
    {
        this.dialogs.open(EditEreignisComponent, structuredClone(ereignis));
    }
}
