import { Component, inject } from '@angular/core';
import { DataService } from 'src/app/shared/services/data/data.service';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';

@Component({
    selector: 'ffg-statistics-page',
    templateUrl: './statistics-page.component.html',
    styleUrls: ['./statistics-page.component.scss'],
    imports: [MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle]
})
export class StatisticsPageComponent
{
    data = inject(DataService);
}
