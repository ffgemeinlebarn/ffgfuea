import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { OperatingService } from '../../services/operating/operating.service';
import { ConfirmFuellungComponent } from '../confirm-fuellung/confirm-fuellung.component';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'ffg-confirm-ereignis-abschluss',
    templateUrl: './confirm-ereignis-abschluss.component.html',
    styleUrls: ['./confirm-ereignis-abschluss.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButton, MatIcon]
})
export class ConfirmEreignisAbschlussComponent implements OnInit
{
    dialog = inject<MatDialogRef<ConfirmFuellungComponent>>(MatDialogRef);
    private operating = inject(OperatingService);


    public ngOnInit(): void { }

    public close(): void
    {
        this.dialog.close();
    }

    public async confirm(): Promise<void>
    {
        this.operating.closeEreignis();
        this.dialog.close();
    }
}
