import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedModule } from '../../shared.module';
import { PrintReportsComponent } from './print-reports.component';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';

describe('PrintReportsComponent', () =>
{
    let component: PrintReportsComponent;
    let fixture: ComponentFixture<PrintReportsComponent>;

    beforeEach(async () =>
    {
        await TestBed.configureTestingModule({
    imports: [SharedModule, PrintReportsComponent],
    providers: [provideHttpClient(withXhr(), withInterceptorsFromDi()), provideHttpClientTesting()]
})
            .compileComponents();
    });

    beforeEach(() =>
    {
        fixture = TestBed.createComponent(PrintReportsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () =>
    {
        expect(component).toBeTruthy();
    });
});
