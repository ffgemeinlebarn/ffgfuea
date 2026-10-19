import { Component, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AddMangelComponent } from 'src/app/shared/dialogs/add-mangel/add-mangel.component';
import { ConfirmEreignisAbschlussComponent } from 'src/app/shared/dialogs/confirm-ereignis-abschluss/confirm-ereignis-abschluss.component';
import { EditEreignisComponent } from 'src/app/shared/dialogs/edit-ereignis/edit-ereignis.component';
import { PrintReportsComponent } from 'src/app/shared/dialogs/print-reports/print-reports.component';
import { RemoveFuellungComponent } from 'src/app/shared/dialogs/remove-fuellung/remove-fuellung.component';
import { SearchFlascheComponent } from 'src/app/shared/dialogs/search-flasche/search-flasche.component';
import { IFuellung } from 'src/app/shared/interfaces/i-fuellung';
import { OperatingService } from '../../shared/services/operating/operating.service';
import { TimingService } from '../../shared/services/timing/timing.service';
import { DatePipe } from '@angular/common';
import { MatGridList, MatGridTile } from '@angular/material/grid-list';
import { MatCard, MatCardTitle, MatCardActions } from '@angular/material/card';
import { MatRipple } from '@angular/material/core';
import { MatIcon } from '@angular/material/icon';
import { MatList } from '@angular/material/list';
import { FuellungItemComponent } from '../../shared/components/fuellung-item/fuellung-item.component';
import { MatFabButton } from '@angular/material/button';

@Component({
    selector: 'ffg-operating-page',
    templateUrl: './operating-page.component.html',
    styleUrls: ['./operating-page.component.scss'],
    imports: [MatGridList, MatGridTile, MatCard, MatRipple, MatIcon, MatCardTitle, MatList, FuellungItemComponent, MatCardActions, MatFabButton, DatePipe]
})
export class OperatingPageComponent implements OnInit
{
    private router = inject(Router);
    private dialog = inject(MatDialog);
    timing = inject(TimingService);
    operating = inject(OperatingService);

    public async ngOnInit(): Promise<void>
    {
        if (!await this.operating.tryStartOpenEreignis())
        {
            this.router.navigate(['/']);
        }
    }

    public toggleScannerInput()
    {
        this.operating.barcodeInputActive.update(active => !active);
    }

    public toggleConfirmFuellung()
    {
        this.operating.confirmFuellungActive.update(active => !active);
    }

    public openSearchFlasche()
    {
        this.dialog.open(SearchFlascheComponent, { width: '500px' });
    }

    public openEditEreignis()
    {
        const ereignis = this.operating.ereignis();
        this.dialog.open(EditEreignisComponent, { width: '500px', data: structuredClone(ereignis) })
            .afterClosed()
            .subscribe(() => this.operating.reloadEreignis(ereignis.id));
    }

    public openAddMangel()
    {
        const ereignis = this.operating.ereignis();
        this.dialog.open(AddMangelComponent, { width: '500px', data: ereignis })
            .afterClosed()
            .subscribe(() => this.operating.reloadEreignis(ereignis.id));
    }

    public openFuellungContext(fuellung: IFuellung)
    {
        this.dialog.open(RemoveFuellungComponent, { width: '500px', data: fuellung });
    }

    public openPrintReportings()
    {
        this.dialog.open(PrintReportsComponent, { width: '500px', data: this.operating.ereignis() });
    }

    public confirmCloseEreignis()
    {
        this.dialog.open(ConfirmEreignisAbschlussComponent, { width: '500px' })
            .afterClosed()
            .subscribe(confirmation =>
            {
                if (confirmation) this.operating.closeEreignis();
            });
    }
}
