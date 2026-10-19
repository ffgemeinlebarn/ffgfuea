import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IFuellung } from '../../interfaces/i-fuellung';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'ffg-confirm-fuellung',
    templateUrl: './confirm-fuellung.component.html',
    styleUrls: ['./confirm-fuellung.component.scss'],
    imports: [MatButton, MatIcon]
})
export class ConfirmFuellungComponent
{
    private dialog = inject<MatDialogRef<ConfirmFuellungComponent, boolean>>(MatDialogRef);
    fuellungToConfirm = inject<IFuellung>(MAT_DIALOG_DATA);

    public close(): void
    {
        this.dialog.close(false);
    }

    public confirm(): void
    {
        this.dialog.close(true);
    }
}
