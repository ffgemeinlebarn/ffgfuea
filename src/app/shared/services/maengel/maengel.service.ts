import { Injectable, inject } from '@angular/core';
import { IMangel } from '../../interfaces/i-mangel';
import { MangelType } from '../../models/mangel-type/mangel-type';
import { DatabaseService } from '../database/database.service';

@Injectable({
    providedIn: 'root'
})
export class MaengelService
{
    database = inject(DatabaseService);

    public mangelTyps: Array<MangelType> = [
        new MangelType('Flasche', 'Abgelaufene Druckprüfung'),
        new MangelType('Flasche', 'Äußere Beschädigung (Kerben, Verformungen)'),
        new MangelType('Flasche', 'Farbkennzeichnung'),
        new MangelType('Ventil', 'Äußere Beschädigung'),
        new MangelType('Ventil', 'Kennzeichnung')
    ];

    public async saveOrCreate(mangel: IMangel)
    {
        console.log('[DB] [Mangel] Save Or Create', mangel);

        return this.database.db.transaction('rw', this.database.db.maengel, async () =>
        {
            mangel.id = await this.database.db.maengel.put(mangel);
        });
    }

    public async getSingle(id: number): Promise<IMangel | undefined>
    {
        console.log('[DB] [Mangel] Get Single', id);
        return await this.database.db.maengel?.get(id);
    }

    public async getAll(): Promise<Array<IMangel>>
    {
        console.log('[DB] [Mangel] Get All');
        return await this.database.db.maengel?.toArray();
    }

    public async getAllByFlascheId(flascheId: number): Promise<Array<IMangel>>
    {
        return await this.database.db.maengel?.where('flascheId').equals(flascheId).toArray();
    }

    public async getAllByEreignisId(ereignisId: number): Promise<Array<IMangel>>
    {
        return await this.database.db.maengel?.where('ereignisId').equals(ereignisId).toArray();
    }
}
