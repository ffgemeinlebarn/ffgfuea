import { DatePipe } from '@angular/common';
import { Component, OnInit, input, ChangeDetectionStrategy } from '@angular/core';
import { MatChip, MatChipListbox } from '@angular/material/chips';
import { MatLine } from '@angular/material/grid-list';
import { MatDivider, MatListItem } from '@angular/material/list';
import { IFuellung } from '../../interfaces/i-fuellung';

@Component({
    selector: 'ffg-fuellung-item',
    templateUrl: './fuellung-item.component.html',
    styleUrls: ['./fuellung-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatListItem, MatLine, MatChipListbox, MatChip, MatDivider, DatePipe]
})
export class FuellungItemComponent implements OnInit
{
    public readonly fuellung = input<IFuellung>(undefined);
    public ngOnInit(): void { }
}
