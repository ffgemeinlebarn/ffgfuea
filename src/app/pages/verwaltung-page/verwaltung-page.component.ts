import { Component, inject, signal } from '@angular/core';
import { SyncService } from 'src/app/shared/services/sync/sync.service';
import { DataService } from 'src/app/shared/services/data/data.service';
import { DialogService } from 'src/app/shared/services/dialog/dialog.service';
import { NotificationService } from 'src/app/shared/services/notification/notification.service';
import { IFeuerwehr, toFeuerwehrRef } from 'src/app/shared/interfaces/i-feuerwehr';
import { IFlasche, isManuelleFlasche } from 'src/app/shared/interfaces/i-flasche';
import { EditFlascheComponent, IEditFlascheData } from 'src/app/shared/dialogs/edit-flasche/edit-flasche.component';
import { RemoveFlascheComponent } from 'src/app/shared/dialogs/remove-flasche/remove-flasche.component';
import { RemoveFeuerwehrComponent } from 'src/app/shared/dialogs/remove-feuerwehr/remove-feuerwehr.component';
import { IPerson } from 'src/app/shared/interfaces/i-person';
import { EditPersonComponent } from 'src/app/shared/dialogs/edit-person/edit-person.component';
import { MatCard } from '@angular/material/card';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { DatePipe } from '@angular/common';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription } from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';

@Component({
    selector: 'ffg-verwaltung-page',
    templateUrl: './verwaltung-page.component.html',
    styleUrls: ['./verwaltung-page.component.scss'],
    imports: [MatCard, MatFormField, MatLabel, MatInput, FormsModule, MatButton, MatIconButton, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatIcon, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, DatePipe]
})
export class VerwaltungPageComponent
{
    private dialogs = inject(DialogService);
    private sync = inject(SyncService);
    private notification = inject(NotificationService);
    data = inject(DataService);

    public displayedColumns: string[] = ['karteiNr', 'geraeteNr', 'flaschennummer', 'barcode', 'typenBezeichnung', 'typenInformation', 'lastEdit', 'quelle', 'aktionen'];
    public feuerwehrNummerToSync: number | null = null;
    public readonly vorname = signal('');
    public readonly nachname = signal('');

    public addFeuerwehrToSync(feuerwehrNummer: number | null)
    {
        if (feuerwehrNummer == null) return;
        this.sync.addFeuerwehr(feuerwehrNummer);
    }

    public openRemoveFeuerwehr(feuerwehr: IFeuerwehr)
    {
        this.dialogs.open(RemoveFeuerwehrComponent, feuerwehr);
    }

    public isManuell(flasche: IFlasche): boolean
    {
        return isManuelleFlasche(flasche);
    }

    public anzahlManuell(feuerwehr: IFeuerwehr): number
    {
        return feuerwehr.flaschen.filter(isManuelleFlasche).length;
    }

    public addFlasche(feuerwehr: IFeuerwehr)
    {
        const data: IEditFlascheData = { feuerwehr: toFeuerwehrRef(feuerwehr) };
        return this.dialogs.open(EditFlascheComponent, data);
    }

    /** Nur manuelle Flaschen sind bearbeitbar, Flaschen aus MAT werden bei der Synchronisierung überschrieben */
    public editFlasche(flasche: IFlasche)
    {
        if (!isManuelleFlasche(flasche)) return;
        const data: IEditFlascheData = { feuerwehr: flasche.feuerwehr, flasche };
        return this.dialogs.open(EditFlascheComponent, data);
    }

    public async removeFlasche(flasche: IFlasche)
    {
        if (!isManuelleFlasche(flasche)) return;
        if (!await this.dialogs.confirm(RemoveFlascheComponent, flasche)) return;

        try
        {
            await this.data.removeManuelleFlasche(flasche);
            this.notification.show('Flasche gelöscht');
        }
        catch (error)
        {
            this.notification.showError(error);
        }
    }

    public async addPerson()
    {
        await this.data.savePerson({ vorname: this.vorname(), nachname: this.nachname() });
        this.vorname.set('');
        this.nachname.set('');
    }

    public editPerson(person: IPerson)
    {
        this.dialogs.open(EditPersonComponent, { ...person });
    }

    public removePerson(person: IPerson)
    {
        this.data.removePerson(person);
    }
}
