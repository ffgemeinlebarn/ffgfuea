import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { IFeuerwehr } from '../../interfaces/i-feuerwehr';
import { IFlasche } from '../../interfaces/i-flasche';
import { DataService } from '../../services/data/data.service';
import { OperatingService } from '../../services/operating/operating.service';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect, MatOption } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'ffg-search-flasche',
    templateUrl: './search-flasche.component.html',
    styleUrls: ['./search-flasche.component.scss'],
    imports: [MatFormField, MatLabel, MatSelect, FormsModule, MatOption, MatButton]
})
export class SearchFlascheComponent
{
    private dialog = inject<MatDialogRef<SearchFlascheComponent>>(MatDialogRef);
    private operating = inject(OperatingService);
    data = inject(DataService);

    public selectedFeuerwehr: IFeuerwehr = this.data.feuerwehren()[0];
    public selectedFlasche: IFlasche = this.selectedFeuerwehr?.flaschen[0];

    public feuerwehrChanged()
    {
        this.selectedFlasche = this.selectedFeuerwehr?.flaschen[0];
    }

    public close(): void
    {
        this.dialog.close();
    }

    public add(): void
    {
        this.operating.addFuellung(this.selectedFlasche);
        this.dialog.close();
    }
}
