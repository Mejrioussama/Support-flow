import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { ClientService, ReportService, TicketService, UserService } from '@core/services';
import { ArchivedTicketSearchParams, Client, MonthlyReport, Page, Ticket, User } from '@core/models';

@Component({
  selector: 'app-archives-reports',
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
    TagModule
  ],
  template: `
    <div class="archives-page">
      <section class="hero-panel">
        <div class="hero-copy">
          <span class="eyebrow">PrimeNG Compliance Hub</span>
          <h1>Archives & rapports mensuels</h1>
          <p>
            Recherche GED multi-critere, traçabilité de clôture et génération de rapports mensuels PDF / Excel
            alignés avec le sujet de stage.
          </p>
          <div class="hero-kpis">
            <article class="hero-kpi">
              <span>Archives chargees</span>
              <strong>{{ archivesPage?.totalElements || 0 }}</strong>
            </article>
            <article class="hero-kpi">
              <span>Periode rapport</span>
              <strong>{{ reportMonth || currentMonth }}</strong>
            </article>
            <article class="hero-kpi">
              <span>Top incidents</span>
              <strong>{{ topIncidentEntries.length }}</strong>
            </article>
          </div>
        </div>
      </section>

      @if (bootstrapping) {
        <div class="loading-state">
          <p-progressSpinner strokeWidth="4" [style]="{ width: '52px', height: '52px' }"></p-progressSpinner>
        </div>
      } @else {
        <div class="content-grid">
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Archives GED</h2>
                <p>Recherche par client, collaborateur, date et gravite.</p>
              </div>
            </div>

            <div class="filters-grid">
              <label class="field-shell">
                <span>Client</span>
                <p-dropdown
                  [options]="clientOptions"
                  optionLabel="label"
                  optionValue="value"
                  [(ngModel)]="archiveFilters.clientId"
                  placeholder="Tous les clients"
                  (onChange)="searchArchives(true)">
                </p-dropdown>
              </label>

              <label class="field-shell">
                <span>Collaborateur</span>
                <p-dropdown
                  [options]="collaboratorOptions"
                  optionLabel="label"
                  optionValue="value"
                  [(ngModel)]="archiveFilters.collaboratorId"
                  placeholder="Tous les collaborateurs"
                  (onChange)="searchArchives(true)">
                </p-dropdown>
              </label>

              <label class="field-shell">
                <span>Gravite</span>
                <p-dropdown
                  [options]="severityOptions"
                  optionLabel="label"
                  optionValue="value"
                  [(ngModel)]="archiveFilters.severity"
                  placeholder="Toutes"
                  (onChange)="searchArchives(true)">
                </p-dropdown>
              </label>

              <label class="field-shell">
                <span>Date debut</span>
                <input pInputText type="date" [(ngModel)]="archiveFilters.fromDate" (change)="searchArchives(true)" />
              </label>

              <label class="field-shell">
                <span>Date fin</span>
                <input pInputText type="date" [(ngModel)]="archiveFilters.toDate" (change)="searchArchives(true)" />
              </label>
            </div>

            <div class="actions-row">
              <button pButton type="button" class="p-button-text" icon="pi pi-refresh" label="Reinitialiser" (click)="resetArchiveFilters()"></button>
              <button pButton type="button" icon="pi pi-search" label="Rechercher" (click)="searchArchives(true)"></button>
            </div>

            @if (archiveMessage) {
              <div class="message-banner" [class.message-banner--error]="archiveMessageType === 'error'">
                <i class="pi" [class.pi-exclamation-triangle]="archiveMessageType === 'error'" [class.pi-info-circle]="archiveMessageType !== 'error'"></i>
                <span>{{ archiveMessage }}</span>
              </div>
            }

            @if (archivesLoading) {
              <div class="inline-loading">
                <p-progressSpinner strokeWidth="4" [style]="{ width: '42px', height: '42px' }"></p-progressSpinner>
              </div>
            } @else if ((archivesPage?.content || []).length > 0) {
              <p-table
                [value]="archivesPage!.content"
                responsiveLayout="scroll"
                styleClass="sf-prime-table archives-table"
                [tableStyle]="{ 'min-width': '70rem' }">
                <ng-template pTemplate="header">
                  <tr>
                    <th>Reference</th>
                    <th>Titre</th>
                    <th>Client</th>
                    <th>Collaborateur</th>
                    <th>Gravite</th>
                    <th>Ferme le</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-ticket>
                  <tr>
                    <td><a [routerLink]="['/tickets', ticket.id]" class="ticket-link">{{ ticket.reference }}</a></td>
                    <td>
                      <div class="title-stack">
                        <strong>{{ ticket.title }}</strong>
                        <span>{{ ticket.archiveReference || 'Archive locale' }}</span>
                      </div>
                    </td>
                    <td>{{ ticket.client?.companyName || ticket.client?.name || '-' }}</td>
                    <td>{{ getAssignedLabel(ticket) }}</td>
                    <td>
                      <p-tag [value]="severityLabel(ticket.severity)" [severity]="severityTag(ticket.severity)"></p-tag>
                    </td>
                    <td>{{ ticket.closedAt | date:'dd/MM/yyyy HH:mm' }}</td>
                  </tr>
                </ng-template>
              </p-table>

              <p-paginator
                [rows]="archivePageSize"
                [first]="archivePageIndex * archivePageSize"
                [totalRecords]="archivesPage?.totalElements || 0"
                [rowsPerPageOptions]="[12]"
                (onPageChange)="onArchivePageChange($event)">
              </p-paginator>
            } @else {
              <div class="empty-state">
                <i class="pi pi-inbox"></i>
                <p>Aucune archive ne correspond aux filtres selectionnes.</p>
              </div>
            }
          </section>

          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Rapports mensuels</h2>
                <p>Temps moyen de resolution, conformite SLA et top incidents.</p>
              </div>
            </div>

            <div class="report-controls">
              <label class="field-shell field-shell--compact">
                <span>Mois du rapport</span>
                <input pInputText type="month" [(ngModel)]="reportMonth" />
              </label>
              <button pButton type="button" icon="pi pi-chart-line" label="Generer" (click)="generateReport()" [disabled]="reportLoading || !reportMonth"></button>
            </div>

            @if (reportMessage) {
              <div class="message-banner" [class.message-banner--error]="reportMessageType === 'error'">
                <i class="pi" [class.pi-check-circle]="reportMessageType === 'success'" [class.pi-times-circle]="reportMessageType === 'error'"></i>
                <span>{{ reportMessage }}</span>
              </div>
            }

            @if (reportLoading) {
              <div class="inline-loading">
                <p-progressSpinner strokeWidth="4" [style]="{ width: '42px', height: '42px' }"></p-progressSpinner>
              </div>
            } @else if (monthlyReport) {
              <div class="summary-grid">
                <article class="summary-card">
                  <span>Periode</span>
                  <strong>{{ monthlyReport.periodLabel }}</strong>
                </article>
                <article class="summary-card">
                  <span>Tickets clotures</span>
                  <strong>{{ monthlyReport.resolvedTickets }}</strong>
                </article>
                <article class="summary-card">
                  <span>Temps moyen</span>
                  <strong>{{ monthlyReport.formattedAverageResolutionTime }}</strong>
                </article>
                <article class="summary-card">
                  <span>SLA respecte</span>
                  <strong>{{ monthlyReport.slaComplianceRate | number:'1.0-2' }}%</strong>
                </article>
              </div>

              <div class="download-row">
                <button pButton type="button" class="p-button-outlined" icon="pi pi-file-pdf" label="Telecharger PDF" (click)="downloadReport('pdf')"></button>
                <button pButton type="button" class="p-button-outlined" icon="pi pi-file-excel" label="Telecharger Excel" (click)="downloadReport('xlsx')"></button>
              </div>

              <div class="incident-list">
                <h3>Top types d incidents</h3>
                @if (topIncidentEntries.length > 0) {
                  @for (incident of topIncidentEntries; track incident[0]) {
                    <div class="incident-row">
                      <span>{{ incident[0] }}</span>
                      <strong>{{ incident[1] }}</strong>
                    </div>
                  }
                } @else {
                  <span class="muted">Aucun incident agrege pour cette periode.</span>
                }
              </div>
            } @else {
              <div class="empty-state">
                <i class="pi pi-chart-bar"></i>
                <p>Generez un rapport pour afficher les indicateurs Jasper/Excel du mois.</p>
              </div>
            }
          </section>
        </div>
      }
    </div>
  `,
  styles: [`
    .archives-page {
      display: grid;
      gap: 1.5rem;
      padding: 1.25rem;
      max-width: 1450px;
      margin: 0 auto;
    }

    .hero-panel,
    .panel,
    .message-banner {
      border-radius: 28px;
      border: 1px solid rgba(56, 189, 248, 0.14);
      background:
        linear-gradient(135deg, rgba(8, 15, 33, 0.95), rgba(10, 35, 71, 0.84)),
        rgba(15, 23, 42, 0.94);
      box-shadow: 0 32px 80px rgba(2, 8, 23, 0.44);
      backdrop-filter: blur(24px);
    }

    .hero-panel {
      padding: 1.8rem;
    }

    .eyebrow {
      display: inline-flex;
      margin-bottom: 1rem;
      padding: 0.4rem 0.8rem;
      border-radius: 999px;
      border: 1px solid rgba(125, 211, 252, 0.24);
      background: rgba(14, 116, 144, 0.12);
      color: #7dd3fc;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.72rem;
      font-weight: 700;
    }

    h1, h2, h3 {
      margin: 0;
      color: #f8fafc;
    }

    h1 {
      font-size: clamp(2rem, 3.6vw, 3rem);
      margin-bottom: 0.65rem;
      line-height: 1.05;
    }

    p {
      margin: 0;
      color: rgba(226, 232, 240, 0.78);
      line-height: 1.7;
    }

    .hero-kpis,
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.9rem;
      margin-top: 1.35rem;
    }

    .hero-kpi,
    .summary-card {
      padding: 1rem 1.1rem;
      border-radius: 18px;
      background: rgba(15, 23, 42, 0.55);
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .hero-kpi span,
    .summary-card span {
      display: block;
      color: rgba(191, 219, 254, 0.72);
      font-size: 0.8rem;
      margin-bottom: 0.35rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .hero-kpi strong,
    .summary-card strong {
      color: #f8fafc;
      font-size: 1.45rem;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1.45fr 1fr;
      gap: 1.5rem;
    }

    .panel {
      padding: 1.25rem;
      display: grid;
      gap: 1rem;
    }

    .panel-head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 1rem;
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

    .field-shell--compact {
      min-width: 220px;
    }

    .actions-row,
    .report-controls,
    .download-row {
      display: flex;
      gap: 0.85rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .message-banner {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.9rem 1rem;
      color: #dbeafe;
    }

    .message-banner--error {
      border-color: rgba(248, 113, 113, 0.25);
      background:
        linear-gradient(135deg, rgba(69, 10, 10, 0.9), rgba(60, 18, 18, 0.82)),
        rgba(15, 23, 42, 0.94);
    }

    .title-stack,
    .incident-list {
      display: grid;
      gap: 0.3rem;
    }

    .title-stack strong,
    .incident-row strong {
      color: #f8fafc;
    }

    .title-stack span,
    .muted {
      color: rgba(191, 219, 254, 0.72);
      font-size: 0.85rem;
    }

    .ticket-link {
      color: #7dd3fc;
      text-decoration: none;
      font-weight: 700;
    }

    .incident-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 0.9rem;
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.48);
      border: 1px solid rgba(148, 163, 184, 0.12);
      color: #e2e8f0;
    }

    .inline-loading,
    .loading-state,
    .empty-state {
      min-height: 220px;
      display: grid;
      place-items: center;
      gap: 0.85rem;
      text-align: center;
      padding: 1.5rem;
    }

    .empty-state i {
      font-size: 2.8rem;
      color: #38bdf8;
    }

    :host ::ng-deep .archives-table .p-datatable-thead > tr > th {
      background: rgba(15, 23, 42, 0.92);
      color: #e2e8f0;
      border-color: rgba(148, 163, 184, 0.12);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.74rem;
    }

    :host ::ng-deep .archives-table .p-datatable-tbody > tr > td {
      background: rgba(15, 23, 42, 0.34);
      color: #f8fafc;
      border-color: rgba(148, 163, 184, 0.1);
      vertical-align: middle;
    }

    :host ::ng-deep .p-paginator {
      border: 0;
      background: transparent;
      color: #e2e8f0;
    }

    @media (max-width: 1180px) {
      .content-grid {
        grid-template-columns: 1fr;
      }

      .filters-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .hero-kpis,
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .archives-page {
        padding: 0.85rem;
      }

      .filters-grid {
        grid-template-columns: 1fr;
      }

      .actions-row,
      .report-controls,
      .download-row {
        width: 100%;
      }
    }
  `]
})
export class ArchivesReportsComponent implements OnInit {
  bootstrapping = true;
  archivesLoading = false;
  reportLoading = false;

  clients: Client[] = [];
  collaborators: User[] = [];
  archivesPage: Page<Ticket> | null = null;
  monthlyReport: MonthlyReport | null = null;

  archiveMessage = '';
  archiveMessageType: 'info' | 'error' = 'info';
  reportMessage = '';
  reportMessageType: 'success' | 'error' = 'success';

  archivePageIndex = 0;
  readonly archivePageSize = 12;

  archiveFilters: ArchivedTicketSearchParams = {
    page: 0,
    size: this.archivePageSize,
    sort: 'closedAt,desc'
  };

  readonly severityOptions = [
    { value: undefined, label: 'Toutes' },
    { value: 'LOW', label: 'Basse' },
    { value: 'MEDIUM', label: 'Moyenne' },
    { value: 'HIGH', label: 'Haute' },
    { value: 'CRITICAL', label: 'Critique' }
  ];

  currentMonth = this.toMonthInputValue(new Date());
  reportMonth = this.currentMonth;

  constructor(
    private readonly ticketService: TicketService,
    private readonly reportService: ReportService,
    private readonly clientService: ClientService,
    private readonly userService: UserService
  ) {}

  ngOnInit(): void {
    forkJoin({
      clients: this.clientService.getAllActiveClients(),
      collaborators: this.userService.getAgents()
    }).subscribe({
      next: ({ clients, collaborators }) => {
        this.clients = clients || [];
        this.collaborators = collaborators || [];
        this.bootstrapping = false;
        this.searchArchives(true);
      },
      error: (error) => {
        console.error('Error loading archives screen bootstrap data:', error);
        this.bootstrapping = false;
        this.archiveMessage = 'Impossible de charger les listes de filtres.';
        this.archiveMessageType = 'error';
      }
    });
  }

  get clientOptions(): Array<{ label: string; value: number | undefined }> {
    return [
      { label: 'Tous les clients', value: undefined },
      ...this.clients.map((client) => ({
        label: client.companyName || client.name || `Client #${client.id}`,
        value: client.id
      }))
    ];
  }

  get collaboratorOptions(): Array<{ label: string; value: number | undefined }> {
    return [
      { label: 'Tous les collaborateurs', value: undefined },
      ...this.collaborators.map((user) => ({
        label: this.getUserLabel(user),
        value: user.id
      }))
    ];
  }

  get topIncidentEntries(): [string, number][] {
    if (!this.monthlyReport?.topIncidentTypes) {
      return [];
    }
    return Object.entries(this.monthlyReport.topIncidentTypes);
  }

  searchArchives(resetPage: boolean = false): void {
    if (resetPage) {
      this.archivePageIndex = 0;
    }

    this.archivesLoading = true;
    this.archiveMessage = '';

    const params: ArchivedTicketSearchParams = {
      ...this.archiveFilters,
      page: this.archivePageIndex,
      size: this.archivePageSize,
      sort: 'closedAt,desc'
    };

    this.ticketService.searchArchivedTickets(params).subscribe({
      next: (page) => {
        this.archivesPage = page;
        this.archivesLoading = false;
        this.archiveMessage = page.totalElements > 0 ? `${page.totalElements} archive(s) trouvee(s).` : '';
        this.archiveMessageType = 'info';
      },
      error: (error) => {
        console.error('Error searching archived tickets:', error);
        this.archivesLoading = false;
        this.archiveMessage = "La recherche d'archives a echoue.";
        this.archiveMessageType = 'error';
      }
    });
  }

  resetArchiveFilters(): void {
    this.archiveFilters = {
      page: 0,
      size: this.archivePageSize,
      sort: 'closedAt,desc'
    };
    this.searchArchives(true);
  }

  onArchivePageChange(event: { first: number; rows: number }): void {
    this.archivePageIndex = Math.floor((event.first || 0) / (event.rows || this.archivePageSize));
    this.searchArchives(false);
  }

  generateReport(): void {
    const [year, month] = (this.reportMonth || '').split('-').map((value) => Number(value));
    if (!year || !month) {
      this.reportMessage = 'Selectionne un mois valide.';
      this.reportMessageType = 'error';
      return;
    }

    this.reportLoading = true;
    this.reportMessage = '';

    this.reportService.generateMonthlyReport(year, month).subscribe({
      next: (report) => {
        this.monthlyReport = report;
        this.reportLoading = false;
        this.reportMessage = `Rapport ${report.periodLabel} genere avec succes.`;
        this.reportMessageType = 'success';
      },
      error: (error) => {
        console.error('Error generating monthly report:', error);
        this.reportLoading = false;
        this.reportMessage = 'Impossible de generer le rapport mensuel.';
        this.reportMessageType = 'error';
      }
    });
  }

  async downloadReport(format: 'pdf' | 'xlsx'): Promise<void> {
    const [year, month] = (this.reportMonth || '').split('-').map((value) => Number(value));
    if (!year || !month) {
      this.reportMessage = 'Selectionne un mois valide avant telechargement.';
      this.reportMessageType = 'error';
      return;
    }

    try {
      const blob = await firstValueFrom(this.reportService.downloadMonthlyReport(year, month, format));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `supportflow-monthly-${year}-${String(month).padStart(2, '0')}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading monthly report:', error);
      this.reportMessage = `Impossible de telecharger le rapport ${format.toUpperCase()}.`;
      this.reportMessageType = 'error';
    }
  }

  getUserLabel(user: User): string {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fullName || user.username || user.email || `Utilisateur #${user.id}`;
  }

  getAssignedLabel(ticket: Ticket): string {
    const assigned = ticket.assignedAgent || ticket.assignedTo || ticket.assignee;
    if (!assigned) {
      return 'Non assigne';
    }
    return [assigned.firstName, assigned.lastName].filter(Boolean).join(' ').trim()
      || assigned.username
      || assigned.email
      || 'Assigne';
  }

  severityLabel(severity?: string): string {
    switch (severity) {
      case 'LOW': return 'Basse';
      case 'MEDIUM': return 'Moyenne';
      case 'HIGH': return 'Haute';
      case 'CRITICAL': return 'Critique';
      default: return severity || 'N/A';
    }
  }

  severityTag(severity?: string): 'success' | 'info' | 'warning' | 'danger' | 'contrast' | undefined {
    switch (severity) {
      case 'LOW': return 'success';
      case 'MEDIUM': return 'info';
      case 'HIGH': return 'warning';
      case 'CRITICAL': return 'danger';
      default: return 'info';
    }
  }

  private toMonthInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }
}
