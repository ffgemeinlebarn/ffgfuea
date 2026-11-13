import { Component, input } from '@angular/core';

/**
 * Unterschriftsfeld mit Linien für z.B. Name, Unterschrift und Datum
 */
@Component({
    selector: 'ffg-unterschrift',
    template: `
        <p class="label">{{ label() }}</p>
        <div class="felder">
            @for (feld of felder(); track feld) {
                <div class="feld">{{ feld }}</div>
            }
        </div>
    `,
    styles: `
        :host
        {
            display: block;
            break-inside: avoid;
        }

        .label
        {
            margin: 0;
            font-weight: 600;
        }

        .felder
        {
            display: flex;
            gap: 6mm;
        }

        .feld
        {
            flex: 2 1 0;
            margin-top: 11mm;
            padding-top: 1mm;
            border-top: 0.3mm solid #000;
            font-size: 7.5pt;
            color: #444;
        }

        .feld:last-child:not(:first-child)
        {
            flex-grow: 1;
        }
    `
})
export class UnterschriftComponent
{
    public readonly label = input.required<string>();
    public readonly felder = input<Array<string>>(['Name', 'Unterschrift', 'Datum']);
}
