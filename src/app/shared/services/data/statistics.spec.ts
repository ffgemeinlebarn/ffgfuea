import { EreignisType } from '../../enums/ereignis-type';
import { createEreignis, createFeuerwehr, createFuellung } from 'src/app/testing/test-data';
import { buildStatistics } from './statistics';

describe('buildStatistics', () =>
{
    const ff1 = createFeuerwehr(1, ['101', '102']);
    const ff2 = createFeuerwehr(2, ['201']);

    it('summiert Ereignisse und Füllungen pro Jahr, neuestes Jahr zuerst', () =>
    {
        const stats = buildStatistics([
            createEreignis({ type: EreignisType.Einsatz, datetimeStart: new Date(2025, 0, 1), fuellungen: [createFuellung(ff1.flaschen[0])] }),
            createEreignis({ type: EreignisType.Uebung, datetimeStart: new Date(2026, 0, 1), fuellungen: [createFuellung(ff1.flaschen[0]), createFuellung(ff2.flaschen[0])] }),
            createEreignis({ type: EreignisType.Uebung, datetimeStart: new Date(2026, 5, 1) })
        ]);

        expect(stats.map(stat => stat.year)).toEqual([2026, 2025]);
        expect(stats[0]).toMatchObject({ einsaetze: 0, uebungen: 2, fuellungen: 2 });
        expect(stats[1]).toMatchObject({ einsaetze: 1, uebungen: 0, fuellungen: 1 });
    });

    it('zählt Füllungen pro Feuerwehr über alle Ereignisse eines Jahres', () =>
    {
        const stats = buildStatistics([
            createEreignis({ fuellungen: [createFuellung(ff1.flaschen[0]), createFuellung(ff1.flaschen[1])] }),
            createEreignis({ fuellungen: [createFuellung(ff2.flaschen[0])] }),
            createEreignis({ fuellungen: [createFuellung(ff1.flaschen[0])] })
        ]);

        expect(stats[0].feuerwehren).toEqual([
            { feuerwehrNummer: 1, name: 'FF 1', fuellungen: 3 },
            { feuerwehrNummer: 2, name: 'FF 2', fuellungen: 1 }
        ]);
    });

    it('ignoriert Füllungen ohne Feuerwehr in der Aufschlüsselung', () =>
    {
        const stats = buildStatistics([
            createEreignis({ fuellungen: [createFuellung({ barcode: '1' })] })
        ]);

        expect(stats[0].fuellungen).toBe(1);
        expect(stats[0].feuerwehren).toEqual([]);
    });
});
