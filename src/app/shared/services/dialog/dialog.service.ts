import { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class DialogService
{
    private dialog = inject(MatDialog);

    /**
     * Öffnet einen Dialog und liefert nach dem Schließen sein Ergebnis
     */
    public open<R = unknown>(component: ComponentType<unknown>, data?: unknown): Promise<R | undefined>
    {
        const ref = this.dialog.open<unknown, unknown, R>(component, { width: '500px', data });
        return firstValueFrom(ref.afterClosed(), { defaultValue: undefined });
    }

    /**
     * Öffnet einen Bestätigungsdialog, der mit true bestätigt wird
     */
    public async confirm(component: ComponentType<unknown>, data?: unknown): Promise<boolean>
    {
        return await this.open<boolean>(component, data) === true;
    }
}
