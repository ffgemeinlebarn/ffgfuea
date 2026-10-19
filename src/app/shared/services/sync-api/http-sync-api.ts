import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IFeuerwehr } from '../../interfaces/i-feuerwehr';
import { SettingsService } from '../settings/settings.service';
import { SyncApi } from './sync-api';

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

    public getFeuerwehr(feuerwehrNummer: number): Promise<IFeuerwehr | null>
    {
        return firstValueFrom(this.http.get<IFeuerwehr>(`${this.settings.syncUrl()}/sync/${feuerwehrNummer}`));
    }
}
