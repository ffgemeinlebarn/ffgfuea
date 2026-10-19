import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { SettingsService } from './shared/services/settings/settings.service';
import { SyncApi } from './shared/services/sync-api/sync-api';

describe('AppComponent', () =>
{
    beforeEach(() =>
    {
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                { provide: SyncApi, useValue: { getLastEdit: vi.fn(async () => ''), getFeuerwehr: vi.fn() } }
            ]
        });
    });

    it('zeigt die Navigation und startet die Synchronisierung', async () =>
    {
        const fixture = TestBed.createComponent(AppComponent);
        await fixture.whenStable();

        expect(fixture.nativeElement.textContent).toContain('Einsätze & Übungen');
        expect(TestBed.inject(SyncApi).getLastEdit).toHaveBeenCalled();
    });

    it('zeigt den Hinweis im Testmodus', async () =>
    {
        const fixture = TestBed.createComponent(AppComponent);
        TestBed.inject(SettingsService).testMode.set(true);
        await fixture.whenStable();

        expect(fixture.nativeElement.textContent).toContain('Der Testmodus ist aktiviert!');
    });
});
