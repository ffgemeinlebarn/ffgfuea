import
    {
        ApplicationConfig,
        importProvidersFrom
    } from '@angular/core';
import { provideRouter } from '@angular/router';

import { CdkColumnDef } from '@angular/cdk/table';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { BrowserModule, HammerModule } from '@angular/platform-browser';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from 'src/environments/environment.development';
import { routes } from './app.routes';
import { SharedModule } from './shared/shared.module';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(routes),
        provideHttpClient(withXhr()),
        importProvidersFrom(SharedModule, BrowserModule, HammerModule, FormsModule, MatDialogModule, ServiceWorkerModule.register('ngsw-worker.js', {
            enabled: environment.production,
            registrationStrategy: 'registerWhenStable:30000'
        })),
        CdkColumnDef
    ],
};