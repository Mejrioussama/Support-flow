import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ClientService } from '@core/services';
import { Client } from '@core/models';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="client-form-container">
      <header class="page-header glass-panel highlight-border">
        <div class="breadcrumb">
          <a routerLink="/clients" class="neon-text-hover">Clients</a>
          <mat-icon class="breadcrumb-separator">chevron_right</mat-icon>
          <span class="neon-text">{{ isEditMode ? 'Modifier' : 'Nouveau' }}</span>
        </div>
        <div class="header-title-wrapper">
          <mat-icon class="neon-icon">business</mat-icon>
          <h1 class="neon-title">{{ isEditMode ? 'Modifier le client' : 'Créer un nouveau client' }}</h1>
        </div>
      </header>
      
      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="50" class="neon-spinner"></mat-spinner>
          <p class="neon-text loading-text">Chargement du dossier...</p>
        </div>
      } @else {
        <mat-card class="form-card glass-panel profile-3d-card animated-entry">
          <mat-card-content class="form-content">
            <form [formGroup]="clientForm" (ngSubmit)="onSubmit()">
              
              <!-- Section 1 : Informations générales -->
              <div class="form-section">
                <div class="section-header">
                  <mat-icon class="neon-text-blue">info</mat-icon>
                  <h3 class="section-title neon-text">Informations générales</h3>
                  <div class="neon-line"></div>
                </div>
                
                <div class="form-grid">
                  <mat-form-field appearance="outline" class="glass-input full-width tilt-on-focus">
                    <mat-label>Raison Sociale</mat-label>
                    <input matInput formControlName="name" placeholder="Nom de l'entreprise">
                    <mat-icon matPrefix class="field-icon">business_center</mat-icon>
                    @if (clientForm.get('name')?.hasError('required')) {
                      <mat-error>Le nom est requis</mat-error>
                    }
                  </mat-form-field>
                  
                  <mat-form-field appearance="outline" class="glass-input tilt-on-focus">
                    <mat-label>Email de contact</mat-label>
                    <input matInput formControlName="email" type="email" placeholder="contact@entreprise.com">
                    <mat-icon matPrefix class="field-icon">alternate_email</mat-icon>
                    @if (clientForm.get('email')?.hasError('required')) {
                      <mat-error>L'email est requis</mat-error>
                    }
                    @if (clientForm.get('email')?.hasError('email')) {
                      <mat-error>Email invalide</mat-error>
                    }
                  </mat-form-field>
                  
                  <mat-form-field appearance="outline" class="glass-input tilt-on-focus">
                    <mat-label>Téléphone support/accueil</mat-label>
                    <input matInput formControlName="phone" placeholder="+33 1 23 45 67 89">
                    <mat-icon matPrefix class="field-icon">ring_volume</mat-icon>
                  </mat-form-field>
                  
                  <mat-form-field appearance="outline" class="glass-input full-width tilt-on-focus">
                    <mat-label>Adresse Postale</mat-label>
                    <textarea matInput formControlName="address" rows="2" 
                              placeholder="Adresse complète..."></textarea>
                    <mat-icon matPrefix class="field-icon">location_on</mat-icon>
                  </mat-form-field>
                  
                  <mat-form-field appearance="outline" class="glass-input tilt-on-focus">
                    <mat-label>Numéro SIRET</mat-label>
                    <input matInput formControlName="siret" placeholder="123 456 789 00012">
                    <mat-icon matPrefix class="field-icon">tag</mat-icon>
                  </mat-form-field>
                  
                  <mat-form-field appearance="outline" class="glass-input tilt-on-focus">
                    <mat-label>Site Web</mat-label>
                    <input matInput formControlName="website" placeholder="https://www.entreprise.com">
                    <mat-icon matPrefix class="field-icon">language</mat-icon>
                  </mat-form-field>
                </div>
              </div>
              
              <!-- Section 2 : Contrat -->
              <div class="form-section">
                <div class="section-header">
                  <mat-icon class="neon-text-orange">description</mat-icon>
                  <h3 class="section-title neon-text">Modalités du Contrat</h3>
                  <div class="neon-line orange-line"></div>
                </div>
                
                <div class="form-grid">
                  <mat-form-field appearance="outline" class="glass-input tilt-on-focus">
                    <mat-label>Niveau de Service (SLA)</mat-label>
                    <mat-icon matPrefix class="field-icon">military_tech</mat-icon>
                    <mat-select formControlName="contractType" panelClass="glass-select-panel">
                      @for (type of contractTypes; track type.value) {
                        <mat-option [value]="type.value">
                           <span [class]="'contract-label contract-' + type.value.toLowerCase()">
                              {{ type.label }}
                           </span>
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  
                  <div class="date-group tilt-on-focus">
                     <mat-form-field appearance="outline" class="glass-input date-input half-width">
                        <mat-label>Date de début</mat-label>
                        <input matInput [matDatepicker]="startPicker" formControlName="contractStartDate">
                        <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
                        <mat-datepicker #startPicker></mat-datepicker>
                     </mat-form-field>
                     
                     <span class="date-separator"><mat-icon>arrow_forward</mat-icon></span>
                     
                     <mat-form-field appearance="outline" class="glass-input date-input half-width">
                        <mat-label>Date de fin</mat-label>
                        <input matInput [matDatepicker]="endPicker" formControlName="contractEndDate">
                        <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
                        <mat-datepicker #endPicker></mat-datepicker>
                     </mat-form-field>
                  </div>
                  
                  <div class="toggle-field glass-input-like tilt-on-focus">
                    <mat-slide-toggle formControlName="active" color="primary">
                       <span class="toggle-label" [class.is-active]="clientForm.get('active')?.value">
                          {{ clientForm.get('active')?.value ? 'Compte Activé' : 'Compte Désactivé' }}
                       </span>
                    </mat-slide-toggle>
                    <mat-icon class="status-icon" [ngClass]="clientForm.get('active')?.value ? 'neon-text-green' : 'neon-text-red'">
                       {{ clientForm.get('active')?.value ? 'verified' : 'block' }}
                    </mat-icon>
                  </div>
                </div>
              </div>
              
              <!-- Section 3 : Notes -->
              <div class="form-section">
                <div class="section-header">
                  <mat-icon class="neon-text-purple">speaker_notes</mat-icon>
                  <h3 class="section-title neon-text">Notes Internes</h3>
                  <div class="neon-line purple-line"></div>
                </div>
                
                <mat-form-field appearance="outline" class="glass-input full-width tilt-on-focus">
                  <mat-label>Observations confidentielles</mat-label>
                  <textarea matInput formControlName="notes" rows="4" 
                            placeholder="Informations supplémentaires, contexte, consignes de support spéciales..."></textarea>
                  <mat-icon matPrefix class="field-icon">edit_note</mat-icon>
                </mat-form-field>
              </div>
              
              <div class="form-actions">
                <button mat-stroked-button type="button" routerLink="/clients" class="glass-btn action-btn">
                  <mat-icon>close</mat-icon> Annuler
                </button>
                <div class="spacer"></div>
                <button mat-raised-button color="primary" type="submit" class="neon-btn action-btn popup-btn" 
                        [disabled]="clientForm.invalid || saving">
                  @if (saving) {
                    <mat-spinner diameter="24" class="neon-spinner-light"></mat-spinner>
                    <span style="margin-left: 8px;">Enregistrement...</span>
                  } @else {
                    <mat-icon>{{ isEditMode ? 'save' : 'how_to_reg' }}</mat-icon>
                    {{ isEditMode ? 'Enregistrer les Modifications' : 'Enregistrer le Partenaire' }}
                  }
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .client-form-container {
      padding: 24px;
      max-width: 1000px;
      margin: 0 auto;
      perspective: 1200px;
    }
    
    .page-header {
      padding: 24px 32px;
      margin-bottom: 32px;
      border-radius: 20px !important;
      
      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-muted);
        margin-bottom: 12px;
        font-size: 14px;
        font-weight: 500;
        
        a.neon-text-hover {
          color: var(--accent-blue);
          text-decoration: none;
          transition: all 0.3s;
          
          &:hover {
            color: var(--neon-cyan);
            text-shadow: 0 0 8px rgba(6, 182, 212, 0.5);
          }
        }
        
        .breadcrumb-separator {
          font-size: 16px; width: 16px; height: 16px;
          opacity: 0.5;
        }
      }
      
      .header-title-wrapper {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .neon-icon {
        font-size: 36px; width: 36px; height: 36px;
        color: var(--neon-cyan);
        filter: drop-shadow(0 0 8px rgba(6, 182, 212, 0.4));
      }
      
      .neon-title {
        margin: 0;
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.5px;
        background: linear-gradient(135deg, var(--text-main) 0%, var(--accent-blue) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
    }
    
    // --- Card & Layout ---
    .form-card {
      border-radius: 20px !important;
      padding: 16px;
    }
    
    .profile-3d-card {
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease !important;
      transform-style: preserve-3d;
      
      &:hover {
        transform: translateY(-2px) rotateX(1deg);
        box-shadow: 0 15px 35px rgba(0,0,0,0.4), 0 0 20px rgba(59, 130, 246, 0.05) !important;
      }
    }
    
    .animated-entry {
      opacity: 0;
      animation: slideUpFloat 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }
    
    @keyframes slideUpFloat {
      0% { opacity: 0; transform: translateY(30px) scale(0.98); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    
    // --- Form Sections ---
    .form-section {
      margin-bottom: 40px;
      background: rgba(var(--sf-text-rgb),0.01);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid rgba(var(--sf-text-rgb),0.03);
      
      &:last-of-type {
        margin-bottom: 0;
      }
    }
    
    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      position: relative;
      
      mat-icon { font-size: 24px; }
      
      .section-title {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      
      .neon-line {
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, rgba(59, 130, 246, 0.3), transparent);
        
        &.orange-line { background: linear-gradient(90deg, rgba(245, 158, 11, 0.3), transparent); }
        &.purple-line { background: linear-gradient(90deg, rgba(139, 92, 246, 0.3), transparent); }
      }
    }
    
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      
      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
      
      .full-width, .date-group {
        grid-column: 1 / -1;
      }
    }
    
    // --- Inputs & Controls ---
    .field-icon {
      margin-right: 8px;
      color: var(--accent-blue);
      opacity: 0.8;
    }
    
    ::ng-deep .glass-input .mdc-notched-outline__leading,
    ::ng-deep .glass-input .mdc-notched-outline__notch,
    ::ng-deep .glass-input .mdc-notched-outline__trailing {
      border-color: rgba(var(--sf-text-rgb),0.1) !important;
      border-width: 2px !important;
      transition: border-color 0.3s !important;
    }
    
    ::ng-deep .glass-input:hover .mdc-notched-outline__leading,
    ::ng-deep .glass-input:hover .mdc-notched-outline__notch,
    ::ng-deep .glass-input:hover .mdc-notched-outline__trailing {
      border-color: rgba(var(--sf-text-rgb),0.2) !important;
    }
    
    ::ng-deep .glass-input.mat-focused .mdc-notched-outline__leading,
    ::ng-deep .glass-input.mat-focused .mdc-notched-outline__notch,
    ::ng-deep .glass-input.mat-focused .mdc-notched-outline__trailing {
      border-color: var(--accent-blue) !important;
    }
    
    ::ng-deep .glass-input input.mat-mdc-input-element,
    ::ng-deep .glass-input textarea.mat-mdc-input-element,
    ::ng-deep .glass-input .mat-mdc-select-value {
      color: var(--text-main) !important;
      font-weight: 500;
    }
    
    .date-group {
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(0,0,0,0.2);
      padding: 16px;
      border-radius: 12px;
      border: 1px solid rgba(var(--sf-text-rgb),0.05);
      
      .date-separator {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        opacity: 0.5;
      }
      
      .date-input {
        flex: 1;
        margin-bottom: -1.25em; // Remove bottom padding from form field
      }
      
      @media (max-width: 600px) {
        flex-direction: column;
        
        .date-separator mat-icon { transform: rotate(90deg); margin: 8px 0; }
        .date-input { width: 100%; }
      }
    }
    
    .glass-input-like {
      background: rgba(0,0,0,0.2);
      border: 1px solid rgba(var(--sf-text-rgb),0.1);
      border-radius: 12px;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      transition: all 0.3s;
      
      &:hover { border-color: rgba(var(--sf-text-rgb),0.2); background: rgba(0,0,0,0.3); }
    }
    
    .toggle-label {
      font-weight: 600;
      color: var(--text-muted);
      margin-left: 8px;
      transition: color 0.3s;
      
      &.is-active { color: var(--text-main); }
    }
    
    .tilt-on-focus {
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      
      &.mat-focused, &:focus-within {
        transform: translateY(-2px);
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.2));
      }
    }
    
    // --- Custom Contract Badges in Select ---
    .contract-label {
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-size: 13px;
      
      &.contract-basic { color: #9ca3af; }
      &.contract-standard { color: var(--accent-blue); }
      &.contract-premium { color: var(--neon-orange); }
      &.contract-enterprise { color: var(--accent-purple); text-shadow: 0 0 8px rgba(139, 92, 246, 0.4); }
    }
    
    // --- Actions ---
    .form-actions {
      display: flex;
      align-items: center;
      padding: 24px 8px 8px;
      border-top: 1px solid rgba(var(--sf-text-rgb),0.05);
      margin-top: 16px;
      
      .spacer { flex: 1; }
      
      .action-btn {
        height: 48px !important;
        padding: 0 32px !important;
        font-weight: 600 !important;
        letter-spacing: 0.5px;
        border-radius: 12px !important;
        
        mat-icon { margin-right: 8px; }
      }
      
      .popup-btn {
        &:not(:disabled) {
          background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%) !important;
          animation: pulseBorder 2s infinite;
        }
      }
    }
    
    @keyframes pulseBorder {
      0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
      70% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
      100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
    }
    
    // --- Utilities ---
    .neon-text-blue { color: var(--accent-blue); }
    .neon-text-orange { color: #f97316; }
    .neon-text-purple { color: var(--accent-purple); }
    .neon-text-green { color: var(--neon-green); }
    .neon-text-red { color: var(--neon-red); }
    
    .loading-state {
      padding: 100px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      
      .loading-text {
        font-weight: 600;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-size: 13px;
        animation: pulse 1.5s infinite;
      }
    }
  `]
})
export class ClientFormComponent implements OnInit {
  clientForm!: FormGroup;
  isEditMode = false;
  clientId?: number;
  loading = false;
  saving = false;

  contractTypes = [
    { value: 'BASIC', label: 'Basic' },
    { value: 'STANDARD', label: 'Standard' },
    { value: 'PREMIUM', label: 'Premium' },
    { value: 'ENTERPRISE', label: 'Enterprise' }
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private clientService: ClientService,
    private snackBar: MatSnackBar
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.clientId = this.route.snapshot.params['id'];
    this.isEditMode = !!this.clientId && this.route.snapshot.url.some(s => s.path === 'edit');

    if (this.isEditMode && this.clientId) {
      this.loadClient(this.clientId);
    }
  }

  initForm(): void {
    this.clientForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: [''],
      siret: [''],
      website: [''],
      contractType: ['STANDARD'],
      contractStartDate: [null],
      contractEndDate: [null],
      active: [true],
      notes: ['']
    });
  }

  loadClient(id: number): void {
    this.loading = true;
    this.clientService.getClient(id).subscribe({
      next: (client) => {
        this.clientForm.patchValue({
          name: client.name,
          email: client.email,
          phone: client.phone,
          address: client.address,
          siret: client.siret,
          website: client.website,
          contractType: client.contractType,
          contractStartDate: client.contractStartDate ? new Date(client.contractStartDate) : null,
          contractEndDate: client.contractEndDate ? new Date(client.contractEndDate) : null,
          active: client.active,
          notes: client.notes
        });
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading client:', error);
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.clientForm.invalid) return;

    this.saving = true;
    const formData = this.clientForm.value;

    const request = this.isEditMode && this.clientId
      ? this.clientService.updateClient(this.clientId, formData)
      : this.clientService.createClient(formData);

    request.subscribe({
      next: (client) => {
        this.saving = false;
        this.snackBar.open(
          this.isEditMode ? 'Client mis à jour avec succès' : 'Client créé avec succès',
          'Fermer',
          { duration: 3000 }
        );
        this.router.navigate(['/clients', client.id]);
      },
      error: (error) => {
        this.saving = false;
        console.error('Error saving client:', error);
        this.snackBar.open('Erreur lors de l\'enregistrement', 'Fermer', { duration: 3000 });
      }
    });
  }
}
