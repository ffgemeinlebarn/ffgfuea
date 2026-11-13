/**
 * Lädt einen Blob als Datei herunter (landet im Download-Ordner des Browsers)
 */
export function downloadBlob(document: Document, blob: Blob, fileName: string): void
{
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
