import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IFeuerwehr } from '../../interfaces/i-feuerwehr';
import { DataService } from '../../services/data/data.service';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'ffg-remove-feuerwehr',
    templateUrl: './remove-feuerwehr.component.html',
    styleUrls: ['./remove-feuerwehr.component.scss'],
    imports: [MatButton]
})
export class RemoveFeuerwehrComponent
{
    private dialog = inject<MatDialogRef<RemoveFeuerwehrComponent>>(MatDialogRef);
    feuerwehr = inject<IFeuerwehr>(MAT_DIALOG_DATA);
    private data = inject(DataService);

    public remove()
    {
        this.data.removeFeuerwehr(this.feuerwehr).finally(() => this.dialog.close());
    }

    public close(): void
    {
        this.dialog.close();
    }
}
