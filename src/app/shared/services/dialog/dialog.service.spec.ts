import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { DialogService } from './dialog.service';

@Component({ template: '' })
class TestDialogComponent { }

describe('DialogService', () =>
{
    let closed: Subject<unknown>;
    let open: ReturnType<typeof vi.fn>;
    let service: DialogService;

    beforeEach(() =>
    {
        closed = new Subject();
        open = vi.fn(() => ({ afterClosed: () => closed }));
        TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: { open } }] });
        service = TestBed.inject(DialogService);
    });

    const close = (result?: unknown) =>
    {
        closed.next(result);
        closed.complete();
    };

    it('öffnet den Dialog mit einheitlicher Breite und den Daten', () =>
    {
        void service.open(TestDialogComponent, { id: 1 });
        expect(open).toHaveBeenCalledWith(TestDialogComponent, { width: '500px', data: { id: 1 } });
    });

    it('liefert das Ergebnis erst nach dem Schließen', async () =>
    {
        let result: unknown = 'offen';
        const promise = service.open(TestDialogComponent).then(value => result = value);

        await Promise.resolve();
        expect(result).toBe('offen');

        close('fertig');
        await promise;
        expect(result).toBe('fertig');
    });

    it('wertet nur true als Bestätigung', async () =>
    {
        for (const [value, expected] of [[true, true], [false, false], [undefined, false], ['ja', false]] as const)
        {
            closed = new Subject();
            const confirmation = service.confirm(TestDialogComponent);
            close(value);
            expect(await confirmation).toBe(expected);
        }
    });

    it('liefert undefined, wenn der Dialog ohne Ergebnis beendet wird', async () =>
    {
        const promise = service.open(TestDialogComponent);
        closed.complete();
        expect(await promise).toBeUndefined();
    });
});
