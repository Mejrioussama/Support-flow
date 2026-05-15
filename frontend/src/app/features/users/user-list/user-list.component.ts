import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { User, UserRole } from '@core/models';
import { KeycloakMigrationResult, UserService } from '@core/services';

type UserStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type KeycloakFilter = 'ALL' | 'LINKED' | 'MISSING';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    PaginatorModule,
    ProgressSpinnerModule,
    TableModule,
    TagModule,
    MatSnackBarModule
  ],
  template: `
    <div class="users-page">
      <section class="hero-panel">
        <div class="hero-copy">
          <span class="eyebrow">Identity & PrimeNG Operations</span>
          <h1>Utilisateurs, roles et federation Keycloak</h1>
          <p>
            Poste de supervision des comptes avec lecture immediate des roles, de la charge support et de l etat de
            synchronisation Keycloak.
          </p>
          <div class="hero-kpis">
            <article class="hero-kpi">
              <span>Actifs</span>
              <strong>{{ activeCount }}</strong>
            </article>
            <article class="hero-kpi">
              <span>Support</span>
              <strong>{{ supportCount }}</strong>
            </article>
            <article class="hero-kpi">
              <span>Clients</span>
              <strong>{{ clientCount }}</strong>
            </article>
            <article class="hero-kpi">
              <span>Keycloak lies</span>
              <strong>{{ linkedKeycloakCount }}</strong>
            </article>
          </div>
        </div>

        <div class="hero-actions">
          <button pButton type="button" class="p-button-outlined" icon="pi pi-sitemap" label="Categories" routerLink="/users/support-categories"></button>
          <button
            pButton
            type="button"
            class="p-button-outlined"
            [icon]="migratingKeycloak ? 'pi pi-spin pi-spinner' : 'pi pi-key'"
            label="Migrer Keycloak"
            [disabled]="migratingKeycloak"
            (click)="migrateKeycloakAccounts()">
          </button>
          <button pButton type="button" icon="pi pi-user-plus" label="Nouvel utilisateur" routerLink="/users/new"></button>
        </div>
      </section>

      @if (lastMigrationResults.length > 0) {
        <section class="message-banner">
          <i class="pi pi-check-circle"></i>
          <div>
            <strong>Derniere migration Keycloak</strong>
            <p>{{ getMigrationSummary() }}</p>
          </div>
        </section>
      }

      <section class="filters-panel">
        <label class="field-shell field-shell--search">
          <span>Recherche</span>
          <input
            pInputText
            [(ngModel)]="searchQuery"
            (keyup.enter)="applyFilters()"
            placeholder="Nom, email, username" />
        </label>

        <label class="field-shell">
          <span>Role</span>
          <p-dropdown
            [options]="roles"
            optionLabel="label"
            optionValue="value"
            [(ngModel)]="selectedRole"
            placeholder="Tous"
            (onChange)="applyFilters()">
          </p-dropdown>
        </label>

        <label class="field-shell">
          <span>Etat</span>
          <p-dropdown
            [options]="statusOptions"
            optionLabel="label"
            optionValue="value"
            [(ngModel)]="statusFilter"
            (onChange)="applyFilters()">
          </p-dropdown>
        </label>

        <label class="field-shell">
          <span>Keycloak</span>
          <p-dropdown
            [options]="keycloakOptions"
            optionLabel="label"
            optionValue="value"
            [(ngModel)]="keycloakFilter"
            (onChange)="applyClientSideFilters()">
          </p-dropdown>
        </label>

        <div class="filters-actions">
          <button pButton type="button" class="p-button-text" icon="pi pi-refresh" label="Reinitialiser" (click)="resetFilters()"></button>
          <button pButton type="button" icon="pi pi-filter" label="Appliquer" (click)="applyFilters()"></button>
        </div>
      </section>

      <section class="table-panel">
        @if (loading) {
          <div class="loading-state">
            <p-progressSpinner strokeWidth="4" [style]="{ width: '52px', height: '52px' }"></p-progressSpinner>
            <p>Chargement des comptes et de la synchronisation federée...</p>
          </div>
        } @else {
          <p-table
            [value]="visibleUsers"
            responsiveLayout="scroll"
            styleClass="sf-prime-table users-table"
            [tableStyle]="{ 'min-width': '72rem' }">
            <ng-template pTemplate="header">
              <tr>
                <th>Utilisateur</th>
                <th>Role</th>
                <th>Identite</th>
                <th>Charge</th>
                <th>Competences</th>
                <th>Etat</th>
                <th>Actions</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-user>
              <tr>
                <td>
                  <div class="user-cell">
                    <div class="avatar" [style.background]="getAvatarBackground(user)">
                      {{ getInitials(user) }}
                    </div>
                    <div class="user-copy">
                      <strong>{{ getDisplayName(user) }}</strong>
                      <span>{{ user.username }}</span>
                      <span>{{ user.email }}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <p-tag [value]="getRoleLabel(user.role)" [severity]="getRoleSeverity(user.role)"></p-tag>
                </td>
                <td>
                  <div class="identity-stack">
                    <p-tag
                      [value]="user.keycloakId ? 'Keycloak lie' : 'Lien manquant'"
                      [severity]="user.keycloakId ? 'success' : 'danger'">
                    </p-tag>
                    @if (user.keycloakId) {
                      <span class="mono">{{ truncateKeycloakId(user.keycloakId) }}</span>
                    }
                  </div>
                </td>
                <td>
                  <div class="workload-stack">
                    <strong>{{ user.assignedTicketsCount || 0 }} tickets</strong>
                    <span>{{ getWorkloadNarrative(user) }}</span>
                  </div>
                </td>
                <td>
                  <div class="skills">
                    @if (user.primarySkillLabel) {
                      <p-tag [value]="user.primarySkillLabel" severity="info"></p-tag>
                    }
                    @if (user.secondarySkillLabel) {
                      <p-tag [value]="user.secondarySkillLabel" severity="warning"></p-tag>
                    }
                    @if (!user.primarySkillLabel && !user.secondarySkillLabel) {
                      <span class="muted">Sans competence explicite</span>
                    }
                  </div>
                </td>
                <td>
                  <div class="status-stack">
                    <p-tag [value]="isUserActive(user) ? 'Actif' : 'Inactif'" [severity]="isUserActive(user) ? 'success' : 'danger'"></p-tag>
                    <span class="muted">{{ user.lastLogin ? ('Vu le ' + (user.lastLogin | date:'dd/MM/yyyy HH:mm')) : 'Jamais connecte' }}</span>
                  </div>
                </td>
                <td>
                  <div class="row-actions">
                    <button pButton type="button" class="p-button-text p-button-sm" icon="pi pi-pencil" [routerLink]="['/users', user.id, 'edit']"></button>
                    <button
                      pButton
                      type="button"
                      class="p-button-text p-button-sm"
                      [icon]="isUserActive(user) ? 'pi pi-user-minus' : 'pi pi-user-plus'"
                      (click)="toggleStatus(user)">
                    </button>
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>

          <p-paginator
            [rows]="pageSize"
            [first]="currentPage * pageSize"
            [totalRecords]="getPaginatorLength()"
            [rowsPerPageOptions]="[10, 25, 50]"
            (onPageChange)="onPageChange($event)">
          </p-paginator>
        }
      </section>
    </div>
  `,
  styles: [`
    .users-page {
      display: grid;
      gap: 1.5rem;
      padding: 1.25rem;
      max-width: 1440px;
      margin: 0 auto;
    }

    .hero-panel,
    .filters-panel,
    .table-panel,
    .message-banner {
      border-radius: 28px;
      border: 1px solid rgba(59, 130, 246, 0.15);
      background:
        linear-gradient(135deg, rgba(9, 16, 35, 0.96), rgba(20, 30, 58, 0.86)),
        rgba(15, 23, 42, 0.94);
      box-shadow: 0 28px 70px rgba(2, 8, 23, 0.44);
      backdrop-filter: blur(24px);
    }

    .hero-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1.4rem;
      padding: 1.8rem;
    }

    .eyebrow {
      display: inline-flex;
      margin-bottom: 1rem;
      padding: 0.4rem 0.8rem;
      border-radius: 999px;
      border: 1px solid rgba(125, 211, 252, 0.24);
      background: rgba(8, 47, 73, 0.22);
      color: #7dd3fc;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.72rem;
      font-weight: 700;
    }

    h1 {
      margin: 0 0 0.6rem;
      font-size: clamp(2rem, 3.5vw, 3rem);
      color: #f8fafc;
      line-height: 1.05;
    }

    p {
      margin: 0;
      color: rgba(226, 232, 240, 0.76);
      line-height: 1.7;
    }

    .hero-kpis {
      margin-top: 1.35rem;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.9rem;
    }

    .hero-kpi {
      padding: 1rem 1.1rem;
      border-radius: 18px;
      background: rgba(15, 23, 42, 0.52);
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .hero-kpi span {
      display: block;
      color: rgba(191, 219, 254, 0.7);
      font-size: 0.8rem;
      margin-bottom: 0.35rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .hero-kpi strong {
      color: #f8fafc;
      font-size: 1.45rem;
    }

    .hero-actions,
    .filters-actions,
    .row-actions,
    .skills {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .hero-actions {
      min-width: 230px;
      flex-direction: column;
      align-items: stretch;
    }

    .message-banner {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.2rem;
    }

    .message-banner i {
      font-size: 1.4rem;
      color: #4ade80;
    }

    .message-banner strong {
      display: block;
      color: #f8fafc;
      margin-bottom: 0.15rem;
    }

    .filters-panel {
      display: grid;
      grid-template-columns: minmax(260px, 2fr) repeat(3, minmax(180px, 1fr)) auto;
      gap: 1rem;
      padding: 1rem 1.2rem;
      align-items: end;
    }

    .field-shell {
      display: grid;
      gap: 0.45rem;
    }

    .field-shell span {
      color: rgba(191, 219, 254, 0.74);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    .field-shell--search {
      min-width: 0;
    }

    .table-panel {
      padding: 1rem;
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }

    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      color: #f8fafc;
      font-weight: 700;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
    }

    .user-copy,
    .identity-stack,
    .workload-stack,
    .status-stack {
      display: grid;
      gap: 0.3rem;
    }

    .user-copy strong,
    .workload-stack strong {
      color: #f8fafc;
    }

    .user-copy span,
    .mono,
    .muted,
    .workload-stack span,
    .status-stack span {
      color: rgba(191, 219, 254, 0.72);
      font-size: 0.85rem;
    }

    .mono {
      font-family: 'Consolas', monospace;
      letter-spacing: 0.04em;
    }

    .loading-state {
      min-height: 360px;
      display: grid;
      place-items: center;
      gap: 0.85rem;
      text-align: center;
      padding: 2rem;
    }

    :host ::ng-deep .users-table .p-datatable-thead > tr > th {
      background: rgba(15, 23, 42, 0.9);
      color: #e2e8f0;
      border-color: rgba(148, 163, 184, 0.12);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.74rem;
    }

    :host ::ng-deep .users-table .p-datatable-tbody > tr > td {
      background: rgba(15, 23, 42, 0.34);
      color: #f8fafc;
      border-color: rgba(148, 163, 184, 0.1);
      vertical-align: middle;
    }

    :host ::ng-deep .p-paginator {
      margin-top: 1rem;
      border: 0;
      background: transparent;
      color: #e2e8f0;
    }

    @media (max-width: 1180px) {
      .hero-panel {
        grid-template-columns: 1fr;
      }

      .hero-kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .filters-panel {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .users-page {
        padding: 0.85rem;
      }

      .hero-kpis,
      .filters-panel {
        grid-template-columns: 1fr;
      }

      .hero-actions,
      .filters-actions {
        width: 100%;
      }
    }
  `]
})
export class UserListComponent implements OnInit {
  readonly roles: Array<{ value: UserRole | ''; label: string }> = [
    { value: '', label: 'Tous' },
    { value: 'ADMIN', label: 'Administrateur' },
    { value: 'SUPPORT_MANAGER', label: 'Manager support' },
    { value: 'SUPPORT_AGENT', label: 'Agent support' },
    { value: 'CLIENT', label: 'Client' }
  ];

  readonly statusOptions: Array<{ value: UserStatusFilter; label: string }> = [
    { value: 'ALL', label: 'Tous' },
    { value: 'ACTIVE', label: 'Actifs' },
    { value: 'INACTIVE', label: 'Inactifs' }
  ];

  readonly keycloakOptions: Array<{ value: KeycloakFilter; label: string }> = [
    { value: 'ALL', label: 'Tous' },
    { value: 'LINKED', label: 'Lies' },
    { value: 'MISSING', label: 'Manquants' }
  ];

  loading = true;
  migratingKeycloak = false;
  totalElements = 0;
  currentPage = 0;
  pageSize = 10;
  searchQuery = '';
  selectedRole: UserRole | '' = '';
  statusFilter: UserStatusFilter = 'ALL';
  keycloakFilter: KeycloakFilter = 'ALL';
  rawUsers: User[] = [];
  visibleUsers: User[] = [];
  lastMigrationResults: KeycloakMigrationResult[] = [];

  constructor(
    private readonly userService: UserService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  get activeCount(): number {
    return this.rawUsers.filter((user) => this.isUserActive(user)).length;
  }

  get supportCount(): number {
    return this.rawUsers.filter((user) => user.role === 'SUPPORT_AGENT' || user.role === 'SUPPORT_MANAGER').length;
  }

  get clientCount(): number {
    return this.rawUsers.filter((user) => user.role === 'CLIENT').length;
  }

  get linkedKeycloakCount(): number {
    return this.rawUsers.filter((user) => !!user.keycloakId).length;
  }

  loadUsers(): void {
    this.loading = true;
    this.userService.getUsers({
      page: this.currentPage,
      size: this.pageSize,
      search: this.searchQuery || undefined,
      role: this.selectedRole || undefined,
      isActive: this.statusFilter === 'ALL' ? undefined : this.statusFilter === 'ACTIVE'
    }).subscribe({
      next: (page) => {
        this.rawUsers = page.content ?? [];
        this.totalElements = page.totalElements ?? 0;
        this.applyClientSideFilters();
        this.loading = false;
      },
      error: () => {
        this.rawUsers = [];
        this.visibleUsers = [];
        this.totalElements = 0;
        this.loading = false;
        this.snackBar.open('Impossible de charger les utilisateurs.', 'Fermer', { duration: 3500 });
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadUsers();
  }

  applyClientSideFilters(): void {
    this.visibleUsers = this.rawUsers.filter((user) => {
      if (this.keycloakFilter === 'LINKED' && !user.keycloakId) {
        return false;
      }
      if (this.keycloakFilter === 'MISSING' && !!user.keycloakId) {
        return false;
      }
      return true;
    });
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedRole = '';
    this.statusFilter = 'ALL';
    this.keycloakFilter = 'ALL';
    this.currentPage = 0;
    this.loadUsers();
  }

  onPageChange(event: PaginatorState): void {
    this.currentPage = event.page ? Math.floor(event.page) : 0;
    this.pageSize = event.rows || this.pageSize;
    this.loadUsers();
  }

  migrateKeycloakAccounts(): void {
    this.migratingKeycloak = true;
    this.userService.migrateExistingUsersToKeycloak().subscribe({
      next: (results) => {
        this.lastMigrationResults = results;
        this.migratingKeycloak = false;
        this.loadUsers();
        this.snackBar.open(
          results.length > 0
            ? `${results.length} compte(s) migre(s) vers Keycloak.`
            : 'Aucun compte supplementaire a migrer.',
          'Fermer',
          { duration: 4000 }
        );
      },
      error: () => {
        this.migratingKeycloak = false;
        this.snackBar.open('La migration Keycloak a echoue.', 'Fermer', { duration: 4000 });
      }
    });
  }

  toggleStatus(user: User): void {
    const request$ = this.isUserActive(user)
      ? this.userService.deactivateUser(user.id)
      : this.userService.activateUser(user.id);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isUserActive(user) ? 'Utilisateur desactive.' : 'Utilisateur active.',
          'Fermer',
          { duration: 3000 }
        );
        this.loadUsers();
      },
      error: () => {
        this.snackBar.open('Impossible de modifier le statut utilisateur.', 'Fermer', { duration: 3500 });
      }
    });
  }

  getDisplayName(user: User): string {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username;
  }

  getInitials(user: User): string {
    return `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.toUpperCase() || '?';
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

  getRoleSeverity(role?: string): 'success' | 'info' | 'warning' | 'danger' | 'contrast' | undefined {
    switch (role) {
      case 'ADMIN':
        return 'danger';
      case 'SUPPORT_MANAGER':
        return 'warning';
      case 'SUPPORT_AGENT':
        return 'info';
      case 'CLIENT':
        return 'success';
      default:
        return 'info';
    }
  }

  getAvatarBackground(user: User): string {
    const palette: Record<string, string> = {
      ADMIN: 'linear-gradient(135deg, #ef4444, #f97316)',
      SUPPORT_MANAGER: 'linear-gradient(135deg, #f59e0b, #facc15)',
      SUPPORT_AGENT: 'linear-gradient(135deg, #2563eb, #0f766e)',
      CLIENT: 'linear-gradient(135deg, #7c3aed, #ec4899)'
    };
    return palette[user.role || 'CLIENT'] || palette['CLIENT'];
  }

  getWorkloadNarrative(user: User): string {
    const count = user.assignedTicketsCount || 0;
    if (user.role === 'CLIENT') {
      return user.clientName ? `Compte rattache a ${user.clientName}` : 'Portail client';
    }
    if (count >= 8) {
      return 'Portefeuille dense';
    }
    if (count >= 4) {
      return 'Charge stable';
    }
    return 'Charge legere';
  }

  isUserActive(user: User): boolean {
    return !!(user.isActive ?? user.enabled);
  }

  truncateKeycloakId(value: string): string {
    return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
  }

  getMigrationSummary(): string {
    return this.lastMigrationResults
      .slice(0, 4)
      .map((item) => `${item.username} (${item.password})`)
      .join(' · ');
  }

  getPaginatorLength(): number {
    return this.keycloakFilter === 'ALL' ? this.totalElements : this.visibleUsers.length;
  }
}
