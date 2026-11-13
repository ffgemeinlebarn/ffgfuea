import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationDuration, NotificationService } from './notification.service';

describe('NotificationService', () =>
{
    let service: NotificationService;
    let open: ReturnType<typeof vi.spyOn>;

    beforeEach(() =>
    {
        service = TestBed.inject(NotificationService);
        open = vi.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue(undefined as never);
    });

    it('zeigt Meldungen ohne Aktion', () =>
    {
        service.show('Gespeichert');
        expect(open).toHaveBeenCalledWith('Gespeichert', undefined, { duration: NotificationDuration.normal });

        service.show('Kurz', NotificationDuration.short);
        expect(open).toHaveBeenLastCalledWith('Kurz', undefined, { duration: NotificationDuration.short });
    });

    it('zeigt Fehler mit optionalem Präfix', () =>
    {
        service.showError(new Error('kaputt'));
        expect(open).toHaveBeenLastCalledWith('kaputt', undefined, { duration: NotificationDuration.normal });

        service.showError('Text', 'Export fehlgeschlagen', NotificationDuration.long);
        expect(open).toHaveBeenLastCalledWith('Export fehlgeschlagen: Text', undefined, { duration: NotificationDuration.long });
    });
});
