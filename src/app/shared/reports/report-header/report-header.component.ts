import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { IEreignis } from '../../interfaces/i-ereignis';
import { formatEreignisNummer } from '../../models/ereignis-nummer/ereignis-nummer';
import { ereignisTyp, personenNamen } from '../report-data';

/**
 * Kopf eines Berichts mit den Daten des Ereignisses
 */
@Component({
    selector: 'ffg-report-header',
    templateUrl: './report-header.component.html',
    styleUrls: ['./report-header.component.scss'],
    imports: [DatePipe]
})
export class ReportHeaderComponent
{
    public readonly ereignis = input.required<IEreignis>();
    public readonly titel = input.required<string>();
    public readonly gedruckt = input.required<Date>();

    public readonly nummer = computed(() => formatEreignisNummer(this.ereignis()));
    public readonly typ = computed(() => ereignisTyp(this.ereignis()));
    public readonly personal = computed(() => personenNamen(this.ereignis().personen ?? []));
}
