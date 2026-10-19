import { Injectable, computed, signal } from '@angular/core';

const pad = (value: number) => String(value).padStart(2, '0');

@Injectable({
    providedIn: 'root'
})
export class TimingService
{
    private readonly now = signal(new Date());

    public readonly ereignisStart = signal<Date>(null);

    public readonly currentTime = computed(() =>
    {
        const now = this.now();
        return `${pad(now.getHours())} : ${pad(now.getMinutes())} : ${pad(now.getSeconds())}`;
    });

    public readonly ereignisDuration = computed(() =>
    {
        const start = this.ereignisStart();
        if (!start) return null;

        const diffMinutes = Math.floor((this.now().getTime() - start.getTime()) / 1000 / 60);
        return {
            hours: Math.floor(diffMinutes / 60),
            minutes: diffMinutes % 60
        };
    });

    constructor()
    {
        setInterval(() => this.now.set(new Date()), 1000);
    }
}
