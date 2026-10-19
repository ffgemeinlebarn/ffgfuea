import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
    providedIn: 'root'
})
export class SettingsService
{
    private snackBar = inject(MatSnackBar);

    public readonly testMode = signal(false);
    public readonly syncUrl = signal('');
    public readonly syncLastEdit = signal('');

    constructor()
    {
        this.loadAll();
    }

    public loadAll()
    {
        this.testMode.set(localStorage.getItem('testMode') === 'true');
        this.syncUrl.set(localStorage.getItem('syncUrl') ?? '');
        this.syncLastEdit.set(localStorage.getItem('syncLastEdit') ?? '');
    }

    public saveAll()
    {
        localStorage.setItem('testMode', String(this.testMode()));
        localStorage.setItem('syncUrl', this.syncUrl());
        this.snackBar.open('Die Einstellungen wurden gespeichert!', null, { duration: 1000 });
    }

    public writeSyncLastEdit(lastEdit: string)
    {
        this.syncLastEdit.set(lastEdit);
        localStorage.setItem('syncLastEdit', lastEdit);
    }
}
