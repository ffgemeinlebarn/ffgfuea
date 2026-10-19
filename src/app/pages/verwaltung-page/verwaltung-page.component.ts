import { Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SyncService } from 'src/app/shared/services/sync/sync.service';
import { DataService } from 'src/app/shared/services/data/data.service';
import { IFeuerwehr } from 'src/app/shared/interfaces/i-feuerwehr';
import { RemoveFeuerwehrComponent } from 'src/app/shared/dialogs/remove-feuerwehr/remove-feuerwehr.component';
import { IPerson } from 'src/app/shared/interfaces/i-person';
import { EditPersonComponent } from 'src/app/shared/dialogs/edit-person/edit-person.component';
import { MatCard } from '@angular/material/card';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { DatePipe } from '@angular/common';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription } from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';

@Component({
    selector: 'ffg-verwaltung-page',
    templateUrl: './verwaltung-page.component.html',
    styleUrls: ['./verwaltung-page.component.scss'],
    imports: [MatCard, MatFormField, MatLabel, MatInput, FormsModule, MatButton, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatIcon, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, DatePipe]
})
export class VerwaltungPageComponent
{
    private dialog = inject(MatDialog);
    private sync = inject(SyncService);
    data = inject(DataService);

    public displayedColumns: string[] = ['karteiNr', 'geraeteNr', 'flaschennummer', 'barcode', 'typenBezeichnung', 'typenInformation', 'lastEdit'];
    public feuerwehrNummerToSync = null;
    public readonly vorname = signal('');
    public readonly nachname = signal('');

    public addFeuerwehrToSync(feuerwehrNummer: number)
    {
        this.sync.addFeuerwehr(feuerwehrNummer);
    }

    public openRemoveFeuerwehr(feuerwehr: IFeuerwehr)
    {
        this.dialog.open(RemoveFeuerwehrComponent, { width: '500px', data: feuerwehr });
    }

    public async addPerson()
    {
        await this.data.savePerson({ vorname: this.vorname(), nachname: this.nachname() });
        this.vorname.set('');
        this.nachname.set('');
    }

    public editPerson(person: IPerson)
    {
        this.dialog.open(EditPersonComponent, { width: '500px', data: { ...person } });
    }

    public removePerson(person: IPerson)
    {
        this.data.removePerson(person);
    }
}
