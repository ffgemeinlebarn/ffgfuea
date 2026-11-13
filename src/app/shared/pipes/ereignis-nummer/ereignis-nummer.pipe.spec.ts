import { createEreignis } from 'src/app/testing/test-data';
import { EreignisNummerPipe } from './ereignis-nummer.pipe';

describe('EreignisNummerPipe', () =>
{
    it('zeigt die Ereignisnummer an', () =>
    {
        expect(new EreignisNummerPipe().transform(createEreignis({ jahr: 2025, nummer: 3 }))).toBe('2025-003');
        expect(new EreignisNummerPipe().transform(null)).toBe('');
    });
});
