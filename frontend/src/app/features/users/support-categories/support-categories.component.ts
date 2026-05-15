import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SupportCategory } from '@core/models';
import { UserService } from '@core/services';

@Component({
  selector: 'app-support-categories',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule
  ],
  template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <a routerLink="/users" class="crumb">Utilisateurs</a>
          <h1>Catalogue des categories support</h1>
          <p>Administration simple du catalogue utilise par la normalisation des tickets et par les competences agent.</p>
        </div>
      </header>

      <div class="layout">
        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ editingId ? 'Modifier une categorie' : 'Nouvelle categorie' }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="categoryForm" (ngSubmit)="saveCategory()">
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Code</mat-label>
                  <input matInput formControlName="code" placeholder="AUTHENTICATION">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Ordre</mat-label>
                  <input matInput type="number" formControlName="sortOrder">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Libelle</mat-label>
                  <input matInput formControlName="label">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Description</mat-label>
                  <textarea matInput rows="3" formControlName="description"></textarea>
                </mat-form-field>
              </div>

              <mat-checkbox formControlName="isActive">Categorie active</mat-checkbox>

              <div class="actions">
                <button mat-stroked-button type="button" (click)="resetForm()">Reinitialiser</button>
                <button mat-raised-button color="primary" type="submit" [disabled]="categoryForm.invalid">
                  <mat-icon>{{ editingId ? 'save' : 'add' }}</mat-icon>
                  {{ editingId ? 'Mettre a jour' : 'Ajouter' }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title>Categories existantes</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="category-list">
              @for (category of categories; track category.id ?? category.code) {
                <div class="category-item">
                  <div>
                    <div class="row-top">
                      <strong>{{ category.label }}</strong>
                      <span class="code-chip">{{ category.code }}</span>
                      <span class="state-chip" [class.state-chip--inactive]="category.isActive === false">
                        {{ category.isActive === false ? 'Inactive' : 'Active' }}
                      </span>
                    </div>
                    <p>{{ category.description || 'Sans description.' }}</p>
                  </div>
                  <div class="row-actions">
                    <button mat-icon-button (click)="editCategory(category)">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="deleteCategory(category)" [disabled]="!category.id">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .page-shell {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px;
    }

    .page-header h1 {
      margin: 8px 0 6px;
      font-size: 32px;
    }

    .page-header p,
    .category-item p {
      color: #64748b;
      margin: 0;
    }

    .crumb {
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
    }

    .layout {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 20px;
      margin-top: 20px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 120px;
      gap: 12px;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 16px;
    }

    .category-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .category-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .row-top {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }

    .code-chip,
    .state-chip {
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .state-chip {
      background: #dcfce7;
      color: #166534;
    }

    .state-chip--inactive {
      background: #f1f5f9;
      color: #475569;
    }

    .row-actions {
      display: flex;
      align-items: center;
    }

    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class SupportCategoriesComponent implements OnInit {
  categories: SupportCategory[] = [];
  editingId?: number;

  readonly categoryForm = this.fb.group({
    code: ['', Validators.required],
    label: ['', Validators.required],
    description: [''],
    isActive: [true],
    sortOrder: [0]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly userService: UserService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.userService.getSupportCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: () => {
        this.categories = [];
      }
    });
  }

  editCategory(category: SupportCategory): void {
    this.editingId = category.id;
    this.categoryForm.patchValue({
      code: category.code,
      label: category.label,
      description: category.description ?? '',
      isActive: category.isActive ?? true,
      sortOrder: category.sortOrder ?? 0
    });
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const payload = this.categoryForm.getRawValue();
    const request$ = this.editingId
      ? this.userService.updateSupportCategory(this.editingId, payload)
      : this.userService.createSupportCategory(payload);

    request$.subscribe({
      next: () => {
        this.snackBar.open(this.editingId ? 'Categorie mise a jour.' : 'Categorie ajoutee.', 'Fermer', { duration: 2500 });
        this.resetForm();
        this.loadCategories();
      },
      error: (error) => {
        this.snackBar.open(error?.error?.message || 'Impossible de sauvegarder la categorie.', 'Fermer', { duration: 3000 });
      }
    });
  }

  deleteCategory(category: SupportCategory): void {
    if (!category.id) {
      return;
    }
    this.userService.deleteSupportCategory(category.id).subscribe({
      next: () => {
        this.snackBar.open('Categorie supprimee.', 'Fermer', { duration: 2500 });
        if (this.editingId === category.id) {
          this.resetForm();
        }
        this.loadCategories();
      },
      error: (error) => {
        this.snackBar.open(error?.error?.message || 'Suppression impossible.', 'Fermer', { duration: 3000 });
      }
    });
  }

  resetForm(): void {
    this.editingId = undefined;
    this.categoryForm.reset({
      code: '',
      label: '',
      description: '',
      isActive: true,
      sortOrder: 0
    });
  }
}
