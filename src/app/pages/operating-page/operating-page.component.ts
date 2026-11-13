import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AddMangelComponent } from 'src/app/shared/dialogs/add-mangel/add-mangel.component';
import { ConfirmEreignisAbschlussComponent, EreignisAbschluss } from 'src/app/shared/dialogs/confirm-ereignis-abschluss/confirm-ereignis-abschluss.component';
import { EditEreignisComponent } from 'src/app/shared/dialogs/edit-ereignis/edit-ereignis.component';
import { BerichteComponent, IBerichteDaten } from 'src/app/shared/dialogs/berichte/berichte.component';
import { RemoveFuellungComponent } from 'src/app/shared/dialogs/remove-fuellung/remove-fuellung.component';
import { SearchFlascheComponent } from 'src/app/shared/dialogs/search-flasche/search-flasche.component';
import { IFuellung } from 'src/app/shared/interfaces/i-fuellung';
import { BarcodeScannerService } from '../../shared/services/barcode-scanner/barcode-scanner.service';
import { DialogService } from '../../shared/services/dialog/dialog.service';
import { OperatingService } from '../../shared/services/operating/operating.service';
import { TimingService } from '../../shared/services/timing/timing.service';
import { IEreignis } from 'src/app/shared/interfaces/i-ereignis';
import { NotificationDuration, NotificationService } from '../../shared/services/notification/notification.service';
import { IAblageZiel, PdfAblageService } from '../../shared/services/pdf-ablage/pdf-ablage.service';
import { SettingsService } from '../../shared/services/settings/settings.service';
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
    private notification = inject(NotificationService);
    private settings = inject(SettingsService);
    private ablage = inject(PdfAblageService);
    timing = inject(TimingService);
    scanner = inject(BarcodeScannerService);
    operating = inject(OperatingService);

    public async ngOnInit(): Promise<void>
    {
        if (!await this.operating.tryStartOpenEreignis())
        {
            void this.router.navigate(['/']);
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
        void this.dialogs.open(SearchFlascheComponent);
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
        void this.dialogs.open(RemoveFuellungComponent, fuellung);
    }

    public openBerichte()
    {
        const ereignis = this.operating.ereignis();
        if (ereignis) void this.dialogs.open(BerichteComponent, { ereignis } satisfies IBerichteDaten);
    }

    public async confirmCloseEreignis()
    {
        const abschluss = await this.dialogs.open<EreignisAbschluss>(ConfirmEreignisAbschlussComponent);
        if (!abschluss) return;
        const drucken = abschluss === 'abschliessenUndDrucken';

        // Automatische PDF-Ablage: Die Berechtigung für den Ordner kann nur gleich nach dem Klick angefragt werden
        const ziel = drucken && this.settings.pdfAutoAblage() && this.ablage.ordner()
            ? await this.ablage.zielErmitteln()
            : null;

        const ereignis = await this.operating.closeEreignis();
        await this.router.navigate(['/']);
        if (!ereignis || !drucken) return;

        // Alle Berichte ablegen, bevor der Berichte-Dialog zum Drucken öffnet
        if (ziel) await this.pdfAblegen(ereignis, ziel);
        void this.dialogs.open(BerichteComponent, { ereignis } satisfies IBerichteDaten);
    }

    private async pdfAblegen(ereignis: IEreignis, ziel: IAblageZiel)
    {
        if (!ziel.ordner)
        {
            this.notification.show(`PDFs wurden nicht abgelegt: ${ziel.hinweis}`, NotificationDuration.long);
            return;
        }

        this.notification.show('Berichte werden als PDF abgelegt …');
        try
        {
            const ergebnis = await this.ablage.speichern(ereignis, undefined, { ziel, download: false });
            if (ergebnis) this.notification.show(this.ablage.meldung(ergebnis), NotificationDuration.long);
        }
        catch (error)
        {
            this.notification.showError(error, 'PDFs konnten nicht abgelegt werden', NotificationDuration.long);
        }
    }
}
