import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';

describe('SettingsService', () =>
{
    it('lädt die Einstellungen aus dem LocalStorage', () =>
    {
        localStorage.setItem('testMode', 'true');
        localStorage.setItem('syncUrl', 'http://localhost:3000');

        const service = TestBed.inject(SettingsService);

        expect(service.testMode()).toBe(true);
        expect(service.syncUrl()).toBe('http://localhost:3000');
        expect(service.syncLastEdit()).toBe('');
    });

    it('speichert Einstellungen erst mit saveAll', () =>
    {
        const service = TestBed.inject(SettingsService);

        service.syncUrl.set('http://mat:3000');
        service.loadAll();
        expect(service.syncUrl()).toBe('');

        service.syncUrl.set('http://mat:3000');
        service.testMode.set(true);
        service.saveAll();
        expect(localStorage.getItem('syncUrl')).toBe('http://mat:3000');
        expect(localStorage.getItem('testMode')).toBe('true');
    });

    it('merkt sich den Stand der Synchronisierung', () =>
    {
        const service = TestBed.inject(SettingsService);

        service.writeSyncLastEdit('2026-10-01');

        expect(service.syncLastEdit()).toBe('2026-10-01');
        expect(localStorage.getItem('syncLastEdit')).toBe('2026-10-01');
    });
});
