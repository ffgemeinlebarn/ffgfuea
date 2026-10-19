import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatChip, MatChipListbox } from '@angular/material/chips';
import { MatLine } from '@angular/material/grid-list';
import { MatDivider, MatListItem } from '@angular/material/list';
import { IFuellung } from '../../interfaces/i-fuellung';

@Component({
    selector: 'ffg-fuellung-item',
    templateUrl: './fuellung-item.component.html',
    styleUrls: ['./fuellung-item.component.scss'],
    imports: [MatListItem, MatLine, MatChipListbox, MatChip, MatDivider, DatePipe]
})
export class FuellungItemComponent
{
    public readonly fuellung = input.required<IFuellung>();
}
