import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRippleModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FuellungItemComponent } from './components/fuellung-item/fuellung-item.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SearchFlascheComponent } from './dialogs/search-flasche/search-flasche.component';
import { PrintReportsComponent } from './dialogs/print-reports/print-reports.component';
import { EditEreignisComponent } from './dialogs/edit-ereignis/edit-ereignis.component';
import { AddMangelComponent } from './dialogs/add-mangel/add-mangel.component';
import { EditPersonComponent } from './dialogs/edit-person/edit-person.component';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { ConfirmFuellungComponent } from './dialogs/confirm-fuellung/confirm-fuellung.component';
import { ConfirmEreignisAbschlussComponent } from './dialogs/confirm-ereignis-abschluss/confirm-ereignis-abschluss.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RemoveFuellungComponent } from './dialogs/remove-fuellung/remove-fuellung.component';
import { RemoveFeuerwehrComponent } from './dialogs/remove-feuerwehr/remove-feuerwehr.component';

@NgModule({ exports: [
        MatButtonModule,
        MatMenuModule,
        MatToolbarModule,
        MatIconModule,
        MatCardModule,
        MatSidenavModule,
        MatGridListModule,
        MatTableModule,
        MatSortModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatInputModule,
        MatListModule,
        MatChipsModule,
        MatRippleModule,
        MatExpansionModule,
        FuellungItemComponent,
        MatSlideToggleModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        MatSnackBarModule
    ],
    imports: [CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatMenuModule,
        MatToolbarModule,
        MatIconModule,
        MatCardModule,
        MatSidenavModule,
        MatGridListModule,
        MatTableModule,
        MatSortModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatInputModule,
        MatListModule,
        MatChipsModule,
        MatRippleModule,
        MatExpansionModule,
        MatSlideToggleModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        MatSnackBarModule, FuellungItemComponent,
        SearchFlascheComponent,
        PrintReportsComponent,
        EditEreignisComponent,
        AddMangelComponent,
        EditPersonComponent,
        ConfirmFuellungComponent,
        ConfirmEreignisAbschlussComponent,
        RemoveFuellungComponent,
        RemoveFeuerwehrComponent], providers: [provideHttpClient(withXhr(), withInterceptorsFromDi())] })
export class SharedModule { }
