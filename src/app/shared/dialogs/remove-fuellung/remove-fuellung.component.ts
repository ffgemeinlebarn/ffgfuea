import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IFuellung } from '../../interfaces/i-fuellung';
import { OperatingService } from '../../services/operating/operating.service';
import { MatLine } from '@angular/material/grid-list';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'ffg-remove-fuellung',
    templateUrl: './remove-fuellung.component.html',
    styleUrls: ['./remove-fuellung.component.scss'],
    imports: [MatLine, MatButton, MatIcon, DatePipe]
})
export class RemoveFuellungComponent
{
    private dialog = inject<MatDialogRef<RemoveFuellungComponent>>(MatDialogRef);
    fuellung = inject<IFuellung>(MAT_DIALOG_DATA);
    private operating = inject(OperatingService);

    public remove()
    {
        this.operating.removeFuellung(this.fuellung);
        this.dialog.close();
    }

    public close(): void
    {
        this.dialog.close();
    }
}
