import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { IEreignis } from '../../interfaces/i-ereignis';
import { anzahlFuellungen, flaschenTyp, IFeuerwehrFuellungen } from '../report-data';
import { ReportHeaderComponent } from '../report-header/report-header.component';
import { UnterschriftComponent } from '../unterschrift/unterschrift.component';

/**
 * Bericht für eine einzelne Feuerwehr im A4-Hochformat
 */
@Component({
    selector: 'ffg-feuerwehrbericht',
    templateUrl: './feuerwehrbericht.component.html',
    styleUrls: ['./feuerwehrbericht.component.scss'],
    imports: [DatePipe, ReportHeaderComponent, UnterschriftComponent]
})
export class FeuerwehrberichtComponent
{
    public static titel(feuerwehrName: string): string
    {
        return `Bericht für die Feuerwehr ${feuerwehrName}`;
    }

    public readonly ereignis = input.required<IEreignis>();
    public readonly gruppe = input.required<IFeuerwehrFuellungen>();
    public readonly gedruckt = input.required<Date>();

    public readonly titel = computed(() => FeuerwehrberichtComponent.titel(this.gruppe().feuerwehr.name));

    public readonly flaschenTyp = flaschenTyp;
    public readonly anzahlFuellungen = anzahlFuellungen;
}
