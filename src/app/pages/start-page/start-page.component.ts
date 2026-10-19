import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { EreignisType } from 'src/app/shared/enums/ereignis-type';
import { IEreignis } from 'src/app/shared/interfaces/i-ereignis';
import { IPerson } from 'src/app/shared/interfaces/i-person';
import { EreignisseService } from 'src/app/shared/services/ereignisse/ereignisse.service';
import { OperatingService } from 'src/app/shared/services/operating/operating.service';
import { StammdatenService } from 'src/app/shared/services/stammdaten/stammdaten.service';
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
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatCard, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent, MatFormField, MatSelect, MatOption, MatInput, FormsModule, MatLabel, MatButton, MatIcon, DatePipe]
})
export class StartPageComponent implements OnInit
{
    private router = inject(Router);
    private ereignisse = inject(EreignisseService);
    operating = inject(OperatingService);
    stammdaten = inject(StammdatenService);

    public newEreignis: IEreignis = null;
    public selectedEreignisId: number = null;
    public allEreignisse: Array<IEreignis> = [];
    public allPersonen: Array<IPerson> = [];

    public async ngOnInit(): Promise<void>
    {
        this.newEreignis = {
            type: EreignisType.Uebung,
            datetimeStart: new Date(),
            datetimeEnd: null
        };
        this.allEreignisse = await (await this.ereignisse.getAll()).reverse();
        this.selectedEreignisId = this.allEreignisse[0]?.id ?? null;

        if (await this.operating.checkIfOpenEreignisExist())
        {
            this.router.navigate(['operating']);
        }
    }

    public async createEreignis(ereignis: IEreignis)
    {
        this.newEreignis.datetimeStart = new Date(this.newEreignis.datetimeStart);
        const id = await this.ereignisse.saveOrCreate(ereignis);
        console.log('Create Ereignis mit Id', id);

        this.router.navigate(['/operating']);
    }
}
