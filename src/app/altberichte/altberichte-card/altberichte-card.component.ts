import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelect } from '@angular/material/select';
import { DatabaseService } from 'src/app/shared/services/database/database.service';
import { NotificationDuration, NotificationService } from 'src/app/shared/services/notification/notification.service';
import { PdfAblageService } from 'src/app/shared/services/pdf-ablage/pdf-ablage.service';
import { AltberichteService, IAltberichteJahr } from '../altberichte.service';

/**
 * Karte in den Einstellungen, um einmalig die Berichte aller abgeschlossenen Ereignisse im alten Layout
 * als PDF abzulegen. Übergangslösung, wird wieder entfernt (siehe README).
 */
@Component({
    selector: 'ffg-altberichte-card',
    templateUrl: './altberichte-card.component.html',
    styleUrls: ['./altberichte-card.component.scss'],
    imports: [MatCard, MatButton, MatFormField, MatLabel, MatSelect, MatOption, MatProgressBar, FormsModule]
})
export class AltberichteCardComponent implements OnInit
{
    public altberichte = inject(AltberichteService);
    public ablage = inject(PdfAblageService);
    public database = inject(DatabaseService);
    private notification = inject(NotificationService);

    public readonly jahre = signal<Array<IAltberichteJahr>>([]);
    /** 0 = alle Jahre (mit null zeigte mat-select statt „Alle Jahre“ nur die Beschriftung) */
    public readonly jahr = signal(0);

    public async ngOnInit(): Promise<void>
    {
        try
        {
            this.jahre.set(await this.altberichte.jahre());
        }
        catch
        {
            // Ohne Jahresliste kann trotzdem für alle Jahre erzeugt werden
        }
    }

    public async starten(): Promise<void>
    {
        try
        {
            const ergebnis = await this.altberichte.starten(this.jahr() || null);
            if (ergebnis && !ergebnis.abgebrochen)
                this.notification.show(`Altberichte: ${ergebnis.erstellt} PDFs erstellt, ${ergebnis.uebersprungen} übersprungen`, NotificationDuration.long);
        }
        catch (error)
        {
            this.notification.showError(error, 'Altberichte konnten nicht erzeugt werden', NotificationDuration.long);
        }
    }
}
