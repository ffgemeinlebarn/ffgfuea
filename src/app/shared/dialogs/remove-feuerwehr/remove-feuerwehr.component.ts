
import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IFeuerwehr } from '../../interfaces/i-feuerwehr';
import { StammdatenService } from '../../services/stammdaten/stammdaten.service';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'ffg-remove-feuerwehr',
    templateUrl: './remove-feuerwehr.component.html',
    styleUrls: ['./remove-feuerwehr.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButton]
})
export class RemoveFeuerwehrComponent implements OnInit
{
    dialog = inject<MatDialogRef<RemoveFeuerwehrComponent>>(MatDialogRef);
    feuerwehr = inject<IFeuerwehr>(MAT_DIALOG_DATA);
    private stammdaten = inject(StammdatenService);

    public ngOnInit(): void { }

    public remove()
    {
        this.stammdaten.removeFeuerwehr(this.feuerwehr).finally(() => this.dialog.close());
    }

    public close(): void
    {
        this.dialog.close();
    }
}
