import { TestBed } from '@angular/core/testing';
import { TimingService } from './timing.service';

describe('TimingService', () =>
{
    let service: TimingService;

    beforeEach(() =>
    {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 0, 1, 9, 5, 7));
        service = TestBed.inject(TimingService);
    });

    afterEach(() => vi.useRealTimers());

    it('zeigt die aktuelle Uhrzeit und aktualisiert sie jede Sekunde', () =>
    {
        expect(service.currentTime()).toBe('09 : 05 : 07');

        vi.advanceTimersByTime(1000);

        expect(service.currentTime()).toBe('09 : 05 : 08');
    });

    it('berechnet die Dauer des Ereignisses', () =>
    {
        expect(service.ereignisDuration()).toBeNull();

        service.ereignisStart.set(new Date(2026, 0, 1, 7, 40, 0));

        expect(service.ereignisDuration()).toEqual({ hours: 1, minutes: 25 });
    });
});
