import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { errorMessage } from '../../utils/error-message';

/** Anzeigedauer in ms */
export const NotificationDuration = {
    short: 1000,
    normal: 3000,
    long: 5000
} as const;

@Injectable({
    providedIn: 'root'
})
export class NotificationService
{
    private snackBar = inject(MatSnackBar);

    public show(message: string, duration: number = NotificationDuration.normal): void
    {
        this.snackBar.open(message, undefined, { duration });
    }

    public showError(error: unknown, prefix?: string, duration: number = NotificationDuration.normal): void
    {
        const message = errorMessage(error);
        this.show(prefix ? `${prefix}: ${message}` : message, duration);
    }
}
