import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SettingsService } from '../settings/settings.service';
import { IMatFeuerwehr, SyncApi } from './sync-api';

@Injectable()
export class HttpSyncApi extends SyncApi
{
    private http = inject(HttpClient);
    private settings = inject(SettingsService);

    public async getLastEdit(): Promise<string>
    {
        const response = await firstValueFrom(this.http.get<{ lastEdit: string }>(this.settings.syncUrl()));
        return response.lastEdit;
    }

    public getFeuerwehr(feuerwehrNummer: number): Promise<IMatFeuerwehr | null>
    {
        return firstValueFrom(this.http.get<IMatFeuerwehr>(`${this.settings.syncUrl()}/sync/${feuerwehrNummer}`));
    }
}
