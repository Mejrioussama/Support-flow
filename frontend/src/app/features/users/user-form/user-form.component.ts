import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Client, SupportCategory, User, UserCreate, UserRole } from '@core/models';
import { ClientService } from '@core/services/client.service';
import { UserService } from '@core/services';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule
  ],
  template: `
    <div class="user-form-page">
      <section class="hero-card">
        <div class="hero-copy">
          <a routerLink="/users" class="crumb">Utilisateurs</a>
          <span class="eyebrow">Identity Studio</span>
          <h1>{{ isEditMode ? 'Mettre a jour un compte SupportFlow' : 'Creer un nouveau compte SupportFlow' }}</h1>
          <p>
            Configurez un utilisateur avec un role clair, un rattachement métier cohérent et une synchronisation
            Keycloak propre des la creation.
          </p>
          <div class="hero-chips">
            <span class="hero-chip" [class]="getRoleToneClass(selectedRole)">
              <mat-icon>{{ getRoleIcon(selectedRole) }}</mat-icon>
              {{ getRoleLabel(selectedRole) }}
            </span>
            <span class="hero-chip hero-chip--soft">
              <mat-icon>{{ showSkillSelectors ? 'psychology' : 'badge' }}</mat-icon>
              {{ showSkillSelectors ? 'Competences support visibles' : 'Compte standard sans skill support' }}
            </span>
            <span class="hero-chip hero-chip--soft" [class.hero-chip--warn]="showClientSelector && !userForm.get('clientId')?.value">
              <mat-icon>{{ showClientSelector ? 'apartment' : 'hub' }}</mat-icon>
              {{ showClientSelector ? 'Rattachement client requis' : 'Compte interne plateforme' }}
            </span>
          </div>
        </div>

        <div class="hero-actions">
          <button mat-stroked-button class="action-btn" routerLink="/users/support-categories">
            <mat-icon>category</mat-icon>
            Categories
          </button>
          <button mat-stroked-button class="action-btn" routerLink="/users">
            <mat-icon>group</mat-icon>
            Liste utilisateurs
          </button>
        </div>
      </section>

      @if (loading) {
        <div class="loading-shell panel-card">
          <mat-spinner diameter="46"></mat-spinner>
          <p>Chargement du compte, des clients et des competences...</p>
        </div>
      } @else {
        <form [formGroup]="userForm" (ngSubmit)="onSubmit()" class="form-layout">
          <section class="main-column">
            <article class="panel-card">
              <div class="section-head">
                <div class="section-icon">
                  <mat-icon>person</mat-icon>
                </div>
                <div>
                  <h2>Identite utilisateur</h2>
                  <p>Informations visibles dans SupportFlow et dans la synchronisation Keycloak.</p>
                </div>
              </div>

              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Prenom</mat-label>
                  <input matInput formControlName="firstName" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Nom</mat-label>
                  <input matInput formControlName="lastName" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Username</mat-label>
                  <input matInput formControlName="username" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Email</mat-label>
                  <input matInput type="email" formControlName="email" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="wide-field">
                  <mat-label>Telephone</mat-label>
                  <input matInput formControlName="phone" />
                </mat-form-field>
              </div>
            </article>

            <article class="panel-card">
              <div class="section-head">
                <div class="section-icon section-icon--violet">
                  <mat-icon>admin_panel_settings</mat-icon>
                </div>
                <div>
                  <h2>Role et gouvernance</h2>
                  <p>Le role pilote les permissions, le workflow et le comportement de synchronisation.</p>
                </div>
              </div>

              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Role</mat-label>
                  <mat-select formControlName="role">
                    @for (role of roles; track role.value) {
                      <mat-option [value]="role.value">{{ role.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <div class="role-note">
                  <strong>{{ getRoleLabel(selectedRole) }}</strong>
                  <p>{{ getRoleDescription(selectedRole) }}</p>
                </div>

                @if (showClientSelector) {
                  <mat-form-field appearance="outline" class="wide-field">
                    <mat-label>Client rattache</mat-label>
                    <mat-select formControlName="clientId">
                      @for (client of clients; track client.id) {
                        <mat-option [value]="client.id">{{ getClientLabel(client) }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                }

                <div class="toggle-block wide-field">
                  <mat-slide-toggle formControlName="isActive">
                    {{ userForm.get('isActive')?.value ? 'Compte actif des la sauvegarde' : 'Compte cree comme inactif' }}
                  </mat-slide-toggle>
                </div>
              </div>
            </article>

            @if (showSkillSelectors) {
              <article class="panel-card">
                <div class="section-head">
                  <div class="section-icon section-icon--green">
                    <mat-icon>psychology</mat-icon>
                  </div>
                  <div>
                    <h2>Competences support</h2>
                    <p>Utilisees pour la shortlist d assignation, la charge et les recommandations.</p>
                  </div>
                </div>

                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Competence principale</mat-label>
                    <mat-select formControlName="primarySkillCode">
                      @for (category of categories; track category.code) {
                        <mat-option [value]="category.code">{{ category.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Competence secondaire</mat-label>
                    <mat-select formControlName="secondarySkillCode">
                      <mat-option [value]="null">Aucune</mat-option>
                      @for (category of categories; track category.code) {
                        <mat-option [value]="category.code">{{ category.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <div class="skill-note wide-field">
                    <strong>Conseil de parametrage</strong>
                    <p>Une competence principale claire ameliore les recommandations d assignation et le pilotage manager.</p>
                  </div>
                </div>
              </article>
            }

            @if (!isEditMode) {
              <article class="panel-card">
                <div class="section-head">
                  <div class="section-icon section-icon--amber">
                    <mat-icon>password</mat-icon>
                  </div>
                  <div>
                    <h2>Acces initial</h2>
                    <p>Ces informations seront provisionnees dans Keycloak pendant la creation.</p>
                  </div>
                </div>

                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Mot de passe</mat-label>
                    <input matInput type="password" formControlName="password" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Confirmation</mat-label>
                    <input matInput type="password" formControlName="confirmPassword" />
                  </mat-form-field>

                  <div class="password-note wide-field">
                    <strong>Recommandation</strong>
                    <p>Utilisez au minimum 8 caracteres. Le compte sera immediatement connectable via Keycloak.</p>
                  </div>
                </div>
              </article>
            }

            @if (isEditMode) {
              <article class="panel-card">
                <div class="section-head">
                  <div class="section-icon section-icon--amber">
                    <mat-icon>password</mat-icon>
                  </div>
                  <div>
                    <h2>Securite et mot de passe</h2>
                    <p>Rotation directe du mot de passe utilisateur avec synchronisation Keycloak immediate.</p>
                  </div>
                </div>

                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Nouveau mot de passe</mat-label>
                    <input matInput type="password" [formControl]="passwordResetForm.controls.newPassword" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Confirmation</mat-label>
                    <input matInput type="password" [formControl]="passwordResetForm.controls.confirmPassword" />
                  </mat-form-field>

                  <div class="password-note wide-field">
                    <strong>Rotation securisee</strong>
                    <p>{{ passwordResetMessage || 'Le mot de passe sera mis a jour en base et dans Keycloak au meme moment.' }}</p>
                  </div>

                  <div class="toggle-block wide-field">
                    <div class="password-status-badges">
                      <span class="status-pill" [class.status-pill--warning]="isTemporaryPasswordMode" [class.status-pill--success]="!isTemporaryPasswordMode">
                        <mat-icon>{{ isTemporaryPasswordMode ? 'timer' : 'verified_user' }}</mat-icon>
                        {{ getPasswordModeLabel() }}
                      </span>
                    </div>
                    <mat-slide-toggle [formControl]="passwordResetForm.controls.forceChangeOnNextLogin">
                      Forcer changement au prochain login
                    </mat-slide-toggle>
                    <p>
                      Si active, le mot de passe devient temporaire: l'utilisateur devra definir son propre mot de passe
                      des sa prochaine connexion dans Keycloak.
                    </p>
                  </div>
                </div>

                <div class="inline-actions">
                  <button
                    mat-stroked-button
                    class="action-btn"
                    type="button"
                    (click)="sendResetEmail()"
                    [disabled]="sendingResetEmail || changingPassword || !userForm.get('email')?.value">
                    <mat-icon>{{ sendingResetEmail ? 'hourglass_top' : 'alternate_email' }}</mat-icon>
                    Envoyer reset par mail
                  </button>
                  <button
                    mat-stroked-button
                    class="action-btn"
                    type="button"
                    (click)="resetPasswordFields()"
                    [disabled]="changingPassword || sendingResetEmail">
                    <mat-icon>restart_alt</mat-icon>
                    Reinitialiser
                  </button>
                  <button
                    mat-raised-button
                    class="action-btn action-btn--primary"
                    type="button"
                    (click)="updatePassword()"
                    [disabled]="changingPassword || sendingResetEmail || passwordResetForm.invalid">
                    <mat-icon>{{ changingPassword ? 'hourglass_top' : 'vpn_key' }}</mat-icon>
                    Changer le mot de passe
                  </button>
                </div>
              </article>
            }
          </section>

          <aside class="side-column">
            <article class="panel-card side-card">
              <span class="eyebrow">Synthese</span>
              <strong>{{ getDisplayNamePreview() }}</strong>
              <p>{{ getRoleDescription(selectedRole) }}</p>

              <div class="side-list">
                <div class="side-row">
                  <span>Role</span>
                  <strong>{{ getRoleLabel(selectedRole) }}</strong>
                </div>
                <div class="side-row">
                  <span>Client</span>
                  <strong>{{ showClientSelector ? (getSelectedClientName() || 'A selectionner') : 'Non applicable' }}</strong>
                </div>
                <div class="side-row">
                  <span>Etat</span>
                  <strong>{{ userForm.get('isActive')?.value ? 'Actif' : 'Inactif' }}</strong>
                </div>
                <div class="side-row">
                  <span>Provisioning</span>
                  <strong>{{ isEditMode ? 'Maj Keycloak si necessaire' : 'Creation Keycloak automatique' }}</strong>
                </div>
                @if (isEditMode) {
                  <div class="side-row side-row--stacked">
                    <span>Securite mot de passe</span>
                    <strong>
                      <span class="status-pill" [class.status-pill--warning]="isTemporaryPasswordMode" [class.status-pill--success]="!isTemporaryPasswordMode">
                        <mat-icon>{{ isTemporaryPasswordMode ? 'lock_clock' : 'task_alt' }}</mat-icon>
                        {{ getPasswordModeLabel() }}
                      </span>
                    </strong>
                  </div>
                }
              </div>
            </article>

            <article class="panel-card side-card">
              <span class="eyebrow">Verification</span>
              <strong>{{ isEditMode ? 'Revision avant sauvegarde' : 'Creation du compte' }}</strong>
              <p>
                {{ getValidationNarrative() }}
              </p>
            </article>

            <div class="sticky-actions">
              <button mat-stroked-button class="action-btn" type="button" routerLink="/users">
                <mat-icon>close</mat-icon>
                Annuler
              </button>
              <button mat-raised-button class="action-btn action-btn--primary" type="submit" [disabled]="userForm.invalid || saving">
                <mat-icon>{{ saving ? 'hourglass_top' : (isEditMode ? 'save' : 'person_add') }}</mat-icon>
                {{ isEditMode ? 'Enregistrer' : 'Creer le compte' }}
              </button>
            </div>
          </aside>
        </form>
      }
    </div>
  `,
  styles: [`
    .user-form-page {
      --page-bg: #07101f;
      --panel: rgba(10, 18, 34, 0.82);
      --panel-soft: rgba(12, 24, 45, 0.76);
      --line: rgba(96, 165, 250, 0.18);
      --text: #e8eefb;
      --muted: #93a1bb;
      min-height: calc(100vh - 72px);
      padding: 24px;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(84, 212, 255, 0.1), transparent 30%),
        radial-gradient(circle at top right, rgba(139, 124, 255, 0.12), transparent 28%),
        linear-gradient(180deg, #06101f 0%, #071322 100%);
      font-family: 'Manrope', sans-serif;
    }

    .hero-card,
    .panel-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      backdrop-filter: blur(18px);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
    }

    .hero-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      padding: 28px;
      margin-bottom: 22px;
      background:
        radial-gradient(circle at 15% 20%, rgba(84, 212, 255, 0.12), transparent 30%),
        linear-gradient(135deg, rgba(9, 18, 34, 0.96), rgba(7, 16, 31, 0.9));
    }

    .crumb,
    .eyebrow {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.18em;
    }

    .crumb {
      text-decoration: none;
      color: #8fdcff;
      margin-bottom: 8px;
    }

    .eyebrow {
      color: rgba(148, 197, 255, 0.86);
      margin-bottom: 10px;
    }

    .hero-card h1 {
      margin: 0 0 10px;
      font-size: 36px;
      line-height: 1.05;
      letter-spacing: -0.04em;
      font-family: 'Space Grotesk', sans-serif;
    }

    .hero-card p,
    .section-head p,
    .role-note p,
    .skill-note p,
    .password-note p,
    .side-card p,
    .loading-shell p {
      margin: 0;
      color: var(--muted);
      line-height: 1.65;
    }

    .hero-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    .hero-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.05);
      color: var(--text);
    }

    .hero-chip--soft { color: #cbd5e1; }
    .hero-chip--warn { color: #fdba74; border-color: rgba(251, 146, 60, 0.22); }
    .hero-chip--admin { color: #fca5a5; border-color: rgba(248, 113, 113, 0.22); }
    .hero-chip--manager { color: #fcd34d; border-color: rgba(250, 204, 21, 0.22); }
    .hero-chip--agent { color: #93c5fd; border-color: rgba(96, 165, 250, 0.22); }
    .hero-chip--client { color: #86efac; border-color: rgba(74, 222, 128, 0.22); }

    .hero-actions,
    .sticky-actions {
      display: grid;
      gap: 12px;
    }

    .hero-actions {
      align-content: start;
      min-width: 220px;
    }

    .action-btn {
      min-height: 48px;
      border-radius: 14px !important;
      justify-content: flex-start !important;
      padding: 0 16px !important;
      border-color: rgba(255, 255, 255, 0.08) !important;
      color: var(--text) !important;
      background: rgba(255, 255, 255, 0.04) !important;
    }

    .action-btn--primary {
      background: linear-gradient(135deg, rgba(84, 212, 255, 0.92), rgba(59, 130, 246, 0.88)) !important;
      color: #03111d !important;
      font-weight: 800;
    }

    .loading-shell {
      display: grid;
      justify-items: center;
      gap: 14px;
      padding: 68px 24px;
    }

    .form-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 22px;
      align-items: start;
    }

    .main-column,
    .side-column {
      display: grid;
      gap: 18px;
    }

    .panel-card {
      padding: 22px;
    }

    .section-head {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 18px;
    }

    .section-head h2 {
      margin: 0 0 4px;
      font-size: 22px;
      letter-spacing: -0.03em;
    }

    .section-icon {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: rgba(84, 212, 255, 0.1);
      border: 1px solid rgba(84, 212, 255, 0.16);
      color: #54d4ff;
      flex-shrink: 0;
    }

    .section-icon--violet {
      color: #c4b5fd;
      border-color: rgba(139, 124, 255, 0.22);
      background: rgba(139, 124, 255, 0.1);
    }

    .section-icon--green {
      color: #86efac;
      border-color: rgba(74, 222, 128, 0.22);
      background: rgba(74, 222, 128, 0.1);
    }

    .section-icon--amber {
      color: #fdba74;
      border-color: rgba(251, 146, 60, 0.22);
      background: rgba(251, 146, 60, 0.1);
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .wide-field {
      grid-column: 1 / -1;
    }

    .role-note,
    .skill-note,
    .password-note,
    .toggle-block {
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--panel-soft);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .password-status-badges {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.02em;
      background: rgba(84, 212, 255, 0.12);
      border: 1px solid rgba(84, 212, 255, 0.18);
      color: #c9f6ff;
    }

    .status-pill--warning {
      background: rgba(251, 191, 36, 0.12);
      border-color: rgba(251, 191, 36, 0.24);
      color: #fde68a;
    }

    .status-pill--success {
      background: rgba(34, 197, 94, 0.12);
      border-color: rgba(34, 197, 94, 0.24);
      color: #bbf7d0;
    }

    .inline-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;
      flex-wrap: wrap;
    }

    .role-note strong,
    .skill-note strong,
    .password-note strong,
    .side-card strong {
      display: block;
      margin-bottom: 6px;
      font-size: 16px;
    }

    .side-card {
      display: grid;
      gap: 12px;
    }

    .side-list {
      display: grid;
      gap: 10px;
    }

    .side-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--panel-soft);
      border: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 13px;
    }

    .side-row span {
      color: var(--muted);
    }

    .side-row--stacked {
      align-items: flex-start;
      flex-direction: column;
    }

    @media (max-width: 1000px) {
      .form-layout,
      .hero-card {
        grid-template-columns: 1fr;
      }

      .hero-actions {
        min-width: 0;
      }
    }

    @media (max-width: 720px) {
      .user-form-page {
        padding: 12px;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .inline-actions {
        flex-direction: column;
      }
    }
  `]
})
export class UserFormComponent implements OnInit {
  userId?: number;
  isEditMode = false;
  loading = false;
  saving = false;
  changingPassword = false;
  sendingResetEmail = false;
  categories: SupportCategory[] = [];
  clients: Client[] = [];
  passwordResetMessage = '';

  readonly roles: Array<{ value: UserRole; label: string }> = [
    { value: 'ADMIN', label: 'Administrateur' },
    { value: 'SUPPORT_MANAGER', label: 'Manager support' },
    { value: 'SUPPORT_AGENT', label: 'Agent support' },
    { value: 'CLIENT', label: 'Client' }
  ];

  readonly userForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    role: ['SUPPORT_AGENT' as UserRole, Validators.required],
    password: [''],
    confirmPassword: [''],
    isActive: [true],
    clientId: [null as number | null],
    primarySkillCode: ['GENERAL'],
    secondarySkillCode: [null as string | null]
  });

  readonly passwordResetForm = this.fb.group({
    newPassword: ['', [Validators.minLength(8)]],
    confirmPassword: [''],
    forceChangeOnNextLogin: [true]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly userService: UserService,
    private readonly clientService: ClientService,
    private readonly snackBar: MatSnackBar
  ) {}

  get selectedRole(): UserRole {
    return (this.userForm.get('role')?.value ?? 'CLIENT') as UserRole;
  }

  get showSkillSelectors(): boolean {
    return this.selectedRole === 'SUPPORT_AGENT' || this.selectedRole === 'SUPPORT_MANAGER';
  }

  get showClientSelector(): boolean {
    return this.selectedRole === 'CLIENT';
  }

  get isTemporaryPasswordMode(): boolean {
    return !!this.passwordResetForm.get('forceChangeOnNextLogin')?.value;
  }

  ngOnInit(): void {
    this.userId = Number(this.route.snapshot.params['id'] || 0) || undefined;
    this.isEditMode = !!this.userId;

    if (!this.isEditMode) {
      this.userForm.get('password')?.addValidators([Validators.required, Validators.minLength(8)]);
      this.userForm.get('confirmPassword')?.addValidators([Validators.required]);
    }

    this.userForm.get('role')?.valueChanges.subscribe((role) => {
      if (role === 'SUPPORT_AGENT' || role === 'SUPPORT_MANAGER') {
        this.userForm.patchValue({
          clientId: null,
          primarySkillCode: this.userForm.get('primarySkillCode')?.value || 'GENERAL'
        }, { emitEvent: false });
        return;
      }

      if (role === 'CLIENT') {
        this.userForm.patchValue({
          primarySkillCode: null,
          secondarySkillCode: null
        }, { emitEvent: false });
        return;
      }

      this.userForm.patchValue({
        clientId: null,
        primarySkillCode: null,
        secondarySkillCode: null
      }, { emitEvent: false });
    });

    this.loadCategories();
    this.loadClients();
    if (this.userId) {
      this.loadUser(this.userId);
    }
  }

  private loadCategories(): void {
    this.userService.getSupportCategories().subscribe({
      next: (categories) => {
        this.categories = categories.filter(category => category.isActive !== false);
      },
      error: () => {
        this.categories = [];
      }
    });
  }

  private loadClients(): void {
    this.clientService.getAllActiveClients().subscribe({
      next: (clients) => {
        this.clients = clients;
      },
      error: () => {
        this.clients = [];
      }
    });
  }

  private loadUser(id: number): void {
    this.loading = true;
    this.userService.getUser(id).subscribe({
      next: (user) => {
        this.patchUser(user);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open("Impossible de charger l'utilisateur", 'Fermer', { duration: 3000 });
      }
    });
  }

  private patchUser(user: User): void {
    this.userForm.patchValue({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      username: user.username,
      email: user.email,
      phone: user.phone ?? '',
      role: (user.role ?? 'CLIENT') as UserRole,
      isActive: user.isActive ?? user.enabled ?? true,
      clientId: user.clientId ?? null,
      primarySkillCode: user.primarySkillCode ?? (user.role === 'SUPPORT_AGENT' || user.role === 'SUPPORT_MANAGER' ? 'GENERAL' : null),
      secondarySkillCode: user.secondarySkillCode ?? null
    });
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const password = this.userForm.get('password')?.value;
    const confirmPassword = this.userForm.get('confirmPassword')?.value;
    if (!this.isEditMode && password !== confirmPassword) {
      this.snackBar.open('Les mots de passe ne correspondent pas.', 'Fermer', { duration: 3000 });
      return;
    }

    if (this.showClientSelector && !this.userForm.get('clientId')?.value) {
      this.snackBar.open('Selectionne un client pour ce compte client.', 'Fermer', { duration: 3000 });
      return;
    }

    const formValue = this.userForm.getRawValue();
    const payload: Partial<UserCreate> = {
      username: formValue.username ?? '',
      email: formValue.email ?? '',
      firstName: formValue.firstName ?? '',
      lastName: formValue.lastName ?? '',
      phone: formValue.phone ?? '',
      password: formValue.password ?? '',
      role: formValue.role ?? 'CLIENT',
      isActive: formValue.isActive ?? true,
      clientId: this.showClientSelector ? formValue.clientId ?? undefined : undefined,
      primarySkillCode: this.showSkillSelectors ? formValue.primarySkillCode ?? 'GENERAL' : undefined,
      secondarySkillCode: this.showSkillSelectors ? formValue.secondarySkillCode ?? undefined : undefined
    };

    this.saving = true;
    const request$ = this.isEditMode && this.userId
      ? this.userService.updateUser(this.userId, payload)
      : this.userService.createUser(payload as UserCreate);

    request$.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(
          this.isEditMode ? 'Utilisateur mis a jour.' : 'Utilisateur cree avec synchronisation Keycloak.',
          'Fermer',
          { duration: 2500 }
        );
        this.router.navigate(['/users']);
      },
      error: (error) => {
        this.saving = false;
        this.snackBar.open(error?.error?.message || "Impossible d'enregistrer l'utilisateur", 'Fermer', { duration: 3500 });
      }
    });
  }

  updatePassword(): void {
    if (!this.userId) {
      return;
    }

    const newPassword = this.passwordResetForm.get('newPassword')?.value || '';
    const confirmPassword = this.passwordResetForm.get('confirmPassword')?.value || '';
    const forceChangeOnNextLogin = this.passwordResetForm.get('forceChangeOnNextLogin')?.value ?? true;

    if (newPassword.length < 8) {
      this.passwordResetMessage = 'Le nouveau mot de passe doit contenir au moins 8 caracteres.';
      this.snackBar.open(this.passwordResetMessage, 'Fermer', { duration: 3000 });
      return;
    }

    if (newPassword !== confirmPassword) {
      this.passwordResetMessage = 'La confirmation du mot de passe ne correspond pas.';
      this.snackBar.open(this.passwordResetMessage, 'Fermer', { duration: 3000 });
      return;
    }

    this.changingPassword = true;
    this.passwordResetMessage = '';

    this.userService.changePassword(this.userId, newPassword, !!forceChangeOnNextLogin).subscribe({
      next: () => {
        this.changingPassword = false;
        this.passwordResetMessage = forceChangeOnNextLogin
          ? 'Mot de passe temporaire defini. L utilisateur devra le changer a la prochaine connexion.'
          : 'Mot de passe mis a jour avec succes dans SupportFlow et Keycloak.';
        this.passwordResetForm.reset({ newPassword: '', confirmPassword: '', forceChangeOnNextLogin });
        this.snackBar.open('Mot de passe utilisateur mis a jour.', 'Fermer', { duration: 3000 });
      },
      error: (error) => {
        this.changingPassword = false;
        this.passwordResetMessage = error?.error?.message || 'Impossible de modifier le mot de passe.';
        this.snackBar.open(this.passwordResetMessage, 'Fermer', { duration: 3500 });
      }
    });
  }

  resetPasswordFields(): void {
    this.passwordResetForm.reset({ newPassword: '', confirmPassword: '', forceChangeOnNextLogin: true });
    this.passwordResetMessage = '';
  }

  sendResetEmail(): void {
    if (!this.userId) {
      return;
    }

    const email = this.userForm.get('email')?.value;
    if (!email) {
      this.passwordResetMessage = "Ajoute d'abord un email valide a ce compte.";
      this.snackBar.open(this.passwordResetMessage, 'Fermer', { duration: 3000 });
      return;
    }

    this.sendingResetEmail = true;
    this.passwordResetMessage = '';

    this.userService.sendPasswordResetEmail(this.userId).subscribe({
      next: (response) => {
        this.sendingResetEmail = false;
        this.passwordResetMessage = `Email de reset envoye a ${response.email}. Consulte MailHog pour verification locale.`;
        this.passwordResetForm.reset({ newPassword: '', confirmPassword: '', forceChangeOnNextLogin: true });
        this.snackBar.open('Reset par mail envoye avec succes.', 'Fermer', { duration: 3200 });
      },
      error: (error) => {
        this.sendingResetEmail = false;
        this.passwordResetMessage = error?.error?.message || "Impossible d'envoyer le reset par mail.";
        this.snackBar.open(this.passwordResetMessage, 'Fermer', { duration: 3600 });
      }
    });
  }

  getRoleLabel(role?: string): string {
    const labels: Record<string, string> = {
      ADMIN: 'Administrateur',
      SUPPORT_MANAGER: 'Manager support',
      SUPPORT_AGENT: 'Agent support',
      CLIENT: 'Client'
    };
    return role ? labels[role] || role : 'N/A';
  }

  getRoleIcon(role?: string): string {
    const icons: Record<string, string> = {
      ADMIN: 'admin_panel_settings',
      SUPPORT_MANAGER: 'supervisor_account',
      SUPPORT_AGENT: 'support_agent',
      CLIENT: 'person'
    };
    return role ? icons[role] || 'person' : 'person';
  }

  getRoleToneClass(role?: string): string {
    const classes: Record<string, string> = {
      ADMIN: 'hero-chip--admin',
      SUPPORT_MANAGER: 'hero-chip--manager',
      SUPPORT_AGENT: 'hero-chip--agent',
      CLIENT: 'hero-chip--client'
    };
    return role ? classes[role] || '' : '';
  }

  getRoleDescription(role?: string): string {
    if (role === 'ADMIN') {
      return 'Compte de gouvernance plateforme avec supervision globale, administration et securite.';
    }
    if (role === 'SUPPORT_MANAGER') {
      return 'Compte manager pour piloter l assignation, les SLA, les escalades et la qualite de service.';
    }
    if (role === 'SUPPORT_AGENT') {
      return 'Compte agent pour traiter les tickets, suivre les workflows et recevoir les assignations.';
    }
    return 'Compte portail client pour suivre les tickets, commenter et valider les resolutions.';
  }

  getDisplayNamePreview(): string {
    const firstName = this.userForm.get('firstName')?.value || '';
    const lastName = this.userForm.get('lastName')?.value || '';
    return `${firstName} ${lastName}`.trim() || this.userForm.get('username')?.value || 'Nouvel utilisateur';
  }

  getSelectedClientName(): string {
    const clientId = this.userForm.get('clientId')?.value;
    const client = this.clients.find((item) => item.id === clientId);
    return client ? this.getClientLabel(client) : '';
  }

  getClientLabel(client: Client): string {
    return client.companyName || client.name || client.code || `Client #${client.id}`;
  }

  getValidationNarrative(): string {
    if (!this.isEditMode) {
      return 'A la creation, le compte sera enregistre en base, provisionne dans Keycloak et pret a etre utilise selon son role.';
    }
    if (this.showClientSelector) {
      return 'Verifiez surtout le rattachement client, l email et l etat d activation avant la mise a jour.';
    }
    if (this.showSkillSelectors) {
      return 'Verifiez le role, les competences et l activite du compte pour garder une assignation et un pilotage coherents.';
    }
    return 'Controlez les informations d identite et la gouvernance du compte avant enregistrement.';
  }

  getPasswordModeLabel(): string {
    return this.isTemporaryPasswordMode
      ? 'Reset temporaire avec changement impose'
      : 'Mot de passe defini sans rotation';
  }
}
