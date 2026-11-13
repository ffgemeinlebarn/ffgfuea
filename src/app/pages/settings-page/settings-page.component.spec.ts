import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FakeDirectoryHandle, installDirectoryPicker, removeDirectoryPicker } from 'src/app/testing/file-system';
import { NotificationService } from 'src/app/shared/services/notification/notification.service';
import { OrdnerStore } from 'src/app/shared/services/pdf-ablage/ordner-store';
import { SettingsService } from 'src/app/shared/services/settings/settings.service';
import { SyncApi } from 'src/app/shared/services/sync-api/sync-api';
import { SettingsPageComponent } from './settings-page.component';

describe('Einstellungen: PDF-Ablage', () =>
{
    let gespeichert: FileSystemDirectoryHandle | undefined;
    let neuerOrdner: FakeDirectoryHandle;
    let show: ReturnType<typeof vi.spyOn>;

    beforeEach(() =>
    {
        gespeichert = undefined;
        neuerOrdner = new FakeDirectoryHandle('Berichte');
        installDirectoryPicker(async () => neuerOrdner);
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                { provide: SyncApi, useValue: {} },
                {
                    provide: OrdnerStore,
                    useValue: {
                        get: async () => gespeichert,
                        set: async (handle: FileSystemDirectoryHandle) => { gespeichert = handle; },
                        delete: async () => { gespeichert = undefined; }
                    }
                }
            ]
        });
        show = vi.spyOn(TestBed.inject(NotificationService), 'show').mockImplementation(() => undefined);
    });

    afterEach(() =>
    {
        removeDirectoryPicker();
        vi.restoreAllMocks();
    });

    async function render(): Promise<ComponentFixture<SettingsPageComponent>>
    {
        const fixture = TestBed.createComponent(SettingsPageComponent);
        await fixture.componentInstance.ablage.geladen;
        await fixture.whenStable();
        return fixture;
    }

    const card = (fixture: ComponentFixture<unknown>): HTMLElement => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.pdf-ablage')!;
    const button = (fixture: ComponentFixture<unknown>, selector: string): HTMLButtonElement | null => card(fixture).querySelector(selector);

    it('wählt einen Ordner aus und zeigt seinen Namen', async () =>
    {
        const fixture = await render();
        expect(card(fixture).textContent).toContain('keiner ausgewählt');
        expect(button(fixture, '.ordner-waehlen')?.textContent).toContain('Ordner auswählen');
        expect(button(fixture, '.ordner-entfernen')).toBeNull();

        button(fixture, '.ordner-waehlen')!.click();
        await vi.waitFor(() => expect(gespeichert).toBe(neuerOrdner));
        await fixture.whenStable();

        expect(card(fixture).querySelector('.ordner')?.textContent).toContain('Berichte');
        expect(button(fixture, '.ordner-waehlen')?.textContent).toContain('Ordner ändern');
        expect(show).toHaveBeenCalledWith('PDFs werden im Ordner „Berichte“ abgelegt');
    });

    it('entfernt den gewählten Ordner', async () =>
    {
        gespeichert = new FakeDirectoryHandle('Alt').asHandle();
        const fixture = await render();
        expect(card(fixture).querySelector('.ordner')?.textContent).toContain('Alt');

        button(fixture, '.ordner-entfernen')!.click();
        await vi.waitFor(() => expect(gespeichert).toBeUndefined());
        await fixture.whenStable();

        expect(card(fixture).textContent).toContain('keiner ausgewählt');
        expect(button(fixture, '.ordner-entfernen')).toBeNull();
    });

    it('weist ohne Unterstützung des Browsers auf den Download hin', async () =>
    {
        removeDirectoryPicker();
        const fixture = await render();

        expect(card(fixture).textContent).toContain('Dieser Browser unterstützt keine Ordnerauswahl');
        expect(button(fixture, '.ordner-waehlen')).toBeNull();
    });

    it('schaltet die automatische Ablage um und speichert sie mit den Einstellungen', async () =>
    {
        const fixture = await render();
        const settings = TestBed.inject(SettingsService);
        const toggle: HTMLButtonElement = card(fixture).querySelector('.pdf-auto-ablage button')!;
        expect(toggle.getAttribute('aria-checked')).toBe('true');

        toggle.click();
        await fixture.whenStable();
        expect(settings.pdfAutoAblage()).toBe(false);

        // Wie die übrigen Einstellungen erst mit "Speichern"
        expect(localStorage.getItem('pdfAutoAblage')).toBeNull();
        settings.saveAll();
        expect(localStorage.getItem('pdfAutoAblage')).toBe('false');
    });
});
