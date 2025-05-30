import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedModule } from 'src/app/shared/shared.module';

import { StatisticsPageComponent } from './statistics-page.component';

describe('StatisticsPageComponent', () =>
{
    let component: StatisticsPageComponent;
    let fixture: ComponentFixture<StatisticsPageComponent>;

    beforeEach(async () =>
    {
        await TestBed.configureTestingModule({
    imports: [SharedModule, StatisticsPageComponent]
})
            .compileComponents();
    });

    beforeEach(() =>
    {
        fixture = TestBed.createComponent(StatisticsPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () =>
    {
        expect(component).toBeTruthy();
    });
});
