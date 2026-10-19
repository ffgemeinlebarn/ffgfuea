import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SyncService } from 'src/app/shared/services/sync/sync.service';
import { StammdatenService } from 'src/app/shared/services/stammdaten/stammdaten.service';
import { IFeuerwehr } from 'src/app/shared/interfaces/i-feuerwehr';
import { IFlasche } from 'src/app/shared/interfaces/i-flasche';
import { SettingsService } from 'src/app/shared/services/settings/settings.service';
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
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatCard, MatFormField, MatLabel, MatInput, FormsModule, MatButton, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatIcon, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, DatePipe]
})
export class VerwaltungPageComponent implements OnInit
{
    dialog = inject(MatDialog);
    sync = inject(SyncService);
    stammdaten = inject(StammdatenService);
    settings = inject(SettingsService);

    public displayedColumns: string[] = ['karteiNr', 'geraeteNr', 'flaschennummer', 'barcode', 'typenBezeichnung', 'typenInformation', 'lastEdit'];
    public feuerwehrNummerToSync = null;

    public selectedFeuerwehr: IFeuerwehr = null;
    public selectedFlasche: IFlasche = null;

    public personToAdd: IPerson = {
        vorname: '',
        nachname: ''
    };
    public async ngOnInit(): Promise<void> { }

    public addFeuerwehrToSync(feuerwehrNummer: number)
    {
        this.sync.addFeuerwehr(feuerwehrNummer);
    }

    public openRemoveFeuerwehr(feuerwehr: IFeuerwehr)
    {
        this.dialog.open(RemoveFeuerwehrComponent, { width: '500px', data: feuerwehr });
    }

    public addPerson()
    {
        this.stammdaten.saveOrCreatePerson(this.personToAdd).then(_ =>
        {
            this.personToAdd.vorname = '';
            this.personToAdd.nachname = '';
        });
    }

    public editPerson(person: IPerson)
    {
        this.dialog.open(EditPersonComponent, { width: '500px', data: person });
    }

    public removePerson(person: IPerson)
    {
        this.stammdaten.removePerson(person);
    }
}
