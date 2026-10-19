import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { IFuellung } from '../../interfaces/i-fuellung';

@Component({
    selector: 'ffg-fuellung-item',
    templateUrl: './fuellung-item.component.html',
    styleUrls: ['./fuellung-item.component.scss'],
    imports: [MatChipSet, MatChip, DatePipe]
})
export class FuellungItemComponent
{
    public readonly fuellung = input.required<IFuellung>();
}
