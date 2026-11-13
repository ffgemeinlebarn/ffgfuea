import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { IEreignis } from '../../interfaces/i-ereignis';
import { anzahlFuellungen, flaschenTyp, GESAMTBERICHT_TITEL, groupFuellungenByFeuerwehr } from '../report-data';
import { ReportHeaderComponent } from '../report-header/report-header.component';
import { UnterschriftComponent } from '../unterschrift/unterschrift.component';

/**
 * Übersichtsbericht (Gesamtbericht) eines Ereignisses im A4-Querformat:
 * alle Füllungen gruppiert nach Feuerwehr, mit Summen und Unterschriftsfeldern
 */
@Component({
    selector: 'ffg-gesamtbericht',
    templateUrl: './gesamtbericht.component.html',
    styleUrls: ['./gesamtbericht.component.scss'],
    imports: [DatePipe, ReportHeaderComponent, UnterschriftComponent]
})
export class GesamtberichtComponent
{
    public static readonly titel = GESAMTBERICHT_TITEL;

    public readonly ereignis = input.required<IEreignis>();
    public readonly gedruckt = input.required<Date>();

    public readonly gruppen = computed(() => groupFuellungenByFeuerwehr(this.ereignis().fuellungen ?? []));
    public readonly gesamt = computed(() => this.gruppen().reduce((summe, gruppe) => summe + gruppe.fuellungen.length, 0));

    public readonly titel = GesamtberichtComponent.titel;
    public readonly flaschenTyp = flaschenTyp;
    public readonly anzahlFuellungen = anzahlFuellungen;
}
