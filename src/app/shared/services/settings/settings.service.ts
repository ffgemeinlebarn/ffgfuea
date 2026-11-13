import { Injectable, inject, signal } from '@angular/core';
import { NotificationDuration, NotificationService } from '../notification/notification.service';

@Injectable({
    providedIn: 'root'
})
export class SettingsService
{
    private notification = inject(NotificationService);

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
        this.notification.show('Die Einstellungen wurden gespeichert!', NotificationDuration.short);
    }

    public writeSyncLastEdit(lastEdit: string)
    {
        this.syncLastEdit.set(lastEdit);
        localStorage.setItem('syncLastEdit', lastEdit);
    }
}
