import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { IFlasche } from '../../interfaces/i-flasche';

/**
 * Bestätigung vor dem Löschen einer manuellen Flasche, liefert true zum Löschen
 */
@Component({
    selector: 'ffg-remove-flasche',
    templateUrl: './remove-flasche.component.html',
    styleUrls: ['./remove-flasche.component.scss'],
    imports: [MatButton]
})
export class RemoveFlascheComponent
{
    private dialog = inject<MatDialogRef<RemoveFlascheComponent, boolean>>(MatDialogRef);
    public readonly flasche = inject<IFlasche>(MAT_DIALOG_DATA);

    public confirm(): void
    {
        this.dialog.close(true);
    }

    public close(): void
    {
        this.dialog.close(false);
    }
}
