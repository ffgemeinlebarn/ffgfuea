import { EreignisType } from '../../enums/ereignis-type';
import { IEreignis } from '../../interfaces/i-ereignis';

export interface IFeuerwehrStatistik
{
    feuerwehrNummer: number;
    name: string;
    fuellungen: number;
}

export interface IJahresStatistik
{
    year: number;
    einsaetze: number;
    uebungen: number;
    fuellungen: number;
    feuerwehren: Array<IFeuerwehrStatistik>;
}

export function buildStatistics(ereignisse: Array<IEreignis>): Array<IJahresStatistik>
{
    const stats = new Map<number, IJahresStatistik>();

    for (const ereignis of ereignisse)
    {
        const year = ereignis.datetimeStart.getFullYear();
        let stat = stats.get(year);
        if (!stat)
        {
            stat = { year, einsaetze: 0, uebungen: 0, fuellungen: 0, feuerwehren: [] };
            stats.set(year, stat);
        }

        if (ereignis.type === EreignisType.Einsatz) stat.einsaetze++;
        if (ereignis.type === EreignisType.Uebung) stat.uebungen++;

        const fuellungen = ereignis.fuellungen ?? [];
        stat.fuellungen += fuellungen.length;

        for (const fuellung of fuellungen)
        {
            const feuerwehr = fuellung.flasche?.feuerwehr;
            if (!feuerwehr) continue;

            let fw = stat.feuerwehren.find(item => item.feuerwehrNummer === feuerwehr.feuerwehrNummer);
            if (!fw)
            {
                fw = { feuerwehrNummer: feuerwehr.feuerwehrNummer, name: feuerwehr.name, fuellungen: 0 };
                stat.feuerwehren.push(fw);
            }
            fw.fuellungen++;
        }
    }

    const result = [...stats.values()];
    result.forEach(stat => stat.feuerwehren.sort((a, b) => b.fuellungen - a.fuellungen));
    return result.sort((a, b) => b.year - a.year);
}
