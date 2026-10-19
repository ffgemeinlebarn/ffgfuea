import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { environment } from 'src/environments/environment';
import { routes } from './app.routes';
import { FakeSyncApi } from './shared/services/sync-api/fake-sync-api';
import { HttpSyncApi } from './shared/services/sync-api/http-sync-api';
import { SyncApi } from './shared/services/sync-api/sync-api';

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideRouter(routes),
        provideHttpClient(withXhr()),
        provideServiceWorker('ngsw-worker.js', {
            enabled: environment.production,
            registrationStrategy: 'registerWhenStable:30000'
        }),
        { provide: SyncApi, useClass: environment.fakeSyncApi ? FakeSyncApi : HttpSyncApi }
    ]
};
