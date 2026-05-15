import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  Ticket,
  TicketArchiveDocument,
  TicketHistoryEntry,
  TicketPriority,
  TicketStatus
} from '@core/models';
import { TicketService } from '@core/services';

type ClientTicketFilter = 'all' | 'attention' | 'resolved';

interface ClientTicketFollowUp {
  loading: boolean;
  history: TicketHistoryEntry[];
  documents: TicketArchiveDocument[];
}

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule
  ],
  template: `
    <div class="client-space">
      <section class="hero-card">
        <div class="hero-copy">
          <span class="eyebrow">Portail Client</span>
          <h1>Mes tickets support</h1>
          <p>Suivez l avancee de vos demandes, visualisez ce que le support attend de vous et validez les resolutions depuis un parcours clair.</p>
        </div>

        <div class="hero-actions">
          <button mat-stroked-button type="button" class="ghost-btn" (click)="loadTickets()">
            <mat-icon>refresh</mat-icon>
            Actualiser
          </button>
          <button mat-raised-button type="button" class="primary-btn" routerLink="/tickets/new">
            <mat-icon>add</mat-icon>
            Nouvelle demande
          </button>
        </div>
      </section>

      <section class="stats-grid">
        @for (stat of stats; track stat.label) {
          <article class="stat-card">
            <span>{{ stat.label }}</span>
            <strong>{{ stat.count }}</strong>
            <small>{{ stat.caption }}</small>
          </article>
        }
      </section>

      <section class="insight-grid">
        <article class="insight-card">
          <div class="insight-card__header">
            <div>
              <span class="eyebrow">Action attendue</span>
              <h2>Tickets qui demandent votre retour</h2>
            </div>
            <span class="insight-count">{{ awaitingCustomerTickets.length }}</span>
          </div>
          <p>Ces tickets sont en pause jusqu a votre prochaine reponse dans la zone Communications.</p>
          <div class="insight-list">
            @for (ticket of awaitingCustomerTickets.slice(0, 3); track ticket.id) {
              <button type="button" class="mini-ticket" (click)="openComments(ticket.id)">
                <strong>{{ ticket.reference }}</strong>
                <span>{{ ticket.pendingReason || 'Le support attend une information complementaire.' }}</span>
              </button>
            }
            @if (awaitingCustomerTickets.length === 0) {
              <span class="empty-inline">Aucun ticket n attend un retour de votre part.</span>
            }
          </div>
        </article>

        <article class="insight-card">
          <div class="insight-card__header">
            <div>
              <span class="eyebrow">Historique</span>
              <h2>Clotures recentes et satisfaction</h2>
            </div>
            <span class="insight-count">{{ recentlyClosedTickets.length }}</span>
          </div>
          <p>Gardez une trace de vos demandes terminees et de la satisfaction exprimee apres resolution.</p>
          <div class="satisfaction-strip">
            <div class="satisfaction-kpi">
              <span>Note moyenne</span>
              <strong>{{ averageSatisfactionLabel }}</strong>
            </div>
            <div class="satisfaction-kpi">
              <span>Tickets clos recents</span>
              <strong>{{ recentlyClosedTickets.length }}</strong>
            </div>
          </div>
          <div class="insight-list">
            @for (ticket of recentlyClosedTickets.slice(0, 3); track ticket.id) {
              <a class="mini-ticket" [routerLink]="['/tickets', ticket.id]">
                <strong>{{ ticket.reference }}</strong>
                <span>{{ ticket.satisfactionComment || 'Resolution cloturee et archivable dans votre historique.' }}</span>
              </a>
            }
            @if (recentlyClosedTickets.length === 0) {
              <span class="empty-inline">Les tickets clotures recents apparaitront ici.</span>
            }
          </div>
        </article>
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
            <mat-label>Recherche</mat-label>
            <input matInput [(ngModel)]="searchTerm" placeholder="Reference, titre, description..." />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Statut</mat-label>
            <mat-select [(ngModel)]="statusFilter">
              <mat-option value="ALL">Tous</mat-option>
              @for (option of statusOptions; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Priorite</mat-label>
            <mat-select [(ngModel)]="priorityFilter">
              <mat-option value="ALL">Toutes</mat-option>
              @for (option of priorityOptions; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </section>

      @if (loading) {
        <div class="loading-shell">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else if (filteredTickets.length === 0) {
        <section class="empty-card">
          <mat-icon>confirmation_number</mat-icon>
          <h2>Aucun ticket ne correspond a votre filtre</h2>
          <p>Essayez un autre filtre ou creez une nouvelle demande de support.</p>
          <button mat-raised-button type="button" class="primary-btn" routerLink="/tickets/new">Creer un ticket</button>
        </section>
      } @else {
        <section class="tickets-grid">
          @for (ticket of filteredTickets; track ticket.id) {
            <article class="ticket-card" [class.ticket-card--expanded]="expandedTicketId === ticket.id">
              <div class="ticket-head">
                <div>
                  <span class="ticket-ref">{{ ticket.reference }}</span>
                  <h2>{{ ticket.title }}</h2>
                  <p class="ticket-status-copy">{{ getStatusNarrative(ticket) }}</p>
                </div>
                <div class="ticket-pills">
                  <span class="pill" [class.pill--attention]="isAwaitingCustomer(ticket)">
                    {{ getStatusLabel(ticket.status) }}
                  </span>
                  @if (isAwaitingCustomer(ticket)) {
                    <span class="pill pill--urgent">En attente de vous</span>
                  }
                </div>
              </div>

              <div class="ticket-meta">
                <span><mat-icon>person</mat-icon> {{ getAgentLabel(ticket) }}</span>
                <span><mat-icon>schedule</mat-icon> {{ (ticket.updatedAt || ticket.createdAt) | date:'dd/MM/yyyy HH:mm' }}</span>
                <span><mat-icon>flag</mat-icon> {{ getPriorityLabel(ticket.priority) }}</span>
              </div>

              <div class="ticket-focus">
                <div class="focus-block">
                  <span>Action attendue</span>
                  <strong>{{ ticket.nextExpectedAction || getFallbackAction(ticket) }}</strong>
                </div>
                <div class="focus-block focus-block--soft">
                  <span>Parcours</span>
                  <strong>{{ getStatusShortSummary(ticket) }}</strong>
                </div>
              </div>

              @if (ticket.pendingReason && isAwaitingCustomer(ticket)) {
                <div class="callout callout--info">
                  <strong>Informations attendues</strong>
                  <span>{{ ticket.pendingReason }}</span>
                </div>
              }

              @if (ticket.status === 'RESOLVED' && (ticket.resolutionSummary || ticket.resolutionDetails)) {
                <div class="callout">
                  <strong>Solution proposee</strong>
                  <span>{{ ticket.resolutionSummary || 'La resolution structuree est disponible dans le suivi detaille.' }}</span>
                  @if (ticket.resolutionDetails) {
                    <div class="resolution-grid">
                      <div><span>Diagnostic</span><strong>{{ ticket.resolutionDetails.diagnostic }}</strong></div>
                      <div><span>Cause</span><strong>{{ ticket.resolutionDetails.rootCause }}</strong></div>
                      <div><span>Action</span><strong>{{ ticket.resolutionDetails.actionsTaken }}</strong></div>
                      <div><span>Recommendation</span><strong>{{ ticket.resolutionDetails.nextRecommendation }}</strong></div>
                    </div>
                  }
                </div>
              }

              @if (ticket.resolutionRejectedReason) {
                <div class="callout callout--warning">
                  <strong>Dernier refus</strong>
                  <span>{{ ticket.resolutionRejectedReason }}</span>
                </div>
              }

              @if (expandedTicketId === ticket.id) {
                <div class="follow-up-card">
                  @if (getFollowUpState(ticket.id).loading) {
                    <div class="follow-up-loading">
                      <mat-spinner diameter="28"></mat-spinner>
                      <span>Chargement du suivi detaille...</span>
                    </div>
                  } @else {
                    <div class="follow-up-grid">
                      <div class="follow-up-section">
                        <div class="follow-up-title">
                          <mat-icon>timeline</mat-icon>
                          <strong>Chronologie simplifiee</strong>
                        </div>
                        @for (entry of getFollowUpState(ticket.id).history.slice(0, 4); track entry.id) {
                          <div class="timeline-entry">
                            <span class="timeline-dot"></span>
                            <div>
                              <strong>{{ getHistoryLabel(entry) }}</strong>
                              <p>{{ entry.description || entry.newValue || 'Mise a jour ticket' }}</p>
                            </div>
                          </div>
                        }
                        @if (getFollowUpState(ticket.id).history.length === 0) {
                          <span class="empty-inline">L historique detaille apparaîtra ici apres les prochaines actions sur le ticket.</span>
                        }
                      </div>

                      <div class="follow-up-section">
                        <div class="follow-up-title">
                          <mat-icon>folder_open</mat-icon>
                          <strong>Documents lies</strong>
                        </div>
                        @for (document of getFollowUpState(ticket.id).documents.slice(0, 4); track document.id) {
                          <div class="document-row">
                            <mat-icon>{{ getDocumentIcon(document) }}</mat-icon>
                            <div>
                              <strong>{{ document.label }}</strong>
                              <span>{{ getDocumentMeta(document) }}</span>
                            </div>
                          </div>
                        }
                        @if (getFollowUpState(ticket.id).documents.length === 0) {
                          <span class="empty-inline">Les pieces jointes et archives Alfresco du ticket s afficheront ici.</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              }

              <div class="ticket-footer">
                @if (isAwaitingCustomer(ticket)) {
                  <button mat-stroked-button type="button" class="ghost-btn" (click)="openComments(ticket.id)">
                    <mat-icon>chat</mat-icon>
                    Repondre au support
                  </button>
                } @else {
                  <button mat-stroked-button type="button" class="ghost-btn" (click)="openComments(ticket.id)">
                    <mat-icon>chat</mat-icon>
                    Communications
                  </button>
                }
                <button mat-stroked-button type="button" class="ghost-btn" (click)="toggleFollowUp(ticket.id)">
                  <mat-icon>{{ expandedTicketId === ticket.id ? 'expand_less' : 'insights' }}</mat-icon>
                  {{ expandedTicketId === ticket.id ? 'Masquer le suivi' : 'Voir le suivi' }}
                </button>
                <button mat-raised-button type="button" class="primary-btn" [routerLink]="['/tickets', ticket.id]">
                  <mat-icon>open_in_new</mat-icon>
                  Ouvrir le detail
                </button>
              </div>
            </article>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .client-space {
      padding: 28px;
      display: grid;
      gap: 22px;
    }

    .hero-card,
    .toolbar-card,
    .stat-card,
    .ticket-card,
    .empty-card,
    .insight-card {
      background: linear-gradient(180deg, rgba(4, 12, 33, 0.96), rgba(5, 15, 41, 0.92));
      border: 1px solid rgba(80, 124, 255, 0.16);
      box-shadow: 0 22px 60px rgba(2, 8, 26, 0.32);
    }

    .hero-card,
    .toolbar-card {
      border-radius: 26px;
      padding: 24px;
    }

    .hero-card {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: center;
    }

    .eyebrow {
      display: inline-flex;
      margin-bottom: 10px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #77d6ff;
      font-weight: 700;
    }

    .hero-copy h1 {
      margin: 0 0 8px;
      font-size: clamp(30px, 3vw, 40px);
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .hero-copy p,
    .toolbar-card p {
      margin: 0;
      color: rgba(216, 226, 255, 0.72);
      line-height: 1.7;
    }

    .hero-actions,
    .ticket-footer,
    .toolbar-fields,
    .filter-pills,
    .ticket-meta,
    .ticket-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .primary-btn,
    .ghost-btn {
      border-radius: 12px;
    }

    .stats-grid,
    .tickets-grid,
    .insight-grid {
      display: grid;
      gap: 18px;
    }

    .stats-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .insight-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stat-card,
    .insight-card {
      border-radius: 22px;
      padding: 20px;
      display: grid;
      gap: 8px;
    }

    .stat-card span,
    .insight-card__header h2 {
      color: rgba(216, 226, 255, 0.7);
    }

    .stat-card span {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .stat-card strong {
      font-size: 30px;
      font-weight: 800;
    }

    .stat-card small,
    .insight-card p {
      color: rgba(216, 226, 255, 0.62);
    }

    .insight-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .insight-card__header h2 {
      margin: 0;
      font-size: 22px;
      color: #f3f7ff;
      font-weight: 800;
    }

    .insight-count {
      min-width: 42px;
      height: 42px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(59, 130, 246, 0.16);
      color: #9fd0ff;
      font-weight: 800;
    }

    .insight-list {
      display: grid;
      gap: 10px;
    }

    .mini-ticket,
    .mini-ticket:visited {
      display: grid;
      gap: 4px;
      text-align: left;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(14, 25, 58, 0.82);
      border: 1px solid rgba(121, 152, 255, 0.16);
      color: #f3f7ff;
      text-decoration: none;
      cursor: pointer;
    }

    .mini-ticket strong {
      font-size: 13px;
      font-weight: 800;
    }

    .mini-ticket span,
    .empty-inline,
    .satisfaction-kpi span,
    .focus-block span,
    .resolution-grid span,
    .document-row span,
    .timeline-entry p {
      color: rgba(216, 226, 255, 0.66);
    }

    .satisfaction-strip {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .satisfaction-kpi {
      border-radius: 16px;
      padding: 14px;
      background: rgba(14, 25, 58, 0.82);
      border: 1px solid rgba(121, 152, 255, 0.16);
      display: grid;
      gap: 6px;
    }

    .satisfaction-kpi strong {
      font-size: 24px;
      font-weight: 800;
      color: #f3f7ff;
    }

    .toolbar-card {
      display: grid;
      gap: 18px;
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
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 14px;
    }

    .tickets-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ticket-card {
      border-radius: 24px;
      padding: 22px;
      display: grid;
      gap: 14px;
    }

    .ticket-card--expanded {
      border-color: rgba(96, 165, 250, 0.3);
      box-shadow: 0 26px 74px rgba(11, 20, 43, 0.42);
    }

    .ticket-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
    }

    .ticket-ref {
      display: inline-flex;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #77d6ff;
    }

    .ticket-head h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
    }

    .ticket-status-copy {
      margin: 8px 0 0;
      color: rgba(216, 226, 255, 0.68);
      line-height: 1.6;
    }

    .ticket-meta {
      color: rgba(214, 225, 255, 0.72);
      font-size: 13px;
    }

    .ticket-meta span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .ticket-meta mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }

    .ticket-focus {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 12px;
    }

    .focus-block {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(15, 28, 63, 0.84);
      border: 1px solid rgba(121, 152, 255, 0.16);
      display: grid;
      gap: 6px;
    }

    .focus-block--soft {
      background: rgba(12, 23, 54, 0.72);
    }

    .focus-block strong,
    .resolution-grid strong,
    .document-row strong,
    .timeline-entry strong {
      color: #f8fbff;
    }

    .pill,
    .callout {
      border-radius: 16px;
    }

    .pill {
      display: inline-flex;
      padding: 6px 10px;
      background: rgba(148, 163, 184, 0.16);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .pill--attention,
    .pill--urgent {
      background: rgba(245, 158, 11, 0.16);
      color: #fcd34d;
    }

    .callout {
      display: grid;
      gap: 8px;
      padding: 14px 16px;
      background: rgba(18, 33, 70, 0.72);
      border: 1px solid rgba(113, 133, 255, 0.18);
    }

    .callout strong {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8ecfff;
    }

    .callout--warning {
      border-color: rgba(248, 113, 113, 0.28);
      background: rgba(76, 18, 31, 0.46);
    }

    .callout--warning strong {
      color: #fda4af;
    }

    .resolution-grid,
    .follow-up-grid {
      display: grid;
      gap: 12px;
    }

    .resolution-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .resolution-grid div,
    .follow-up-section {
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(9, 20, 49, 0.74);
      border: 1px solid rgba(121, 152, 255, 0.12);
      display: grid;
      gap: 6px;
    }

    .follow-up-card {
      border-radius: 20px;
      padding: 18px;
      background: linear-gradient(180deg, rgba(10, 20, 49, 0.92), rgba(8, 18, 45, 0.86));
      border: 1px solid rgba(121, 152, 255, 0.16);
    }

    .follow-up-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .follow-up-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      color: #dce9ff;
    }

    .follow-up-loading,
    .loading-shell,
    .empty-card {
      display: grid;
      place-items: center;
      text-align: center;
      gap: 10px;
    }

    .follow-up-loading {
      min-height: 140px;
    }

    .timeline-entry,
    .document-row {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: flex-start;
      padding: 10px 0;
      border-top: 1px solid rgba(121, 152, 255, 0.1);
    }

    .timeline-entry:first-of-type,
    .document-row:first-of-type {
      border-top: 0;
      padding-top: 0;
    }

    .timeline-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      margin-top: 6px;
      background: linear-gradient(135deg, #38bdf8, #60a5fa);
      box-shadow: 0 0 0 6px rgba(56, 189, 248, 0.1);
    }

    .document-row mat-icon {
      color: #7dd3fc;
      margin-top: 2px;
    }

    .ticket-footer {
      justify-content: flex-end;
    }

    .empty-card {
      border-radius: 26px;
      padding: 32px;
      min-height: 260px;
    }

    .empty-card mat-icon {
      width: 50px;
      height: 50px;
      font-size: 50px;
      color: #8ecfff;
    }

    @media (max-width: 1180px) {
      .stats-grid,
      .insight-grid,
      .tickets-grid,
      .follow-up-grid,
      .resolution-grid,
      .ticket-focus {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 900px) {
      .hero-card,
      .toolbar-fields {
        grid-template-columns: 1fr;
        display: grid;
      }
    }
  `]
})
export class MyTicketsComponent implements OnInit {
  loading = true;
  tickets: Ticket[] = [];
  searchTerm = '';
  quickFilter: ClientTicketFilter = 'all';
  statusFilter: TicketStatus | 'ALL' = 'ALL';
  priorityFilter: TicketPriority | 'ALL' = 'ALL';
  expandedTicketId: number | null = null;
  followUpByTicketId: Record<number, ClientTicketFollowUp> = {};

  readonly quickFilters = [
    { value: 'all' as const, label: 'Tous' },
    { value: 'attention' as const, label: 'Action requise' },
    { value: 'resolved' as const, label: 'A valider / clos' }
  ];

  readonly statusOptions: Array<{ value: TicketStatus; label: string }> = [
    { value: 'NEW', label: 'Nouveau' },
    { value: 'OPEN', label: 'Ouvert' },
    { value: 'IN_PROGRESS', label: 'En cours' },
    { value: 'PENDING', label: 'En attente' },
    { value: 'RESOLVED', label: 'Resolu' },
    { value: 'CLOSED', label: 'Clos' }
  ];

  readonly priorityOptions: Array<{ value: TicketPriority; label: string }> = [
    { value: 'LOW', label: 'Basse' },
    { value: 'MEDIUM', label: 'Moyenne' },
    { value: 'HIGH', label: 'Haute' },
    { value: 'CRITICAL', label: 'Critique' },
    { value: 'SUPER_CRITICAL', label: 'Super critique' }
  ];

  constructor(
    private readonly ticketService: TicketService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadTickets();
  }

  get filteredTickets(): Ticket[] {
    const search = this.searchTerm.trim().toLowerCase();
    return this.tickets.filter(ticket => {
      const matchesSearch = !search || [ticket.reference, ticket.title, ticket.description]
        .filter(Boolean)
        .some(value => value!.toLowerCase().includes(search));
      const matchesStatus = this.statusFilter === 'ALL' || ticket.status === this.statusFilter;
      const matchesPriority = this.priorityFilter === 'ALL' || ticket.priority === this.priorityFilter;
      const matchesQuick = this.matchesQuickFilter(ticket);
      return matchesSearch && matchesStatus && matchesPriority && matchesQuick;
    });
  }

  get awaitingCustomerTickets(): Ticket[] {
    return this.tickets.filter(ticket => this.isAwaitingCustomer(ticket));
  }

  get recentlyClosedTickets(): Ticket[] {
    return this.tickets
      .filter(ticket => ticket.status === 'CLOSED')
      .sort((left, right) => this.sortByUpdatedDesc(left, right))
      .slice(0, 5);
  }

  get averageSatisfactionLabel(): string {
    const ratings = this.tickets
      .map(ticket => ticket.satisfactionRating)
      .filter((rating): rating is number => typeof rating === 'number');
    if (ratings.length === 0) {
      return 'N/A';
    }
    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    return `${average.toFixed(1)} / 5`;
  }

  get stats(): Array<{ label: string; count: number; caption: string }> {
    return [
      { label: 'Nouveaux / ouverts', count: this.tickets.filter(ticket => ['NEW', 'OPEN'].includes(ticket.status)).length, caption: 'Tickets recemment crees ou ouverts.' },
      { label: 'En cours', count: this.tickets.filter(ticket => ['ASSIGNED', 'IN_PROGRESS'].includes(ticket.status)).length, caption: 'Demandes en traitement actif.' },
      { label: 'En attente de vous', count: this.awaitingCustomerTickets.length, caption: 'Informations attendues pour reprendre le traitement.' },
      { label: 'Resolus / clos', count: this.tickets.filter(ticket => ['RESOLVED', 'CLOSED'].includes(ticket.status)).length, caption: 'Tickets a valider ou deja termines.' }
    ];
  }

  loadTickets(): void {
    this.loading = true;
    this.ticketService.getMyTickets({ page: 0, size: 100, sort: 'updatedAt,desc' }).subscribe({
      next: (page) => {
        this.tickets = page.content || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading client tickets:', error);
        this.loading = false;
      }
    });
  }

  toggleFollowUp(ticketId: number): void {
    if (this.expandedTicketId === ticketId) {
      this.expandedTicketId = null;
      return;
    }

    this.expandedTicketId = ticketId;
    if (this.followUpByTicketId[ticketId]) {
      return;
    }

    this.followUpByTicketId[ticketId] = { loading: true, history: [], documents: [] };
    forkJoin({
      history: this.ticketService.getTicketHistory(ticketId, 0, 6).pipe(
        catchError(() => of({ content: [] as TicketHistoryEntry[] }))
      ),
      documents: this.ticketService.getAlfrescoDocuments(ticketId).pipe(
        catchError(() => of([] as TicketArchiveDocument[]))
      )
    }).subscribe({
      next: ({ history, documents }) => {
        this.followUpByTicketId[ticketId] = {
          loading: false,
          history: history.content || [],
          documents
        };
      },
      error: () => {
        this.followUpByTicketId[ticketId] = { loading: false, history: [], documents: [] };
      }
    });
  }

  getFollowUpState(ticketId: number): ClientTicketFollowUp {
    return this.followUpByTicketId[ticketId] || { loading: false, history: [], documents: [] };
  }

  openComments(ticketId: number): void {
    void this.router.navigate(['/tickets', ticketId], { queryParams: { tab: 'comments' } });
  }

  isAwaitingCustomer(ticket: Ticket): boolean {
    return ticket.status === 'PENDING' && ticket.waitingOn === 'CLIENT';
  }

  getQuickFilterCount(filter: ClientTicketFilter): number {
    switch (filter) {
      case 'attention':
        return this.tickets.filter(ticket => this.isAwaitingCustomer(ticket) || ticket.status === 'RESOLVED').length;
      case 'resolved':
        return this.tickets.filter(ticket => ['RESOLVED', 'CLOSED'].includes(ticket.status)).length;
      default:
        return this.tickets.length;
    }
  }

  matchesQuickFilter(ticket: Ticket): boolean {
    switch (this.quickFilter) {
      case 'attention':
        return this.isAwaitingCustomer(ticket) || ticket.status === 'RESOLVED';
      case 'resolved':
        return ['RESOLVED', 'CLOSED'].includes(ticket.status);
      default:
        return true;
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
      default: return status;
    }
  }

  getPriorityLabel(priority?: TicketPriority): string {
    switch (priority) {
      case 'LOW': return 'Basse';
      case 'MEDIUM': return 'Moyenne';
      case 'HIGH': return 'Haute';
      case 'CRITICAL': return 'Critique';
      case 'SUPER_CRITICAL': return 'Super critique';
      default: return 'Priorite';
    }
  }

  getAgentLabel(ticket: Ticket): string {
    const assignee = ticket.assignedTo || ticket.assignedAgent || ticket.assignee;
    if (!assignee) {
      return 'Affectation en cours';
    }
    return assignee.fullName || `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.username;
  }

  getStatusNarrative(ticket: Ticket): string {
    if (this.isAwaitingCustomer(ticket)) {
      return 'Le support attend votre retour pour reprendre le diagnostic.';
    }
    if (ticket.status === 'RESOLVED') {
      return 'Une solution a ete proposee. Vous pouvez maintenant la valider ou la refuser.';
    }
    if (ticket.status === 'CLOSED') {
      return 'Le ticket est termine. Son suivi reste disponible dans votre historique.';
    }
    return 'Le support continue le traitement de votre demande et mettra a jour le ticket a chaque etape cle.';
  }

  getStatusShortSummary(ticket: Ticket): string {
    if (this.isAwaitingCustomer(ticket)) {
      return 'Votre reponse relancera le ticket';
    }
    if (ticket.status === 'RESOLVED') {
      return 'Validation client en attente';
    }
    if (ticket.status === 'CLOSED') {
      return 'Traitement termine';
    }
    return 'Suivi support en cours';
  }

  getFallbackAction(ticket: Ticket): string {
    if (this.isAwaitingCustomer(ticket)) {
      return 'Le support attend votre retour dans Communications.';
    }
    if (ticket.status === 'RESOLVED') {
      return 'La solution est prete pour validation.';
    }
    if (ticket.status === 'CLOSED') {
      return 'Le ticket est termine et archive dans votre historique.';
    }
    return 'Le support poursuit le traitement de votre demande.';
  }

  getHistoryLabel(entry: TicketHistoryEntry): string {
    return entry.action
      ?.replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase()) || 'Mise a jour';
  }

  getDocumentIcon(document: TicketArchiveDocument): string {
    if (document.kind === 'archive' || document.kind === 'folder') {
      return 'folder';
    }
    if ((document.mimeType || '').includes('pdf')) {
      return 'picture_as_pdf';
    }
    if ((document.mimeType || '').includes('image')) {
      return 'image';
    }
    return 'description';
  }

  getDocumentMeta(document: TicketArchiveDocument): string {
    if (document.kind === 'archive') {
      return 'Dossier d archive du ticket';
    }
    if (document.kind === 'attachment' && !document.synced) {
      return 'Piece jointe locale en attente de synchronisation';
    }
    return document.relativePath || (document.synced ? 'Synchronise dans Alfresco' : 'Document associe');
  }

  private sortByUpdatedDesc(left: Ticket, right: Ticket): number {
    return new Date(right.updatedAt || right.createdAt || 0).getTime()
      - new Date(left.updatedAt || left.createdAt || 0).getTime();
  }
}
