import { Component, inject } from '@angular/core';
import { SettingsService } from './shared/services/settings/settings.service';
import { SyncService } from './shared/services/sync/sync.service';

import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatToolbar, MatToolbarRow } from '@angular/material/toolbar';
import { MatButton } from '@angular/material/button';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'ffg-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [MatProgressSpinner, MatToolbar, MatToolbarRow, MatButton, RouterLink, MatIcon, RouterOutlet]
})
export class AppComponent
{
    settings = inject(SettingsService);
    sync = inject(SyncService);

    constructor()
    {
        this.sync.syncSavedFeuerwehren();
    }
}
