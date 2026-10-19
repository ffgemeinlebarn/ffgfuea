import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { EreignisType } from 'src/app/shared/enums/ereignis-type';
import { EreignisseService } from 'src/app/shared/services/ereignisse/ereignisse.service';
import { OperatingService } from 'src/app/shared/services/operating/operating.service';

import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';

@Component({
    selector: 'ffg-statistics-page',
    templateUrl: './statistics-page.component.html',
    styleUrls: ['./statistics-page.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle]
})
export class StatisticsPageComponent implements OnInit
{
    ereignisse = inject(EreignisseService);

    public stats: Array<any> = [];
    public async ngOnInit(): Promise<void>
    {
        const ereignisse = await this.ereignisse.getAll();
        ereignisse.forEach(async ereigniss =>
        {
            const year = ereigniss.datetimeStart.getFullYear();
            let index = this.stats.findIndex(e => e?.year === year);

            if (index === -1)
            {
                this.stats.push({
                    year,
                    einsaetze: 0,
                    uebungen: 0,
                    fuellungen: 0
                });

                index = this.stats.length - 1;
            }

            if (ereigniss.type === EreignisType.Einsatz)
                this.stats[index].einsaetze++;

            if (ereigniss.type === EreignisType.Uebung)
                this.stats[index].uebungen++;

            this.stats[index].fuellungen += ereigniss.fuellungen.length;
            this.stats[index].feuerwehren = [];

            ereigniss.fuellungen.forEach(f =>
            {
                const feuerwehrNummer = f.flasche.feuerwehr.feuerwehrNummer;
                const name = f.flasche.feuerwehr.name;
                let indexFw = this.stats[index].feuerwehren.findIndex(fw => fw.feuerwehrNummer === feuerwehrNummer);

                if (indexFw === -1)
                {
                    this.stats[index].feuerwehren.push({
                        feuerwehrNummer,
                        name,
                        fuellungen: 0
                    });

                    indexFw = this.stats[index].feuerwehren.length - 1;
                }

                this.stats[index].feuerwehren[indexFw].fuellungen++;
            });

            this.stats[index].feuerwehren.sort((a: any, b: any) => b.fuellungen - a.fuellungen);
        });

        this.stats.sort((a: any, b: any) => b.year - a.year);
    }
}
