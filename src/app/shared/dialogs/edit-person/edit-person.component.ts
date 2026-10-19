import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IPerson } from '../../interfaces/i-person';
import { DataService } from '../../services/data/data.service';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'ffg-edit-person',
    templateUrl: './edit-person.component.html',
    styleUrls: ['./edit-person.component.scss'],
    imports: [MatFormField, MatLabel, MatInput, FormsModule, MatButton]
})
export class EditPersonComponent
{
    private dialog = inject<MatDialogRef<EditPersonComponent>>(MatDialogRef);
    person = inject<IPerson>(MAT_DIALOG_DATA);
    private data = inject(DataService);

    public close(): void
    {
        this.dialog.close();
    }

    public async save(): Promise<void>
    {
        await this.data.savePerson(this.person);
        this.dialog.close();
    }
}
