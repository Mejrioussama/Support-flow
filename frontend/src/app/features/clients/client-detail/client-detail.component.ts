import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ClientService, TicketService } from '@core/services';
import { Client, Ticket, TicketStatus, TicketPriority } from '@core/models';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="client-detail">
      @if (loading) {
        <div class="loading">
          <mat-spinner diameter="50"></mat-spinner>
        </div>
      } @else if (client) {
        <!-- Header -->
        <header class="page-header">
          <div class="breadcrumb">
            <a routerLink="/clients">Clients</a>
            <mat-icon>chevron_right</mat-icon>
            <span>{{ client.name }}</span>
          </div>
          <div class="header-actions">
            <button mat-stroked-button [routerLink]="['/clients', client.id, 'edit']" class="glass-btn">
              <mat-icon>edit</mat-icon>
              Modifier
            </button>
            <button mat-raised-button color="primary" [routerLink]="['/tickets/new']" 
                    [queryParams]="{clientId: client.id}" class="neon-btn">
              <mat-icon>add</mat-icon>
              Nouveau Ticket
            </button>
          </div>
        </header>
        
        <div class="content-grid">
          <!-- Main Content -->
          <div class="main-content">
            <mat-card class="client-info-card glass-panel">
              <mat-card-header>
                <div class="client-avatar">
                  {{ getInitials(client.name) }}
                </div>
                <div class="client-header-info">
                  <mat-card-title class="neon-text">{{ client.name }}</mat-card-title>
                  <span class="status-indicator" [class.active]="client.active">
                    {{ client.active ? 'Actif' : 'Inactif' }}
                  </span>
                </div>
              </mat-card-header>
              <mat-card-content>
                <div class="info-grid">
                  <div class="info-item">
                    <mat-icon>email</mat-icon>
                    <div>
                      <span class="label">Email</span>
                      <a href="mailto:{{ client.email }}">{{ client.email }}</a>
                    </div>
                  </div>
                  @if (client.phone) {
                    <div class="info-item">
                      <mat-icon>phone</mat-icon>
                      <div>
                        <span class="label">Téléphone</span>
                        <span>{{ client.phone }}</span>
                      </div>
                    </div>
                  }
                  @if (client.address) {
                    <div class="info-item">
                      <mat-icon>location_on</mat-icon>
                      <div>
                        <span class="label">Adresse</span>
                        <span>{{ client.address }}</span>
                      </div>
                    </div>
                  }
                  @if (client.siret) {
                    <div class="info-item">
                      <mat-icon>badge</mat-icon>
                      <div>
                        <span class="label">SIRET</span>
                        <span>{{ client.siret }}</span>
                      </div>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>
            
            <!-- Tickets Tab -->
            <mat-card class="tickets-card glass-panel">
              <mat-card-header>
                <mat-card-title>Tickets ({{ tickets.length }})</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                @if (tickets.length > 0) {
                  <table mat-table [dataSource]="tickets" class="transparent-table">
                    <ng-container matColumnDef="reference">
                      <th mat-header-cell *matHeaderCellDef>Référence</th>
                      <td mat-cell *matCellDef="let ticket">
                        <a [routerLink]="['/tickets', ticket.id]" class="ticket-link">
                          {{ ticket.reference }}
                        </a>
                      </td>
                    </ng-container>
                    
                    <ng-container matColumnDef="title">
                      <th mat-header-cell *matHeaderCellDef>Titre</th>
                      <td mat-cell *matCellDef="let ticket">{{ ticket.title }}</td>
                    </ng-container>
                    
                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef>Statut</th>
                      <td mat-cell *matCellDef="let ticket">
                        <span class="status-badge" [class]="'status-' + ticket.status.toLowerCase()">
                          {{ getStatusLabel(ticket.status) }}
                        </span>
                      </td>
                    </ng-container>
                    
                    <ng-container matColumnDef="priority">
                      <th mat-header-cell *matHeaderCellDef>Priorité</th>
                      <td mat-cell *matCellDef="let ticket">
                        <span class="priority-badge" [class]="'priority-' + ticket.priority.toLowerCase()">
                          {{ getPriorityLabel(ticket.priority) }}
                        </span>
                      </td>
                    </ng-container>
                    
                    <ng-container matColumnDef="createdAt">
                      <th mat-header-cell *matHeaderCellDef>Créé le</th>
                      <td mat-cell *matCellDef="let ticket">
                        {{ ticket.createdAt | date:'dd/MM/yyyy' }}
                      </td>
                    </ng-container>
                    
                    <tr mat-header-row *matHeaderRowDef="ticketColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: ticketColumns;" class="interactive-row"></tr>
                  </table>
                } @else {
                  <div class="empty-state">
                    <mat-icon>confirmation_number</mat-icon>
                    <p>Aucun ticket pour ce client</p>
                  </div>
                }
              </mat-card-content>
            </mat-card>
          </div>
          
          <!-- Sidebar -->
          <aside class="detail-sidebar">
            <mat-card class="contract-card glass-panel">
              <mat-card-header>
                <mat-card-title>Contrat</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="contract-type">
                  <span class="contract-badge large" [class]="'contract-' + client.contractType?.toLowerCase()">
                    {{ getContractLabel(client.contractType) }}
                  </span>
                </div>
                
                @if (client.contractStartDate || client.contractEndDate) {
                  <div class="contract-dates">
                    @if (client.contractStartDate) {
                      <div class="date-item">
                        <span class="label">Début</span>
                        <span>{{ client.contractStartDate | date:'dd/MM/yyyy' }}</span>
                      </div>
                    }
                    @if (client.contractEndDate) {
                      <div class="date-item">
                        <span class="label">Fin</span>
                        <span>{{ client.contractEndDate | date:'dd/MM/yyyy' }}</span>
                      </div>
                    }
                  </div>
                }
              </mat-card-content>
            </mat-card>
            
            <mat-card class="stats-card glass-panel">
              <mat-card-header>
                <mat-card-title>Statistiques</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="stat-item">
                  <span class="stat-value">{{ tickets.length }}</span>
                  <span class="stat-label">Tickets total</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ openTicketsCount }}</span>
                  <span class="stat-label">Tickets ouverts</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ resolvedTicketsCount }}</span>
                  <span class="stat-label">Tickets résolus</span>
                </div>
              </mat-card-content>
            </mat-card>
            
            <mat-card class="dates-card glass-panel">
              <mat-card-header>
                <mat-card-title>Dates</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="info-row">
                  <span class="label">Créé le</span>
                  <span>{{ client.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
                <mat-divider class="glass-divider"></mat-divider>
                <div class="info-row">
                  <span class="label">Mis à jour</span>
                  <span>{{ client.updatedAt | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
              </mat-card-content>
            </mat-card>
          </aside>
        </div>
      } @else {
        <div class="not-found">
          <mat-icon>error_outline</mat-icon>
          <h2 class="neon-title">Client non trouvé</h2>
          <button mat-raised-button color="primary" routerLink="/clients" class="neon-btn">
            Retour à la liste
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .client-detail {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .loading, .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 100px;
      
      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--text-muted);
        margin-bottom: 16px;
      }
    }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      
      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-muted);
        font-weight: 500;
        
        a {
          color: var(--sf-blue);
          text-decoration: none;
          transition: color 0.3s ease;
          &:hover { color: var(--sf-cyan); }
        }
      }
      
      .header-actions {
        display: flex;
        gap: 12px;
      }
    }
    
    .content-grid {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 24px;
      
      @media (max-width: 1024px) {
        grid-template-columns: 1fr;
      }
    }
    
    .client-info-card {
      margin-bottom: 24px;
      
      mat-card-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
        
        .client-avatar {
          width: 64px;
          height: 64px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--sf-blue) 0%, var(--sf-purple) 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        
        .client-header-info {
          mat-card-title {
            margin-bottom: 4px;
            font-weight: 700;
          }
        }
      }
      
      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 24px;
        
        .info-item {
          display: flex;
          gap: 12px;
          
          mat-icon {
            color: var(--text-muted);
          }
          
          .label {
            display: block;
            font-size: 12px;
            color: var(--text-muted);
            margin-bottom: 2px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          a {
            color: var(--sf-blue);
            text-decoration: none;
            font-weight: 500;
            &:hover { color: var(--sf-cyan); }
          }
          
          span { color: var(--text-main); font-weight: 500; }
        }
      }
    }
    
    .tickets-card {
      .ticket-link {
        color: var(--sf-blue);
        text-decoration: none;
        font-weight: 500;
        &:hover { color: var(--sf-cyan); }
      }
      
      .empty-state {
        text-align: center;
        padding: 48px;
        color: var(--text-muted);
        
        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          margin-bottom: 8px;
          opacity: 0.5;
        }
      }
    }
    
    .detail-sidebar {
      mat-card {
        margin-bottom: 24px;
      }
      
      .contract-card {
        .contract-type {
          text-align: center;
          margin-bottom: 16px;
          padding: 16px 0;
        }
        
        .contract-dates {
          display: flex;
          flex-direction: column;
          gap: 12px;
          
          .date-item {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            
            .label { color: var(--text-muted); }
            span { color: var(--text-main); font-weight: 500; }
          }
        }
      }
      
      .stats-card {
        mat-card-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          
          .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: var(--sf-blue);
          }
          
          .stat-label {
            color: var(--text-muted);
            font-size: 13px;
          }
        }
      }
      
      .dates-card {
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          font-size: 13px;
          
          .label { color: var(--text-muted); }
          span { color: var(--text-main); font-weight: 500; }
        }
      }
    }
    
    .status-indicator {
      display: inline-flex;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
      color: var(--sf-red);
      
      &::before {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 8px;
        background: var(--sf-red);
        box-shadow: 0 0 8px var(--sf-red);
      }
      
      &.active {
        color: var(--sf-green);
        &::before {
          background: var(--sf-green);
          box-shadow: 0 0 10px var(--sf-green);
        }
      }
    }
    
    .contract-badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      background: var(--glass-highlight);
      border: 1px solid var(--glass-border);
      
      &.large {
        padding: 10px 24px;
        font-size: 14px;
        border-radius: 24px;
      }
      
      &.contract-basic { color: #9ca3af; }
      &.contract-standard { color: var(--sf-blue); border-color: rgba(59, 130, 246, 0.3); }
      &.contract-premium { color: var(--sf-yellow); border-color: rgba(245, 158, 11, 0.3); background: rgba(245, 158, 11, 0.08); }
      &.contract-enterprise { color: var(--sf-purple); border-color: rgba(139, 92, 246, 0.3); background: rgba(139, 92, 246, 0.08); }
    }
  `]
})
export class ClientDetailComponent implements OnInit {
  client: Client | null = null;
  tickets: Ticket[] = [];
  loading = true;
  ticketColumns = ['reference', 'title', 'status', 'priority', 'createdAt'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientService: ClientService,
    private ticketService: TicketService
  ) {}

  ngOnInit(): void {
    const clientId = this.route.snapshot.paramMap.get('id');
    if (clientId) {
      this.loadClient(+clientId);
    }
  }

  async loadClient(id: number): Promise<void> {
    try {
      const [client, ticketsPage] = await Promise.all([
        this.clientService.getClient(id).toPromise(),
        this.ticketService.getTickets({ clientId: id, page: 0, size: 100 }).toPromise()
      ]);
      
      this.client = client || null;
      this.tickets = ticketsPage?.content || [];
      this.loading = false;
    } catch (error) {
      console.error('Error loading client:', error);
      this.loading = false;
    }
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase();
  }

  getContractLabel(type?: string): string {
    const labels: Record<string, string> = {
      'BASIC': 'Basic',
      'STANDARD': 'Standard',
      'PREMIUM': 'Premium',
      'ENTERPRISE': 'Enterprise'
    };
    return labels[type || ''] || type || '-';
  }

  getStatusLabel(status: TicketStatus): string {
    const labels: Record<TicketStatus, string> = {
      'NEW': 'Nouveau',
      'OPEN': 'Ouvert',
      'ASSIGNED': 'Assigné',
      'IN_PROGRESS': 'En cours',
      'PENDING': 'En attente',
      'ESCALATED_MANUAL': 'Escaladé (manuel)',
      'ESCALATED_SLA': 'Escalade active',
      'RESOLVED': 'Résolu',
      'CLOSED': 'Fermé',
      'CANCELLED': 'Annulé'
    };
    return labels[status] || status;
  }

  getPriorityLabel(priority: TicketPriority): string {
    const labels: Record<TicketPriority, string> = {
      'LOW': 'Basse',
      'MEDIUM': 'Moyenne',
      'HIGH': 'Haute',
      'CRITICAL': 'Critique',
      'SUPER_CRITICAL': 'Super Critique'
    };
    return labels[priority] || priority;
  }

  get openTicketsCount(): number {
    return this.tickets.filter(t => !['RESOLVED', 'CLOSED'].includes(t.status)).length;
  }

  get resolvedTicketsCount(): number {
    return this.tickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
  }
}
