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
    /** Beim Abschließen & Drucken alle Berichte als PDF im gewählten Ordner ablegen */
    public readonly pdfAutoAblage = signal(true);

    constructor()
    {
        this.loadAll();
    }

    public loadAll()
    {
        this.testMode.set(localStorage.getItem('testMode') === 'true');
        this.syncUrl.set(localStorage.getItem('syncUrl') ?? '');
        this.syncLastEdit.set(localStorage.getItem('syncLastEdit') ?? '');
        this.pdfAutoAblage.set(localStorage.getItem('pdfAutoAblage') !== 'false');
    }

    public saveAll()
    {
        localStorage.setItem('testMode', String(this.testMode()));
        localStorage.setItem('syncUrl', this.syncUrl());
        localStorage.setItem('pdfAutoAblage', String(this.pdfAutoAblage()));
        this.notification.show('Die Einstellungen wurden gespeichert!', NotificationDuration.short);
    }

    public writeSyncLastEdit(lastEdit: string)
    {
        this.syncLastEdit.set(lastEdit);
        localStorage.setItem('syncLastEdit', lastEdit);
    }
}
