import { Component, inject, signal } from '@angular/core';
import { EditEreignisComponent } from 'src/app/shared/dialogs/edit-ereignis/edit-ereignis.component';
import { PrintReportsComponent } from 'src/app/shared/dialogs/print-reports/print-reports.component';
import { EreignisType } from 'src/app/shared/enums/ereignis-type';
import { IEreignis } from 'src/app/shared/interfaces/i-ereignis';
import { DataService } from 'src/app/shared/services/data/data.service';
import { DialogService } from 'src/app/shared/services/dialog/dialog.service';
import { NotificationDuration, NotificationService } from 'src/app/shared/services/notification/notification.service';
import { PdfAblageService } from 'src/app/shared/services/pdf-ablage/pdf-ablage.service';
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
    private notification = inject(NotificationService);
    private ablage = inject(PdfAblageService);

    public EreignisType = EreignisType;

    /** Ereignis, dessen PDFs gerade gespeichert werden */
    public readonly saving = signal<IEreignis | null>(null);

    public openPrintReportings(ereignis: IEreignis)
    {
        this.dialogs.open(PrintReportsComponent, ereignis);
    }

    /**
     * Speichert alle Berichte des Ereignisses als PDF im gewählten Ordner, sonst als Download
     */
    public async savePdfs(ereignis: IEreignis)
    {
        if (this.saving()) return;

        this.saving.set(ereignis);
        try
        {
            const ergebnis = await this.ablage.speichern(ereignis);
            if (ergebnis) this.notification.show(this.ablage.meldung(ergebnis), NotificationDuration.long);
        }
        catch (error)
        {
            this.notification.showError(error, 'PDFs konnten nicht gespeichert werden', NotificationDuration.long);
        }
        finally
        {
            this.saving.set(null);
        }
    }

    public openEditEreignis(ereignis: IEreignis)
    {
        this.dialogs.open(EditEreignisComponent, structuredClone(ereignis));
    }
}
