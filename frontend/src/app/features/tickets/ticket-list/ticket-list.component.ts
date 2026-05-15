import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { firstValueFrom } from 'rxjs';

import { TicketService, AuthService } from '@core/services';
import { Ticket, TicketStatus, TicketPriority, Page, WaitingOn } from '@core/models';
import { SlaIndicatorComponent } from '@shared/components';
import { AssignDialogComponent, AssignDialogData, AssignDialogResult } from '../assign-dialog/assign-dialog.component';
import {
  TicketWorkflowActionDialogComponent,
  TicketWorkflowActionDialogData,
  TicketWorkflowActionDialogResult
} from '../ticket-workflow-action-dialog/ticket-workflow-action-dialog.component';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
    MatDialogModule,
    MatSnackBarModule,
    TableModule,
    ProgressBarModule,
    SlaIndicatorComponent
  ],
  template: `
    <div class="ticket-list">
      <header class="page-header glass-panel highlight-border">
        <div class="header-content">
          <div class="title-with-icon">
            <mat-icon class="neon-icon">confirmation_number</mat-icon>
            <h1 class="neon-title">Gestion des Tickets</h1>
          </div>
          <p class="subtitle">{{ totalElements }} tickets au total</p>
          @if (getFocusLabel()) {
            <div class="focus-banner">
              <mat-icon>tune</mat-icon>
              <span>{{ getFocusLabel() }}</span>
            </div>
          }
        </div>
        <button mat-raised-button class="neon-btn" routerLink="/tickets/new">
          <mat-icon>add</mat-icon>
          Nouveau Ticket
        </button>
      </header>

      @if (isManager && dataSource.data.length > 0) {
        <mat-card class="filters-card glass-panel highlight-border bulk-card">
          <mat-card-content>
            <div class="bulk-bar">
              <div class="bulk-bar__meta">
                <strong>{{ selectedTicketIds.size }}</strong>
                <span>ticket(s) selectionne(s)</span>
              </div>
              <div class="bulk-bar__actions">
                <button mat-stroked-button class="glass-btn small-btn" (click)="toggleSelectAllVisible()">
                  {{ areAllVisibleSelected() ? 'Tout deselectionner' : 'Tout selectionner' }}
                </button>
                <button mat-stroked-button class="glass-btn small-btn" [disabled]="selectedTicketIds.size === 0" (click)="bulkAssignSelected()">Assigner</button>
                <button mat-stroked-button class="glass-btn small-btn" [disabled]="selectedTicketIds.size === 0" (click)="bulkManagerReviewSelected()">Revue manager</button>
                <button mat-stroked-button class="glass-btn small-btn" [disabled]="selectedTicketIds.size === 0" (click)="bulkExtendSlaSelected()">Prolonger SLA</button>
                <button mat-stroked-button class="glass-btn small-btn" [disabled]="selectedTicketIds.size === 0" (click)="bulkWaitSelected()">Mettre en attente</button>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      }

      <!-- Filters -->
      <mat-card class="filters-card glass-panel highlight-border">
        <mat-card-content>
          @if (isManager) {
            <div class="manager-focus-pills">
              @for (option of managerFocusOptions; track option.value) {
                <button type="button" class="manager-focus-pill" [class.active]="focusFilter === option.value" (click)="setFocusFilter(option.value)">
                  <mat-icon>{{ option.icon }}</mat-icon>
                  {{ option.label }}
                </button>
              }
            </div>
          }
          <div class="filters">
            <mat-form-field appearance="outline" class="search-field glass-input">
              <mat-label>Rechercher</mat-label>
              <input matInput [(ngModel)]="searchQuery" 
                     (keyup.enter)="applyFilters()" 
                     placeholder="Référence, titre, description...">
              <mat-icon matSuffix class="search-icon">search</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="glass-input">
              <mat-label>Statut</mat-label>
              <mat-select [(ngModel)]="filterStatus" (selectionChange)="applyFilters()">
                <mat-option value="">Tous</mat-option>
                @for (status of statusOptions; track status.value) {
                  <mat-option [value]="status.value">{{ status.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="glass-input">
              <mat-label>Priorité</mat-label>
              <mat-select [(ngModel)]="filterPriority" (selectionChange)="applyFilters()">
                <mat-option value="">Toutes</mat-option>
                @for (priority of priorityOptions; track priority.value) {
                  <mat-option [value]="priority.value">{{ priority.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <button mat-stroked-button (click)="resetFilters()" class="glass-btn small-btn reset-btn">
              <mat-icon>clear</mat-icon>
              Réinitialiser
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Table -->
      <mat-card class="table-card glass-panel" [class.is-loading]="loading">
        @if (loading) {
          <div class="loading-overlay">
            <mat-spinner diameter="50" class="neon-spinner"></mat-spinner>
          </div>
        }

        <mat-card-content>
          <div class="prime-table-wrapper">
            <p-table [value]="dataSource.data" responsiveLayout="stack" styleClass="sf-prime-ticket-table">
              <ng-template pTemplate="header">
                <tr>
                  <th>@if (isManager) { <input type="checkbox" [checked]="areAllVisibleSelected()" (change)="toggleSelectAllVisible()" /> }</th>
                  <th>Ticket</th>
                  <th>Etat</th>
                  <th>Supervision</th>
                  <th>SLA</th>
                  <th>Actions</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-ticket>
                <tr>
                  <td>
                    @if (isManager) {
                      <input type="checkbox" [checked]="isSelected(ticket)" (change)="toggleTicketSelection(ticket)" />
                    }
                  </td>
                  <td>
                    <div class="prime-ticket-main">
                      <a [routerLink]="['/tickets', ticket.id]" class="ticket-link neon-text">
                        {{ ticket.reference }}
                      </a>
                      <strong>{{ ticket.title }}</strong>
                      <span>{{ ticket.client?.name || ticket.client?.companyName || 'Client non renseignÃ©' }}</span>
                      @if (ticket.assignedTo || ticket.assignedAgent) {
                        <span>AssignÃ© Ã  {{ ticket.assignedTo?.fullName || ticket.assignedAgent?.fullName }}</span>
                      }
                    </div>
                  </td>
                  <td>
                    <div class="prime-ticket-status">
                      <span class="status-badge" [class]="'status-' + ticket.status.toLowerCase()">
                        {{ getStatusLabel(ticket.status) }}
                      </span>
                      <span class="priority-badge" [class]="'priority-' + ticket.priority.toLowerCase()">
                        {{ getPriorityLabel(ticket.priority) }}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div class="prime-ticket-supervision">
                      @if (ticket.waitingOn) {
                        <span class="supervision-pill">{{ getWaitingOnLabel(ticket.waitingOn) }}</span>
                      }
                      <small>{{ getNextActionLabel(ticket) }}</small>
                    </div>
                  </td>
                  <td>
                    <div class="prime-sla-cell">
                      <p-progressBar [value]="getSlaProgress(ticket)" [showValue]="false"></p-progressBar>
                      <small>{{ ticket.slaRemainingTime || 'SLA en cours de calcul' }}</small>
                    </div>
                  </td>
                  <td>
                    <div class="prime-actions">
                      <a [routerLink]="['/tickets', ticket.id]" class="prime-inline-link">Ouvrir</a>
                      @if (canAct(ticket, 'assign')) {
                        <button type="button" class="prime-inline-btn" (click)="assignTicket(ticket)">Assigner</button>
                      }
                      @if (canAct(ticket, 'take-charge')) {
                        <button type="button" class="prime-inline-btn" (click)="takeCharge(ticket)">Prendre</button>
                      }
                    </div>
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>

          <div class="table-container">
            <table mat-table [dataSource]="dataSource" matSort (matSortChange)="onSortChange($event)" class="transparent-table">
              
              <ng-container matColumnDef="reference">
                <th mat-header-cell *matHeaderCellDef mat-sort-header> Référence </th>
                <td mat-cell *matCellDef="let ticket">
                  <a [routerLink]="['/tickets', ticket.id]" class="ticket-link neon-text">
                    {{ ticket.reference }}
                  </a>
                </td>
              </ng-container>

              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef mat-sort-header> Titre </th>
                <td mat-cell *matCellDef="let ticket">
                  <div class="title-cell">
                    <span class="ticket-title">{{ ticket.title }}</span>
                    <span class="ticket-desc">{{ ticket.description | slice:0:50 }}...</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="client">
                <th mat-header-cell *matHeaderCellDef> Client </th>
                <td mat-cell *matCellDef="let ticket">
                  <span class="client-name">{{ ticket.client?.name || '-' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef mat-sort-header> Statut </th>
                <td mat-cell *matCellDef="let ticket">
                  <span class="status-badge" [class]="'status-' + ticket.status.toLowerCase()">
                    {{ getStatusLabel(ticket.status) }}
                  </span>
                  @if ((ticket.escalationLevel ?? 0) > 0 && ticket.status !== 'ESCALATED_SLA') {
                    <span class="escalation-badge" [class]="'level-' + ticket.escalationLevel">
                      {{ getEscalationStepLabel(ticket.escalationLevel) }}
                    </span>
                  }
                  @if (ticket.archived) {
                    <span class="archive-badge" matTooltip="Ticket archivé">
                      <mat-icon>inventory_2</mat-icon>
                      Archivé
                    </span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="priority">
                <th mat-header-cell *matHeaderCellDef mat-sort-header> Priorité </th>
                <td mat-cell *matCellDef="let ticket">
                  <span class="priority-badge" [class]="'priority-' + ticket.priority.toLowerCase()">
                    <mat-icon class="tiny-icon">bolt</mat-icon>
                    {{ getPriorityLabel(ticket.priority) }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="assignee">
                <th mat-header-cell *matHeaderCellDef> Assigné à </th>
                <td mat-cell *matCellDef="let ticket">
                  @if (ticket.assignedTo) {
                    <div class="assignee-cell">
                      <div class="avatar-glass">{{ getInitials(ticket.assignedTo.firstName, ticket.assignedTo.lastName) }}</div>
                      <span>{{ ticket.assignedTo.firstName }} {{ ticket.assignedTo.lastName }}</span>
                    </div>
                  } @else {
                    <span class="unassigned">Non assigné</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef mat-sort-header> Créé le </th>
                <td mat-cell *matCellDef="let ticket" class="date-cell">
                  {{ ticket.createdAt | date:'dd/MM/yyyy HH:mm' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="sla">
                <th mat-header-cell *matHeaderCellDef> SLA </th>
                <td mat-cell *matCellDef="let ticket">
                  <app-sla-indicator [ticket]="ticket"></app-sla-indicator>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-header"></th>
                <td mat-cell *matCellDef="let ticket" class="actions-cell">
                  <button mat-icon-button [matMenuTriggerFor]="menu" class="action-menu-btn">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #menu="matMenu" class="glass-menu">
                    <button mat-menu-item [routerLink]="['/tickets', ticket.id]" class="menu-item-hover">
                      <mat-icon class="text-blue">visibility</mat-icon>
                      <span>Voir détails</span>
                    </button>
                    
                    @if (canAct(ticket, 'edit')) {
                      <button mat-menu-item [routerLink]="['/tickets', ticket.id, 'edit']" class="menu-item-hover">
                        <mat-icon class="text-purple">edit</mat-icon>
                        <span>Modifier</span>
                      </button>
                    }

                    @if (canAct(ticket, 'assign')) {
                      <button mat-menu-item (click)="assignTicket(ticket)" class="menu-item-hover">
                        <mat-icon class="text-green">person_add</mat-icon>
                        <span>Assigner</span>
                      </button>
                    }

                    @if (canAct(ticket, 'take-charge')) {
                      <button mat-menu-item (click)="takeCharge(ticket)" class="menu-item-hover">
                        <mat-icon class="text-blue">play_arrow</mat-icon>
                        <span>Prendre en charge</span>
                      </button>
                    }

                    @if (canAct(ticket, 'change-status')) {
                      <mat-divider class="glass-divider"></mat-divider>
                      <button mat-menu-item [matMenuTriggerFor]="statusMenu" class="menu-item-hover">
                        <mat-icon class="text-orange">swap_horiz</mat-icon>
                        <span>Changer statut</span>
                      </button>
                      <mat-menu #statusMenu="matMenu" class="glass-menu">
                        @for (option of getAvailableStatusOptions(ticket); track option.value) {
                          <button mat-menu-item (click)="changeStatus(ticket, option.value)" class="menu-item-hover">
                            <mat-icon class="text-orange">radio_button_checked</mat-icon>
                            <span>{{ option.label }}</span>
                          </button>
                        }
                      </mat-menu>
                    }
                  </mat-menu>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns; let i = index" 
                  class="interactive-row row-animate-in"
                  [style.animation-delay]="(i * 0.05) + 's'"
                  [class.urgent]="row.priority === 'HIGH' || row.priority === 'CRITICAL'"></tr>
            </table>
          </div>

          @if (!loading && dataSource.data.length === 0) {
            <div class="empty-state">
              <div class="floating-icon">
                <mat-icon>inbox</mat-icon>
              </div>
              <h3>Aucun ticket trouvé</h3>
              <p>Modifiez vos filtres ou créez un nouveau ticket</p>
            </div>
          }
        </mat-card-content>
        
        <mat-paginator 
          class="glass-paginator"
          [length]="totalElements"
          [pageSize]="pageSize"
          [pageIndex]="currentPage"
          [pageSizeOptions]="[10, 25, 50, 100]"
          (page)="onPageChange($event)"
          showFirstLastButtons>
        </mat-paginator>
      </mat-card>
    </div>
  `,
  styles: [`
    .ticket-list {
      padding: 24px;
      max-width: 1600px;
      margin: 0 auto;
    }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      padding: 24px 32px;
      border-radius: 20px;
      
      .header-content {
        .title-with-icon {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 8px;
          
          .neon-icon {
            font-size: 36px;
            width: 36px; height: 36px;
            color: var(--neon-cyan);
            filter: drop-shadow(0 0 8px rgba(6, 182, 212, 0.5));
          }
        }
        
        h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, var(--text-main) 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .subtitle {
          margin: 0;
          color: var(--text-muted);
          font-size: 15px;
        }

        .focus-banner {
          margin-top: 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(34, 211, 238, 0.08);
          border: 1px solid rgba(34, 211, 238, 0.24);
          color: #67e8f9;
          font-size: 12px;
          font-weight: 700;

          mat-icon {
            width: 16px;
            height: 16px;
            font-size: 16px;
          }
        }
      }
    }
    
    .filters-card {
      margin-bottom: 24px;
      
      .mat-mdc-card-content {
        padding: 20px 24px !important;
      }

      .manager-focus-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 18px;
      }

      .manager-focus-pill {
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

        &.active {
          border-color: rgba(96, 165, 250, 0.38);
          background: rgba(21, 53, 116, 0.82);
        }

        mat-icon {
          width: 18px;
          height: 18px;
          font-size: 18px;
        }
      }
      
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        align-items: center;
        
        .search-field {
          flex: 1;
          min-width: 300px;
        }

        mat-form-field {
          min-width: 180px;
          margin-bottom: 0 !important; // override material space
        }
        
        .reset-btn {
          height: 48px;
          border-radius: 12px;
        }
      }
    }
    
    .table-card {
      position: relative;
      min-height: 400px;
      padding-bottom: 0;
      overflow: hidden;

      &.is-loading {
        min-height: 500px;
      }
      
      .loading-overlay {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: var(--sf-glass);
        backdrop-filter: blur(4px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10;
        border-radius: inherit;
      }
      
      .mat-mdc-card-content {
        padding: 0 !important;
      }

      .prime-table-wrapper {
        display: none;
        padding: 16px;
      }

      .prime-ticket-main {
        display: grid;
        gap: 6px;

        strong {
          color: var(--text-main);
          font-size: 14px;
        }

        span {
          color: var(--text-muted);
          font-size: 12px;
        }
      }

      .prime-ticket-status,
      .prime-actions,
      .prime-sla-cell {
        display: grid;
        gap: 8px;
      }

      .prime-inline-link,
      .prime-inline-btn {
        color: var(--accent-blue);
        font-size: 12px;
        font-weight: 700;
        text-decoration: none;
        background: none;
        border: none;
        padding: 0;
        text-align: left;
        cursor: pointer;
      }

      .table-container {
        overflow-x: auto;
        padding: 0 12px;
        
        &::-webkit-scrollbar { height: 8px; }
        &::-webkit-scrollbar-track { background: transparent; }
        &::-webkit-scrollbar-thumb { background: var(--glass-highlight); border-radius: 4px; }
      }
      
      .transparent-table {
        width: 100%;
        min-width: 1000px;
        background: transparent;
        border-spacing: 0 12px;
        border-collapse: separate;

        th.mat-mdc-header-cell {
          background: transparent;
          color: var(--text-muted);
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: none;
          padding: 16px;
        }

        td.mat-mdc-cell {
          border-bottom: none;
          padding: 16px;
          color: var(--text-main);
        }

        tr.mat-mdc-header-row {
          height: 48px;
        }

        tr.mat-mdc-row {
          background: var(--glass-bg);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 12px;
          height: 72px;

          td:first-child {
            border-top-left-radius: 12px;
            border-bottom-left-radius: 12px;
            border-left: 1px solid var(--glass-border);
          }

          td:last-child {
            border-top-right-radius: 12px;
            border-bottom-right-radius: 12px;
            border-right: 1px solid var(--glass-border);
          }

          td {
            border-top: 1px solid var(--glass-border);
            border-bottom: 1px solid var(--glass-border);
          }

          &:hover {
            background: var(--glass-bg-hover);
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2), 
                        0 0 0 1px var(--glass-highlight) inset;
            
            td {
              border-color: transparent;
            }

            .action-menu-btn {
              opacity: 1;
            }
          }
          
          &.urgent {
            background: rgba(220, 38, 38, 0.05);
            td { border-color: rgba(220, 38, 38, 0.1); }
          }
        }
      }
      
      .ticket-link {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        text-decoration: none;
        letter-spacing: 0.5px;
        transition: all 0.2s ease;
        
        &:hover {
          text-shadow: 0 0 10px var(--neon-cyan);
        }
      }
      
      .title-cell {
        display: flex;
        flex-direction: column;
        gap: 4px;
        
        .ticket-title {
          font-weight: 600;
          color: var(--text-main);
        }
        
        .ticket-desc {
          font-size: 13px;
          color: var(--text-muted);
        }
      }
      
      .assignee-cell {
        display: flex;
        align-items: center;
        gap: 12px;
        
        .avatar-glass {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: var(--glass-highlight);
          border: 1px solid var(--glass-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-main);
        }
      }
      
      .date-cell {
        font-family: 'Space Grotesk', monospace;
        color: var(--text-muted);
        font-size: 14px;
      }

      .status-badge {
        display: inline-flex;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.5px;
        background: var(--glass-highlight);
        border: 1px solid var(--glass-border);
        backdrop-filter: blur(4px);
        
        &.status-open { color: #38bdf8; border-color: rgba(56,189,248,0.3); background: rgba(56,189,248,0.1); }
        &.status-assigned { color: #818cf8; border-color: rgba(129,140,248,0.3); background: rgba(129,140,248,0.1); }
        &.status-in_progress { color: #f472b6; border-color: rgba(244,114,182,0.3); background: rgba(244,114,182,0.1); }
        &.status-pending { color: #fbbf24; border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.1); }
        &.status-escalated_manual, &.status-escalated_sla { color: #f87171; border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.1); }
        &.status-resolved { color: #34d399; border-color: rgba(52,211,153,0.3); background: rgba(52,211,153,0.1); }
        &.status-closed { color: #9ca3af; }
      }

      .escalation-badge {
        display: inline-flex;
        margin-left: 8px;
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        border: 1px solid transparent;

        &.level-1 {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.12);
          border-color: rgba(245, 158, 11, 0.28);
        }

        &.level-2, &.level-3 {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.28);
        }
      }

      .priority-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        
        &.priority-low { color: #9ca3af; }
        &.priority-medium { color: #60a5fa; }
        &.priority-high { color: #f97316; }
        &.priority-critical { 
          color: #ef4444; 
          text-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
          animation: pulse-red 2s infinite;
        }
      }
      
      .action-menu-btn {
        opacity: 0.6;
        transition: opacity 0.2s;
        color: var(--text-main);
      }
      
      .empty-state {
        padding: 60px 20px;
        text-align: center;
        
        .floating-icon {
          width: 80px; height: 80px;
          margin: 0 auto 24px;
          border-radius: 50%;
          background: var(--glass-highlight);
          border: 1px solid var(--glass-border);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: float 4s ease-in-out infinite;
          
          mat-icon {
            font-size: 40px;
            width: 40px; height: 40px;
            color: var(--accent-purple);
          }
        }
        
        h3 {
          font-size: 20px;
          color: var(--text-main);
          margin: 0 0 8px;
        }
        
        p {
          color: var(--text-muted);
          margin: 0;
        }
      }
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    @keyframes pulse-red {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.1); }
    }
    
    .row-animate-in {
      animation: slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    
    @keyframes slideInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    ::ng-deep .glass-paginator {
      background: transparent !important;
      color: var(--text-main) !important;
      border-top: 1px solid var(--glass-border);
      
      .mat-mdc-paginator-container { color: var(--text-main); }
      .mat-mdc-icon-button { color: var(--text-main); }
      .mat-mdc-select-value { color: var(--text-main); }
    }

    @media (max-width: 960px) {
      .table-card {
        .prime-table-wrapper {
          display: block;
        }

        .table-container {
          display: none;
        }
      }
    }
  `]
})
export class TicketListComponent implements OnInit {
  dataSource = new MatTableDataSource<Ticket>([]);
  rawTickets: Ticket[] = [];
  displayedColumns = ['reference', 'title', 'client', 'status', 'priority', 'assignee', 'createdAt', 'sla', 'actions'];

  loading = true;
  totalElements = 0;
  currentPage = 0;
  pageSize = 10;
  sortField = 'createdAt';
  sortDirection = 'desc';

  searchQuery = '';
  filterStatus = '';
  filterPriority = '';
  focusFilter = '';
  selectedTicketIds = new Set<number>();
  readonly managerFilterStorageKey = 'supportflow-manager-ticket-focus';
  readonly managerFocusOptions = [
    { value: '', label: 'Tous', icon: 'view_list' },
    { value: 'unassigned', label: 'Sans owner', icon: 'person_off' },
    { value: 'waiting-client', label: 'En attente client', icon: 'pending_actions' },
    { value: 'customer-replied', label: 'Reponse client recue', icon: 'reply' },
    { value: 'resolution-rejected', label: 'Resolution refusee', icon: 'warning' },
    { value: 'blocked', label: 'Bloques', icon: 'pause_circle' },
    { value: 'at-risk', label: 'SLA a risque', icon: 'speed' }
  ];

  statusOptions: { value: TicketStatus; label: string }[] = [
    { value: 'NEW', label: 'Nouveau' },
    { value: 'OPEN', label: 'Ouvert' },
    { value: 'ASSIGNED', label: 'Assigné' },
    { value: 'IN_PROGRESS', label: 'En cours' },
    { value: 'PENDING', label: 'En attente' },
    { value: 'ESCALATED_MANUAL', label: 'Escaladé (manuel)' },
    { value: 'RESOLVED', label: 'Résolu' },
    { value: 'CLOSED', label: 'Fermé' },
    { value: 'CANCELLED', label: 'Annulé' }
  ];

  priorityOptions = [
    { value: 'LOW', label: 'Basse' },
    { value: 'MEDIUM', label: 'Moyenne' },
    { value: 'HIGH', label: 'Haute' },
    { value: 'CRITICAL', label: 'Critique' },
    { value: 'SUPER_CRITICAL', label: 'Super Critique' }
  ];

  isClient = false;
  isManager = false;

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.isClient = this.authService.isClient();
    this.isManager = this.authService.isManager();
    if (this.isClient) {
      this.displayedColumns = ['reference', 'title', 'status', 'priority', 'createdAt', 'sla', 'actions'];
    }
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const hasExplicitParams = params.keys.length > 0;
      const stored = this.isManager && !hasExplicitParams ? this.readStoredManagerFilters() : null;
      this.searchQuery = params.get('search') || stored?.searchQuery || '';
      this.filterStatus = params.get('status') || stored?.filterStatus || '';
      this.filterPriority = params.get('priority') || stored?.filterPriority || '';
      this.focusFilter = params.get('focus') || stored?.focusFilter || '';
      this.currentPage = Number(params.get('page') || stored?.currentPage || 0);
      this.pageSize = Number(params.get('size') || stored?.pageSize || 10);
      this.sortField = params.get('sortField') || stored?.sortField || 'createdAt';
      this.sortDirection = params.get('sortDirection') || stored?.sortDirection || 'desc';
      this.loadTickets();
    });
  }

  loadTickets(): void {
    this.loading = true;

    const params: any = {
      page: this.currentPage,
      size: this.pageSize,
      sort: `${this.sortField},${this.sortDirection}`
    };

    if (this.searchQuery) params.search = this.searchQuery;
    if (this.filterStatus) params.status = this.filterStatus;
    if (this.filterPriority) params.priority = this.filterPriority;
    this.applyManagerFocusParams(params);

    this.ticketService.getTickets(params).subscribe({
      next: (page) => {
        this.rawTickets = page.content;
        this.dataSource.data = this.applyFocusFilter(page.content);
        this.totalElements = page.totalElements;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading tickets:', error);
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.updateRouteFilters();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.filterStatus = '';
    this.filterPriority = '';
    this.focusFilter = '';
    this.currentPage = 0;
    this.updateRouteFilters();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updateRouteFilters();
  }

  onSortChange(sort: Sort): void {
    this.sortField = sort.active || 'createdAt';
    this.sortDirection = sort.direction || 'desc';
    this.updateRouteFilters();
  }

  getStatusLabel(status: TicketStatus): string {
    if (status === 'ESCALATED_SLA') {
      return 'Escalade active';
    }
    return this.statusOptions.find(s => s.value === status)?.label || status;
  }

  getEscalationStepLabel(level?: number): string {
    if (!level || level < 1) return '';
    if (level === 1) return 'Escalade L1';
    if (level === 2) return 'Escalade L2';
    return 'Escalade L3';
  }

  getPriorityLabel(priority: TicketPriority): string {
    return this.priorityOptions.find(p => p.value === priority)?.label || priority;
  }

  getSlaProgress(ticket: Ticket): number {
    if (typeof ticket.slaConsumedPercent === 'number') {
      return Math.max(0, Math.min(100, Math.round(ticket.slaConsumedPercent)));
    }

    switch (ticket.slaState) {
      case 'ON_TRACK':
        return 35;
      case 'AT_RISK':
        return 75;
      case 'BREACHED':
        return 100;
      case 'PAUSED':
        return 10;
      default:
        return 45;
    }
  }

  getInitials(firstName?: string, lastName?: string): string {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  }

  canAct(ticket: Ticket, action: string): boolean {
    return this.authService.canActOnTicket(ticket, action);
  }

  getFocusLabel(): string {
    if (this.focusFilter === 'waiting-client') return 'Vue manager · En attente client';
    if (this.focusFilter === 'waiting-third-party') return 'Vue manager · En attente tiers';
    if (this.focusFilter === 'customer-replied') return 'Vue manager · Reponse client recue';
    if (this.focusFilter === 'resolution-rejected') return 'Vue manager · Resolution refusee';
    if (this.focusFilter === 'blocked') return 'Vue manager · Tickets bloques';
    switch (this.focusFilter) {
      case 'unassigned':
        return 'Vue manager · Non assignes';
      case 'breached':
        return 'Vue manager · SLA depasses';
      case 'at-risk':
        return 'Vue manager · SLA a risque';
      case 'escalated':
        return 'Vue manager · Escalades';
      default:
        return '';
    }
  }

  setFocusFilter(value: string): void {
    this.focusFilter = value;
    this.applyFilters();
  }

  getWaitingOnLabel(waitingOn?: WaitingOn): string {
    switch (waitingOn) {
      case 'CLIENT':
        return 'Attente client';
      case 'THIRD_PARTY':
        return 'Attente tiers';
      case 'MANAGER':
        return 'Attente manager';
      case 'AGENT':
        return 'Attente agent';
      default:
        return 'Suivi';
    }
  }

  getNextActionLabel(ticket: Ticket): string {
    return ticket.nextExpectedAction
      || ticket.pendingReason
      || ticket.managerReviewReason
      || ticket.resolutionRejectedReason
      || 'Suivi manager';
  }

  assignTicket(ticket: Ticket): void {
    if (!ticket?.id || !this.canAct(ticket, 'assign')) {
      return;
    }

    const dialogRef = this.dialog.open(AssignDialogComponent, {
      width: '720px',
      disableClose: false,
      data: {
        currentAgentId: ticket.assignedTo?.id ?? ticket.assignedAgent?.id ?? null,
        ticketId: ticket.id
      } as AssignDialogData
    });

    dialogRef.afterClosed().subscribe((result?: AssignDialogResult) => {
      if (!result?.agentId) {
        return;
      }

      this.ticketService.assignTicket(ticket.id, result.agentId, result.source).subscribe({
        next: (updatedTicket) => {
          this.replaceTicketInTable(updatedTicket);
          this.snackBar.open(
            result.source === 'AI_RECOMMENDATION'
              ? 'Recommandation IA validée et ticket assigné'
              : 'Ticket assigné avec succès',
            'Fermer',
            { duration: 3000 }
          );
        },
        error: (error) => {
          console.error('Error assigning ticket from list:', error);
          const errorMsg = error?.error?.message || 'Erreur lors de l\'assignation';
          this.snackBar.open(`Impossible d'assigner le ticket: ${errorMsg}`, 'Fermer', { duration: 4000 });
        }
      });
    });
  }

  takeCharge(ticket: Ticket): void {
    if (!ticket?.id || !this.canAct(ticket, 'take-charge')) {
      return;
    }

    this.ticketService.takeCharge(ticket.id).subscribe({
      next: (updatedTicket) => {
        this.replaceTicketInTable(updatedTicket);
        this.snackBar.open('Ticket pris en charge avec succès', 'Fermer', { duration: 3000 });
      },
      error: (error) => {
        console.error('Error taking charge from list:', error);
        const errorMsg = error?.error?.message || 'Erreur inconnue';
        this.snackBar.open(`Impossible de prendre le ticket: ${errorMsg}`, 'Fermer', { duration: 4000 });
      }
    });
  }

  private updateRouteFilters(): void {
    this.storeManagerFilters();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: this.searchQuery || null,
        status: this.filterStatus || null,
        priority: this.filterPriority || null,
        focus: this.focusFilter || null,
        page: this.currentPage || null,
        size: this.pageSize !== 10 ? this.pageSize : null,
        sortField: this.sortField !== 'createdAt' ? this.sortField : null,
        sortDirection: this.sortDirection !== 'desc' ? this.sortDirection : null
      },
      queryParamsHandling: ''
    });
  }

  private storeManagerFilters(): void {
    if (!this.isManager) {
      return;
    }
    localStorage.setItem(this.managerFilterStorageKey, JSON.stringify({
      searchQuery: this.searchQuery,
      filterStatus: this.filterStatus,
      filterPriority: this.filterPriority,
      focusFilter: this.focusFilter,
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      sortField: this.sortField,
      sortDirection: this.sortDirection
    }));
  }

  private readStoredManagerFilters(): any | null {
    try {
      const raw = localStorage.getItem(this.managerFilterStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private applyFocusFilter(tickets: Ticket[]): Ticket[] {
    if (!this.focusFilter) {
      return tickets;
    }

    return tickets.filter(ticket => {
      switch (this.focusFilter) {
        case 'unassigned':
          return !ticket.assignedTo && !ticket.assignedAgent && !ticket.assignee;
        case 'breached':
          return this.getTicketSlaState(ticket) === 'BREACHED';
        case 'at-risk':
          return this.getTicketSlaState(ticket) === 'AT_RISK';
        case 'escalated':
          return ticket.status === 'ESCALATED_SLA'
            || ticket.status === 'ESCALATED_MANUAL'
            || (ticket.escalationLevel ?? 0) > 0;
        case 'waiting-client':
          return ticket.status === 'PENDING' && ticket.waitingOn === 'CLIENT';
        case 'waiting-third-party':
          return ticket.status === 'PENDING' && ticket.waitingOn === 'THIRD_PARTY';
        case 'customer-replied':
          return !!ticket.lastCustomerResponseAt && ticket.status === 'IN_PROGRESS';
        case 'resolution-rejected':
          return !!ticket.resolutionRejectedReason && ticket.status === 'IN_PROGRESS';
        case 'blocked':
          return ticket.status === 'PENDING';
        default:
          return true;
      }
    });
  }

  private getTicketSlaState(ticket: Ticket): 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'PAUSED' {
    if ((ticket.escalationLevel ?? 0) >= 2 || ticket.legacyEscalated || ticket.slaBreached) {
      return 'BREACHED';
    }
    return (ticket.slaPhase || ticket.slaState || 'ON_TRACK') as 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'PAUSED';
  }

  changeStatus(ticket: Ticket, status: TicketStatus): void {
    if (!ticket?.id || !this.canAct(ticket, 'change-status') || ticket.status === status) {
      return;
    }

    this.ticketService.updateTicketStatus(ticket.id, status).subscribe({
      next: (updatedTicket) => {
        this.replaceTicketInTable(updatedTicket);
        this.snackBar.open(`Statut mis à jour: ${this.getStatusLabel(status)}`, 'Fermer', { duration: 3000 });
      },
      error: (error) => {
        console.error('Error updating status from list:', error);
        const errorMsg = error?.error?.message || 'Erreur lors du changement de statut';
        this.snackBar.open(`Impossible de changer le statut: ${errorMsg}`, 'Fermer', { duration: 4000 });
      }
    });
  }

  private replaceTicketInTable(updatedTicket: Ticket): void {
    const updatedData = this.dataSource.data.map(ticket =>
      ticket.id === updatedTicket.id ? updatedTicket : ticket
    );
    this.dataSource.data = updatedData;
  }

  getAvailableStatusOptions(ticket: Ticket): { value: TicketStatus; label: string }[] {
    return this.statusOptions.filter(option =>
      option.value !== ticket.status && option.value !== 'ESCALATED_SLA');
  }

  isSelected(ticket: Ticket): boolean {
    return !!ticket.id && this.selectedTicketIds.has(ticket.id);
  }

  toggleTicketSelection(ticket: Ticket): void {
    if (!ticket.id) return;
    if (this.selectedTicketIds.has(ticket.id)) {
      this.selectedTicketIds.delete(ticket.id);
    } else {
      this.selectedTicketIds.add(ticket.id);
    }
    this.selectedTicketIds = new Set(this.selectedTicketIds);
  }

  areAllVisibleSelected(): boolean {
    const visibleIds = this.dataSource.data.map(ticket => ticket.id).filter((id): id is number => typeof id === 'number');
    return visibleIds.length > 0 && visibleIds.every(id => this.selectedTicketIds.has(id));
  }

  toggleSelectAllVisible(): void {
    const visibleIds = this.dataSource.data.map(ticket => ticket.id).filter((id): id is number => typeof id === 'number');
    if (this.areAllVisibleSelected()) {
      visibleIds.forEach(id => this.selectedTicketIds.delete(id));
    } else {
      visibleIds.forEach(id => this.selectedTicketIds.add(id));
    }
    this.selectedTicketIds = new Set(this.selectedTicketIds);
  }

  bulkAssignSelected(): void {
    const tickets = this.getSelectedTickets().filter(ticket => this.canAct(ticket, 'assign'));
    if (tickets.length === 0) return;

    const seedTicket = tickets[0];
    const dialogRef = this.dialog.open(AssignDialogComponent, {
      width: '720px',
      disableClose: false,
      data: {
        currentAgentId: seedTicket.assignedTo?.id ?? seedTicket.assignedAgent?.id ?? null,
        ticketId: seedTicket.id
      } as AssignDialogData
    });

    dialogRef.afterClosed().subscribe((result?: AssignDialogResult) => {
      if (!result?.agentId) return;
      this.runBulkAction(
        tickets,
        ticket => firstValueFrom(this.ticketService.assignTicket(ticket.id!, result.agentId, result.source)),
        'Selection assignee avec succes'
      );
    });
  }

  bulkManagerReviewSelected(): void {
    this.openBulkWorkflowDialog('Revue manager groupee', 'Lancer la revue', result =>
      this.runBulkAction(
        this.getSelectedTickets(),
        ticket => firstValueFrom(this.ticketService.requestManagerReview(ticket.id!, result.reason)),
        'Revue manager envoyee pour la selection'
      )
    );
  }

  bulkExtendSlaSelected(): void {
    const tickets = this.getSelectedTickets();
    if (tickets.length === 0) return;
    const dialogRef = this.dialog.open<TicketWorkflowActionDialogComponent, TicketWorkflowActionDialogData, TicketWorkflowActionDialogResult>(
      TicketWorkflowActionDialogComponent,
      {
        width: '620px',
        maxWidth: '95vw',
        data: {
          title: 'Prolongation SLA groupee',
          subtitle: `${tickets.length} ticket(s) recevront la meme extension SLA.`,
          submitLabel: 'Prolonger',
          reasonLabel: 'Justification',
          minutesEnabled: true,
          defaultMinutes: 60,
          requireReason: true
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.reason || !result.minutes) return;
      this.runBulkAction(
        tickets,
        ticket => firstValueFrom(this.ticketService.extendSla(ticket.id!, result.minutes!, result.reason)),
        'SLA prolonge pour la selection'
      );
    });
  }

  bulkWaitSelected(): void {
    const tickets = this.getSelectedTickets();
    if (tickets.length === 0) return;
    const dialogRef = this.dialog.open<TicketWorkflowActionDialogComponent, TicketWorkflowActionDialogData, TicketWorkflowActionDialogResult>(
      TicketWorkflowActionDialogComponent,
      {
        width: '620px',
        maxWidth: '95vw',
        data: {
          title: 'Mettre plusieurs tickets en attente',
          subtitle: `${tickets.length} ticket(s) passeront en attente avec le meme motif.`,
          submitLabel: 'Mettre en attente',
          reasonLabel: 'Motif d attente',
          waitingOnEnabled: true,
          defaultWaitingOn: 'CLIENT',
          requireReason: true
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.reason || !result.waitingOn) return;
      this.runBulkAction(
        tickets,
        ticket => firstValueFrom(this.ticketService.waitForCustomer(ticket.id!, result.waitingOn!, result.reason)),
        'Selection mise en attente'
      );
    });
  }

  private getSelectedTickets(): Ticket[] {
    return this.dataSource.data.filter(ticket => !!ticket.id && this.selectedTicketIds.has(ticket.id));
  }

  private async runBulkAction(tickets: Ticket[], requestFactory: (ticket: Ticket) => Promise<any>, successMessage: string): Promise<void> {
    if (tickets.length === 0) return;
    try {
      await Promise.all(tickets.map(ticket => requestFactory(ticket)));
      this.selectedTicketIds = new Set<number>();
      this.snackBar.open(successMessage, 'Fermer', { duration: 3500 });
      this.loadTickets();
    } catch (error: any) {
      console.error('Bulk ticket action failed:', error);
      const message = error?.error?.message || 'Une action groupee a echoue';
      this.snackBar.open(message, 'Fermer', { duration: 4000 });
    }
  }

  private openBulkWorkflowDialog(title: string, submitLabel: string, onConfirm: (result: TicketWorkflowActionDialogResult) => void): void {
    const tickets = this.getSelectedTickets();
    if (tickets.length === 0) return;
    const dialogRef = this.dialog.open<TicketWorkflowActionDialogComponent, TicketWorkflowActionDialogData, TicketWorkflowActionDialogResult>(
      TicketWorkflowActionDialogComponent,
      {
        width: '620px',
        maxWidth: '95vw',
        data: {
          title,
          subtitle: `${tickets.length} ticket(s) seront traites avec le meme motif.`,
          submitLabel,
          reasonLabel: 'Motif commun',
          requireReason: true
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.reason) return;
      onConfirm(result);
    });
  }

  private applyManagerFocusParams(params: any): void {
    switch (this.focusFilter) {
      case 'unassigned':
        params.unassigned = true;
        params.actionBucket = 'unassigned';
        break;
      case 'breached':
        params.slaState = 'BREACHED';
        params.actionBucket = 'breached';
        break;
      case 'at-risk':
        params.slaState = 'AT_RISK';
        params.actionBucket = 'at-risk';
        break;
      case 'escalated':
        params.actionBucket = 'breached';
        break;
      case 'waiting-client':
      case 'waiting-third-party':
      case 'customer-replied':
      case 'resolution-rejected':
      case 'blocked':
        params.actionBucket = this.focusFilter;
        break;
      default:
        break;
    }
  }
}
