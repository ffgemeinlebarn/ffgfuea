import { TestBed } from '@angular/core/testing';
import { BarcodeScannerService } from './barcode-scanner.service';

describe('BarcodeScannerService', () =>
{
    let scanner: BarcodeScannerService;
    let barcodes: Array<string>;

    const pressKeys = (...keys: Array<string>) =>
        keys.forEach(key => document.body.dispatchEvent(new KeyboardEvent('keydown', { key })));

    beforeEach(() =>
    {
        scanner = TestBed.inject(BarcodeScannerService);
        barcodes = [];
        scanner.barcodes.subscribe(barcode => barcodes.push(barcode));
    });

    it('meldet Ziffernfolgen, die mit Enter abgeschlossen werden', () =>
    {
        pressKeys('1', '2', '3', '4', '5', 'Enter', '6', '7', '8', '9', '0', '1', 'Enter');
        expect(barcodes).toEqual(['12345', '678901']);
    });

    it('ignoriert zu kurze Eingaben', () =>
    {
        pressKeys('1', '2', '3', '4', 'Enter');
        expect(barcodes).toEqual([]);
    });

    it('verwirft die Eingabe bei anderen Zeichen', () =>
    {
        pressKeys('1', '2', 'a', '3', '4', '5', 'Enter');
        pressKeys('1', '2', '3', '4', '5', 'Shift', 'Enter');
        expect(barcodes).toEqual([]);
    });

    it('ist deaktivierbar', () =>
    {
        scanner.active.set(false);
        pressKeys('1', '2', '3', '4', '5', 'Enter');
        expect(barcodes).toEqual([]);

        scanner.active.set(true);
        pressKeys('1', '2', '3', '4', '5', 'Enter');
        expect(barcodes).toEqual(['12345']);
    });
});
