/** Nachbildung einer Datei der File System Access API, merkt sich den geschriebenen Inhalt */
export class FakeFileHandle
{
    public readonly kind = 'file';
    public inhalt: Blob | null = null;
    public schreibvorgaenge = 0;

    constructor(public readonly name: string, inhalt?: Blob)
    {
        this.inhalt = inhalt ?? null;
    }

    public async createWritable()
    {
        const teile: Array<Blob> = [];
        return {
            write: async (daten: Blob) => { teile.push(daten); },
            close: async () =>
            {
                this.inhalt = new Blob(teile, { type: teile[0]?.type });
                this.schreibvorgaenge++;
            },
            abort: async () => undefined
        };
    }
}

/** Nachbildung eines Ordners der File System Access API samt Berechtigungen */
export class FakeDirectoryHandle
{
    public readonly kind = 'directory';
    public readonly ordner = new Map<string, FakeDirectoryHandle>();
    public readonly dateien = new Map<string, FakeFileHandle>();

    /** Ergebnis von queryPermission bzw. requestPermission */
    public berechtigung: PermissionState = 'granted';
    public anfrageErgebnis: PermissionState = 'granted';

    public readonly queryPermission = vi.fn(async () => this.berechtigung);
    public readonly requestPermission = vi.fn(async () =>
    {
        this.berechtigung = this.anfrageErgebnis;
        return this.anfrageErgebnis;
    });

    constructor(public readonly name: string)
    {
    }

    public async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FakeDirectoryHandle>
    {
        let ordner = this.ordner.get(name);
        if (!ordner)
        {
            if (!options?.create) throw new DOMException(name, 'NotFoundError');
            ordner = new FakeDirectoryHandle(name);
            this.ordner.set(name, ordner);
        }
        return ordner;
    }

    public async getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFileHandle>
    {
        let datei = this.dateien.get(name);
        if (!datei)
        {
            if (!options?.create) throw new DOMException(name, 'NotFoundError');
            datei = new FakeFileHandle(name);
            this.dateien.set(name, datei);
        }
        return datei;
    }

    /** Ordner unter einem Pfad, z.B. pfad('2026', '2026-007_Uebung') */
    public pfad(...namen: Array<string>): FakeDirectoryHandle | undefined
    {
        return namen.reduce<FakeDirectoryHandle | undefined>((ordner, name) => ordner?.ordner.get(name), this);
    }

    public asHandle(): FileSystemDirectoryHandle
    {
        return this as unknown as FileSystemDirectoryHandle;
    }
}

/** Stellt showDirectoryPicker bereit, solange der Test läuft (mit removeDirectoryPicker entfernen) */
export function installDirectoryPicker(picker: () => Promise<unknown>): ReturnType<typeof vi.fn>
{
    const mock = vi.fn(picker);
    (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker = mock;
    return mock;
}

export function removeDirectoryPicker(): void
{
    delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
}

/** Fängt Downloads über einen Link ab und liefert die Dateinamen */
export function captureDownloads(): Array<string>
{
    const namen: Array<string> = [];
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement)
    {
        namen.push(this.download);
    });
    return namen;
}
