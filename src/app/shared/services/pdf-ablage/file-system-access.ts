// Teile der File System Access API, die (noch) nicht in lib.dom.d.ts enthalten sind.
// Verfügbar in Chrome und Edge am PC, siehe https://developer.chrome.com/docs/capabilities/web-apis/file-system-access

export interface IBerechtigungOptionen
{
    mode: 'read' | 'readwrite';
}

/** Ordner mit den Methoden zur Abfrage der Berechtigung (fehlen in manchen Browsern) */
export interface IOrdnerHandle extends FileSystemDirectoryHandle
{
    queryPermission?(options: IBerechtigungOptionen): Promise<PermissionState>;
    requestPermission?(options: IBerechtigungOptionen): Promise<PermissionState>;
}

export interface IDirectoryPickerOptionen
{
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads';
}

export type DirectoryPicker = (options?: IDirectoryPickerOptionen) => Promise<FileSystemDirectoryHandle>;

/** showDirectoryPicker des Fensters, undefined wenn der Browser keine Ordnerauswahl unterstützt */
export function getDirectoryPicker(window: Window | null): DirectoryPicker | undefined
{
    const picker = (window as { showDirectoryPicker?: DirectoryPicker } | null)?.showDirectoryPicker;
    return typeof picker === 'function' ? picker.bind(window) : undefined;
}
