import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { environment } from '@env/environment';

import { AuthService, TicketService, UserService } from '@core/services';
import { User } from '@core/models';

interface ProfileViewModel {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  roleLabel: string;
  phone?: string;
  avatarUrl?: string;
  keycloakId?: string;
  isActive?: boolean;
  lastLogin?: string;
  clientName?: string;
  assignedTicketsCount?: number;
  primarySkillLabel?: string;
  secondarySkillLabel?: string;
}

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

interface ProfileEditModel {
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string;
}

interface ProfilePreferences {
  emailDigest: boolean;
  desktopAlerts: boolean;
  compactPanels: boolean;
}

interface AvatarPresetSelection {
  category: AvatarPresetCategory;
  gender: AvatarGender;
  outfit: AvatarOutfit;
  variant: AvatarVariant;
  backdrop: AvatarBackdrop;
  accessory: AvatarAccessory;
  hairStyle: AvatarHairStyle;
  label: string;
  subtitle: string;
}

type AvatarPresetCategory = 'all' | 'manager' | 'support' | 'client' | 'executive';
type AvatarGender = 'woman' | 'man';
type AvatarOutfit = 'business' | 'casual' | 'support';
type AvatarVariant = 'signature' | 'soft' | 'sharp';
type AvatarBackdrop = 'blue' | 'violet' | 'emerald' | 'sunset';
type AvatarAccessory = 'none' | 'glasses' | 'beard';
type AvatarHairStyle = 'classic' | 'short' | 'long' | 'cover';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatChipsModule
  ],
  template: `
    <div class="profile-page">
      <section class="profile-hero surface-card">
        <div class="profile-hero__identity">
          <div class="profile-avatar">
            @if (getDisplayedAvatarUrl()) {
              <img [src]="getDisplayedAvatarUrl()" [alt]="profile.fullName || profile.username" />
            } @else {
              <span>{{ getInitials() }}</span>
            }
          </div>
          <div class="profile-hero__copy">
            <span class="profile-eyebrow">Identity Workspace</span>
            <h1>{{ profile.fullName || 'Profil utilisateur' }}</h1>
            <p>
              {{ getRoleNarrative() }}
            </p>
            <div class="profile-inline-meta">
              <span>
                <mat-icon>alternate_email</mat-icon>
                {{ profile.username || 'Utilisateur' }}
              </span>
              <span>
                <mat-icon>mail</mat-icon>
                {{ profile.email || 'Email non renseigne' }}
              </span>
            </div>
            <div class="profile-badges">
              <span class="profile-chip profile-chip--role" [class]="'profile-chip--' + profile.role.toLowerCase()">
                <mat-icon>{{ getRoleIcon() }}</mat-icon>
                {{ profile.roleLabel }}
              </span>
              <span class="profile-chip" [class.profile-chip--ok]="profile.isActive">
                <mat-icon>{{ profile.isActive ? 'verified' : 'block' }}</mat-icon>
                {{ profile.isActive ? 'Compte actif' : 'Compte desactive' }}
              </span>
              <span class="profile-chip" [class.profile-chip--linked]="!!profile.keycloakId">
                <mat-icon>{{ profile.keycloakId ? 'key' : 'link_off' }}</mat-icon>
                {{ profile.keycloakId ? 'Lie a Keycloak' : 'Lien Keycloak absent' }}
              </span>
              @if (!isClient && (profile.assignedTicketsCount || 0) > 0) {
                <span class="profile-chip profile-chip--load">
                  <mat-icon>assignment</mat-icon>
                  {{ profile.assignedTicketsCount }} tickets actifs
                </span>
              }
            </div>
          </div>
        </div>

        <div class="profile-hero__actions">
          <button mat-stroked-button class="hero-btn" (click)="startEditing()">
            <mat-icon>edit</mat-icon>
            Modifier le profil
          </button>
          <button mat-raised-button class="hero-btn hero-btn--primary" (click)="openAccountManagement()">
            <mat-icon>admin_panel_settings</mat-icon>
            Portail Securite
          </button>
          @if (isClient) {
            <button mat-stroked-button class="hero-btn" routerLink="/tickets">
              <mat-icon>confirmation_number</mat-icon>
              Mes tickets
            </button>
          } @else {
            <button mat-stroked-button class="hero-btn" routerLink="/dashboard">
              <mat-icon>space_dashboard</mat-icon>
              Tableau de bord
            </button>
          }
        </div>
      </section>

      @if (loading) {
        <div class="loading-shell surface-card">
          <mat-spinner diameter="46"></mat-spinner>
          <p>Chargement du profil et des informations de compte...</p>
        </div>
      } @else {
        <section class="profile-layout">
          <div class="profile-main">
            <article class="surface-card editor-card">
              <div class="card-head">
                <div class="card-head__icon card-head__icon--cyan">
                  <mat-icon>edit_square</mat-icon>
                </div>
                <div>
                  <h2>Modifier mon profil</h2>
                  <p>Mettez a jour vos informations personnelles visibles dans SupportFlow.</p>
                </div>
              </div>

              <div class="editor-grid">
                <label class="field">
                  <span class="field__label">Prenom</span>
                  <input
                    type="text"
                    [(ngModel)]="editModel.firstName"
                    [disabled]="saving"
                    placeholder="Votre prenom" />
                </label>

                <label class="field">
                  <span class="field__label">Nom</span>
                  <input
                    type="text"
                    [(ngModel)]="editModel.lastName"
                    [disabled]="saving"
                    placeholder="Votre nom" />
                </label>

                <label class="field field--wide">
                  <span class="field__label">Telephone</span>
                  <input
                    type="text"
                    [(ngModel)]="editModel.phone"
                    [disabled]="saving"
                    placeholder="+216..." />
                </label>

                <label class="field field--wide">
                  <span class="field__label">Avatar URL</span>
                  <input
                    type="url"
                    [(ngModel)]="editModel.avatarUrl"
                    [disabled]="saving"
                    placeholder="https://.../photo.jpg" />
                </label>
              </div>

              <div class="avatar-preset-card">
                <div class="avatar-preset-card__head">
                  <div>
                    <span class="field__label">Avatars prets</span>
                    <strong>Choisissez un avatar rapide</strong>
                  </div>
                  <span class="avatar-preset-card__hint">Selection rapide par profil et tenue</span>
                </div>

                <div class="avatar-preset-grid">
                  <label class="field">
                    <span class="field__label">Profil</span>
                    <select [(ngModel)]="avatarPreset.gender" [disabled]="saving">
                      <option value="woman">Femme</option>
                      <option value="man">Homme</option>
                    </select>
                  </label>

                  <label class="field">
                    <span class="field__label">Style vestimentaire</span>
                    <select [(ngModel)]="avatarPreset.outfit" [disabled]="saving">
                      <option value="business">Business</option>
                      <option value="casual">Casual</option>
                      <option value="support">Support Tech</option>
                    </select>
                  </label>

                  <label class="field">
                    <span class="field__label">Visage / coiffure</span>
                    <select [(ngModel)]="avatarPreset.variant" [disabled]="saving">
                      <option value="signature">Signature</option>
                      <option value="soft">Soft</option>
                      <option value="sharp">Sharp</option>
                    </select>
                  </label>

                  <label class="field">
                    <span class="field__label">Couleur de fond</span>
                    <select [(ngModel)]="avatarPreset.backdrop" [disabled]="saving">
                      <option value="blue">Bleu</option>
                      <option value="violet">Violet</option>
                      <option value="emerald">Emeraude</option>
                      <option value="sunset">Sunset</option>
                    </select>
                  </label>

                  <label class="field">
                    <span class="field__label">Accessoire</span>
                    <select [(ngModel)]="avatarPreset.accessory" [disabled]="saving">
                      <option value="none">Aucun</option>
                      <option value="glasses">Lunettes</option>
                      <option value="beard">Barbe</option>
                    </select>
                  </label>

                  <label class="field">
                    <span class="field__label">Cheveux / voile</span>
                    <select [(ngModel)]="avatarPreset.hairStyle" [disabled]="saving">
                      <option value="classic">Classique</option>
                      <option value="short">Cheveux courts</option>
                      <option value="long">Cheveux longs</option>
                      <option value="cover">Hijab / Casquette</option>
                    </select>
                  </label>
                </div>

                <div class="avatar-preset-preview">
                  <div class="avatar-preset-preview__bubble">
                    <img [src]="getPresetAvatarPreview()" alt="Apercu avatar preset" />
                  </div>
                  <div class="avatar-preset-preview__copy">
                    <strong>{{ getAvatarPresetDisplayLabel() }}</strong>
                    <span>{{ getAvatarPresetDescription() }}</span>
                  </div>
                </div>

                <div class="avatar-gallery-filters">
                  @for (category of avatarGalleryCategories; track category.value) {
                    <button
                      type="button"
                      class="avatar-gallery-filter"
                      [class.avatar-gallery-filter--active]="activeAvatarCategory === category.value"
                      (click)="activeAvatarCategory = category.value">
                      {{ category.label }}
                    </button>
                  }
                </div>

                <div class="avatar-gallery">
                  @for (preset of getFilteredAvatarGalleryPresets(); track preset.label) {
                    <button
                      type="button"
                      class="avatar-gallery__item"
                      [class.avatar-gallery__item--active]="isPresetSelected(preset)"
                      (click)="selectAvatarPreset(preset)">
                      <div class="avatar-gallery__thumb">
                        <img [src]="buildPresetThumbnail(preset)" [alt]="preset.label" />
                      </div>
                      <strong>{{ preset.label }}</strong>
                      <span>{{ preset.subtitle }}</span>
                    </button>
                  }
                </div>

                <div class="avatar-preset-actions">
                  <button mat-stroked-button class="hero-btn editor-btn" type="button" (click)="applyAvatarPreset()" [disabled]="saving">
                    <mat-icon>auto_fix_high</mat-icon>
                    Utiliser cet avatar
                  </button>
                  <button mat-stroked-button class="hero-btn editor-btn" type="button" (click)="clearAvatar()" [disabled]="saving">
                    <mat-icon>hide_image</mat-icon>
                    Retirer l avatar
                  </button>
                </div>
              </div>

              <div class="editor-actions">
                <div class="editor-feedback" [class.editor-feedback--error]="saveError" [class.editor-feedback--ok]="saveSuccess">
                  @if (saving) {
                    <span>Enregistrement du profil...</span>
                  } @else if (saveError) {
                    <span>{{ saveError }}</span>
                  } @else if (saveSuccess) {
                    <span>{{ saveSuccess }}</span>
                  } @else {
                    <span>Les changements sont synchronises avec votre compte SupportFlow.</span>
                  }
                </div>

                <div class="editor-actions__buttons">
                  <button mat-stroked-button class="hero-btn editor-btn" type="button" (click)="resetEditModel()" [disabled]="saving">
                    <mat-icon>refresh</mat-icon>
                    Reinitialiser
                  </button>
                  <button mat-raised-button class="hero-btn hero-btn--primary editor-btn" type="button" (click)="saveProfile()" [disabled]="saving || !hasProfileChanges()">
                    <mat-icon>{{ saving ? 'hourglass_top' : 'save' }}</mat-icon>
                    Enregistrer
                  </button>
                </div>
              </div>
            </article>

            <article class="surface-card info-card">
              <div class="card-head">
                <div class="card-head__icon">
                  <mat-icon>badge</mat-icon>
                </div>
                <div>
                  <h2>Fiche utilisateur</h2>
                  <p>Informations reelles du compte synchronise avec SupportFlow.</p>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-tile">
                  <span class="info-label">Nom complet</span>
                  <strong>{{ profile.fullName || '-' }}</strong>
                </div>
                <div class="info-tile">
                  <span class="info-label">Nom d'utilisateur</span>
                  <strong>{{ profile.username || '-' }}</strong>
                </div>
                <div class="info-tile">
                  <span class="info-label">Email</span>
                  <strong>{{ profile.email || '-' }}</strong>
                </div>
                <div class="info-tile">
                  <span class="info-label">Telephone</span>
                  <strong>{{ profile.phone || 'Non renseigne' }}</strong>
                </div>
                <div class="info-tile">
                  <span class="info-label">Role systeme</span>
                  <strong>{{ profile.roleLabel }}</strong>
                </div>
                <div class="info-tile">
                  <span class="info-label">Derniere connexion</span>
                  <strong>{{ profile.lastLogin ? (profile.lastLogin | date:'dd/MM/yyyy HH:mm') : 'Non disponible' }}</strong>
                </div>
                @if (!isClient) {
                  <div class="info-tile">
                    <span class="info-label">Backlog assigne</span>
                    <strong>{{ profile.assignedTicketsCount || 0 }} tickets</strong>
                  </div>
                }
                @if (profile.primarySkillLabel) {
                  <div class="info-tile">
                    <span class="info-label">Expertise principale</span>
                    <strong>{{ profile.primarySkillLabel }}</strong>
                  </div>
                }
                @if (profile.secondarySkillLabel) {
                  <div class="info-tile">
                    <span class="info-label">Expertise secondaire</span>
                    <strong>{{ profile.secondarySkillLabel }}</strong>
                  </div>
                }
                @if (profile.clientName) {
                  <div class="info-tile info-tile--wide">
                    <span class="info-label">Client rattache</span>
                    <strong>{{ profile.clientName }}</strong>
                  </div>
                }
                @if (profile.keycloakId) {
                  <div class="info-tile info-tile--wide">
                    <span class="info-label">Identifiant Keycloak</span>
                    <strong class="mono">{{ profile.keycloakId }}</strong>
                  </div>
                }
                @if (profile.avatarUrl) {
                  <div class="info-tile info-tile--wide">
                    <span class="info-label">Avatar</span>
                    <strong class="mono">{{ profile.avatarUrl }}</strong>
                  </div>
                }
              </div>
            </article>

            @if (isClient) {
              <article class="surface-card stats-card">
                <div class="card-head">
                  <div class="card-head__icon card-head__icon--cyan">
                    <mat-icon>insights</mat-icon>
                  </div>
                  <div>
                    <h2>Suivi tickets</h2>
                    <p>Vue compacte de votre portefeuille support actuel.</p>
                  </div>
                </div>

                <div class="stats-grid">
                  <div class="stat-block stat-block--total">
                    <span class="stat-block__value">{{ ticketStats.total }}</span>
                    <span class="stat-block__label">Total</span>
                  </div>
                  <div class="stat-block stat-block--open">
                    <span class="stat-block__value">{{ ticketStats.open }}</span>
                    <span class="stat-block__label">Ouverts</span>
                  </div>
                  <div class="stat-block stat-block--progress">
                    <span class="stat-block__value">{{ ticketStats.inProgress }}</span>
                    <span class="stat-block__label">En cours</span>
                  </div>
                  <div class="stat-block stat-block--resolved">
                    <span class="stat-block__value">{{ ticketStats.resolved }}</span>
                    <span class="stat-block__label">Resolus</span>
                  </div>
                </div>
              </article>
            } @else {
              <article class="surface-card stats-card">
                <div class="card-head">
                  <div class="card-head__icon card-head__icon--violet">
                    <mat-icon>hub</mat-icon>
                  </div>
                  <div>
                    <h2>Poste de travail</h2>
                    <p>Acces direct aux zones de supervision et de traitement.</p>
                  </div>
                </div>

                <div class="workspace-grid">
                  <a routerLink="/dashboard" class="workspace-link">
                    <mat-icon>space_dashboard</mat-icon>
                    <div>
                      <strong>Dashboard</strong>
                      <span>Vision manager ou agent</span>
                    </div>
                  </a>
                  <a routerLink="/tickets" class="workspace-link">
                    <mat-icon>confirmation_number</mat-icon>
                    <div>
                      <strong>Tickets</strong>
                      <span>Traitement et suivi SLA</span>
                    </div>
                  </a>
                  <a routerLink="/archives" class="workspace-link">
                    <mat-icon>folder_copy</mat-icon>
                    <div>
                      <strong>Archives</strong>
                      <span>GED, rapports et preuves</span>
                    </div>
                  </a>
                  <a routerLink="/ai-assistant" class="workspace-link">
                    <mat-icon>auto_awesome</mat-icon>
                    <div>
                      <strong>AI Assistant</strong>
                      <span>Analyse et suggestions</span>
                    </div>
                  </a>
                </div>
              </article>
            }
          </div>

          <aside class="profile-side">
            <article class="surface-card security-card">
              <div class="card-head">
                <div class="card-head__icon card-head__icon--green">
                  <mat-icon>shield</mat-icon>
                </div>
                <div>
                  <h2>Securite du compte</h2>
                  <p>Gestion centralisee via Keycloak Identity.</p>
                </div>
              </div>

              <div class="security-orb">
                <div class="security-orb__ring"></div>
                <mat-icon>shield</mat-icon>
              </div>

              <div class="security-list">
                <div class="security-row">
                  <span>Fournisseur d'identite</span>
                  <strong>Keycloak</strong>
                </div>
                <div class="security-row">
                  <span>Etat du lien</span>
                  <strong>{{ profile.keycloakId ? 'Synchronise' : 'A verifier' }}</strong>
                </div>
                <div class="security-row">
                  <span>Authentification</span>
                  <strong>SSO / Credentials</strong>
                </div>
              </div>

              <button mat-raised-button class="portal-btn" (click)="openAccountManagement()">
                <mat-icon>open_in_new</mat-icon>
                Ouvrir le portail securise
              </button>

              <button mat-stroked-button class="hero-btn portal-btn portal-btn--secondary" (click)="openSecuritySettings()">
                <mat-icon>password</mat-icon>
                Mot de passe et sessions
              </button>
            </article>

            <article class="surface-card preferences-card">
              <div class="card-head">
                <div class="card-head__icon card-head__icon--violet">
                  <mat-icon>tune</mat-icon>
                </div>
                <div>
                  <h2>Preferences</h2>
                  <p>Reglez votre experience locale sur ce poste de travail.</p>
                </div>
              </div>

              <div class="preferences-list">
                <button type="button" class="preference-row" (click)="togglePreference('emailDigest')">
                  <div>
                    <strong>Digest email</strong>
                    <span>Recevoir un rappel synthese de vos activites support.</span>
                  </div>
                  <span class="preference-toggle" [class.preference-toggle--on]="preferences.emailDigest">
                    {{ preferences.emailDigest ? 'Actif' : 'Off' }}
                  </span>
                </button>

                <button type="button" class="preference-row" (click)="togglePreference('desktopAlerts')">
                  <div>
                    <strong>Alertes bureau</strong>
                    <span>Garder les notifications visuelles prioritaires sur cette machine.</span>
                  </div>
                  <span class="preference-toggle" [class.preference-toggle--on]="preferences.desktopAlerts">
                    {{ preferences.desktopAlerts ? 'Actif' : 'Off' }}
                  </span>
                </button>

                <button type="button" class="preference-row" (click)="togglePreference('compactPanels')">
                  <div>
                    <strong>Panneaux compacts</strong>
                    <span>Reduire l'espacement de certaines cartes dans vos espaces de travail.</span>
                  </div>
                  <span class="preference-toggle" [class.preference-toggle--on]="preferences.compactPanels">
                    {{ preferences.compactPanels ? 'Actif' : 'Off' }}
                  </span>
                </button>
              </div>
            </article>

            <article class="surface-card side-note">
              <span class="side-note__eyebrow">Recommandation</span>
              <strong>{{ getProfileRecommendationTitle() }}</strong>
              <p>{{ getProfileRecommendationText() }}</p>
            </article>

            <article class="surface-card side-note side-note--workspace">
              <span class="side-note__eyebrow">Espace actif</span>
              <strong>{{ getWorkspaceLabel() }}</strong>
              <p>
                {{ getWorkspaceNarrative() }}
              </p>
            </article>
          </aside>
        </section>
      }
    </div>
  `,
  styles: [`
    .profile-page {
      --page-bg: #07101f;
      --panel: rgba(10, 18, 34, 0.82);
      --panel-soft: rgba(12, 24, 45, 0.76);
      --line: rgba(96, 165, 250, 0.18);
      --line-strong: rgba(96, 165, 250, 0.32);
      --text: #e8eefb;
      --muted: #93a1bb;
      --accent: #54d4ff;
      --accent-violet: #8b7cff;
      --accent-green: #4ade80;
      min-height: calc(100vh - 72px);
      padding: 24px;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(84, 212, 255, 0.12), transparent 34%),
        radial-gradient(circle at top right, rgba(139, 124, 255, 0.12), transparent 32%),
        linear-gradient(180deg, #06101f 0%, #071322 100%);
      font-family: 'Manrope', sans-serif;
    }

    .surface-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      backdrop-filter: blur(18px);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
    }

    .profile-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      padding: 28px;
      margin-bottom: 24px;
      background:
        radial-gradient(circle at 15% 20%, rgba(84, 212, 255, 0.12), transparent 30%),
        linear-gradient(135deg, rgba(9, 18, 34, 0.96), rgba(7, 16, 31, 0.9));
    }

    .profile-hero__identity {
      display: flex;
      align-items: center;
      gap: 22px;
      min-width: 0;
    }

    .profile-avatar {
      width: 118px;
      height: 118px;
      border-radius: 32px;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 30% 30%, rgba(84, 212, 255, 0.34), transparent 50%),
        linear-gradient(145deg, rgba(84, 212, 255, 0.18), rgba(139, 124, 255, 0.22));
      border: 1px solid rgba(139, 124, 255, 0.28);
      box-shadow:
        0 0 0 8px rgba(84, 212, 255, 0.05),
        0 0 28px rgba(84, 212, 255, 0.16);
      flex-shrink: 0;
    }

    .profile-avatar span {
      font-size: 42px;
      font-weight: 800;
      font-family: 'Space Grotesk', sans-serif;
      letter-spacing: -0.04em;
    }

    .profile-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 32px;
      display: block;
    }

    .profile-hero__copy {
      min-width: 0;
      display: grid;
      gap: 10px;
    }

    .profile-eyebrow,
    .side-note__eyebrow {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: rgba(148, 197, 255, 0.86);
    }

    .profile-hero__copy h1 {
      margin: 0;
      font-size: 36px;
      line-height: 1.04;
      font-family: 'Space Grotesk', sans-serif;
      letter-spacing: -0.04em;
    }

    .profile-hero__copy p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
      max-width: 720px;
    }

    .profile-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 6px;
    }

    .profile-inline-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      color: #c3d0ea;
      font-size: 13px;
      font-weight: 600;
    }

    .profile-inline-meta span {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
    }

    .profile-inline-meta mat-icon {
      width: 15px;
      height: 15px;
      font-size: 15px;
      color: var(--accent);
    }

    .profile-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: var(--text);
      font-size: 12px;
      font-weight: 700;
    }

    .profile-chip mat-icon {
      width: 15px;
      height: 15px;
      font-size: 15px;
    }

    .profile-chip--role.profile-chip--admin { color: #fca5a5; border-color: rgba(248, 113, 113, 0.22); }
    .profile-chip--role.profile-chip--support_manager { color: #fcd34d; border-color: rgba(250, 204, 21, 0.22); }
    .profile-chip--role.profile-chip--support_agent { color: #93c5fd; border-color: rgba(96, 165, 250, 0.22); }
    .profile-chip--role.profile-chip--client { color: #86efac; border-color: rgba(74, 222, 128, 0.22); }
    .profile-chip--ok { color: #86efac; border-color: rgba(74, 222, 128, 0.22); }
    .profile-chip--linked { color: #c4b5fd; border-color: rgba(139, 124, 255, 0.24); }
    .profile-chip--load { color: #7dd3fc; border-color: rgba(56, 189, 248, 0.22); }

    .profile-hero__actions {
      display: grid;
      align-content: start;
      gap: 12px;
      min-width: 220px;
    }

    .hero-btn {
      min-height: 48px;
      border-radius: 14px !important;
      justify-content: flex-start !important;
      padding: 0 16px !important;
      border-color: rgba(255, 255, 255, 0.08) !important;
      color: var(--text) !important;
      background: rgba(255, 255, 255, 0.04) !important;
    }

    .hero-btn--primary {
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

    .loading-shell p {
      margin: 0;
      color: var(--muted);
    }

    .profile-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 330px;
      gap: 24px;
      align-items: start;
    }

    .profile-main,
    .profile-side {
      display: grid;
      gap: 24px;
    }

    .info-card,
    .editor-card,
    .stats-card,
    .security-card,
    .side-note {
      padding: 22px;
    }

    .editor-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .field {
      display: grid;
      gap: 8px;
    }

    .field--wide {
      grid-column: 1 / -1;
    }

    .field__label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      font-weight: 700;
    }

    .field input {
      min-height: 52px;
      padding: 0 16px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.03);
      color: var(--text);
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
      font: inherit;
    }

    .field select {
      min-height: 52px;
      padding: 0 16px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.03);
      color: var(--text);
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
      font: inherit;
      appearance: none;
    }

    .field input::placeholder {
      color: rgba(147, 161, 187, 0.75);
    }

    .field input:focus,
    .field select:focus {
      border-color: rgba(84, 212, 255, 0.42);
      box-shadow: 0 0 0 4px rgba(84, 212, 255, 0.08);
      background: rgba(255, 255, 255, 0.05);
    }

    .field input:disabled,
    .field select:disabled {
      opacity: 0.76;
      cursor: wait;
    }

    .field select option {
      color: #06101f;
    }

    .avatar-preset-card {
      margin-top: 16px;
      padding: 18px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      background:
        radial-gradient(circle at top right, rgba(139, 124, 255, 0.12), transparent 35%),
        rgba(255, 255, 255, 0.025);
    }

    .avatar-preset-card__head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 14px;
    }

    .avatar-preset-card__head strong {
      display: block;
      margin-top: 4px;
      font-size: 18px;
    }

    .avatar-preset-card__hint {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
      max-width: 220px;
      text-align: right;
    }

    .avatar-preset-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 14px;
    }

    .avatar-preset-preview {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(12, 24, 45, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .avatar-preset-preview__bubble {
      width: 74px;
      height: 74px;
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid rgba(84, 212, 255, 0.18);
      box-shadow: 0 0 24px rgba(84, 212, 255, 0.12);
      flex-shrink: 0;
    }

    .avatar-preset-preview__bubble img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .avatar-preset-preview__copy {
      display: grid;
      gap: 4px;
    }

    .avatar-preset-preview__copy strong {
      font-size: 15px;
    }

    .avatar-preset-preview__copy span {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .avatar-preset-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 14px;
    }

    .avatar-gallery {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 14px;
    }

    .avatar-gallery-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
    }

    .avatar-gallery-filter {
      padding: 9px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.03);
      color: #cbd5e1;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
    }

    .avatar-gallery-filter:hover {
      transform: translateY(-1px);
      border-color: rgba(84, 212, 255, 0.24);
      background: rgba(255, 255, 255, 0.05);
    }

    .avatar-gallery-filter--active {
      color: #06101f;
      border-color: rgba(84, 212, 255, 0.34);
      background: linear-gradient(135deg, rgba(84, 212, 255, 0.95), rgba(125, 211, 252, 0.9));
    }

    .avatar-gallery__item {
      display: grid;
      gap: 8px;
      padding: 12px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(255, 255, 255, 0.03);
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
    }

    .avatar-gallery__item:hover {
      transform: translateY(-1px);
      border-color: rgba(84, 212, 255, 0.3);
      background: rgba(255, 255, 255, 0.05);
    }

    .avatar-gallery__item--active {
      border-color: rgba(84, 212, 255, 0.42);
      background: rgba(84, 212, 255, 0.08);
      box-shadow: 0 0 0 3px rgba(84, 212, 255, 0.08);
    }

    .avatar-gallery__thumb {
      width: 100%;
      aspect-ratio: 1;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(12, 24, 45, 0.7);
    }

    .avatar-gallery__thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .avatar-gallery__item strong {
      font-size: 13px;
      line-height: 1.35;
    }

    .avatar-gallery__item span {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.45;
    }

    .editor-actions {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      margin-top: 18px;
      padding-top: 18px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .editor-actions__buttons {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .editor-btn {
      min-width: 152px;
    }

    .editor-feedback {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .editor-feedback--ok {
      color: #86efac;
    }

    .editor-feedback--error {
      color: #fca5a5;
    }

    .card-head {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 18px;
    }

    .card-head__icon {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: rgba(84, 212, 255, 0.1);
      border: 1px solid rgba(84, 212, 255, 0.16);
      color: var(--accent);
      flex-shrink: 0;
    }

    .card-head__icon--cyan {
      color: var(--accent);
      border-color: rgba(84, 212, 255, 0.22);
    }

    .card-head__icon--violet {
      color: #b4a7ff;
      border-color: rgba(139, 124, 255, 0.22);
      background: rgba(139, 124, 255, 0.1);
    }

    .card-head__icon--green {
      color: var(--accent-green);
      border-color: rgba(74, 222, 128, 0.22);
      background: rgba(74, 222, 128, 0.1);
    }

    .card-head h2 {
      margin: 0 0 4px;
      font-size: 22px;
      letter-spacing: -0.03em;
    }

    .card-head p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .info-tile {
      display: grid;
      gap: 6px;
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--panel-soft);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .info-tile--wide {
      grid-column: 1 / -1;
    }

    .info-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      font-weight: 700;
    }

    .info-tile strong {
      font-size: 15px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .mono {
      font-family: 'Space Grotesk', monospace;
      font-size: 13px !important;
      color: #bfe7ff;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .stat-block {
      display: grid;
      gap: 4px;
      padding: 18px 14px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(255, 255, 255, 0.03);
    }

    .stat-block__value {
      font-size: 34px;
      font-weight: 800;
      font-family: 'Space Grotesk', sans-serif;
      letter-spacing: -0.05em;
    }

    .stat-block__label {
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    .stat-block--open .stat-block__value { color: #fbbf24; }
    .stat-block--progress .stat-block__value { color: #60a5fa; }
    .stat-block--resolved .stat-block__value { color: #4ade80; }

    .workspace-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .workspace-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.03);
      color: inherit;
      text-decoration: none;
      transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
    }

    .workspace-link:hover {
      transform: translateY(-1px);
      border-color: var(--line-strong);
      background: rgba(255, 255, 255, 0.05);
    }

    .workspace-link mat-icon {
      color: var(--accent);
    }

    .workspace-link strong {
      display: block;
      margin-bottom: 3px;
      font-size: 14px;
    }

    .workspace-link span {
      color: var(--muted);
      font-size: 12px;
    }

    .security-orb {
      position: relative;
      width: 150px;
      height: 150px;
      margin: 12px auto 18px;
      display: grid;
      place-items: center;
    }

    .security-orb__ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid rgba(74, 222, 128, 0.18);
      box-shadow: 0 0 26px rgba(74, 222, 128, 0.12);
    }

    .security-orb mat-icon {
      width: 66px;
      height: 66px;
      font-size: 66px;
      color: var(--accent-green);
      filter: drop-shadow(0 0 18px rgba(74, 222, 128, 0.36));
    }

    .security-list {
      display: grid;
      gap: 10px;
      margin-bottom: 18px;
    }

    .security-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--panel-soft);
      border: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 13px;
    }

    .security-row span {
      color: var(--muted);
    }

    .portal-btn {
      width: 100%;
      min-height: 48px;
      border-radius: 14px !important;
      background: linear-gradient(135deg, rgba(74, 222, 128, 0.16), rgba(16, 185, 129, 0.22)) !important;
      color: #b8ffcf !important;
      border: 1px solid rgba(74, 222, 128, 0.18) !important;
    }

    .portal-btn--secondary {
      margin-top: 10px;
      background: rgba(255, 255, 255, 0.03) !important;
      color: var(--text) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
    }

    .preferences-card {
      padding: 22px;
    }

    .preferences-list {
      display: grid;
      gap: 12px;
    }

    .preference-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      width: 100%;
      text-align: left;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: var(--panel-soft);
      color: inherit;
      cursor: pointer;
      transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
    }

    .preference-row:hover {
      border-color: var(--line-strong);
      transform: translateY(-1px);
      background: rgba(255, 255, 255, 0.05);
    }

    .preference-row strong {
      display: block;
      margin-bottom: 4px;
      font-size: 14px;
    }

    .preference-row span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .preference-toggle {
      padding: 7px 11px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      white-space: nowrap;
    }

    .preference-toggle--on {
      color: #86efac;
      border-color: rgba(74, 222, 128, 0.24);
      background: rgba(74, 222, 128, 0.1);
    }

    .side-note strong {
      display: block;
      margin: 8px 0 6px;
      font-size: 18px;
    }

    .side-note p {
      margin: 0;
      color: var(--muted);
      line-height: 1.65;
    }

    .side-note--workspace {
      background:
        radial-gradient(circle at top right, rgba(84, 212, 255, 0.12), transparent 35%),
        rgba(10, 18, 34, 0.82);
    }

    @media (max-width: 1080px) {
      .profile-hero,
      .profile-layout {
        grid-template-columns: 1fr;
      }

      .profile-hero__actions {
        min-width: 0;
      }
    }

    @media (max-width: 760px) {
      .profile-page {
        padding: 12px;
      }

      .profile-hero {
        padding: 18px;
      }

      .profile-hero__identity {
        flex-direction: column;
        align-items: flex-start;
      }

      .profile-hero__copy h1 {
        font-size: 30px;
      }

      .info-grid,
      .editor-grid,
      .avatar-preset-grid,
      .avatar-gallery,
      .workspace-grid,
      .stats-grid {
        grid-template-columns: 1fr;
      }

      .editor-actions {
        flex-direction: column;
        align-items: stretch;
      }

      .editor-actions__buttons {
        justify-content: stretch;
      }

      .avatar-preset-card__head,
      .avatar-preset-preview {
        flex-direction: column;
        align-items: flex-start;
      }

      .avatar-preset-card__hint {
        text-align: left;
        max-width: none;
      }
    }
  `]
})
export class ProfileComponent implements OnInit {
  loading = true;
  isClient = false;
  saving = false;
  saveSuccess = '';
  saveError = '';
  private readonly preferencesStorageKey = 'supportflow.profile.preferences';

  profile: ProfileViewModel = {
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    fullName: '',
    role: '',
    roleLabel: '',
    avatarUrl: ''
  };

  editModel: ProfileEditModel = {
    firstName: '',
    lastName: '',
    phone: '',
    avatarUrl: ''
  };

  preferences: ProfilePreferences = {
    emailDigest: true,
    desktopAlerts: true,
    compactPanels: false
  };

  avatarPreset: {
    gender: AvatarGender;
    outfit: AvatarOutfit;
    variant: AvatarVariant;
    backdrop: AvatarBackdrop;
    accessory: AvatarAccessory;
    hairStyle: AvatarHairStyle;
  } = {
    gender: 'woman',
    outfit: 'business',
    variant: 'signature',
    backdrop: 'blue',
    accessory: 'none',
    hairStyle: 'classic'
  };

  activeAvatarCategory: AvatarPresetCategory = 'all';

  avatarGalleryCategories: Array<{ value: AvatarPresetCategory; label: string }> = [
    { value: 'all', label: 'Tous' },
    { value: 'manager', label: 'Manager' },
    { value: 'support', label: 'Support' },
    { value: 'client', label: 'Client' },
    { value: 'executive', label: 'Executive' }
  ];

  avatarGalleryPresets: AvatarPresetSelection[] = [
    { category: 'manager', gender: 'woman', outfit: 'business', variant: 'signature', backdrop: 'blue', accessory: 'none', hairStyle: 'classic', label: 'Manager Femme', subtitle: 'Business bleu' },
    { category: 'support', gender: 'woman', outfit: 'support', variant: 'soft', backdrop: 'emerald', accessory: 'glasses', hairStyle: 'cover', label: 'Support Femme', subtitle: 'Hijab + lunettes' },
    { category: 'client', gender: 'woman', outfit: 'casual', variant: 'sharp', backdrop: 'sunset', accessory: 'none', hairStyle: 'long', label: 'Creative Femme', subtitle: 'Casual sunset' },
    { category: 'manager', gender: 'man', outfit: 'business', variant: 'signature', backdrop: 'blue', accessory: 'glasses', hairStyle: 'short', label: 'Manager Homme', subtitle: 'Business + lunettes' },
    { category: 'support', gender: 'man', outfit: 'support', variant: 'sharp', backdrop: 'emerald', accessory: 'beard', hairStyle: 'classic', label: 'Tech Homme', subtitle: 'Support + barbe' },
    { category: 'client', gender: 'man', outfit: 'casual', variant: 'soft', backdrop: 'violet', accessory: 'none', hairStyle: 'cover', label: 'Casual Homme', subtitle: 'Casquette violette' },
    { category: 'executive', gender: 'woman', outfit: 'business', variant: 'soft', backdrop: 'violet', accessory: 'glasses', hairStyle: 'short', label: 'Lead Femme', subtitle: 'Soft violet' },
    { category: 'support', gender: 'man', outfit: 'support', variant: 'signature', backdrop: 'sunset', accessory: 'none', hairStyle: 'long', label: 'Ops Homme', subtitle: 'Support sunset' }
  ];

  ticketStats: TicketStats = {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0
  };

  constructor(
    private authService: AuthService,
    private ticketService: TicketService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.isClient = this.authService.isClient();
    this.loadPreferences();
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading = true;

    this.userService.getCurrentUser().subscribe({
      next: (user) => {
        this.profile = this.mapUserToProfile(user);
        this.resetEditModel();
        this.loading = false;
        if (this.isClient) {
          this.loadTicketStats();
        }
      },
      error: (error) => {
        console.error('Error loading current user profile:', error);
        this.loadProfileFallback();
      }
    });
  }

  private loadProfileFallback(): void {
    try {
      const role = this.authService.getPrimaryRole();
      const userInfo = this.authService.getUserInfo();
      const fullName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim();

      this.profile = {
        username: userInfo.username || 'Utilisateur',
        email: userInfo.email || '',
        firstName: userInfo.firstName || '',
        lastName: userInfo.lastName || '',
        fullName: fullName || userInfo.username || 'Utilisateur',
        role,
        roleLabel: this.getRoleLabel(role),
        isActive: true
      };
      this.resetEditModel();
    } finally {
      this.loading = false;
      if (this.isClient) {
        this.loadTicketStats();
      }
    }
  }

  private mapUserToProfile(user: User): ProfileViewModel {
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || user.fullName || user.username || 'Utilisateur';
    const role = user.role || this.authService.getPrimaryRole();

    return {
      username: user.username || 'Utilisateur',
      email: user.email || '',
      firstName,
      lastName,
      fullName,
      role,
      roleLabel: this.getRoleLabel(role),
      phone: user.phone || '',
      avatarUrl: user.avatarUrl || '',
      keycloakId: user.keycloakId || '',
      isActive: user.isActive ?? true,
      lastLogin: user.lastLogin || '',
      clientName: user.clientName || '',
      assignedTicketsCount: user.assignedTicketsCount || 0,
      primarySkillLabel: user.primarySkillLabel || '',
      secondarySkillLabel: user.secondarySkillLabel || ''
    };
  }

  loadTicketStats(): void {
    this.ticketService.getMyTickets().subscribe({
      next: (response) => {
        const tickets = response?.content || [];
        this.ticketStats = {
          total: tickets.length,
          open: tickets.filter((t: any) => ['NEW', 'OPEN', 'ASSIGNED'].includes(t.status)).length,
          inProgress: tickets.filter((t: any) => ['IN_PROGRESS', 'PENDING'].includes(t.status)).length,
          resolved: tickets.filter((t: any) => t.status === 'RESOLVED').length,
          closed: tickets.filter((t: any) => t.status === 'CLOSED').length
        };
      },
      error: (error) => console.error('Error loading ticket stats:', error)
    });
  }

  startEditing(): void {
    this.resetEditModel();
    this.saveSuccess = '';
    this.saveError = '';
  }

  resetEditModel(): void {
    this.editModel = {
      firstName: this.profile.firstName || '',
      lastName: this.profile.lastName || '',
      phone: this.profile.phone || '',
      avatarUrl: this.profile.avatarUrl || ''
    };
  }

  hasProfileChanges(): boolean {
    return this.normalizeField(this.editModel.firstName) !== this.normalizeField(this.profile.firstName)
      || this.normalizeField(this.editModel.lastName) !== this.normalizeField(this.profile.lastName)
      || this.normalizeField(this.editModel.phone) !== this.normalizeField(this.profile.phone)
      || this.normalizeField(this.editModel.avatarUrl) !== this.normalizeField(this.profile.avatarUrl);
  }

  getDisplayedAvatarUrl(): string {
    return this.normalizeField(this.editModel.avatarUrl) || this.normalizeField(this.profile.avatarUrl);
  }

  applyAvatarPreset(): void {
    this.editModel.avatarUrl = this.buildPresetAvatarDataUrl(
      this.avatarPreset.gender,
      this.avatarPreset.outfit,
      this.avatarPreset.variant,
      this.avatarPreset.backdrop,
      this.avatarPreset.accessory,
      this.avatarPreset.hairStyle
    );
    this.saveSuccess = 'Avatar preset pret a etre enregistre.';
    this.saveError = '';
  }

  clearAvatar(): void {
    this.editModel.avatarUrl = '';
    this.saveSuccess = '';
    this.saveError = '';
  }

  getPresetAvatarPreview(): string {
    return this.buildPresetAvatarDataUrl(
      this.avatarPreset.gender,
      this.avatarPreset.outfit,
      this.avatarPreset.variant,
      this.avatarPreset.backdrop,
      this.avatarPreset.accessory,
      this.avatarPreset.hairStyle
    );
  }

  getAvatarPresetLabel(): string {
    const genderLabel = this.avatarPreset.gender === 'woman' ? 'Profil femme' : 'Profil homme';
    const outfitLabel = this.getAvatarOutfitLabel(this.avatarPreset.outfit);
    return `${genderLabel} · ${outfitLabel}`;
  }

  getAvatarPresetDescription(): string {
    if (this.avatarPreset.outfit === 'business') {
      return 'Tenue professionnelle pour managers, demos corporate et profils encadres.';
    }
    if (this.avatarPreset.outfit === 'support') {
      return 'Style support technique avec accents plus operationnels et look centre de service.';
    }
    return 'Tenue decontractee propre pour un profil moderne et approachable.';
  }

  getAvatarPresetDisplayLabel(): string {
    const genderLabel = this.avatarPreset.gender === 'woman' ? 'Profil femme' : 'Profil homme';
    const outfitLabel = this.getAvatarOutfitLabel(this.avatarPreset.outfit);
    const variantLabel = this.getAvatarVariantLabel(this.avatarPreset.variant);
    const backdropLabel = this.getAvatarBackdropLabel(this.avatarPreset.backdrop);
    return `${genderLabel} · ${outfitLabel} · ${variantLabel} · ${backdropLabel}`;
  }

  selectAvatarPreset(preset: AvatarPresetSelection): void {
    this.avatarPreset = {
      gender: preset.gender,
      outfit: preset.outfit,
      variant: preset.variant,
      backdrop: preset.backdrop,
      accessory: preset.accessory,
      hairStyle: preset.hairStyle
    };
    this.saveSuccess = 'Preset selectionne. Clique sur "Utiliser cet avatar" pour l appliquer.';
    this.saveError = '';
  }

  isPresetSelected(preset: AvatarPresetSelection): boolean {
    return this.avatarPreset.gender === preset.gender
      && this.avatarPreset.outfit === preset.outfit
      && this.avatarPreset.variant === preset.variant
      && this.avatarPreset.backdrop === preset.backdrop
      && this.avatarPreset.accessory === preset.accessory
      && this.avatarPreset.hairStyle === preset.hairStyle;
  }

  buildPresetThumbnail(preset: AvatarPresetSelection): string {
    return this.buildPresetAvatarDataUrl(
      preset.gender,
      preset.outfit,
      preset.variant,
      preset.backdrop,
      preset.accessory,
      preset.hairStyle
    );
  }

  getFilteredAvatarGalleryPresets(): AvatarPresetSelection[] {
    if (this.activeAvatarCategory === 'all') {
      return this.avatarGalleryPresets;
    }
    return this.avatarGalleryPresets.filter((preset) => preset.category === this.activeAvatarCategory);
  }

  saveProfile(): void {
    if (this.saving || !this.hasProfileChanges()) {
      return;
    }

    this.saving = true;
    this.saveSuccess = '';
    this.saveError = '';

    const payload = {
      firstName: this.editModel.firstName.trim(),
      lastName: this.editModel.lastName.trim(),
      phone: this.editModel.phone.trim(),
      avatarUrl: this.editModel.avatarUrl.trim()
    };

    this.userService.updateProfile(payload).subscribe({
      next: (user) => {
        this.profile = this.mapUserToProfile(user);
        this.resetEditModel();
        this.saveSuccess = 'Profil mis a jour avec succes.';
        this.saving = false;
      },
      error: (error) => {
        console.error('Error saving profile:', error);
        this.saveError = 'Impossible d enregistrer le profil pour le moment.';
        this.saving = false;
      }
    });
  }

  private normalizeField(value?: string): string {
    return (value || '').trim();
  }

  private getAvatarOutfitLabel(outfit: AvatarOutfit): string {
    const labels: Record<AvatarOutfit, string> = {
      business: 'Business',
      casual: 'Casual',
      support: 'Support Tech'
    };
    return labels[outfit];
  }

  private getAvatarVariantLabel(variant: AvatarVariant): string {
    const labels: Record<AvatarVariant, string> = {
      signature: 'Signature',
      soft: 'Soft',
      sharp: 'Sharp'
    };
    return labels[variant];
  }

  private getAvatarBackdropLabel(backdrop: AvatarBackdrop): string {
    const labels: Record<AvatarBackdrop, string> = {
      blue: 'Bleu',
      violet: 'Violet',
      emerald: 'Emeraude',
      sunset: 'Sunset'
    };
    return labels[backdrop];
  }

  private buildPresetAvatarDataUrl(
    gender: AvatarGender,
    outfit: AvatarOutfit,
    variant: AvatarVariant,
    backdrop: AvatarBackdrop,
    accessory: AvatarAccessory,
    hairStyle: AvatarHairStyle
  ): string {
    const presets: Record<AvatarGender, Record<AvatarOutfit, {
      background: string;
      hair: string;
      skin: string;
      shirt: string;
      jacket: string;
      accent: string;
      hairPath: string;
    }>> = {
      woman: {
        business: {
          background: '#13233f',
          hair: '#2f254d',
          skin: '#efc2a4',
          shirt: '#f5f7ff',
          jacket: '#1e3a8a',
          accent: '#7dd3fc',
          hairPath: 'M64 38c15 0 26 11 26 28v18H78V68c0-8-6-14-14-14s-14 6-14 14v16H38V66c0-17 11-28 26-28z'
        },
        casual: {
          background: '#1f2347',
          hair: '#4b2c5e',
          skin: '#efc2a4',
          shirt: '#f59e0b',
          jacket: '#7c3aed',
          accent: '#f9a8d4',
          hairPath: 'M64 36c17 0 28 12 28 30v18H77V69c0-7-5-13-13-13s-13 6-13 13v15H36V66c0-18 11-30 28-30z'
        },
        support: {
          background: '#072d36',
          hair: '#1f2937',
          skin: '#efc2a4',
          shirt: '#0f172a',
          jacket: '#0ea5a4',
          accent: '#67e8f9',
          hairPath: 'M64 37c16 0 27 11 27 29v18H79V69c0-8-6-14-15-14s-15 6-15 14v15H37V66c0-18 11-29 27-29z'
        }
      },
      man: {
        business: {
          background: '#11243d',
          hair: '#1f2937',
          skin: '#e8bc99',
          shirt: '#f8fafc',
          jacket: '#334155',
          accent: '#60a5fa',
          hairPath: 'M38 57c2-15 14-25 26-25s24 10 26 25l-8-4c-5-3-11-4-18-4s-13 1-18 4l-8 4z'
        },
        casual: {
          background: '#2b1f3a',
          hair: '#3f2c1f',
          skin: '#e8bc99',
          shirt: '#fb7185',
          jacket: '#7c2d12',
          accent: '#fda4af',
          hairPath: 'M38 58c1-16 14-26 26-26s25 10 26 26l-10-4c-4-2-10-3-16-3s-12 1-16 3l-10 4z'
        },
        support: {
          background: '#082f49',
          hair: '#111827',
          skin: '#e8bc99',
          shirt: '#0f172a',
          jacket: '#0369a1',
          accent: '#22d3ee',
          hairPath: 'M37 58c2-16 14-27 27-27 12 0 24 11 26 27l-9-4c-5-2-10-3-17-3s-12 1-17 3l-10 4z'
        }
      }
    };

    const preset = presets[gender][outfit];
    const backdropMap: Record<AvatarBackdrop, { background: string; accent: string }> = {
      blue: { background: preset.background, accent: preset.accent },
      violet: { background: '#312e81', accent: '#c4b5fd' },
      emerald: { background: '#064e3b', accent: '#6ee7b7' },
      sunset: { background: '#7c2d12', accent: '#fdba74' }
    };
    const variantFace: Record<AvatarVariant, { face: string; eyes: string; mouth: string; hairExtra?: string }> = {
      signature: {
        face: 'circle cx="64" cy="45" r="22"',
        eyes: 'M52 48c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3zm24 0c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3z',
        mouth: 'M54 61c3 2 6 3 10 3s7-1 10-3'
      },
      soft: {
        face: 'ellipse cx="64" cy="46" rx="21" ry="23"',
        eyes: 'M51 49c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3zm26 0c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3z',
        mouth: 'M53 62c4 3 7 4 11 4s7-1 11-4',
        hairExtra: 'M46 39c5-7 10-10 18-10 8 0 13 3 18 10'
      },
      sharp: {
        face: 'path d="M64 23c14 0 23 11 23 24 0 15-9 26-23 26S41 62 41 47c0-13 9-24 23-24z"',
        eyes: 'M49 48h8v3h-8zm22 0h8v3h-8z',
        mouth: 'M52 63c4 1 8 1 12 1s8 0 12-1',
        hairExtra: 'M42 40c7-8 14-11 22-11 8 0 15 3 22 11'
      }
    };
    const face = variantFace[variant];
    const theme = backdropMap[backdrop];
    const hairShape = this.getAvatarHairShape(gender, hairStyle, preset.hair);
    const accessoryMarkup = this.getAvatarAccessoryMarkup(gender, accessory, preset.hair);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${theme.background}" />
            <stop offset="100%" stop-color="${theme.accent}" />
          </linearGradient>
        </defs>
        <rect width="128" height="128" rx="32" fill="url(#bg)" />
        <${face.face} fill="${preset.skin}" />
        <path d="${preset.hairPath}" fill="${preset.hair}" />
        ${hairShape}
        ${face.hairExtra ? `<path d="${face.hairExtra}" fill="none" stroke="${preset.hair}" stroke-width="5" stroke-linecap="round" />` : ''}
        <path d="${face.eyes}" fill="#0f172a" stroke="#0f172a" stroke-width="1.2" stroke-linecap="round" />
        <path d="${face.mouth}" fill="none" stroke="#7c2d12" stroke-width="2.1" stroke-linecap="round" />
        ${accessoryMarkup}
        <path d="M28 128c2-25 16-39 36-39s34 14 36 39H28z" fill="${preset.jacket}" />
        <path d="M46 128c2-18 8-27 18-27s16 9 18 27H46z" fill="${preset.shirt}" />
        <path d="M51 87h26l-4 10H55l-4-10z" fill="${theme.accent}" opacity="0.75" />
      </svg>
    `.trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  private getAvatarHairShape(gender: AvatarGender, hairStyle: AvatarHairStyle, color: string): string {
    if (hairStyle === 'short') {
      return `<path d="M42 40c6-7 13-10 22-10 9 0 16 3 22 10" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" />`;
    }
    if (hairStyle === 'long') {
      return gender === 'woman'
        ? `<path d="M44 48c-3 14-3 28 0 40M84 48c3 14 3 28 0 40" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" />`
        : `<path d="M46 49c-2 12-2 24 0 34M82 49c2 12 2 24 0 34" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" />`;
    }
    if (hairStyle === 'cover') {
      return gender === 'woman'
        ? `<path d="M33 50c7-16 18-24 31-24s24 8 31 24v38H33V50z" fill="${color}" opacity="0.95" />`
        : `<path d="M38 40c7-8 15-12 26-12 11 0 19 4 26 12v12H38V40z" fill="${color}" opacity="0.95" />`;
    }
    return '';
  }

  private getAvatarAccessoryMarkup(gender: AvatarGender, accessory: AvatarAccessory, color: string): string {
    if (accessory === 'glasses') {
      return `
        <circle cx="52" cy="50" r="7" fill="none" stroke="#0f172a" stroke-width="2.4" />
        <circle cx="76" cy="50" r="7" fill="none" stroke="#0f172a" stroke-width="2.4" />
        <path d="M59 50h10" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" />
      `;
    }
    if (accessory === 'beard' && gender === 'man') {
      return `<path d="M48 61c4 9 9 14 16 14s12-5 16-14c-2 13-8 21-16 21s-14-8-16-21z" fill="${color}" opacity="0.92" />`;
    }
    return '';
  }

  togglePreference(key: keyof ProfilePreferences): void {
    this.preferences = {
      ...this.preferences,
      [key]: !this.preferences[key]
    };
    this.persistPreferences();
  }

  private loadPreferences(): void {
    try {
      const saved = localStorage.getItem(this.preferencesStorageKey);
      if (!saved) {
        return;
      }
      this.preferences = {
        ...this.preferences,
        ...JSON.parse(saved)
      };
    } catch (error) {
      console.warn('Unable to load profile preferences:', error);
    }
  }

  private persistPreferences(): void {
    try {
      localStorage.setItem(this.preferencesStorageKey, JSON.stringify(this.preferences));
    } catch (error) {
      console.warn('Unable to persist profile preferences:', error);
    }
  }

  getInitials(): string {
    const first = this.profile.firstName?.charAt(0) || '';
    const last = this.profile.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || this.profile.username?.charAt(0)?.toUpperCase() || '?';
  }

  getRoleIcon(): string {
    const icons: Record<string, string> = {
      ADMIN: 'admin_panel_settings',
      SUPPORT_MANAGER: 'supervisor_account',
      SUPPORT_AGENT: 'support_agent',
      CLIENT: 'person'
    };
    return icons[this.profile.role] || 'person';
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      ADMIN: 'Administrateur',
      SUPPORT_MANAGER: 'Manager Support',
      SUPPORT_AGENT: 'Agent Support',
      CLIENT: 'Client'
    };
    return labels[role] || role;
  }

  getRoleNarrative(): string {
    if (this.profile.role === 'SUPPORT_MANAGER') {
      return 'Supervisez les escalades, l assignation et la qualite de service depuis votre espace personnel.';
    }
    if (this.profile.role === 'SUPPORT_AGENT') {
      return 'Retrouvez vos informations de compte et vos raccourcis de traitement dans un poste de travail unifie.';
    }
    if (this.profile.role === 'ADMIN') {
      return 'Pilotez la plateforme, la securite et la gouvernance d identite depuis un espace centralise.';
    }
    return 'Suivez vos informations de compte et l etat global de vos demandes de support.';
  }

  getProfileRecommendationTitle(): string {
    return this.profile.keycloakId ? 'Compte synchronise et pret' : 'Verifiez le lien d identite';
  }

  getProfileRecommendationText(): string {
    if (this.profile.keycloakId) {
      return 'Votre compte est correctement relie au portail de securite. Utilisez Keycloak pour les mots de passe, les sessions et la gestion MFA.';
    }
    return 'Le compte reste utilisable, mais il faut verifier la synchronisation Keycloak pour garantir un acces unifie et une administration propre.';
  }

  getWorkspaceLabel(): string {
    if (this.profile.role === 'SUPPORT_MANAGER') {
      return 'Pilotage support et supervision';
    }
    if (this.profile.role === 'SUPPORT_AGENT') {
      return 'Traitement, diagnostics et escalades';
    }
    if (this.profile.role === 'ADMIN') {
      return 'Administration, gouvernance et securite';
    }
    return 'Suivi client et coordination support';
  }

  getWorkspaceNarrative(): string {
    if (this.profile.role === 'SUPPORT_MANAGER') {
      return 'Vous pilotez l assignation, les delais SLA, les escalades et la qualite de service depuis les vues manager et dashboard.';
    }
    if (this.profile.role === 'SUPPORT_AGENT') {
      return 'Votre espace regroupe les tickets assignes, l assistant IA et les raccourcis utiles pour traiter rapidement les demandes.';
    }
    if (this.profile.role === 'ADMIN') {
      return 'Votre profil centralise les acces critiques de la plateforme avec une passerelle directe vers la gouvernance des comptes.';
    }
    return 'Votre profil sert de point d entree pour suivre vos tickets, vos notifications et les documents de service associes.';
  }

  openAccountManagement(): void {
    const keycloakUrl = `${environment.keycloak.url}/realms/${environment.keycloak.realm}/account`;
    window.open(keycloakUrl, '_blank');
  }

  openSecuritySettings(): void {
    const keycloakUrl = `${environment.keycloak.url}/realms/${environment.keycloak.realm}/account/#/security/signingin`;
    window.open(keycloakUrl, '_blank');
  }
}
