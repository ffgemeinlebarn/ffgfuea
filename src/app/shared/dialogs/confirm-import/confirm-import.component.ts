import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';

export interface IConfirmImportData
{
    feuerwehren: number;
    personen: number;
    ereignisse: number;
    testMode: boolean;
}

@Component({
    selector: 'ffg-confirm-import',
    templateUrl: './confirm-import.component.html',
    styleUrls: ['./confirm-import.component.scss'],
    imports: [MatButton]
})
export class ConfirmImportComponent
{
    private dialog = inject<MatDialogRef<ConfirmImportComponent, boolean>>(MatDialogRef);
    vorhanden = inject<IConfirmImportData>(MAT_DIALOG_DATA);

    public close(): void
    {
        this.dialog.close(false);
    }

    public confirm(): void
    {
        this.dialog.close(true);
    }
}
