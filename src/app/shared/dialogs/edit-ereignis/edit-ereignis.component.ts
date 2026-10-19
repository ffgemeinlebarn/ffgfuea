import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EreignisType } from '../../enums/ereignis-type';
import { IEreignis } from '../../interfaces/i-ereignis';
import { DataService, compareById } from '../../services/data/data.service';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect, MatOption } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'ffg-edit-ereignis',
    templateUrl: './edit-ereignis.component.html',
    styleUrls: ['./edit-ereignis.component.scss'],
    imports: [MatFormField, MatLabel, MatSelect, FormsModule, MatOption, MatInput, MatButton]
})
export class EditEreignisComponent
{
    private dialog = inject<MatDialogRef<EditEreignisComponent>>(MatDialogRef);
    ereignis = inject<IEreignis>(MAT_DIALOG_DATA);
    data = inject(DataService);

    public EreignisType = EreignisType;
    public compareById = compareById;

    public close(): void
    {
        this.dialog.close();
    }

    public async save(): Promise<void>
    {
        await this.data.saveEreignis(this.ereignis);
        this.dialog.close();
    }
}
