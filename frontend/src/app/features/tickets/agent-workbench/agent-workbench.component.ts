import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AgentWorkbench, Ticket, TicketResolveRequest, TicketStatus, WaitingOn } from '@core/models';
import { AuthService, TicketService } from '@core/services';
import { ResolveDialogComponent, ResolveDialogResult } from '../resolve-dialog/resolve-dialog.component';
import {
  TicketWorkflowActionDialogComponent,
  TicketWorkflowActionDialogData,
  TicketWorkflowActionDialogResult
} from '../ticket-workflow-action-dialog/ticket-workflow-action-dialog.component';
import { EscalateDialogComponent, EscalateDialogResult } from '../escalate-dialog/escalate-dialog.component';

type AgentWorkbenchFilter = 'all' | 'urgent' | 'reply' | 'waiting';
type AgentWorkbenchSort = 'sla' | 'priority' | 'recent';

@Component({
  selector: 'app-agent-workbench',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  template: `
    <div class="workbench-page">
      <section class="hero-card">
        <div class="hero-copy">
          <a routerLink="/dashboard" class="crumb">Tableau de bord</a>
          <span class="eyebrow">Agent Workbench</span>
          <h1>Vue de travail agent</h1>
          <p>Retrouvez vos tickets prioritaires, les reprises client, les risques SLA et les actions immediates sans passer par la liste generale.</p>
        </div>

        <div class="hero-metrics">
          <div class="metric-card">
            <span>A prendre</span>
            <strong>{{ workbench.availableToTake.length }}</strong>
          </div>
          <div class="metric-card">
            <span>En cours</span>
            <strong>{{ workbench.assignedOpen.length }}</strong>
          </div>
          <div class="metric-card">
            <span>SLA a risque</span>
            <strong>{{ slaAtRiskCount }}</strong>
          </div>
          <div class="metric-card metric-card--alert">
            <span>A reprendre</span>
            <strong>{{ workbench.customerReplied.length + workbench.resolutionRejected.length }}</strong>
          </div>
        </div>
      </section>

      <section class="toolbar-card">
        <div class="filter-pills">
          @for (filter of quickFilters; track filter.value) {
            <button type="button" class="filter-pill" [class.active]="quickFilter === filter.value" (click)="quickFilter = filter.value">
              {{ filter.label }}
              <span>{{ getQuickFilterCount(filter.value) }}</span>
            </button>
          }
        </div>

        <div class="toolbar-fields">
          <mat-form-field appearance="outline">
            <mat-label>Tri de travail</mat-label>
            <mat-select [(ngModel)]="sortMode">
              <mat-option value="sla">Priorite SLA</mat-option>
              <mat-option value="priority">Criticite</mat-option>
              <mat-option value="recent">Plus recents</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-stroked-button type="button" class="ghost-btn" (click)="loadWorkbench()">
            <mat-icon>refresh</mat-icon>
            Actualiser
          </button>
        </div>
      </section>

      @if (loading) {
        <div class="loading-shell">
          <mat-spinner diameter="46"></mat-spinner>
        </div>
      } @else {
        <section class="segment-grid">
          @for (segment of segments; track segment.key) {
            <article class="segment-card">
              <div class="segment-head">
                <div>
                  <span class="segment-kicker">{{ segment.kicker }}</span>
                  <h2>{{ segment.title }}</h2>
                </div>
                <span class="segment-count">{{ segment.tickets.length }}</span>
              </div>

              <p class="segment-copy">{{ segment.description }}</p>

              @if (segment.tickets.length === 0) {
                <div class="empty-state">
                  <mat-icon>check_circle</mat-icon>
                  <span>{{ segment.emptyLabel }}</span>
                </div>
              } @else {
                <div class="ticket-stack">
                  @for (ticket of segment.tickets; track ticket.id) {
                    <article class="ticket-card">
                      <div class="ticket-card__head">
                        <div>
                          <span class="ticket-ref">{{ ticket.reference }}</span>
                          <h3>{{ ticket.title }}</h3>
                        </div>
                        <div class="ticket-badges">
                          <span class="pill" [class.pill--breached]="getSlaTone(ticket) === 'breached'" [class.pill--risk]="getSlaTone(ticket) === 'risk'">
                            {{ getSlaLabel(ticket) }}
                          </span>
                          <span class="pill pill--priority">{{ getPriorityLabel(ticket.priority) }}</span>
                        </div>
                      </div>

                      <div class="ticket-meta">
                        <span>{{ getStatusLabel(ticket.status) }}</span>
                        @if (ticket.waitingOn) {
                          <span>Attente: {{ getWaitingOnLabel(ticket.waitingOn) }}</span>
                        }
                        @if (ticket.lastCustomerResponseAt) {
                          <span>Retour client: {{ ticket.lastCustomerResponseAt | date:'dd/MM HH:mm' }}</span>
                        }
                      </div>

                      <p class="ticket-context">{{ getTicketContext(ticket) }}</p>

                      <div class="ticket-actions">
                        <button mat-stroked-button type="button" [routerLink]="['/tickets', ticket.id]">
                          <mat-icon>open_in_new</mat-icon>
                          Ouvrir
                        </button>
                        <button mat-stroked-button type="button" (click)="openComments(ticket.id)">
                          <mat-icon>chat</mat-icon>
                          Communications
                        </button>
                        @if (canAct(ticket, 'take-charge')) {
                          <button mat-raised-button color="primary" type="button" (click)="takeCharge(ticket)">
                            <mat-icon>bolt</mat-icon>
                            {{ segment.key === 'available' ? 'Prendre' : 'Poursuivre' }}
                          </button>
                        }
                        @if (canAct(ticket, 'resolve')) {
                          <button mat-stroked-button type="button" (click)="resolve(ticket)">
                            <mat-icon>task_alt</mat-icon>
                            {{ isResumeSegment(segment.key) ? 'Reprendre' : 'Resoudre' }}
                          </button>
                        }
                        @if (canAct(ticket, 'sla-pause')) {
                          <button mat-stroked-button type="button" (click)="waitForCustomer(ticket)">
                            <mat-icon>pause_circle</mat-icon>
                            Attente
                          </button>
                        }
                        @if (canAct(ticket, 'escalate')) {
                          <button mat-stroked-button type="button" (click)="escalate(ticket)">
                            <mat-icon>trending_up</mat-icon>
                            Escalader
                          </button>
                        }
                      </div>
                    </article>
                  }
                </div>
              }
            </article>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .workbench-page {
      padding: 28px;
      display: grid;
      gap: 24px;
    }

    .hero-card,
    .segment-card,
    .ticket-card,
    .toolbar-card {
      background: linear-gradient(180deg, rgba(4, 12, 33, 0.96), rgba(5, 15, 41, 0.92));
      border: 1px solid rgba(80, 124, 255, 0.16);
      box-shadow: 0 22px 60px rgba(2, 8, 26, 0.36);
    }

    .hero-card,
    .toolbar-card {
      border-radius: 28px;
      padding: 28px;
      display: grid;
      gap: 24px;
    }

    .hero-card {
      grid-template-columns: minmax(0, 1.3fr) minmax(280px, 420px);
    }

    .crumb,
    .eyebrow {
      display: inline-flex;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 11px;
      font-weight: 700;
      color: #72c6ff;
      text-decoration: none;
    }

    .hero-copy h1 {
      margin: 0 0 10px;
      font-size: clamp(30px, 3vw, 42px);
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .hero-copy p,
    .segment-copy {
      margin: 0;
      color: rgba(217, 226, 255, 0.74);
      line-height: 1.7;
    }

    .hero-metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      align-content: start;
    }

    .metric-card {
      border-radius: 20px;
      padding: 18px;
      background: rgba(12, 24, 56, 0.82);
      border: 1px solid rgba(137, 163, 255, 0.16);
    }

    .metric-card span {
      display: block;
      color: rgba(214, 225, 255, 0.68);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .metric-card strong {
      display: block;
      margin-top: 10px;
      font-size: 30px;
      font-weight: 800;
    }

    .metric-card--alert {
      border-color: rgba(248, 113, 113, 0.28);
      background: rgba(73, 18, 27, 0.48);
    }

    .toolbar-card {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }

    .filter-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .filter-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(122, 151, 255, 0.18);
      background: rgba(11, 22, 52, 0.74);
      color: rgba(231, 238, 255, 0.9);
      font-weight: 700;
      cursor: pointer;
    }

    .filter-pill span {
      min-width: 26px;
      height: 26px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(59, 130, 246, 0.18);
      color: #9fd0ff;
      font-size: 12px;
    }

    .filter-pill.active {
      border-color: rgba(96, 165, 250, 0.38);
      background: rgba(21, 53, 116, 0.82);
    }

    .toolbar-fields {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .ghost-btn {
      border-radius: 12px;
    }

    .segment-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
    }

    .segment-card {
      border-radius: 24px;
      padding: 22px;
      display: grid;
      gap: 18px;
    }

    .segment-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .segment-kicker {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #6dcff6;
    }

    .segment-head h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
    }

    .segment-count {
      min-width: 42px;
      height: 42px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(73, 164, 255, 0.16);
      color: #9cd5ff;
      font-weight: 800;
    }

    .ticket-stack {
      display: grid;
      gap: 14px;
    }

    .ticket-card {
      border-radius: 20px;
      padding: 18px;
      display: grid;
      gap: 12px;
    }

    .ticket-card__head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }

    .ticket-ref {
      display: inline-flex;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #72c6ff;
    }

    .ticket-card h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }

    .ticket-badges,
    .ticket-meta,
    .ticket-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: rgba(148, 163, 184, 0.14);
      color: rgba(226, 232, 240, 0.92);
    }

    .pill--breached {
      background: rgba(220, 38, 38, 0.16);
      color: #fda4af;
    }

    .pill--risk {
      background: rgba(245, 158, 11, 0.16);
      color: #fcd34d;
    }

    .pill--priority {
      background: rgba(37, 99, 235, 0.16);
      color: #93c5fd;
    }

    .ticket-meta {
      font-size: 12px;
      color: rgba(214, 225, 255, 0.68);
    }

    .ticket-context {
      margin: 0;
      color: rgba(241, 245, 249, 0.9);
      line-height: 1.6;
    }

    .ticket-actions button {
      border-radius: 12px;
    }

    .empty-state,
    .loading-shell {
      min-height: 160px;
      display: grid;
      place-items: center;
      text-align: center;
      gap: 10px;
      color: rgba(214, 225, 255, 0.64);
    }

    .empty-state mat-icon {
      width: 40px;
      height: 40px;
      font-size: 40px;
      color: #22c55e;
    }

    @media (max-width: 1180px) {
      .hero-card,
      .segment-grid,
      .toolbar-card {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AgentWorkbenchComponent implements OnInit {
  loading = true;
  quickFilter: AgentWorkbenchFilter = 'all';
  sortMode: AgentWorkbenchSort = 'sla';
  workbench: AgentWorkbench = {
    availableToTake: [],
    assignedOpen: [],
    waitingCustomer: [],
    customerReplied: [],
    resolutionRejected: []
  };

  readonly quickFilters = [
    { value: 'all' as const, label: 'Tous' },
    { value: 'urgent' as const, label: 'Urgents / SLA' },
    { value: 'reply' as const, label: 'Retour client' },
    { value: 'waiting' as const, label: 'En attente client' }
  ];

  constructor(
    private readonly ticketService: TicketService,
    private readonly authService: AuthService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadWorkbench();
  }

  get slaAtRiskCount(): number {
    return this.allWorkbenchTickets.filter(ticket => ['risk', 'breached'].includes(this.getSlaTone(ticket))).length;
  }

  get allWorkbenchTickets(): Ticket[] {
    return [
      ...this.workbench.availableToTake,
      ...this.workbench.assignedOpen,
      ...this.workbench.waitingCustomer,
      ...this.workbench.customerReplied,
      ...this.workbench.resolutionRejected
    ];
  }

  get segments(): Array<{
    key: string;
    kicker: string;
    title: string;
    description: string;
    emptyLabel: string;
    tickets: Ticket[];
  }> {
    return [
      {
        key: 'available',
        kicker: 'Intake',
        title: 'A prendre',
        description: 'Tickets sans owner, classes du plus urgent au moins urgent.',
        emptyLabel: 'Aucun ticket disponible a prendre.',
        tickets: this.prepareTickets('available', this.workbench.availableToTake)
      },
      {
        key: 'assigned',
        kicker: 'Execution',
        title: 'Mes tickets en cours',
        description: 'Portefeuille actif assigne a cet agent.',
        emptyLabel: 'Aucun ticket actif en cours.',
        tickets: this.prepareTickets('assigned', this.workbench.assignedOpen)
      },
      {
        key: 'waiting',
        kicker: 'Suivi client',
        title: 'En attente client',
        description: 'Tickets en pause dans l attente d un retour metier ou fonctionnel.',
        emptyLabel: 'Aucun ticket en attente client.',
        tickets: this.prepareTickets('waiting', this.workbench.waitingCustomer)
      },
      {
        key: 'reply',
        kicker: 'Relance',
        title: 'A reprendre',
        description: 'Le client a repondu, le ticket repasse en traitement et doit etre repris rapidement.',
        emptyLabel: 'Aucune reprise client en attente.',
        tickets: this.prepareTickets('reply', this.workbench.customerReplied)
      },
      {
        key: 'rejected',
        kicker: 'Qualite',
        title: 'Resolution refusee',
        description: 'Tickets revenus en traitement apres refus explicite de la solution.',
        emptyLabel: 'Aucun refus de resolution a traiter.',
        tickets: this.prepareTickets('rejected', this.workbench.resolutionRejected)
      }
    ];
  }

  loadWorkbench(): void {
    this.loading = true;
    this.ticketService.getAgentWorkbench(10).subscribe({
      next: (workbench) => {
        this.workbench = workbench;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading agent workbench:', error);
        this.loading = false;
        this.snackBar.open('Impossible de charger la vue agent.', 'Fermer', { duration: 3500 });
      }
    });
  }

  openComments(ticketId: number): void {
    void this.router.navigate(['/tickets', ticketId], { queryParams: { tab: 'comments' } });
  }

  isResumeSegment(segmentKey: string): boolean {
    return segmentKey === 'reply' || segmentKey === 'rejected';
  }

  canAct(ticket: Ticket, action: string): boolean {
    return this.authService.canActOnTicket(ticket, action);
  }

  takeCharge(ticket: Ticket): void {
    this.ticketService.takeCharge(ticket.id).subscribe({
      next: () => {
        this.snackBar.open('Ticket pris en charge avec succes.', 'Fermer', { duration: 2800 });
        this.loadWorkbench();
      },
      error: (error) => {
        this.snackBar.open(error?.error?.message || 'Impossible de prendre le ticket.', 'Fermer', { duration: 3600 });
      }
    });
  }

  waitForCustomer(ticket: Ticket): void {
    const dialogRef = this.dialog.open<TicketWorkflowActionDialogComponent, TicketWorkflowActionDialogData, TicketWorkflowActionDialogResult>(
      TicketWorkflowActionDialogComponent,
      {
        width: '620px',
        maxWidth: '95vw',
        data: {
          title: 'Mettre en attente',
          subtitle: 'Precisez ce qui est attendu pour reprendre le traitement.',
          submitLabel: 'Mettre en attente',
          reasonLabel: 'Motif',
          waitingOnEnabled: true,
          defaultWaitingOn: 'CLIENT',
          requireReason: true
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.reason || !result.waitingOn) {
        return;
      }
      this.ticketService.waitForCustomer(ticket.id, result.waitingOn, result.reason).subscribe({
        next: () => {
          this.snackBar.open('Ticket mis en attente avec succes.', 'Fermer', { duration: 2800 });
          this.loadWorkbench();
        },
        error: (error) => {
          this.snackBar.open(error?.error?.message || 'Impossible de mettre le ticket en attente.', 'Fermer', { duration: 3600 });
        }
      });
    });
  }

  resolve(ticket: Ticket): void {
    const dialogRef = this.dialog.open<ResolveDialogComponent, { ticketReference: string; ticketTitle: string }, ResolveDialogResult>(
      ResolveDialogComponent,
      {
        width: '680px',
        maxWidth: '95vw',
        autoFocus: false,
        data: {
          ticketReference: ticket.reference,
          ticketTitle: ticket.title
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.summary) {
        return;
      }

      const payload: TicketResolveRequest = {
        resolutionSummary: result.summary,
        resolutionDetails: {
          diagnostic: result.diagnostic,
          rootCause: result.rootCause,
          actionsTaken: result.actionsTaken,
          nextRecommendation: result.nextRecommendation
        }
      };

      this.ticketService.resolveTicket(ticket.id, payload).subscribe({
        next: () => {
          this.snackBar.open('Resolution enregistree avec succes.', 'Fermer', { duration: 2800 });
          this.loadWorkbench();
        },
        error: (error) => {
          this.snackBar.open(error?.error?.message || 'Impossible de resoudre le ticket.', 'Fermer', { duration: 3600 });
        }
      });
    });
  }

  escalate(ticket: Ticket): void {
    const dialogRef = this.dialog.open(EscalateDialogComponent, {
      width: '680px',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe((result?: EscalateDialogResult) => {
      if (!result?.agentId || !result.motif?.trim()) {
        return;
      }
      this.ticketService.escalateTicket(ticket.id, result.agentId, result.motif.trim()).subscribe({
        next: () => {
          this.snackBar.open('Ticket escalade avec succes.', 'Fermer', { duration: 2800 });
          this.loadWorkbench();
        },
        error: (error) => {
          this.snackBar.open(error?.error?.message || 'Impossible d escalader le ticket.', 'Fermer', { duration: 3600 });
        }
      });
    });
  }

  getQuickFilterCount(filter: AgentWorkbenchFilter): number {
    switch (filter) {
      case 'urgent':
        return this.allWorkbenchTickets.filter(ticket => ['risk', 'breached'].includes(this.getSlaTone(ticket))).length;
      case 'reply':
        return this.workbench.customerReplied.length + this.workbench.resolutionRejected.length;
      case 'waiting':
        return this.workbench.waitingCustomer.length;
      default:
        return this.allWorkbenchTickets.length;
    }
  }

  getStatusLabel(status: TicketStatus): string {
    switch (status) {
      case 'NEW': return 'Nouveau';
      case 'OPEN': return 'Ouvert';
      case 'ASSIGNED': return 'Assigne';
      case 'IN_PROGRESS': return 'En cours';
      case 'PENDING': return 'En attente';
      case 'RESOLVED': return 'Resolu';
      case 'CLOSED': return 'Clos';
      case 'ESCALATED_MANUAL': return 'Escalade manuelle';
      case 'ESCALATED_SLA': return 'Escalade SLA';
      default: return status;
    }
  }

  getPriorityLabel(priority?: Ticket['priority']): string {
    return priority === 'SUPER_CRITICAL' ? 'Super critique' : (priority || 'Priorite');
  }

  getWaitingOnLabel(waitingOn: WaitingOn): string {
    switch (waitingOn) {
      case 'CLIENT': return 'Client';
      case 'AGENT': return 'Agent';
      case 'MANAGER': return 'Manager';
      case 'THIRD_PARTY': return 'Tiers';
      default: return waitingOn;
    }
  }

  getTicketContext(ticket: Ticket): string {
    if (ticket.resolutionRejectedReason) {
      return `Resolution refusee: ${ticket.resolutionRejectedReason}`;
    }
    if (ticket.lastCustomerResponseAt) {
      return `Le client a repondu le ${new Date(ticket.lastCustomerResponseAt).toLocaleString('fr-FR')}. ${ticket.nextExpectedAction || 'Reprenez le diagnostic.'}`;
    }
    return ticket.nextExpectedAction || ticket.pendingReason || 'Suivi agent en cours';
  }

  getSlaTone(ticket: Ticket): 'breached' | 'risk' | 'track' {
    if (ticket.slaBreached || ticket.slaPhase === 'BREACHED' || ticket.status === 'ESCALATED_SLA') {
      return 'breached';
    }
    if (ticket.slaPhase === 'AT_RISK') {
      return 'risk';
    }
    return 'track';
  }

  getSlaLabel(ticket: Ticket): string {
    const tone = this.getSlaTone(ticket);
    if (tone === 'breached') return 'SLA depasse';
    if (tone === 'risk') return 'SLA a risque';
    if (ticket.slaPaused) return 'SLA en pause';
    return 'SLA maitrise';
  }

  private prepareTickets(segmentKey: string, tickets: Ticket[]): Ticket[] {
    return [...tickets]
      .filter(ticket => this.matchesQuickFilter(segmentKey, ticket))
      .sort((left, right) => this.compareTickets(left, right));
  }

  private matchesQuickFilter(segmentKey: string, ticket: Ticket): boolean {
    switch (this.quickFilter) {
      case 'urgent':
        return ['risk', 'breached'].includes(this.getSlaTone(ticket)) || ticket.priority === 'SUPER_CRITICAL' || ticket.priority === 'CRITICAL';
      case 'reply':
        return segmentKey === 'reply' || segmentKey === 'rejected' || !!ticket.lastCustomerResponseAt || !!ticket.resolutionRejectedReason;
      case 'waiting':
        return segmentKey === 'waiting' || (ticket.status === 'PENDING' && ticket.waitingOn === 'CLIENT');
      default:
        return true;
    }
  }

  private compareTickets(left: Ticket, right: Ticket): number {
    if (this.sortMode === 'recent') {
      return this.updatedTimestamp(right) - this.updatedTimestamp(left);
    }

    if (this.sortMode === 'priority') {
      const priorityDiff = this.priorityWeight(right.priority) - this.priorityWeight(left.priority);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return this.compareBySlaAndAge(left, right);
    }

    return this.compareBySlaAndAge(left, right);
  }

  private compareBySlaAndAge(left: Ticket, right: Ticket): number {
    const slaDiff = this.slaWeight(right) - this.slaWeight(left);
    if (slaDiff !== 0) {
      return slaDiff;
    }

    const priorityDiff = this.priorityWeight(right.priority) - this.priorityWeight(left.priority);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const customerReplyDiff = (right.lastCustomerResponseAt ? 1 : 0) - (left.lastCustomerResponseAt ? 1 : 0);
    if (customerReplyDiff !== 0) {
      return customerReplyDiff;
    }

    return this.updatedTimestamp(right) - this.updatedTimestamp(left);
  }

  private priorityWeight(priority?: Ticket['priority']): number {
    switch (priority) {
      case 'SUPER_CRITICAL': return 5;
      case 'CRITICAL': return 4;
      case 'HIGH': return 3;
      case 'MEDIUM': return 2;
      case 'LOW': return 1;
      default: return 0;
    }
  }

  private slaWeight(ticket: Ticket): number {
    const tone = this.getSlaTone(ticket);
    if (tone === 'breached') return 3;
    if (tone === 'risk') return 2;
    return 1;
  }

  private updatedTimestamp(ticket: Ticket): number {
    return new Date(ticket.updatedAt || ticket.createdAt || 0).getTime();
  }
}
