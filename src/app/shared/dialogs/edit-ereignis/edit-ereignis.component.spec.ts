import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EditEreignisComponent } from './edit-ereignis.component';
import { SharedModule } from '../../shared.module';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';

describe('EditEreignisComponent', () =>
{
    let component: EditEreignisComponent;
    let fixture: ComponentFixture<EditEreignisComponent>;

    beforeEach(async () =>
    {
        await TestBed.configureTestingModule({
    imports: [SharedModule, EditEreignisComponent],
    providers: [provideHttpClient(withXhr(), withInterceptorsFromDi()), provideHttpClientTesting()]
})
            .compileComponents();
    });

    beforeEach(() =>
    {
        fixture = TestBed.createComponent(EditEreignisComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () =>
    {
        expect(component).toBeTruthy();
    });
});
