import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { environment } from 'src/environments/environment';

interface IOrdnerEintrag
{
    id: string;
    handle: FileSystemDirectoryHandle;
}

const BERICHTE = 'berichte';

/**
 * Merkt sich den gewählten Ordner für die PDF-Ablage. Ein FileSystemDirectoryHandle kann nicht im
 * LocalStorage, aber in der IndexedDB gespeichert werden. Dafür gibt es eine eigene kleine Datenbank,
 * damit die Versionierung der Hauptdatenbank unberührt bleibt. Gilt für Echt- und Testbetrieb.
 */
@Injectable({
    providedIn: 'root'
})
export class OrdnerStore
{
    private readonly db = new OrdnerDatabase(`${environment.database.name}_dateiablage`);

    public async get(): Promise<FileSystemDirectoryHandle | undefined>
    {
        return (await this.db.ordner.get(BERICHTE))?.handle;
    }

    public async set(handle: FileSystemDirectoryHandle): Promise<void>
    {
        await this.db.ordner.put({ id: BERICHTE, handle });
    }

    public async delete(): Promise<void>
    {
        await this.db.ordner.delete(BERICHTE);
    }
}

class OrdnerDatabase extends Dexie
{
    public ordner!: Table<IOrdnerEintrag, string>;

    constructor(name: string)
    {
        super(name);
        this.version(1).stores({
            ordner: '&id'
        });
    }
}
