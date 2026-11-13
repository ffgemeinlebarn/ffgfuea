import { Component, inject } from '@angular/core';
import { BerichteComponent, IBerichteDaten } from 'src/app/shared/dialogs/berichte/berichte.component';
import { EditEreignisComponent } from 'src/app/shared/dialogs/edit-ereignis/edit-ereignis.component';
import { EreignisType } from 'src/app/shared/enums/ereignis-type';
import { IEreignis } from 'src/app/shared/interfaces/i-ereignis';
import { DataService } from 'src/app/shared/services/data/data.service';
import { DialogService } from 'src/app/shared/services/dialog/dialog.service';
import { DatePipe } from '@angular/common';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription } from '@angular/material/expansion';
import { MatButton } from '@angular/material/button';
import { MatList } from '@angular/material/list';
import { FuellungItemComponent } from '../../shared/components/fuellung-item/fuellung-item.component';
import { EreignisNummerPipe } from '../../shared/pipes/ereignis-nummer/ereignis-nummer.pipe';

@Component({
    selector: 'ffg-ereignisse-page',
    templateUrl: './ereignisse-page.component.html',
    styleUrls: ['./ereignisse-page.component.scss'],
    imports: [MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatButton, MatList, FuellungItemComponent, DatePipe, EreignisNummerPipe]
})
export class EreignissePageComponent
{
    data = inject(DataService);
    private dialogs = inject(DialogService);

    public EreignisType = EreignisType;

    /** Berichte drucken oder als PDF speichern */
    public openBerichte(ereignis: IEreignis)
    {
        this.dialogs.open(BerichteComponent, { ereignis, pdfSpeichern: true } satisfies IBerichteDaten);
    }

    public openEditEreignis(ereignis: IEreignis)
    {
        this.dialogs.open(EditEreignisComponent, structuredClone(ereignis));
    }
}
