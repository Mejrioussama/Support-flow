import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { ClientService } from '@core/services';
import { Client } from '@core/models';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ButtonModule,
    InputTextModule,
    PaginatorModule,
    ProgressSpinnerModule,
    TableModule,
    TagModule
  ],
  template: `
    <div class="clients-page">
      <section class="hero-panel">
        <div class="hero-copy">
          <span class="eyebrow">PrimeNG Client Console</span>
          <h1>Gestion des clients</h1>
          <p>
            Vue partenaire mobile-first pour piloter le portefeuille client, suivre les contrats et ouvrir rapidement
            un ticket lié depuis une DataTable PrimeNG.
          </p>
          <div class="hero-kpis">
            <article class="hero-kpi">
              <span>Clients visibles</span>
              <strong>{{ totalElements }}</strong>
            </article>
            <article class="hero-kpi">
              <span>Accès actifs</span>
              <strong>{{ activeCount }}</strong>
            </article>
            <article class="hero-kpi">
              <span>Premium / Enterprise</span>
              <strong>{{ premiumCount }}</strong>
            </article>
          </div>
        </div>

        <div class="hero-actions">
          <button pButton type="button" icon="pi pi-plus" label="Nouveau client" routerLink="/clients/new"></button>
          <button
            pButton
            type="button"
            class="p-button-outlined"
            icon="pi pi-ticket"
            label="Nouveau ticket"
            routerLink="/tickets/new">
          </button>
        </div>
      </section>

      <section class="toolbar-panel">
        <label class="search-shell">
          <i class="pi pi-search"></i>
          <input
            pInputText
            [(ngModel)]="searchQuery"
            (keyup.enter)="applySearch()"
            placeholder="Rechercher par societe, email, telephone, SIRET..." />
        </label>

        <div class="toolbar-actions">
          <button
            pButton
            type="button"
            class="p-button-text"
            icon="pi pi-times"
            label="Effacer"
            (click)="clearSearch()"
            [disabled]="!searchQuery">
          </button>
          <button pButton type="button" icon="pi pi-search" label="Rechercher" (click)="applySearch()"></button>
        </div>
      </section>

      <section class="table-panel">
        @if (loading) {
          <div class="loading-state">
            <p-progressSpinner strokeWidth="4" [style]="{ width: '52px', height: '52px' }"></p-progressSpinner>
            <p>Synchronisation des clients partenaires...</p>
          </div>
        } @else if (clients.length > 0) {
          <p-table
            [value]="clients"
            responsiveLayout="scroll"
            styleClass="sf-prime-table clients-table"
            [tableStyle]="{ 'min-width': '68rem' }">
            <ng-template pTemplate="header">
              <tr>
                <th>Societe</th>
                <th>Contact</th>
                <th>Contrat</th>
                <th>Acces</th>
                <th>Tickets actifs</th>
                <th>Inscription</th>
                <th>Actions</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-client>
              <tr>
                <td>
                  <div class="name-cell">
                    <div class="avatar">{{ getAvatarLabel(client) }}</div>
                    <div class="name-copy">
                      <a [routerLink]="['/clients', client.id]">{{ client.companyName || client.name || ('Client #' + client.id) }}</a>
                      <span>{{ client.code || 'Code non renseigne' }}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="contact-stack">
                    <span>{{ client.email || 'Email non renseigne' }}</span>
                    <span>{{ client.phone || 'Telephone non renseigne' }}</span>
                  </div>
                </td>
                <td>
                  <p-tag [value]="getContractLabel(client.contractType)" [severity]="getContractSeverity(client.contractType)"></p-tag>
                </td>
                <td>
                  <p-tag
                    [value]="client.active ? 'Actif' : 'Suspendu'"
                    [severity]="client.active ? 'success' : 'danger'">
                  </p-tag>
                </td>
                <td>
                  <div class="ticket-chip" [class.ticket-chip--hot]="(client.ticketCount || 0) >= 10">
                    <i class="pi pi-ticket"></i>
                    <strong>{{ client.ticketCount || 0 }}</strong>
                  </div>
                </td>
                <td>{{ client.createdAt | date:'dd/MM/yyyy' }}</td>
                <td>
                  <div class="row-actions">
                    <button pButton type="button" class="p-button-text p-button-sm" icon="pi pi-eye" [routerLink]="['/clients', client.id]"></button>
                    <button pButton type="button" class="p-button-text p-button-sm" icon="pi pi-pencil" [routerLink]="['/clients', client.id, 'edit']"></button>
                    <button
                      pButton
                      type="button"
                      class="p-button-text p-button-sm"
                      icon="pi pi-plus-circle"
                      [routerLink]="['/tickets/new']"
                      [queryParams]="{ clientId: client.id }">
                    </button>
                    <button
                      pButton
                      type="button"
                      class="p-button-text p-button-sm"
                      [icon]="client.active ? 'pi pi-lock' : 'pi pi-lock-open'"
                      (click)="toggleStatus(client)">
                    </button>
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>

          <p-paginator
            [rows]="pageSize"
            [first]="currentPage * pageSize"
            [totalRecords]="totalElements"
            [rowsPerPageOptions]="[10, 25, 50, 100]"
            (onPageChange)="onPageChange($event)">
          </p-paginator>
        } @else {
          <div class="empty-state">
            <i class="pi pi-building-columns"></i>
            <h3>Aucun client pour ce filtre</h3>
            <p>Ajoutez un client ou relancez la recherche avec des criteres plus larges.</p>
            <button pButton type="button" icon="pi pi-plus" label="Ajouter un client" routerLink="/clients/new"></button>
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .clients-page {
      display: grid;
      gap: 1.5rem;
      padding: 1.25rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .hero-panel,
    .toolbar-panel,
    .table-panel {
      border: 1px solid rgba(56, 189, 248, 0.14);
      background:
        linear-gradient(135deg, rgba(8, 15, 33, 0.94), rgba(10, 35, 71, 0.76)),
        rgba(15, 23, 42, 0.92);
      box-shadow: 0 30px 80px rgba(2, 8, 23, 0.42);
      border-radius: 26px;
      backdrop-filter: blur(24px);
    }

    .hero-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1.5rem;
      padding: 1.75rem;
    }

    .eyebrow {
      display: inline-flex;
      padding: 0.4rem 0.8rem;
      border-radius: 999px;
      border: 1px solid rgba(125, 211, 252, 0.24);
      background: rgba(14, 116, 144, 0.12);
      color: #7dd3fc;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.72rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }

    h1 {
      margin: 0 0 0.65rem;
      font-size: clamp(2rem, 3.6vw, 3rem);
      color: #f8fafc;
      line-height: 1.05;
    }

    p {
      margin: 0;
      color: rgba(226, 232, 240, 0.78);
      line-height: 1.7;
    }

    .hero-kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.9rem;
      margin-top: 1.35rem;
    }

    .hero-kpi {
      padding: 1rem 1.1rem;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      background: rgba(15, 23, 42, 0.58);
    }

    .hero-kpi span {
      display: block;
      color: rgba(191, 219, 254, 0.72);
      font-size: 0.8rem;
      margin-bottom: 0.35rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .hero-kpi strong {
      color: #f8fafc;
      font-size: 1.5rem;
    }

    .hero-actions {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 0.85rem;
      min-width: 220px;
    }

    .toolbar-panel {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      padding: 1rem 1.2rem;
      flex-wrap: wrap;
    }

    .search-shell {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.85rem 1rem;
      border-radius: 18px;
      background: rgba(15, 23, 42, 0.78);
      border: 1px solid rgba(148, 163, 184, 0.18);
      flex: 1 1 480px;
    }

    .search-shell i {
      color: #38bdf8;
    }

    .search-shell input {
      width: 100%;
      background: transparent;
      border: none;
      color: #e2e8f0;
    }

    .toolbar-actions,
    .row-actions {
      display: flex;
      gap: 0.65rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .table-panel {
      padding: 1rem;
    }

    .name-cell {
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
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(59, 130, 246, 0.24));
      border: 1px solid rgba(125, 211, 252, 0.24);
      color: #f8fafc;
      font-weight: 700;
      letter-spacing: 0.06em;
    }

    .name-copy,
    .contact-stack {
      display: grid;
      gap: 0.25rem;
    }

    .name-copy a {
      color: #f8fafc;
      font-weight: 600;
      text-decoration: none;
    }

    .name-copy span,
    .contact-stack span {
      color: rgba(191, 219, 254, 0.72);
      font-size: 0.86rem;
    }

    .ticket-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.55rem 0.8rem;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.18);
      color: #e2e8f0;
    }

    .ticket-chip--hot {
      background: rgba(127, 29, 29, 0.25);
      border-color: rgba(248, 113, 113, 0.32);
      color: #fecaca;
    }

    .loading-state,
    .empty-state {
      min-height: 360px;
      display: grid;
      place-items: center;
      text-align: center;
      gap: 0.85rem;
      padding: 2rem;
    }

    .empty-state i {
      font-size: 3rem;
      color: #38bdf8;
    }

    :host ::ng-deep .sf-prime-table .p-datatable-thead > tr > th {
      background: rgba(15, 23, 42, 0.92);
      color: #e2e8f0;
      border-color: rgba(148, 163, 184, 0.12);
      text-transform: uppercase;
      font-size: 0.74rem;
      letter-spacing: 0.08em;
    }

    :host ::ng-deep .sf-prime-table .p-datatable-tbody > tr {
      background: transparent;
      color: #f8fafc;
    }

    :host ::ng-deep .sf-prime-table .p-datatable-tbody > tr > td {
      border-color: rgba(148, 163, 184, 0.1);
      vertical-align: middle;
      background: rgba(15, 23, 42, 0.32);
    }

    :host ::ng-deep .p-paginator {
      margin-top: 1rem;
      border: 0;
      background: transparent;
      color: #e2e8f0;
    }

    @media (max-width: 980px) {
      .hero-panel {
        grid-template-columns: 1fr;
      }

      .hero-kpis {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .clients-page {
        padding: 0.85rem;
      }

      .toolbar-panel {
        padding: 0.9rem;
      }

      .search-shell {
        flex-basis: 100%;
      }

      .toolbar-actions,
      .hero-actions {
        width: 100%;
      }
    }
  `]
})
export class ClientListComponent implements OnInit {
  clients: Client[] = [];

  loading = true;
  totalElements = 0;
  currentPage = 0;
  pageSize = 10;
  sortField = 'companyName';
  sortDirection = 'asc';
  searchQuery = '';

  constructor(private readonly clientService: ClientService) {}

  ngOnInit(): void {
    this.loadClients();
  }

  get activeCount(): number {
    return this.clients.filter((client) => client.active).length;
  }

  get premiumCount(): number {
    return this.clients.filter((client) => ['PREMIUM', 'ENTERPRISE'].includes(client.contractType || '')).length;
  }

  loadClients(): void {
    this.loading = true;

    const params: Record<string, string | number> = {
      page: this.currentPage,
      size: this.pageSize,
      sort: `${this.sortField},${this.sortDirection}`
    };

    if (this.searchQuery.trim()) {
      params['search'] = this.searchQuery.trim();
    }

    this.clientService.getClients(params).subscribe({
      next: (page) => {
        this.clients = page.content ?? [];
        this.totalElements = page.totalElements ?? 0;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading clients:', error);
        this.clients = [];
        this.totalElements = 0;
        this.loading = false;
      }
    });
  }

  applySearch(): void {
    this.currentPage = 0;
    this.loadClients();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applySearch();
  }

  onPageChange(event: PaginatorState): void {
    this.currentPage = event.page ? Math.floor(event.page) : 0;
    this.pageSize = event.rows || this.pageSize;
    this.loadClients();
  }

  getAvatarLabel(client: Client): string {
    return (client.companyName || client.name || 'CL')
      .slice(0, 2)
      .toUpperCase();
  }

  getContractLabel(type?: string): string {
    const labels: Record<string, string> = {
      BASIC: 'Basic',
      STANDARD: 'Standard',
      PREMIUM: 'Premium',
      ENTERPRISE: 'Enterprise'
    };
    return labels[type || ''] || type || '-';
  }

  getContractSeverity(type?: string): 'success' | 'info' | 'warning' | 'danger' | 'contrast' | undefined {
    switch (type) {
      case 'ENTERPRISE':
        return 'contrast';
      case 'PREMIUM':
        return 'success';
      case 'STANDARD':
        return 'info';
      case 'BASIC':
        return 'warning';
      default:
        return 'info';
    }
  }

  toggleStatus(client: Client): void {
    const updatedClient = { ...client, active: !client.active };
    this.clientService.updateClient(client.id, updatedClient).subscribe({
      next: () => this.loadClients(),
      error: (error) => console.error('Error updating client status:', error)
    });
  }
}
