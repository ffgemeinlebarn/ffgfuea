import { createEreignis } from 'src/app/testing/test-data';
import { assignEreignisNummern, formatEreignisNummer } from './ereignis-nummer';

describe('Ereignisnummer', () =>
{
    it('formatiert Jahr und dreistellige laufende Nummer', () =>
    {
        expect(formatEreignisNummer({ jahr: 2026, nummer: 7 })).toBe('2026-007');
        expect(formatEreignisNummer({ jahr: 2026, nummer: 42 })).toBe('2026-042');
        expect(formatEreignisNummer({ jahr: 2026, nummer: 1234 })).toBe('2026-1234');
    });

    it('ist ohne Nummer leer', () =>
    {
        expect(formatEreignisNummer({})).toBe('');
        expect(formatEreignisNummer({ jahr: 2026 })).toBe('');
        expect(formatEreignisNummer(null)).toBe('');
    });

    it('nummeriert pro Jahr nach Beginn und bei Gleichstand nach Id', () =>
    {
        const ereignisse = [
            createEreignis({ id: 1, ort: 'B', datetimeStart: new Date(2026, 5, 1) }),
            createEreignis({ id: 2, ort: 'A', datetimeStart: new Date(2026, 0, 1) }),
            createEreignis({ id: 4, ort: 'D', datetimeStart: new Date(2025, 11, 31) }),
            createEreignis({ id: 3, ort: 'C', datetimeStart: new Date(2025, 11, 31) })
        ];

        assignEreignisNummern(ereignisse);

        expect(ereignisse.map(ereignis => `${ereignis.ort} ${formatEreignisNummer(ereignis)}`))
            .toEqual(['B 2026-002', 'A 2026-001', 'D 2025-002', 'C 2025-001']);
    });

    it('behält vorhandene Nummern und hängt neue daran an', () =>
    {
        const vorhanden = createEreignis({ jahr: 2026, nummer: 5 });
        const behalten = createEreignis({ jahr: 2026, nummer: 9, datetimeStart: new Date(2027, 0, 1) });
        const neu = createEreignis({ datetimeStart: new Date(2026, 0, 1) });
        const anderesJahr = createEreignis({ datetimeStart: new Date(2024, 0, 1) });

        assignEreignisNummern([neu, behalten, anderesJahr], [vorhanden]);

        expect(formatEreignisNummer(behalten)).toBe('2026-009');
        expect(formatEreignisNummer(neu)).toBe('2026-010');
        expect(formatEreignisNummer(anderesJahr)).toBe('2024-001');
    });
});
