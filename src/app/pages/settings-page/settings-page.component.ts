import { Component, DOCUMENT, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ConfirmImportComponent, IConfirmImportData } from 'src/app/shared/dialogs/confirm-import/confirm-import.component';
import { BackupError, IBackup, LEGACY_VERSION, serializeBackup } from 'src/app/shared/services/backup/backup-format';
import { BackupService, ImportMode } from 'src/app/shared/services/backup/backup.service';
import { DataService } from 'src/app/shared/services/data/data.service';
import { DatabaseService } from 'src/app/shared/services/database/database.service';
import { DialogService } from 'src/app/shared/services/dialog/dialog.service';
import { NotificationDuration, NotificationService } from 'src/app/shared/services/notification/notification.service';
import { PdfAblageService } from 'src/app/shared/services/pdf-ablage/pdf-ablage.service';
import { SettingsService } from 'src/app/shared/services/settings/settings.service';
import { downloadBlob } from 'src/app/shared/utils/download';
import { errorMessage } from 'src/app/shared/utils/error-message';
import { environment } from 'src/environments/environment';
import { MatButton } from '@angular/material/button';
import { DatePipe } from '@angular/common';
import { MatCard } from '@angular/material/card';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { AltberichteCardComponent } from 'src/app/altberichte/altberichte-card/altberichte-card.component';

@Component({
    selector: 'ffg-settings-page',
    templateUrl: './settings-page.component.html',
    styleUrls: ['./settings-page.component.scss'],
    imports: [MatButton, MatCard, MatSlideToggle, FormsModule, MatFormField, MatInput, MatRadioGroup, MatRadioButton, DatePipe, AltberichteCardComponent]
})
export class SettingsPageComponent implements OnInit, OnDestroy
{
    settings = inject(SettingsService);
    database = inject(DatabaseService);
    ablage = inject(PdfAblageService);
    private data = inject(DataService);
    private backup = inject(BackupService);
    private dialogs = inject(DialogService);
    private notification = inject(NotificationService);
    private document = inject(DOCUMENT);

    /** Testmodus und Import nur, wenn kein Ereignis läuft */
    public readonly noOpenEreignis = signal(false);
    public readonly busy = signal(false);
    public readonly importFileName = signal<string | null>(null);
    public readonly importBackup = signal<IBackup | null>(null);
    public readonly importProblems = signal<Array<string>>([]);
    public readonly importMode = signal<ImportMode>('merge');
    public readonly importSummary = computed(() => summarize(this.importBackup()));
    public readonly legacyVersion = LEGACY_VERSION;
    public version = environment.version;

    public async ngOnInit(): Promise<void>
    {
        // Während eines laufenden Ereignisses darf nicht umgeschaltet werden
        this.noOpenEreignis.set(await this.data.findOpenEreignisId() == null);
    }

    public ngOnDestroy(): void
    {
        // Nicht gespeicherte Änderungen verwerfen
        this.settings.loadAll();
    }

    public async save()
    {
        this.settings.saveAll();
        this.database.refresh();
        await this.data.load();
    }

    public async ordnerWaehlen()
    {
        try
        {
            if (await this.ablage.ordnerWaehlen())
                this.notification.show(`PDFs werden im Ordner „${this.ablage.ordnerName()}“ abgelegt`);
        }
        catch (error)
        {
            this.notification.showError(error, 'Ordner konnte nicht ausgewählt werden', NotificationDuration.long);
        }
    }

    public async ordnerEntfernen()
    {
        try
        {
            await this.ablage.ordnerEntfernen();
            this.notification.show('Ordner entfernt, PDFs werden jetzt heruntergeladen');
        }
        catch (error)
        {
            this.notification.showError(error, 'Ordner konnte nicht entfernt werden', NotificationDuration.long);
        }
    }

    public async export()
    {
        this.busy.set(true);
        try
        {
            const backup = await this.backup.createBackup();
            this.download(serializeBackup(backup), this.backup.fileName(backup));
        }
        catch (error)
        {
            this.notification.showError(error, 'Export fehlgeschlagen', NotificationDuration.long);
        }
        finally
        {
            this.busy.set(false);
        }
    }

    public async selectFile(file: File | undefined)
    {
        this.importBackup.set(null);
        this.importProblems.set([]);
        this.importFileName.set(file?.name ?? null);
        if (!file) return;

        try
        {
            const backup = this.backup.read(await file.text());
            this.importMode.set(backup.version === LEGACY_VERSION ? 'merge' : this.importMode());
            this.importBackup.set(backup);
        }
        catch (error)
        {
            this.importProblems.set(error instanceof BackupError ? error.problems : [errorMessage(error)]);
        }
    }

    public async import()
    {
        const backup = this.importBackup();
        if (!backup) return;
        const mode = this.importMode();

        if (mode === 'replace')
        {
            const vorhanden: IConfirmImportData = {
                feuerwehren: this.data.feuerwehren().length,
                personen: this.data.personen().length,
                ereignisse: this.data.ereignisse().length,
                testMode: this.database.testMode
            };
            if (!await this.dialogs.confirm(ConfirmImportComponent, vorhanden)) return;
        }

        this.busy.set(true);
        try
        {
            const result = await this.backup.import(backup, mode);
            const skipped = result.skipped > 0 ? `, ${result.skipped} bereits vorhanden` : '';
            this.notification.show(`Import abgeschlossen: ${result.ereignisse} Ereignisse, ${result.personen} Personen und ${result.feuerwehren} Feuerwehren übernommen${skipped}`, NotificationDuration.long);
            void this.selectFile(undefined);
        }
        catch (error)
        {
            this.notification.showError(error, 'Import fehlgeschlagen', NotificationDuration.long);
        }
        finally
        {
            this.busy.set(false);
        }
    }

    private download(blob: Blob, fileName: string)
    {
        downloadBlob(this.document, blob, fileName);
    }
}

function summarize(backup: IBackup | null)
{
    if (!backup) return null;

    // Kein Math.min(...starts), das sprengt bei vielen Ereignissen den Stack
    const starts = backup.ereignisse.map(ereignis => ereignis.datetimeStart.getTime());
    return {
        backup,
        flaschen: backup.feuerwehren.reduce((sum, feuerwehr) => sum + feuerwehr.flaschen.length, 0),
        fuellungen: backup.ereignisse.reduce((sum, ereignis) => sum + ereignis.fuellungen.length, 0),
        from: starts.length ? new Date(starts.reduce((a, b) => Math.min(a, b))) : null,
        to: starts.length ? new Date(starts.reduce((a, b) => Math.max(a, b))) : null
    };
}
