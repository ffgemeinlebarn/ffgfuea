import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AddMangelComponent } from 'src/app/shared/dialogs/add-mangel/add-mangel.component';
import { ConfirmEreignisAbschlussComponent, EreignisAbschluss } from 'src/app/shared/dialogs/confirm-ereignis-abschluss/confirm-ereignis-abschluss.component';
import { EditEreignisComponent } from 'src/app/shared/dialogs/edit-ereignis/edit-ereignis.component';
import { PrintReportsComponent } from 'src/app/shared/dialogs/print-reports/print-reports.component';
import { RemoveFuellungComponent } from 'src/app/shared/dialogs/remove-fuellung/remove-fuellung.component';
import { SearchFlascheComponent } from 'src/app/shared/dialogs/search-flasche/search-flasche.component';
import { IFuellung } from 'src/app/shared/interfaces/i-fuellung';
import { BarcodeScannerService } from '../../shared/services/barcode-scanner/barcode-scanner.service';
import { DialogService } from '../../shared/services/dialog/dialog.service';
import { OperatingService } from '../../shared/services/operating/operating.service';
import { TimingService } from '../../shared/services/timing/timing.service';
import { DatePipe } from '@angular/common';
import { MatGridList, MatGridTile } from '@angular/material/grid-list';
import { MatCard, MatCardTitle, MatCardActions } from '@angular/material/card';
import { MatRipple } from '@angular/material/core';
import { MatIcon } from '@angular/material/icon';
import { MatList } from '@angular/material/list';
import { FuellungItemComponent } from '../../shared/components/fuellung-item/fuellung-item.component';
import { EreignisNummerPipe } from '../../shared/pipes/ereignis-nummer/ereignis-nummer.pipe';
import { MatFabButton } from '@angular/material/button';

@Component({
    selector: 'ffg-operating-page',
    templateUrl: './operating-page.component.html',
    styleUrls: ['./operating-page.component.scss'],
    imports: [MatGridList, MatGridTile, MatCard, MatRipple, MatIcon, MatCardTitle, MatList, FuellungItemComponent, MatCardActions, MatFabButton, DatePipe, EreignisNummerPipe]
})
export class OperatingPageComponent implements OnInit
{
    private router = inject(Router);
    private dialogs = inject(DialogService);
    timing = inject(TimingService);
    scanner = inject(BarcodeScannerService);
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
        this.scanner.active.update(active => !active);
    }

    public toggleConfirmFuellung()
    {
        this.operating.confirmFuellungActive.update(active => !active);
    }

    public openSearchFlasche()
    {
        this.dialogs.open(SearchFlascheComponent);
    }

    public async openEditEreignis()
    {
        const ereignis = this.operating.ereignis();
        if (!ereignis) return;

        await this.dialogs.open(EditEreignisComponent, structuredClone(ereignis));
        await this.operating.reload();
    }

    public async openAddMangel()
    {
        const ereignis = this.operating.ereignis();
        if (!ereignis) return;

        await this.dialogs.open(AddMangelComponent, ereignis);
        await this.operating.reload();
    }

    public openFuellungContext(fuellung: IFuellung)
    {
        this.dialogs.open(RemoveFuellungComponent, fuellung);
    }

    public openPrintReportings()
    {
        this.dialogs.open(PrintReportsComponent, this.operating.ereignis());
    }

    public async confirmCloseEreignis()
    {
        const abschluss = await this.dialogs.open<EreignisAbschluss>(ConfirmEreignisAbschlussComponent);
        if (!abschluss) return;

        // Erst speichern, das Drucken lädt die Seite danach neu
        const ereignis = await this.operating.closeEreignis();
        await this.router.navigate(['/']);

        if (ereignis && abschluss === 'abschliessenUndDrucken')
            this.dialogs.open(PrintReportsComponent, ereignis);
    }
}
