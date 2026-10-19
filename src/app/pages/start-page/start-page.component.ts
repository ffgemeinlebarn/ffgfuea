import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EreignisType } from 'src/app/shared/enums/ereignis-type';
import { IEreignis } from 'src/app/shared/interfaces/i-ereignis';
import { DataService, compareById } from 'src/app/shared/services/data/data.service';
import { MatCard, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent } from '@angular/material/card';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect, MatOption } from '@angular/material/select';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'ffg-start-page',
    templateUrl: './start-page.component.html',
    styleUrls: ['./start-page.component.scss'],
    imports: [MatCard, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent, MatFormField, MatSelect, MatOption, MatInput, FormsModule, MatLabel, MatButton, MatIcon, DatePipe]
})
export class StartPageComponent implements OnInit
{
    private router = inject(Router);
    data = inject(DataService);

    public compareById = compareById;

    public newEreignis: IEreignis = {
        type: EreignisType.Uebung,
        datetimeStart: new Date(),
        datetimeEnd: null
    };

    public async ngOnInit(): Promise<void>
    {
        if (await this.data.findOpenEreignisId() != null)
        {
            this.router.navigate(['operating']);
        }
    }

    public async createEreignis()
    {
        this.newEreignis.datetimeStart = new Date(this.newEreignis.datetimeStart);
        const id = await this.data.saveEreignis(this.newEreignis);
        console.log('Create Ereignis mit Id', id);
        this.router.navigate(['/operating']);
    }
}
