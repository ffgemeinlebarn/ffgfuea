import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'ffg-confirm-ereignis-abschluss',
    templateUrl: './confirm-ereignis-abschluss.component.html',
    styleUrls: ['./confirm-ereignis-abschluss.component.scss'],
    imports: [MatButton, MatIcon]
})
export class ConfirmEreignisAbschlussComponent
{
    private dialog = inject<MatDialogRef<ConfirmEreignisAbschlussComponent, boolean>>(MatDialogRef);

    public close(): void
    {
        this.dialog.close(false);
    }

    public confirm(): void
    {
        this.dialog.close(true);
    }
}
