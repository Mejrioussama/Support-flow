import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import * as THREE from 'three';

import { DashboardService, TicketService, AuthService } from '@core/services';
import { DashboardStats, Ticket, TicketStatus, TicketPriority, AgentAvailability, AgentPerformance } from '@core/models';
import { SlaIndicatorComponent, PageHeaderComponent, StatCardComponent, StatusBadgeComponent, PriorityBadgeComponent, EmptyStateComponent, SkeletonComponent } from '@shared/components';
import { AssignDialogComponent, AssignDialogData, AssignDialogResult } from '../tickets/assign-dialog/assign-dialog.component';

interface SlaRingData {
  name: string;
  value: number;
  displayValue: string;
  unit: string;
  color: string;
  glowColor: string;
  offset: number;
  innerOffset: number;
  sublabel: string;
}

interface OrbitalParticle {
  mesh: THREE.Mesh;
  angle: number;
  radius: number;
  speed: number;
  yOffset: number;
}

interface ManagerAgentLoad {
  agentId: number;
  agentName: string;
  status: string;
  statusReason?: string;
  inShift: boolean;
  currentTickets: number;
  maxTickets: number;
  loadPercent: number;
  averageResolutionLabel?: string;
  satisfactionLabel?: string;
  slaLabel?: string;
}

interface ManagerAgentPortfolio {
  key: string;
  agentId?: number;
  agentName: string;
  loadPercent: number;
  currentTickets: number;
  maxTickets: number;
  criticalTickets: number;
  breachedTickets: number;
  atRiskTickets: number;
  tickets: Ticket[];
  status?: string;
  inShift?: boolean;
  statusReason?: string;
}

interface ManagerDashboardAlert {
  key: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  ticket?: Ticket;
  portfolio?: ManagerAgentPortfolio;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    NgChartsModule,
    SlaIndicatorComponent,
    PageHeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    PriorityBadgeComponent,
    EmptyStateComponent,
    SkeletonComponent
  ],
  template: `
    <div class="dashboard-wrapper">
      <!-- Glowing Grid Background -->
      <div class="glow-grid-bg"></div>
      <!-- Animated Scan-line Overlay -->
      <div class="scanline-overlay"></div>
      <!-- 3D Background Canvas -->
      <canvas #bgCanvas class="bg-canvas"></canvas>

      <!-- Floating Particles Overlay -->
      <div class="particles-overlay">
        <div class="particle" *ngFor="let p of particles" [style.left]="p.x" [style.top]="p.y" [style.animationDuration]="p.duration" [style.animationDelay]="p.delay" [style.width]="p.size" [style.height]="p.size"></div>
      </div>

      <div class="dashboard sf-animate-fade-in">
        <!-- Hero Header with 3D Robot -->
        <div class="hero-header">
          <!-- HUD Scanner Lines -->
          <div class="hud-scanner">
            <div class="hud-scan-line"></div>
            <div class="hud-scan-line hud-scan-line--2"></div>
          </div>
          <!-- Corner HUD Brackets -->
          <div class="hud-corner hud-corner--tl"></div>
          <div class="hud-corner hud-corner--tr"></div>
          <div class="hud-corner hud-corner--bl"></div>
          <div class="hud-corner hud-corner--br"></div>

          <div class="hero-content">
            <div class="hero-text-block">
              <div class="hero-kicker">
                <span class="kicker-dot"></span>
                <span>ANALYTICS DASHBOARD</span>
                <span class="kicker-line"></span>
              </div>
              <h1 class="hero-title">
                Tableau de bord
                <span class="hero-title-accent">SupportFlow</span>
              </h1>
              <p class="hero-subtitle">Centre de commande — Vue d'ensemble temps réel de votre activité support</p>
              <div class="hero-actions">
                <button mat-button class="hero-btn hero-btn--ghost" (click)="exportDashboard()">
                  <mat-icon>download</mat-icon> Exporter
                </button>
                <button mat-raised-button class="hero-btn hero-btn--primary" routerLink="/tickets/new">
                  <mat-icon>add</mat-icon> Nouveau Ticket
                </button>
              </div>
            </div>
            <div class="hero-3d-scene">
              <div class="orbital-ring orbital-ring-1"></div>
              <div class="orbital-ring orbital-ring-2"></div>
              <div class="orbital-ring orbital-ring-3"></div>
              <div class="orbital-ring orbital-ring-4"></div>
              <canvas #robotCanvas class="robot-canvas"></canvas>
              <div class="robot-ground-glow"></div>
              <div class="hud-tag hud-tag-1">
                <span class="hud-tag-dot"></span>
                <span>UNIT-AI7</span>
              </div>
              <div class="hud-tag hud-tag-2">
                <span class="hud-tag-dot hud-tag-dot--green"></span>
                <span>ONLINE</span>
              </div>
            </div>
          </div>
          <div class="hero-metrics-strip">
            <div class="metric-pill" matTooltip="Taux de conformité SLA">
              <mat-icon>verified</mat-icon>
              <span>SLA: {{ stats?.slaComplianceRate ? (stats!.slaComplianceRate | number:'1.0-0') : '--' }}%</span>
            </div>
            <div class="metric-pill" matTooltip="Temps moyen de résolution">
              <mat-icon>schedule</mat-icon>
              <span>TMR: {{ stats?.avgResolutionTime ? (stats!.avgResolutionTime | number:'1.0-0') + 'h' : '--' }}</span>
            </div>
            <div class="metric-pill" matTooltip="Tickets en cours">
              <mat-icon>engineering</mat-icon>
              <span>En cours: {{ stats?.inProgressTickets || 0 }}</span>
            </div>
            <div class="metric-pill metric-pill--live" matTooltip="Tickets résolus aujourd'hui">
              <span class="live-dot"></span>
              <span>+{{ stats?.resolvedToday || 0 }} résolus</span>
            </div>
          </div>
        </div>

        @if (loading) {
          <div class="stats-grid">
            @for (i of [1,2,3,4]; track i) {
              <app-skeleton height="140px" borderRadius="24px"></app-skeleton>
            }
          </div>
          <div class="charts-grid" style="margin-top: 24px;">
            <app-skeleton height="400px" borderRadius="24px"></app-skeleton>
            <app-skeleton height="400px" borderRadius="24px"></app-skeleton>
          </div>
        } @else {
          <!-- Stats Cards with parallax tilt + animated counters -->
          <div class="stats-grid">
            <div class="holo-card-wrap sf-animate-slide-up sf-stagger-1"
                 (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
              <div class="holo-border holo-blue"></div>
              <div class="card-scan-line" style="animation-delay:0s"></div>
              <app-stat-card
                label="Total Tickets"
                [value]="displayStats.totalTickets"
                icon="confirmation_number"
                color="blue">
              </app-stat-card>
            </div>

            <div class="holo-card-wrap sf-animate-slide-up sf-stagger-2"
                 (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
              <div class="holo-border holo-yellow"></div>
              <div class="card-scan-line" style="animation-delay:1.8s"></div>
              <app-stat-card
                label="Tickets Ouverts"
                [value]="displayStats.openTickets"
                icon="pending"
                color="yellow">
              </app-stat-card>
            </div>

            <div class="holo-card-wrap sf-animate-slide-up sf-stagger-3"
                 (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
              <div class="holo-border holo-green"></div>
              <div class="card-scan-line" style="animation-delay:3.6s"></div>
              <app-stat-card
                label="Tickets Résolus"
                [value]="displayStats.resolvedTickets"
                icon="check_circle"
                color="green">
              </app-stat-card>
            </div>

            <div class="holo-card-wrap sf-animate-slide-up sf-stagger-4"
                 (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
              <div class="holo-border holo-red"></div>
              <div class="card-scan-line" style="animation-delay:5.4s"></div>
              <app-stat-card
                label="Urgents/Critiques"
                [value]="displayStats.urgentTickets"
                icon="bolt"
                color="red">
              </app-stat-card>
            </div>
          </div>

          @if (isManagerView) {
            <div class="manager-grid">
              <mat-card class="manager-panel glass-panel holo-card-wrap"
                        (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
                <div class="holo-border holo-red"></div>
                <mat-card-header>
                  <div class="chart-header-row" style="width:100%">
                    <div class="chart-title-group">
                      <mat-icon class="chart-icon">assignment_late</mat-icon>
                      <mat-card-title>File d'action manager</mat-card-title>
                    </div>
                    <button mat-button class="glass-btn see-all-btn" [routerLink]="['/tickets']" [queryParams]="{ sortField: 'updatedAt', sortDirection: 'desc' }">
                      Tout le backlog <mat-icon>arrow_forward</mat-icon>
                    </button>
                  </div>
                </mat-card-header>
                <mat-card-content>
                  <div class="manager-kpis">
                    <a class="manager-kpi manager-kpi--warning manager-kpi--link" [routerLink]="['/tickets']" [queryParams]="{ focus: 'unassigned', sortField: 'createdAt', sortDirection: 'desc' }">
                      <span class="manager-kpi__value">{{ unassignedManagerTickets.length }}</span>
                      <span class="manager-kpi__label">Non assignes</span>
                    </a>
                    <a class="manager-kpi manager-kpi--danger manager-kpi--link" [routerLink]="['/tickets']" [queryParams]="{ focus: 'breached', sortField: 'updatedAt', sortDirection: 'desc' }">
                      <span class="manager-kpi__value">{{ breachedManagerTickets.length }}</span>
                      <span class="manager-kpi__label">SLA depasses</span>
                    </a>
                    <a class="manager-kpi manager-kpi--risk manager-kpi--link" [routerLink]="['/tickets']" [queryParams]="{ focus: 'at-risk', sortField: 'updatedAt', sortDirection: 'desc' }">
                      <span class="manager-kpi__value">{{ atRiskManagerTickets.length }}</span>
                      <span class="manager-kpi__label">A risque</span>
                    </a>
                    <a class="manager-kpi manager-kpi--info manager-kpi--link" [routerLink]="['/tickets']" [queryParams]="{ focus: 'escalated', sortField: 'updatedAt', sortDirection: 'desc' }">
                      <span class="manager-kpi__value">{{ escalatedManagerTickets.length }}</span>
                      <span class="manager-kpi__label">Escalades</span>
                    </a>
                  </div>

                  @if (managerActionTickets.length > 0) {
                    <div class="manager-ticket-list">
                      @for (ticket of managerActionTickets; track ticket.id) {
                        <div class="manager-ticket-row">
                          <div class="manager-ticket-main">
                            <div class="manager-ticket-topline">
                              <span class="manager-ticket-ref">{{ ticket.reference }}</span>
                              <app-priority-badge [priority]="ticket.priority"></app-priority-badge>
                            </div>
                            <strong>{{ ticket.title }}</strong>
                            <span>{{ ticket.client?.name || ticket.client?.companyName || 'Client non renseigne' }}</span>
                            <small>{{ getManagerTicketContext(ticket) }}</small>
                          </div>
                          <div class="manager-ticket-side">
                            <app-status-badge [status]="ticket.status"></app-status-badge>
                            <span class="manager-ticket-sla" [class.manager-ticket-sla--danger]="isSlaCriticalTicket(ticket)">
                              {{ ticket.slaRemainingTime || getTicketSlaState(ticket) }}
                            </span>
                            <div class="manager-ticket-actions">
                              <a mat-stroked-button class="manager-action-btn" [routerLink]="['/tickets', ticket.id]">
                                Ouvrir
                              </a>
                              @if (canManagerQuickAction(ticket, 'assign')) {
                                <button mat-stroked-button type="button" class="manager-action-btn" (click)="assignFromDashboard(ticket)">
                                  Assigner
                                </button>
                              }
                              @if (canManagerQuickAction(ticket, 'take-charge')) {
                                <button mat-stroked-button type="button" class="manager-action-btn" (click)="takeChargeFromDashboard(ticket)">
                                  Prendre
                                </button>
                              }
                              @if (canManagerQuickAction(ticket, 'manager-review')) {
                                <button mat-stroked-button type="button" class="manager-action-btn manager-action-btn--accent" (click)="requestManagerReviewFromDashboard(ticket)">
                                  Revue
                                </button>
                              }
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <app-empty-state
                      icon="task_alt"
                      title="Aucune urgence manager"
                      description="Le backlog manager ne contient pas de ticket prioritaire pour le moment."
                      [compact]="true">
                    </app-empty-state>
                  }
                </mat-card-content>
              </mat-card>

              <mat-card class="manager-panel glass-panel holo-card-wrap"
                        (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
                <div class="holo-border holo-cyan"></div>
                <mat-card-header>
                  <div class="chart-title-group">
                    <mat-icon class="chart-icon">groups</mat-icon>
                    <mat-card-title>Charge equipe</mat-card-title>
                  </div>
                </mat-card-header>
                <mat-card-content>
                  @if (managerAgentLoads.length > 0) {
                    <div class="manager-agent-list">
                      @for (agent of managerAgentLoads; track agent.agentId) {
                        <div class="manager-agent-row">
                          <div class="manager-agent-head">
                            <div>
                              <strong>{{ agent.agentName }}</strong>
                              <span>
                                {{ getAgentStatusLabel(agent.status) }}
                                @if (!agent.inShift) {
                                  <span> · Hors shift</span>
                                }
                              </span>
                            </div>
                            <span class="manager-agent-load-badge" [class]="getAgentLoadTone(agent.loadPercent)">
                              {{ agent.currentTickets }}/{{ agent.maxTickets }}
                            </span>
                          </div>
                          <div class="manager-agent-bar">
                            <span [style.width.%]="agent.loadPercent"></span>
                          </div>
                          <div class="manager-agent-meta">
                            <span>{{ agent.slaLabel || 'SLA n/a' }}</span>
                            <span>{{ agent.averageResolutionLabel || 'Resolution n/a' }}</span>
                            <span>{{ agent.satisfactionLabel || 'Satisfaction n/a' }}</span>
                          </div>
                          @if (agent.statusReason) {
                            <small class="manager-agent-reason">{{ agent.statusReason }}</small>
                          }
                        </div>
                      }
                    </div>
                  } @else {
                    <app-empty-state
                      icon="group_off"
                      title="Charge equipe indisponible"
                      description="Les donnees de disponibilite agent ne sont pas encore remontees."
                      [compact]="true">
                    </app-empty-state>
                  }
                </mat-card-content>
              </mat-card>
            </div>

            @if (managerPortfolios.length > 0) {
              <mat-card class="manager-alerts-panel glass-panel holo-card-wrap"
                        (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
                <div class="holo-border holo-orange"></div>
                <mat-card-header>
                  <div class="chart-header-row" style="width:100%">
                    <div class="chart-title-group">
                      <mat-icon class="chart-icon">notifications_active</mat-icon>
                      <mat-card-title>Alertes manager intelligentes</mat-card-title>
                    </div>
                    <span class="chart-badge">PRIORISEES</span>
                  </div>
                </mat-card-header>
                <mat-card-content>
                  <div class="manager-alerts-list">
                    @for (alert of managerAlerts; track alert.key) {
                      <div class="manager-alert" [class]="'manager-alert--' + alert.level">
                        <div class="manager-alert-main">
                          <strong>{{ alert.title }}</strong>
                          <span>{{ alert.description }}</span>
                        </div>
                        <div class="manager-ticket-actions">
                          @if (alert.ticket) {
                            <a mat-stroked-button class="manager-action-btn" [routerLink]="['/tickets', alert.ticket.id]">
                              Ouvrir
                            </a>
                            @if (canManagerQuickAction(alert.ticket, 'assign')) {
                              <button mat-stroked-button type="button" class="manager-action-btn manager-action-btn--accent" (click)="assignFromDashboard(alert.ticket)">
                                Reassigner
                              </button>
                            }
                          } @else if (alert.portfolio) {
                            <button mat-stroked-button type="button" class="manager-action-btn manager-action-btn--accent" (click)="rebalancePortfolio(alert.portfolio)">
                              Reequilibrer
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </mat-card-content>
              </mat-card>

              <mat-card class="manager-portfolio-panel glass-panel holo-card-wrap"
                        (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
                <div class="holo-border holo-purple"></div>
                <mat-card-header>
                  <div class="chart-header-row" style="width:100%">
                    <div class="chart-title-group">
                      <mat-icon class="chart-icon">hub</mat-icon>
                      <mat-card-title>Pilotage par agent</mat-card-title>
                    </div>
                    <span class="chart-badge">REEQUILIBRAGE</span>
                  </div>
                </mat-card-header>
                <mat-card-content>
                  <div class="manager-portfolio-grid">
                    @for (portfolio of managerPortfolios; track portfolio.key) {
                      <div class="manager-portfolio-card">
                        <div class="manager-portfolio-head">
                          <div>
                            <strong>{{ portfolio.agentName }}</strong>
                            <span>
                              @if (portfolio.status) {
                                <span>{{ getAgentStatusLabel(portfolio.status) }}</span>
                              } @else {
                                <span>Sans proprietaire</span>
                              }
                              @if (portfolio.inShift === false) {
                                <span> · Hors shift</span>
                              }
                            </span>
                          </div>
                          <span class="manager-agent-load-badge" [class]="getAgentLoadTone(portfolio.loadPercent)">
                            {{ portfolio.currentTickets }}/{{ portfolio.maxTickets }}
                          </span>
                        </div>

                        <div class="manager-portfolio-bar">
                          <span [style.width.%]="portfolio.loadPercent"></span>
                        </div>

                        <div class="manager-portfolio-kpis">
                          <span>{{ portfolio.criticalTickets }} critiques</span>
                          <span>{{ portfolio.atRiskTickets }} a risque</span>
                          <span>{{ portfolio.breachedTickets }} depasses</span>
                        </div>

                        @if (getRecommendedTransferTarget(portfolio); as recommendedAgent) {
                          <div class="manager-recommendation">
                            <mat-icon>auto_awesome</mat-icon>
                            <span>Transfert recommande vers <strong>{{ recommendedAgent.agentName }}</strong></span>
                          </div>
                        }

                        <div class="manager-portfolio-tickets">
                          @for (ticket of portfolio.tickets; track ticket.id) {
                            <div class="manager-portfolio-ticket">
                              <div class="manager-portfolio-ticket-main">
                                <a [routerLink]="['/tickets', ticket.id]">{{ ticket.reference }}</a>
                                <strong>{{ ticket.title }}</strong>
                              </div>
                              <div class="manager-portfolio-ticket-meta">
                                <app-priority-badge [priority]="ticket.priority"></app-priority-badge>
                                <span [class.manager-ticket-sla--danger]="isSlaCriticalTicket(ticket)">
                                  {{ ticket.slaRemainingTime || getTicketSlaState(ticket) }}
                                </span>
                                @if (canManagerQuickAction(ticket, 'assign')) {
                                  <button mat-stroked-button type="button" class="manager-action-btn manager-action-btn--mini" (click)="assignFromDashboard(ticket)">
                                    Reassigner
                                  </button>
                                }
                              </div>
                            </div>
                          }
                        </div>

                        <div class="manager-ticket-actions">
                          <a mat-stroked-button class="manager-action-btn"
                             [routerLink]="['/tickets']"
                             [queryParams]="{ sortField: 'updatedAt', sortDirection: 'desc' }">
                            Ouvrir backlog
                          </a>
                          @if (portfolio.criticalTickets > 0 || portfolio.breachedTickets > 0) {
                            <button mat-stroked-button type="button" class="manager-action-btn manager-action-btn--accent"
                               (click)="rebalancePortfolio(portfolio)">
                              Reequilibrer
                            </button>
                          }
                        </div>

                        @if (portfolio.statusReason) {
                          <small class="manager-agent-reason">{{ portfolio.statusReason }}</small>
                        }
                      </div>
                    }
                  </div>
                </mat-card-content>
              </mat-card>
            }
          }

          <!-- SLA Neon Progress Rings -->
          <div class="sla-rings-section">
            <div class="sla-rings-header">
              <div class="chart-title-group">
                <mat-icon class="chart-icon">radar</mat-icon>
                <span class="rings-title">Performance SLA Temps Réel</span>
              </div>
              <div class="rings-live-badge">
                <span class="live-dot"></span>
                <span>LIVE</span>
              </div>
            </div>
            <div class="sla-rings-grid">
              @for (ring of slaRings; track ring.name) {
                <div class="sla-ring-card"
                     (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
                  <div class="ring-wrapper">
                    <svg class="ring-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="60" cy="60" r="50"
                        fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
                      <circle cx="60" cy="60" r="50"
                        fill="none" stroke="rgba(255,255,255,0.03)"
                        stroke-width="14" stroke-dasharray="3 9"/>
                      <circle class="ring-progress"
                        cx="60" cy="60" r="50" fill="none" stroke-width="8"
                        stroke-linecap="round"
                        [attr.stroke]="ring.color"
                        [attr.stroke-dasharray]="'314.16'"
                        [attr.stroke-dashoffset]="ring.offset"
                        transform="rotate(-90 60 60)"
                        [style.filter]="'drop-shadow(0 0 6px ' + ring.color + ') drop-shadow(0 0 14px ' + ring.color + ')'"/>
                      <circle cx="60" cy="60" r="43" fill="none" stroke-width="1"
                        stroke-linecap="round"
                        [attr.stroke]="ring.color"
                        [attr.stroke-dasharray]="'270.18'"
                        [attr.stroke-dashoffset]="ring.innerOffset"
                        transform="rotate(-90 60 60)" opacity="0.2"/>
                      <text class="ring-val-text" x="60" y="54"
                        text-anchor="middle" dominant-baseline="middle">{{ ring.displayValue }}</text>
                      <text class="ring-unit-text" x="60" y="72" text-anchor="middle">{{ ring.unit }}</text>
                    </svg>
                    <div class="ring-center-glow"
                         [style.background]="'radial-gradient(circle, ' + ring.glowColor + ', transparent 70%)'"></div>
                  </div>
                  <div class="ring-name">{{ ring.name }}</div>
                  <div class="ring-sublabel" [style.color]="ring.color">{{ ring.sublabel }}</div>
                </div>
              }
            </div>
          </div>

          <!-- Charts Row -->
          <div class="charts-grid">
            <mat-card class="chart-card glass-panel holo-card-wrap"
                      (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
              <div class="holo-border holo-cyan"></div>
              <mat-card-header>
                <div class="chart-header-row">
                  <div class="chart-title-group">
                    <mat-icon class="chart-icon">show_chart</mat-icon>
                    <mat-card-title>Tickets des 7 derniers jours</mat-card-title>
                  </div>
                  <span class="chart-badge">TENDANCE</span>
                </div>
              </mat-card-header>
              <mat-card-content>
                <canvas baseChart
                  [type]="lineChartType"
                  [data]="weeklyChartData"
                  [options]="lineChartOptions">
                </canvas>
              </mat-card-content>
            </mat-card>
            
            <mat-card class="chart-card glass-panel holo-card-wrap"
                      (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
              <div class="holo-border holo-purple"></div>
              <mat-card-header>
                <div class="chart-header-row">
                  <div class="chart-title-group">
                    <mat-icon class="chart-icon">donut_large</mat-icon>
                    <mat-card-title>Tickets par Statut</mat-card-title>
                  </div>
                  <span class="chart-badge">RÉPARTITION</span>
                </div>
              </mat-card-header>
              <mat-card-content>
                <canvas baseChart
                  [type]="doughnutChartType"
                  [data]="statusChartData"
                  [options]="doughnutChartOptions">
                </canvas>
              </mat-card-content>
            </mat-card>
          </div>

          <!-- Bottom Row -->
          <div class="bottom-grid">
            <mat-card class="chart-card glass-panel holo-card-wrap"
                      (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
              <div class="holo-border holo-orange"></div>
              <mat-card-header>
                <div class="chart-header-row">
                  <div class="chart-title-group">
                    <mat-icon class="chart-icon">priority_high</mat-icon>
                    <mat-card-title>Par Priorité</mat-card-title>
                  </div>
                </div>
              </mat-card-header>
              <mat-card-content>
                <canvas baseChart
                  [type]="doughnutChartType"
                  [data]="priorityChartData"
                  [options]="doughnutChartOptions">
                </canvas>
              </mat-card-content>
            </mat-card>

            <mat-card class="recent-tickets glass-panel holo-card-wrap"
                      (mousemove)="tiltCard($event)" (mouseleave)="resetCard($event)">
              <div class="holo-border holo-cyan"></div>
              <mat-card-header>
                <div class="chart-header-row" style="width:100%">
                  <div class="chart-title-group">
                    <mat-icon class="chart-icon">receipt_long</mat-icon>
                    <mat-card-title>Tickets Récents</mat-card-title>
                  </div>
                  <button mat-button class="glass-btn see-all-btn" routerLink="/tickets">
                    Voir tout <mat-icon>arrow_forward</mat-icon>
                  </button>
                </div>
              </mat-card-header>
              <mat-card-content>
                <div class="sla-filters">
                  <button mat-button class="sla-pill" [class.active]="slaFilter === 'ALL'" (click)="setSlaFilter('ALL')">
                    Tous
                  </button>
                  <button mat-button class="sla-pill" [class.active]="slaFilter === 'ON_TRACK'" (click)="setSlaFilter('ON_TRACK')">
                    SLA OK <span class="badge ok">{{ stats?.slaOnTrackTickets || 0 }}</span>
                  </button>
                  <button mat-button class="sla-pill" [class.active]="slaFilter === 'AT_RISK'" (click)="setSlaFilter('AT_RISK')">
                    SLA à risque <span class="badge risk">{{ stats?.slaAtRiskTickets || 0 }}</span>
                  </button>
                  <button mat-button class="sla-pill" [class.active]="slaFilter === 'BREACHED'" (click)="setSlaFilter('BREACHED')">
                    SLA dépassé <span class="badge breached">{{ stats?.slaBreachedTickets || 0 }}</span>
                  </button>
                </div>

                @if (filteredRecentTickets.length > 0) {
                  <div class="table-container">
                    <table mat-table [dataSource]="filteredRecentTickets" class="tickets-table transparent-table">
                      <ng-container matColumnDef="reference">
                        <th mat-header-cell *matHeaderCellDef>Référence</th>
                        <td mat-cell *matCellDef="let ticket">
                          <a [routerLink]="['/tickets', ticket.id]" class="ticket-link neon-text">
                            {{ ticket.reference }}
                          </a>
                        </td>
                      </ng-container>
                      
                      <ng-container matColumnDef="title">
                        <th mat-header-cell *matHeaderCellDef>Titre</th>
                        <td mat-cell *matCellDef="let ticket">{{ ticket.title }}</td>
                      </ng-container>
                      
                      <ng-container matColumnDef="client">
                        <th mat-header-cell *matHeaderCellDef>Client</th>
                        <td mat-cell *matCellDef="let ticket">{{ ticket.client?.name || '-' }}</td>
                      </ng-container>
                      
                      <ng-container matColumnDef="status">
                        <th mat-header-cell *matHeaderCellDef>Statut</th>
                        <td mat-cell *matCellDef="let ticket">
                          <app-status-badge [status]="ticket.status"></app-status-badge>
                        </td>
                      </ng-container>
                      
                      <ng-container matColumnDef="priority">
                        <th mat-header-cell *matHeaderCellDef>Priorité</th>
                        <td mat-cell *matCellDef="let ticket">
                          <app-priority-badge [priority]="ticket.priority"></app-priority-badge>
                        </td>
                      </ng-container>
                      
                      <ng-container matColumnDef="createdAt">
                        <th mat-header-cell *matHeaderCellDef>Mise à jour</th>
                        <td mat-cell *matCellDef="let ticket" class="date-cell">
                          {{ (ticket.updatedAt || ticket.createdAt) | date:'dd/MM HH:mm' }}
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="slaState">
                        <th mat-header-cell *matHeaderCellDef>SLA</th>
                        <td mat-cell *matCellDef="let ticket">
                          <app-sla-indicator [ticket]="ticket" [showTime]="true"></app-sla-indicator>
                        </td>
                      </ng-container>
                      
                      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                      <tr
                        mat-row
                        *matRowDef="let row; columns: displayedColumns;"
                        class="interactive-row"
                        [class.sla-critical-row]="isSlaCriticalTicket(row)">
                      </tr>
                    </table>
                  </div>
                } @else {
                  <app-empty-state
                    icon="inbox"
                    title="Aucun ticket"
                    description="Aucun ticket ne correspond à ce filtre SLA pour le moment."
                    [compact]="true">
                  </app-empty-state>
                }
              </mat-card-content>
            </mat-card>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    * { color: var(--text-main); }
    h1, h2, h3, h4, mat-card-title, th.mat-mdc-header-cell, td.mat-mdc-cell { color: var(--text-main) !important; }

    /* ═══════ WRAPPER & 3D BACKGROUND ═══════ */
    .dashboard-wrapper {
      position: relative;
      min-height: 100vh;
      background-color: var(--bg-dark);
      overflow: hidden;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .bg-canvas {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 0;
      pointer-events: none;
      opacity: 0.5;
    }

    /* ═══════ FLOATING PARTICLES ═══════ */
    .particles-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .particle {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(59,130,246,0.6), rgba(139,92,246,0.3));
      animation: particleFloat linear infinite;
      opacity: 0;
      filter: blur(1px);
    }

    @keyframes particleFloat {
      0%   { transform: translateY(100vh) scale(0); opacity: 0; }
      10%  { opacity: 0.8; }
      90%  { opacity: 0.3; }
      100% { transform: translateY(-10vh) scale(1); opacity: 0; }
    }

    /* ═══════ MAIN CONTENT ═══════ */
    .dashboard {
      position: relative;
      z-index: 1;
      padding: 24px;
      max-width: 1600px;
      margin: 0 auto;
    }

    /* ═══════ HERO HEADER ═══════ */
    .hero-header {
      background: var(--sf-glass);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--sf-glass-border);
      border-radius: 28px;
      padding: 0;
      margin-bottom: 32px;
      overflow: hidden;
      position: relative;
    }

    .hero-header::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--sf-blue), var(--sf-purple), var(--sf-cyan), transparent);
      animation: shimmerBorder 4s linear infinite;
      background-size: 200% 100%;
    }

    @keyframes shimmerBorder {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .hero-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 40px 48px 24px;
      gap: 32px;
    }

    .hero-text-block {
      flex: 1;
      min-width: 0;
    }

    .hero-kicker {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.15em;
      color: var(--sf-cyan);
      text-transform: uppercase;
    }

    .kicker-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--sf-cyan);
      box-shadow: 0 0 12px var(--sf-cyan);
      animation: pulse 2s ease-in-out infinite;
    }

    .kicker-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, rgba(6,182,212,0.4), transparent);
      max-width: 120px;
    }

    .hero-title {
      margin: 0 0 8px;
      font-size: 42px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.1;
      background: linear-gradient(135deg, var(--sf-text-1) 0%, #a5b4fc 40%, var(--sf-cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
    }

    .hero-title-accent {
      display: block;
      font-size: 26px;
      font-weight: 600;
      letter-spacing: 0.02em;
      background: linear-gradient(135deg, var(--sf-purple), var(--sf-cyan));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-subtitle {
      margin: 0 0 24px;
      color: var(--sf-text-3);
      font-size: 15px;
      line-height: 1.6;
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .hero-btn {
      border-radius: 14px !important;
      height: 46px !important;
      padding: 0 24px !important;
      font-weight: 600 !important;
      font-size: 14px !important;
      transition: all 0.35s var(--sf-ease-spring) !important;
      display: inline-flex !important;
      align-items: center;
      gap: 8px;
    }

    .hero-btn--ghost {
      background: rgba(var(--sf-text-rgb), 0.05) !important;
      border: 1px solid rgba(var(--sf-text-rgb), 0.12) !important;
      color: var(--sf-text-1) !important;
      backdrop-filter: blur(8px);
    }
    .hero-btn--ghost:hover {
      background: rgba(var(--sf-text-rgb), 0.12) !important;
      border-color: rgba(var(--sf-text-rgb), 0.25) !important;
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }

    .hero-btn--primary {
      background: linear-gradient(135deg, var(--sf-blue), var(--sf-purple)) !important;
      color: #fff !important;
      border: none !important;
      box-shadow: 0 4px 20px rgba(59,130,246,0.4) !important;
      position: relative;
      overflow: hidden;
    }
    .hero-btn--primary::after {
      content: '';
      position: absolute;
      top: 0; left: -100%;
      width: 60%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
      transform: skewX(-20deg);
      transition: 0.6s;
    }
    .hero-btn--primary:hover::after { left: 150%; }
    .hero-btn--primary:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 32px rgba(139,92,246,0.5) !important;
    }

    /* ═══════ 3D ROBOT CONTAINER ═══════ */
    .hero-3d-container {
      position: relative;
      width: 280px;
      height: 260px;
      flex-shrink: 0;
    }

    .robot-canvas {
      width: 100%;
      height: 100%;
      border-radius: 20px;
    }

    .hero-3d-glow {
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 40px;
      background: radial-gradient(ellipse, rgba(59,130,246,0.3), transparent 70%);
      filter: blur(12px);
      pointer-events: none;
    }

    /* ═══════ METRICS STRIP ═══════ */
    .hero-metrics-strip {
      display: flex;
      gap: 16px;
      padding: 16px 48px 24px;
      flex-wrap: wrap;
    }

    .metric-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      background: rgba(var(--sf-text-rgb), 0.04);
      border: 1px solid rgba(var(--sf-text-rgb), 0.08);
      border-radius: 100px;
      font-size: 13px;
      font-weight: 600;
      color: var(--sf-text-2);
      transition: all 0.25s var(--sf-ease);

      mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--sf-cyan); }
      &:hover {
        background: rgba(var(--sf-text-rgb), 0.08);
        border-color: rgba(var(--sf-text-rgb), 0.15);
        transform: translateY(-1px);
      }
    }

    .metric-pill--live {
      border-color: rgba(16,185,129,0.3);
      background: rgba(16,185,129,0.08);
      color: #34d399;
    }

    .live-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 10px #34d399;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }

    /* ═══════ HOLOGRAPHIC CARD BORDERS ═══════ */
    .holo-card-wrap {
      position: relative;
      overflow: visible;
    }

    .holo-border {
      position: absolute;
      inset: -1px;
      border-radius: inherit;
      z-index: -1;
      opacity: 0;
      transition: opacity 0.4s ease;
      pointer-events: none;
    }

    .holo-card-wrap:hover .holo-border {
      opacity: 1;
    }



    .holo-border.holo-blue   { background: linear-gradient(135deg, rgba(59,130,246,0.6), rgba(6,182,212,0.3), transparent); filter: blur(8px); }
    .holo-border.holo-yellow  { background: linear-gradient(135deg, rgba(245,158,11,0.6), rgba(251,191,36,0.3), transparent); filter: blur(8px); }
    .holo-border.holo-green   { background: linear-gradient(135deg, rgba(16,185,129,0.6), rgba(52,211,153,0.3), transparent); filter: blur(8px); }
    .holo-border.holo-red     { background: linear-gradient(135deg, rgba(239,68,68,0.6), rgba(248,113,113,0.3), transparent); filter: blur(8px); }
    .holo-border.holo-cyan    { background: linear-gradient(135deg, rgba(6,182,212,0.5), rgba(59,130,246,0.3), transparent); filter: blur(8px); }
    .holo-border.holo-purple  { background: linear-gradient(135deg, rgba(139,92,246,0.5), rgba(99,102,241,0.3), transparent); filter: blur(8px); }
    .holo-border.holo-orange  { background: linear-gradient(135deg, rgba(249,115,22,0.5), rgba(245,158,11,0.3), transparent); filter: blur(8px); }

    /* ═══════ GLASS PANEL (enhanced) ═══════ */
    .glass-panel {
      background: var(--glass-bg) !important;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border) !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(var(--sf-text-rgb),0.04) !important;
      border-radius: 24px !important;
      transition: transform 0.4s var(--sf-ease-spring), box-shadow 0.4s var(--sf-ease) !important;
    }

    .glass-panel:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(var(--sf-text-rgb),0.06) !important;
    }

    /* ═══════ STATS GRID ═══════ */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }

    /* ═══════ CHART CARDS ═══════ */
    .charts-grid {
      display: grid;
      grid-template-columns: 5fr 3fr;
      gap: 24px;
      margin-bottom: 24px;
    }

    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 3fr;
      gap: 24px;
    }

    .chart-card mat-card-header { padding: 24px 28px 0; }

    .chart-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .chart-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .chart-icon {
      font-size: 20px !important;
      width: 20px !important; height: 20px !important;
      color: var(--sf-cyan) !important;
      filter: drop-shadow(0 0 6px var(--sf-cyan));
    }

    .chart-card mat-card-title {
      font-size: 17px !important;
      font-weight: 700 !important;
      letter-spacing: -0.01em;
    }

    .chart-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      padding: 4px 12px;
      border-radius: 100px;
      background: rgba(var(--sf-text-rgb), 0.05);
      border: 1px solid rgba(var(--sf-text-rgb), 0.08);
      color: var(--sf-text-3);
    }

    .chart-card mat-card-content {
      padding: 20px 28px 24px;
      height: 340px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ═══════ RECENT TICKETS ═══════ */
    .recent-tickets mat-card-header {
      padding: 24px 28px 0;
      margin-bottom: 20px;
    }

    .glass-btn {
      background: rgba(var(--sf-text-rgb), 0.05) !important;
      border: 1px solid rgba(var(--sf-text-rgb), 0.1) !important;
      color: var(--sf-text-1) !important;
      border-radius: 12px !important;
      padding: 0 20px !important;
      height: 40px !important;
      backdrop-filter: blur(8px);
      transition: all 0.3s var(--sf-ease) !important;
    }
    .glass-btn:hover {
      background: rgba(var(--sf-text-rgb), 0.12) !important;
      border-color: rgba(var(--sf-text-rgb), 0.25) !important;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }

    .sla-filters {
      padding: 0 28px;
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .sla-pill {
      background: rgba(var(--sf-text-rgb), 0.03) !important;
      border: 1px solid rgba(var(--sf-text-rgb), 0.08) !important;
      color: var(--sf-text-3) !important;
      border-radius: 100px !important;
      height: 36px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      transition: all 0.3s var(--sf-ease) !important;
    }
    .sla-pill:hover {
      background: rgba(var(--sf-text-rgb), 0.08) !important;
      color: var(--sf-text-1) !important;
    }
    .sla-pill.active {
      background: rgba(59,130,246,0.12) !important;
      border-color: rgba(59,130,246,0.4) !important;
      color: var(--sf-text-1) !important;
      box-shadow: 0 0 16px rgba(59,130,246,0.15);
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 700;
      margin-left: 6px;
    }
    .badge.ok { background: rgba(16,185,129,0.15); color: #34d399; }
    .badge.risk { background: rgba(245,158,11,0.15); color: #fbbf24; }
    .badge.breached { background: rgba(239,68,68,0.15); color: #f87171; }

    /* ═══════ TABLE ═══════ */
    .table-container { overflow-x: auto; }

    .transparent-table {
      background: transparent !important;
      width: 100%;
    }

    .transparent-table th.mat-mdc-header-cell {
      background: rgba(0,0,0,0.15);
      color: var(--sf-text-3) !important;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.06em;
      border-bottom: 1px solid var(--glass-border);
      padding: 14px 16px;
    }

    .transparent-table td.mat-mdc-cell {
      border-bottom: 1px solid rgba(var(--sf-text-rgb), 0.04);
      padding: 14px 16px;
      color: var(--sf-text-1) !important;
    }

    .interactive-row { transition: all 0.2s var(--sf-ease); }
    .interactive-row:hover {
      background-color: rgba(var(--sf-text-rgb), 0.04) !important;
    }
    .interactive-row.sla-critical-row {
      background: linear-gradient(90deg, rgba(239,68,68,0.10), rgba(239,68,68,0.02)) !important;
      box-shadow: inset 3px 0 0 rgba(239,68,68,0.65);
    }
    .interactive-row.sla-critical-row:hover {
      background: linear-gradient(90deg, rgba(239,68,68,0.14), rgba(239,68,68,0.04)) !important;
    }

    .neon-text {
      color: var(--sf-cyan) !important;
      text-decoration: none;
      font-weight: 700;
      font-family: var(--sf-font-mono);
      font-size: 13px;
      transition: all 0.2s;
    }
    .neon-text:hover {
      color: var(--sf-text-1) !important;
      text-shadow: 0 0 10px var(--sf-cyan);
    }

    .date-cell {
      color: var(--sf-text-3) !important;
      font-family: var(--sf-font-mono);
      font-size: 12px;
    }

    /* ═══════ GLOWING GRID BACKGROUND ═══════ */
    .glow-grid-bg {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(6,182,212,0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(6,182,212,0.05) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 100%);
      -webkit-mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 100%);
      animation: gridPulse 8s ease-in-out infinite;
    }
    @keyframes gridPulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    /* ═══════ SCANLINE OVERLAY ═══════ */
    .scanline-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(0,10,25,0.10) 3px,
        rgba(0,10,25,0.10) 4px
      );
      animation: scanlineScroll 14s linear infinite;
    }
    @keyframes scanlineScroll {
      0%   { background-position: 0 0; }
      100% { background-position: 0 200px; }
    }

    /* ═══════ HUD SCANNER LINES ═══════ */
    .hud-scanner {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 2;
      border-radius: 28px;
    }
    .hud-scan-line {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg,
        transparent 0%,
        rgba(6,182,212,0.35) 15%,
        rgba(6,182,212,0.9)  50%,
        rgba(6,182,212,0.35) 85%,
        transparent 100%
      );
      box-shadow: 0 0 22px rgba(6,182,212,0.55), 0 0 44px rgba(6,182,212,0.2);
      animation: hudScanDown 5s linear infinite;
    }
    .hud-scan-line--2 {
      animation-delay: -2.5s;
      opacity: 0.45;
      background: linear-gradient(90deg,
        transparent 0%,
        rgba(139,92,246,0.35) 15%,
        rgba(139,92,246,0.85) 50%,
        rgba(139,92,246,0.35) 85%,
        transparent 100%
      );
      box-shadow: 0 0 22px rgba(139,92,246,0.45);
    }
    @keyframes hudScanDown {
      0%   { top: -2px;  opacity: 0; }
      5%   { opacity: 1; }
      95%  { opacity: 1; }
      100% { top: 100%;  opacity: 0; }
    }

    /* ═══════ HUD CORNER BRACKETS ═══════ */
    .hud-corner {
      position: absolute;
      width: 20px; height: 20px;
      z-index: 5;
      pointer-events: none;
    }
    .hud-corner--tl { top: 10px; left: 10px; border-top: 2px solid var(--sf-cyan); border-left: 2px solid var(--sf-cyan); box-shadow: -3px -3px 10px rgba(6,182,212,0.3); }
    .hud-corner--tr { top: 10px; right: 10px; border-top: 2px solid var(--sf-cyan); border-right: 2px solid var(--sf-cyan); box-shadow: 3px -3px 10px rgba(6,182,212,0.3); }
    .hud-corner--bl { bottom: 10px; left: 10px; border-bottom: 2px solid var(--sf-cyan); border-left: 2px solid var(--sf-cyan); box-shadow: -3px 3px 10px rgba(6,182,212,0.3); }
    .hud-corner--br { bottom: 10px; right: 10px; border-bottom: 2px solid var(--sf-cyan); border-right: 2px solid var(--sf-cyan); box-shadow: 3px 3px 10px rgba(6,182,212,0.3); }

    /* ═══════ HERO 3D SCENE — HOLOGRAPHIC RINGS ═══════ */
    .hero-3d-scene {
      position: relative;
      width: 320px;
      height: 290px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .orbital-ring {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }
    .orbital-ring-1 {
      width: 200px; height: 200px;
      border: 1px solid rgba(6,182,212,0.50);
      box-shadow: 0 0 18px rgba(6,182,212,0.18), inset 0 0 18px rgba(6,182,212,0.08);
      animation: ringRotateCW 8s linear infinite;
    }
    .orbital-ring-2 {
      width: 262px; height: 262px;
      border: 1px dashed rgba(139,92,246,0.38);
      box-shadow: 0 0 14px rgba(139,92,246,0.12);
      animation: ringRotateCCW 13s linear infinite;
    }
    .orbital-ring-3 {
      width: 148px; height: 148px;
      border: 1px solid rgba(59,130,246,0.42);
      box-shadow: 0 0 12px rgba(59,130,246,0.15);
      animation: ringRotateCW 5.5s linear infinite;
    }
    .orbital-ring-4 {
      width: 305px; height: 305px;
      border: 1px dotted rgba(6,182,212,0.14);
      animation: ringRotateCCW 22s linear infinite;
    }
    @keyframes ringRotateCW  { from { transform: rotate(0deg); }   to { transform: rotate(360deg);  } }
    @keyframes ringRotateCCW { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }

    .robot-ground-glow {
      position: absolute;
      bottom: 8px;
      left: 50%; transform: translateX(-50%);
      width: 55%; height: 28px;
      background: radial-gradient(ellipse, rgba(59,130,246,0.35), transparent 70%);
      filter: blur(12px);
      pointer-events: none;
    }

    .hud-tag {
      position: absolute;
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--sf-cyan);
      background: rgba(6,182,212,0.08);
      border: 1px solid rgba(6,182,212,0.22);
      border-radius: 4px;
      padding: 4px 9px;
      pointer-events: none;
      z-index: 10;
    }
    .hud-tag-1 { top: 14px;  left:  0; }
    .hud-tag-2 { bottom: 24px; right: 0; }
    .hud-tag-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--sf-cyan);
      box-shadow: 0 0 8px var(--sf-cyan);
      animation: pulse 2s ease-in-out infinite;
    }
    .hud-tag-dot--green { background: #34d399; box-shadow: 0 0 8px #34d399; }

    /* ═══════ CARD SCAN LINE ═══════ */
    .card-scan-line {
      position: absolute;
      left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.85) 50%, transparent 100%);
      top: -1px;
      z-index: 10;
      pointer-events: none;
      animation: cardScanDown 8s ease-in-out infinite;
      opacity: 0;
    }
    @keyframes cardScanDown {
      0%    { top: 0%;   opacity: 0;   }
      4%    { opacity: 1; }
      96%   { opacity: 0.8; }
      100%  { top: 100%; opacity: 0; }
    }

    /* ═══════ TILT CARDS ═══════ */
    .holo-card-wrap, .sla-ring-card {
      transform-style: preserve-3d;
      will-change: transform;
    }

    /* ═══════ SLA NEON RINGS SECTION ═══════ */
    .sla-rings-section {
      margin-bottom: 32px;
      background: var(--sf-glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--sf-glass-border);
      border-radius: 24px;
      padding: 28px 32px;
      position: relative;
      overflow: hidden;
    }
    .sla-rings-section::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--sf-cyan), var(--sf-purple), var(--sf-cyan), transparent);
      animation: shimmerBorder 4s linear infinite;
      background-size: 200% 100%;
    }
    .sla-rings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 28px;
    }
    .rings-title {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--sf-text-1);
    }
    .rings-live-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      padding: 5px 14px;
      border-radius: 100px;
      background: rgba(16,185,129,0.1);
      border: 1px solid rgba(16,185,129,0.28);
      color: #34d399;
    }
    .sla-rings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
      gap: 20px;
    }
    .sla-ring-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 20px 14px 16px;
      background: rgba(255,255,255,0.025);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 18px;
      cursor: default;
      transition: transform 0.5s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, background 0.3s ease;
    }
    .sla-ring-card:hover {
      background: rgba(255,255,255,0.05);
      box-shadow: 0 12px 36px rgba(0,0,0,0.25);
    }
    .ring-wrapper {
      position: relative;
      width: 120px; height: 120px;
    }
    .ring-svg {
      width: 120px; height: 120px;
      overflow: visible;
    }
    .ring-progress {
      transition: stroke-dashoffset 2.8s cubic-bezier(0.17,0.67,0.35,1.0);
    }
    .ring-val-text {
      fill: var(--sf-text-1);
      font-family: 'Inter', sans-serif;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }
    .ring-unit-text {
      fill: var(--sf-text-3);
      font-family: 'Inter', sans-serif;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    .ring-center-glow {
      position: absolute;
      inset: 22%;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0.4;
      filter: blur(14px);
      animation: glowPulse 3.5s ease-in-out infinite;
    }
    @keyframes glowPulse {
      0%, 100% { opacity: 0.25; transform: scale(0.8); }
      50%       { opacity: 0.55; transform: scale(1.15); }
    }
    .ring-name {
      font-size: 11.5px;
      font-weight: 700;
      color: var(--sf-text-2);
      text-align: center;
      letter-spacing: 0.02em;
    }
    .ring-sublabel {
      font-size: 9.5px;
      font-weight: 700;
      text-align: center;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      opacity: 0.85;
    }

    .manager-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
      gap: 24px;
      margin-bottom: 32px;
    }

    .manager-panel {
      background: var(--sf-glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--sf-glass-border);
      border-radius: 24px;
      overflow: hidden;
    }

    .manager-portfolio-panel {
      margin-bottom: 32px;
      background: var(--sf-glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--sf-glass-border);
      border-radius: 24px;
      overflow: hidden;
    }

    .manager-alerts-panel {
      margin-bottom: 24px;
      background: var(--sf-glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--sf-glass-border);
      border-radius: 24px;
      overflow: hidden;
    }

    .manager-kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }

    .manager-kpi {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
    }

    .manager-kpi--link {
      text-decoration: none;
      color: inherit;
      transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    }

    .manager-kpi--link:hover {
      transform: translateY(-2px);
      box-shadow: 0 18px 30px rgba(0,0,0,0.18);
    }

    .manager-kpi__value {
      font-size: 24px;
      font-weight: 800;
      color: var(--sf-text-1);
    }

    .manager-kpi__label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--sf-text-3);
    }

    .manager-kpi--warning { border-color: rgba(251,191,36,0.25); background: rgba(251,191,36,0.08); }
    .manager-kpi--danger { border-color: rgba(248,113,113,0.28); background: rgba(248,113,113,0.08); }
    .manager-kpi--risk { border-color: rgba(244,114,182,0.28); background: rgba(244,114,182,0.08); }
    .manager-kpi--info { border-color: rgba(34,211,238,0.28); background: rgba(34,211,238,0.08); }

    .manager-ticket-list,
    .manager-agent-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .manager-ticket-row,
    .manager-agent-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
      text-decoration: none;
      color: inherit;
      transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    }

    .manager-ticket-row:hover,
    .manager-agent-row:hover {
      transform: translateY(-2px);
      border-color: rgba(96,165,250,0.28);
      box-shadow: 0 18px 30px rgba(0,0,0,0.18);
    }

    .manager-ticket-row {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }

    .manager-ticket-main,
    .manager-ticket-side {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .manager-ticket-main {
      min-width: 0;
      flex: 1;
    }

    .manager-ticket-topline {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .manager-ticket-ref {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--sf-cyan);
      text-transform: uppercase;
    }

    .manager-ticket-main strong {
      font-size: 15px;
      color: var(--sf-text-1);
    }

    .manager-ticket-main span,
    .manager-ticket-main small,
    .manager-agent-head span,
    .manager-agent-meta span,
    .manager-agent-reason {
      color: var(--sf-text-3);
    }

    .manager-ticket-sla {
      font-size: 12px;
      font-weight: 700;
      color: #34d399;
      text-align: right;
    }

    .manager-ticket-sla--danger {
      color: #f87171;
    }

    .manager-ticket-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 4px;
    }

    .manager-action-btn {
      min-width: 0;
      height: 34px;
      padding: 0 12px;
      border-radius: 10px;
      border-color: rgba(255,255,255,0.14) !important;
      color: var(--sf-text-2) !important;
      background: rgba(255,255,255,0.04);
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
    }

    .manager-action-btn--accent {
      border-color: rgba(34,211,238,0.24) !important;
      color: #67e8f9 !important;
      background: rgba(34,211,238,0.08);
    }

    .manager-action-btn--mini {
      height: 30px;
      padding: 0 10px;
      font-size: 11px;
    }

    .manager-agent-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .manager-agent-head strong {
      display: block;
      color: var(--sf-text-1);
      margin-bottom: 2px;
    }

    .manager-agent-load-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 58px;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.06);
      color: var(--sf-text-2);
    }

    .load-ok { color: #34d399; border-color: rgba(52,211,153,0.24); background: rgba(52,211,153,0.08); }
    .load-warn { color: #fbbf24; border-color: rgba(251,191,36,0.24); background: rgba(251,191,36,0.08); }
    .load-danger { color: #f87171; border-color: rgba(248,113,113,0.24); background: rgba(248,113,113,0.08); }

    .manager-agent-bar {
      height: 8px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      overflow: hidden;
    }

    .manager-agent-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6);
      box-shadow: 0 0 18px rgba(59,130,246,0.25);
    }

    .manager-agent-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 12px;
    }

    .manager-alerts-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .manager-alert {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
    }

    .manager-alert-main {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .manager-alert-main strong {
      color: var(--sf-text-1);
      font-size: 14px;
    }

    .manager-alert-main span {
      color: var(--sf-text-3);
      font-size: 12px;
    }

    .manager-alert--critical {
      border-color: rgba(248,113,113,0.24);
      background: rgba(248,113,113,0.07);
    }

    .manager-alert--warning {
      border-color: rgba(251,191,36,0.24);
      background: rgba(251,191,36,0.07);
    }

    .manager-alert--info {
      border-color: rgba(34,211,238,0.24);
      background: rgba(34,211,238,0.07);
    }

    .manager-portfolio-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }

    .manager-portfolio-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 18px;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
    }

    .manager-portfolio-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    .manager-portfolio-head strong {
      display: block;
      color: var(--sf-text-1);
      margin-bottom: 2px;
    }

    .manager-portfolio-head span {
      color: var(--sf-text-3);
      font-size: 12px;
    }

    .manager-portfolio-bar {
      height: 8px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      overflow: hidden;
    }

    .manager-portfolio-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #8b5cf6, #3b82f6, #22d3ee);
    }

    .manager-portfolio-kpis {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 12px;
      color: var(--sf-text-3);
    }

    .manager-recommendation {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(139,92,246,0.10);
      border: 1px solid rgba(139,92,246,0.24);
      color: #d8b4fe;
      font-size: 12px;
      font-weight: 600;
    }

    .manager-recommendation mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }

    .manager-portfolio-tickets {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .manager-portfolio-ticket {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }

    .manager-portfolio-ticket-main {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .manager-portfolio-ticket-main a {
      color: var(--sf-cyan);
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .manager-portfolio-ticket-main strong {
      color: var(--sf-text-1);
      font-size: 13px;
    }

    .manager-portfolio-ticket-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      font-size: 12px;
      color: var(--sf-text-3);
    }

    /* ═══════ RESPONSIVE ═══════ */
    @media (max-width: 1100px) {
      .charts-grid, .bottom-grid, .manager-grid { grid-template-columns: 1fr; }
      .hero-3d-scene { display: none; }
    }
    @media (max-width: 768px) {
      .dashboard { padding: 16px; }
      .hero-content { padding: 24px; flex-direction: column; }
      .hero-metrics-strip { padding: 12px 24px 20px; }
      .hero-title { font-size: 30px; }
      .sla-rings-grid { grid-template-columns: repeat(3, 1fr); }
      .manager-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .manager-ticket-row { flex-direction: column; align-items: stretch; }
      .manager-ticket-sla { text-align: left; }
    }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('robotCanvas') robotCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('bgCanvas') bgCanvasRef!: ElementRef<HTMLCanvasElement>;

  loading = true;
  stats: DashboardStats | null = null;
  recentTickets: Ticket[] = [];
  displayedColumns = ['reference', 'title', 'client', 'status', 'priority', 'createdAt', 'slaState'];
  slaFilter: 'ALL' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED' = 'ALL';
  isClient = false;
  isManagerView = false;
  managerTickets: Ticket[] = [];
  managerAgentLoads: ManagerAgentLoad[] = [];

  // Floating particles data
  particles = Array.from({ length: 25 }, () => ({
    x: Math.random() * 100 + '%',
    y: Math.random() * 100 + '%',
    size: (Math.random() * 4 + 2) + 'px',
    duration: (Math.random() * 15 + 10) + 's',
    delay: (Math.random() * 10) + 's'
  }));

  // Three.js
  private robotScene!: THREE.Scene;
  private robotCamera!: THREE.PerspectiveCamera;
  private robotRenderer!: THREE.WebGLRenderer;
  private robotGroup!: THREE.Group;
  private bgScene!: THREE.Scene;
  private bgCamera!: THREE.PerspectiveCamera;
  private bgRenderer!: THREE.WebGLRenderer;
  private bgCubes: THREE.Mesh[] = [];
  private animFrameId = 0;
  private bgAnimFrameId = 0;
  private clock = new THREE.Clock();

  // Animated display counters (count up from 0)
  displayStats = { totalTickets: 0, openTickets: 0, resolvedTickets: 0, urgentTickets: 0 };

  // SLA neon ring gauges
  slaRings: SlaRingData[] = [];

  // Orbital particles (THREE.js spheres orbiting the robot)
  private orbitals: OrbitalParticle[] = [];

  // Chart configurations
  doughnutChartType: ChartType = 'doughnut';
  lineChartType: ChartType = 'line';

  statusChartData: ChartConfiguration['data'] = {
    labels: ['Nouveau', 'Ouvert', 'Assigné', 'En cours', 'En attente', 'Escalade (M)', 'Escalade active', 'Résolu', 'Fermé'],
    datasets: [{
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      backgroundColor: [
        '#3b82f6', '#8b5cf6', '#10b981', '#06b6d4',
        '#f59e0b', '#f97316', '#ef4444', '#34d399', '#6b7280'
      ],
      borderColor: 'rgba(0,0,0,0.3)',
      borderWidth: 2,
      hoverOffset: 8
    }]
  };

  priorityChartData: ChartConfiguration['data'] = {
    labels: ['Basse', 'Moyenne', 'Haute', 'Critique', 'Super critique'],
    datasets: [{
      data: [0, 0, 0, 0, 0],
      backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#fb7185'],
      borderColor: 'rgba(0,0,0,0.3)',
      borderWidth: 2,
      hoverOffset: 8
    }]
  };

  weeklyChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{
      label: 'Tickets créés',
      data: [],
      borderColor: '#06b6d4',
      backgroundColor: (ctx: any) => {
        const chart = ctx.chart;
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return 'rgba(6,182,212,0.1)';
        const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, 'rgba(6,182,212,0.25)');
        gradient.addColorStop(1, 'rgba(6,182,212,0.02)');
        return gradient;
      },
      fill: true,
      tension: 0.45,
      pointBackgroundColor: '#06b6d4',
      pointBorderColor: '#0e1726',
      pointBorderWidth: 3,
      pointRadius: 5,
      pointHoverRadius: 8,
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: '#06b6d4',
      pointHoverBorderWidth: 3,
      borderWidth: 3
    }]
  };

  doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 16,
          color: '#8e9aaf',
          font: { family: 'Inter', size: 11 },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      }
    }
  };

  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(14,18,32,0.9)',
        borderColor: 'rgba(6,182,212,0.3)',
        borderWidth: 1,
        titleFont: { family: 'Inter', weight: 'bold' },
        bodyFont: { family: 'Inter' },
        padding: 12,
        cornerRadius: 12,
        displayColors: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          color: '#64748b',
          font: { family: 'Inter', size: 11 },
          padding: 8
        },
        grid: { color: 'rgba(120, 130, 150, 0.08)', drawTicks: false }
      },
      x: {
        ticks: {
          color: '#64748b',
          font: { family: 'Inter', size: 11 },
          padding: 8
        },
        grid: { display: false }
      }
    }
  };

  constructor(
    private dashboardService: DashboardService,
    private ticketService: TicketService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    this.isClient = this.authService.isClient();
    this.isManagerView = this.authService.isManager();
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.initRobotScene();
        this.initBgScene();
      }, 100);
    });
  }

  ngOnDestroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.bgAnimFrameId) cancelAnimationFrame(this.bgAnimFrameId);
    this.robotRenderer?.dispose();
    this.bgRenderer?.dispose();
  }

  // ═══════ 3D ROBOT SCENE ═══════
  private initRobotScene(): void {
    const canvas = this.robotCanvasRef?.nativeElement;
    if (!canvas) return;

    this.robotScene = new THREE.Scene();
    this.robotCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    this.robotCamera.position.set(0, 1, 5);
    this.robotCamera.lookAt(0, 0.5, 0);

    this.robotRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.robotRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.robotRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.robotRenderer.setClearColor(0x000000, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404060, 1.2);
    this.robotScene.add(ambientLight);
    const mainLight = new THREE.DirectionalLight(0x06b6d4, 2);
    mainLight.position.set(3, 5, 5);
    this.robotScene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0x8b5cf6, 0.8);
    fillLight.position.set(-3, 2, -2);
    this.robotScene.add(fillLight);
    const rimLight = new THREE.PointLight(0x3b82f6, 1.5, 10);
    rimLight.position.set(0, 3, -3);
    this.robotScene.add(rimLight);

    this.robotGroup = new THREE.Group();
    this.buildRobot();
    this.createOrbitalParticles();
    this.robotScene.add(this.robotGroup);

    this.animateRobot();
  }

  private buildRobot(): void {
    const bodyMat = new THREE.MeshPhongMaterial({
      color: 0x0d1b2e, emissive: 0x061018, specular: 0x3b82f6, shininess: 90, transparent: true, opacity: 0.97
    });
    const accentMat = new THREE.MeshPhongMaterial({
      color: 0x06b6d4, emissive: 0x035563, specular: 0xffffff, shininess: 120
    });
    const purpleMat = new THREE.MeshPhongMaterial({
      color: 0x8b5cf6, emissive: 0x3b1f6e, specular: 0xffffff, shininess: 100
    });
    const eyeMat = new THREE.MeshPhongMaterial({
      color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 2.5, transparent: true, opacity: 0.92
    });
    const glowMat = new THREE.MeshPhongMaterial({
      color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 2, transparent: true, opacity: 0.65
    });
    const panelMat = new THREE.MeshPhongMaterial({
      color: 0x111e35, emissive: 0x050e1a, specular: 0x06b6d4, shininess: 60, transparent: true, opacity: 0.9
    });
    const darkAccentMat = new THREE.MeshPhongMaterial({
      color: 0x162540, emissive: 0x05101c, specular: 0x8b5cf6, shininess: 50
    });

    // ── HEAD ──────────────────────────────────────────────────────────
    const headGeo = new THREE.BoxGeometry(1.25, 1.05, 1.05);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.y = 2.25; head.name = 'head';
    this.robotGroup.add(head);

    // Head side panels (bevelled look)
    [[-0.69, 2.25, 0], [0.69, 2.25, 0]].forEach(([x, y, z]) => {
      const sidePan = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.85), darkAccentMat);
      sidePan.position.set(x, y, z as number);
      this.robotGroup.add(sidePan);
    });

    // Head top plate
    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.85), accentMat);
    topPlate.position.set(0, 2.82, 0);
    this.robotGroup.add(topPlate);

    // Head fins
    [[-0.4, 0.3], [0, 0.38], [0.4, 0.3]].forEach(([xOff, h]) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, h as number, 0.06), accentMat);
      fin.position.set(xOff as number, 3.0 + (h as number) / 2, 0);
      this.robotGroup.add(fin);
    });

    // Visor (wide glowing bar)
    const visorGeo = new THREE.BoxGeometry(1.05, 0.32, 0.12);
    const visor = new THREE.Mesh(visorGeo, eyeMat);
    visor.position.set(0, 2.28, 0.53); visor.name = 'visor';
    this.robotGroup.add(visor);

    // Visor inner glow strip
    const visorGlow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.06), glowMat);
    visorGlow.position.set(0, 2.28, 0.60); visorGlow.name = 'visorGlow';
    this.robotGroup.add(visorGlow);

    // Chin detail
    const chin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.35), accentMat);
    chin.position.set(0, 1.74, 0.3);
    this.robotGroup.add(chin);

    // Antenna
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 8), accentMat);
    antenna.position.set(0, 2.98, 0);
    this.robotGroup.add(antenna);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), glowMat);
    antennaTip.position.set(0, 3.26, 0); antennaTip.name = 'antennaTip';
    this.robotGroup.add(antennaTip);
    // Antenna ring
    const antennaRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 8, 24), accentMat);
    antennaRing.position.set(0, 3.26, 0);
    this.robotGroup.add(antennaRing);

    // ── NECK ──────────────────────────────────────────────────────────
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.32, 10), accentMat);
    neck.position.y = 1.62;
    this.robotGroup.add(neck);

    // ── TORSO ──────────────────────────────────────────────────────────
    const torsoGeo = new THREE.BoxGeometry(1.45, 1.45, 0.95);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.y = 0.72; torso.name = 'torso';
    this.robotGroup.add(torso);

    // Torso side detail panels
    [[-0.78, 0.72, 0], [0.78, 0.72, 0]].forEach(([x, y, z]) => {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.7), panelMat);
      sp.position.set(x, y, z as number);
      this.robotGroup.add(sp);
    });

    // Torso front panels (3 rows)
    [[0, 1.15, 0.49, 1.1, 0.06, 0.26], [0, 0.72, 0.49, 0.9, 0.06, 0.3], [0, 0.28, 0.49, 0.85, 0.06, 0.22]].forEach(([x,y,z,w,h,d]) => {
      const fp = new THREE.Mesh(new THREE.BoxGeometry(w as number, h as number, d as number), panelMat);
      fp.position.set(x as number, y as number, z as number);
      this.robotGroup.add(fp);
    });

    // Chest emblem ring + core
    const emblemRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 10, 32), glowMat);
    emblemRing.position.set(0, 0.95, 0.49); emblemRing.name = 'emblemRing';
    this.robotGroup.add(emblemRing);
    const emblemCore = new THREE.Mesh(new THREE.CircleGeometry(0.13, 32), eyeMat);
    emblemCore.position.set(0, 0.95, 0.52); emblemCore.name = 'emblemCore';
    this.robotGroup.add(emblemCore);

    // Chest hex pattern (3 small hexagons)
    [[-0.38, 0.95], [0.38, 0.95], [0, 0.58]].forEach(([x, y]) => {
      const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 6), accentMat);
      hex.rotation.z = Math.PI / 6;
      hex.position.set(x as number, y as number, 0.50);
      this.robotGroup.add(hex);
    });

    // Center stripe (glowing belt)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.47, 0.07, 0.97), accentMat);
    stripe.position.y = 0.02;
    this.robotGroup.add(stripe);

    // Waist torus
    const waistTorus = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.055, 8, 32), accentMat);
    waistTorus.position.y = 0.02; waistTorus.rotation.x = Math.PI / 2;
    waistTorus.name = 'waistTorus';
    this.robotGroup.add(waistTorus);

    // ── SHOULDERS ─────────────────────────────────────────────────────
    [-0.9, 0.9].forEach(x => {
      const shGeo = new THREE.SphereGeometry(0.22, 16, 16);
      const sh = new THREE.Mesh(shGeo, accentMat);
      sh.position.set(x, 1.42, 0);
      this.robotGroup.add(sh);
      // shoulder accent disc
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16), purpleMat);
      disc.position.set(x, 1.42, 0);
      disc.rotation.z = Math.PI / 2;
      this.robotGroup.add(disc);
    });

    // ── ARMS ──────────────────────────────────────────────────────────
    const armGeo = new THREE.BoxGeometry(0.32, 1.05, 0.32);
    const lArm = new THREE.Mesh(armGeo, bodyMat); lArm.position.set(-1.04, 0.82, 0); lArm.name = 'leftArm';
    const rArm = new THREE.Mesh(armGeo, bodyMat); rArm.position.set( 1.04, 0.82, 0); rArm.name = 'rightArm';
    this.robotGroup.add(lArm, rArm);

    // Arm band accents
    [-1.04, 1.04].forEach(x => {
      [0.55, 0.18, -0.18].forEach(yOff => {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.34), x < 0 ? accentMat : purpleMat);
        band.position.set(x, yOff, 0);
        this.robotGroup.add(band);
      });
    });

    // Forearm units (lower arm rounded)
    [-1.04, 1.04].forEach(x => {
      const fa = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.3, 12), panelMat);
      fa.position.set(x, 0.27, 0);
      this.robotGroup.add(fa);
    });

    // ── LOWER BODY ────────────────────────────────────────────────────
    const lowerGeo = new THREE.BoxGeometry(1.22, 0.52, 0.82);
    const lower = new THREE.Mesh(lowerGeo, bodyMat);
    lower.position.y = -0.22;
    this.robotGroup.add(lower);

    // Lower front panels
    [[-0.36, -0.22, 0.42], [0.36, -0.22, 0.42]].forEach(([x, y, z]) => {
      const lp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.38, 0.08), panelMat);
      lp.position.set(x, y, z as number);
      this.robotGroup.add(lp);
    });

    // Bottom ring detail
    const bottomRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 28), glowMat);
    bottomRing.position.y = -0.48;
    bottomRing.rotation.x = Math.PI / 2;
    bottomRing.name = 'bottomRing';
    this.robotGroup.add(bottomRing);

    // Position & scale
    this.robotGroup.position.y = -0.8;
    this.robotGroup.scale.setScalar(0.82);
  }

  private createOrbitalParticles(): void {
    const colors = [0x06b6d4, 0x8b5cf6, 0x3b82f6, 0x10b981, 0xf59e0b];
    for (let i = 0; i < 14; i++) {
      const size = 0.04 + Math.random() * 0.07;
      const mat  = new THREE.MeshPhongMaterial({
        color: colors[i % colors.length],
        emissive: colors[i % colors.length],
        emissiveIntensity: 2.2,
        transparent: true,
        opacity: 0.75 + Math.random() * 0.2
      });
      const mesh    = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), mat);
      const radius  = 1.4 + Math.random() * 0.9;
      const angle   = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
      const speed   = 0.28 + Math.random() * 0.45;
      const yOffset = (Math.random() - 0.5) * 2.2;
      this.orbitals.push({ mesh, angle, radius, speed, yOffset });
      this.robotScene.add(mesh);
    }
  }

  private animateRobot = (): void => {
    this.animFrameId = requestAnimationFrame(this.animateRobot);
    const t = this.clock.getElapsedTime();
    const dt = 0.016;

    if (this.robotGroup) {
      // Floating
      this.robotGroup.position.y = -0.8 + Math.sin(t * 0.75) * 0.14;
      // Slow proud rotation
      this.robotGroup.rotation.y = Math.sin(t * 0.28) * 0.32;

      // Head look
      const head  = this.robotGroup.getObjectByName('head');
      const visor = this.robotGroup.getObjectByName('visor');
      const visorG = this.robotGroup.getObjectByName('visorGlow');
      if (head)  head.rotation.y  = Math.sin(t * 0.45) * 0.22;
      if (visor) visor.rotation.y = Math.sin(t * 0.45) * 0.22;
      if (visorG) visorG.rotation.y = Math.sin(t * 0.45) * 0.22;

      // Arms
      const lArm = this.robotGroup.getObjectByName('leftArm');
      const rArm = this.robotGroup.getObjectByName('rightArm');
      if (lArm) lArm.rotation.x = Math.sin(t * 0.55) * 0.14;
      if (rArm) rArm.rotation.x = Math.sin(t * 0.55 + Math.PI) * 0.14;

      // Waist torus spin
      const waist = this.robotGroup.getObjectByName('waistTorus');
      if (waist) waist.rotation.z = t * 0.4;

      // Chest emblem pulse
      const emblemRing = this.robotGroup.getObjectByName('emblemRing');
      const emblemCore = this.robotGroup.getObjectByName('emblemCore');
      if (emblemRing) {
        (emblemRing.material as THREE.MeshPhongMaterial).emissiveIntensity = 1.2 + Math.sin(t * 2.2) * 0.8;
        emblemRing.rotation.z = t * 0.6;
      }
      if (emblemCore) {
        (emblemCore.material as THREE.MeshPhongMaterial).emissiveIntensity = 1.8 + Math.sin(t * 2.2) * 1.0;
      }

      // Antenna tip pulse
      const tip = this.robotGroup.getObjectByName('antennaTip');
      if (tip) {
        tip.scale.setScalar(0.85 + Math.sin(t * 3.2) * 0.22);
        (tip.material as THREE.MeshPhongMaterial).emissiveIntensity = 1.5 + Math.sin(t * 3.2) * 1.2;
      }

      // Bottom ring spin
      const botRing = this.robotGroup.getObjectByName('bottomRing');
      if (botRing) {
        botRing.rotation.z = t * 0.7;
        (botRing.material as THREE.MeshPhongMaterial).emissiveIntensity = 1.0 + Math.sin(t * 1.8) * 0.6;
      }
    }

    // ── Orbital particles ─────────────────────────────────────────────
    const baseY = this.robotGroup ? this.robotGroup.position.y : -0.8;
    for (const orb of this.orbitals) {
      orb.angle += orb.speed * dt;
      orb.mesh.position.x = Math.cos(orb.angle) * orb.radius;
      orb.mesh.position.y = baseY + orb.yOffset + Math.sin(orb.angle * 0.5) * 0.35;
      orb.mesh.position.z = Math.sin(orb.angle) * orb.radius;
      (orb.mesh.material as THREE.MeshPhongMaterial).emissiveIntensity =
        1.4 + Math.sin(t * 2.8 + orb.angle) * 0.9;
    }

    this.robotRenderer.render(this.robotScene, this.robotCamera);
  };

  // ═══════ 3D BACKGROUND SCENE (Floating Cubes) ═══════
  private initBgScene(): void {
    const canvas = this.bgCanvasRef?.nativeElement;
    if (!canvas) return;

    this.bgScene = new THREE.Scene();
    this.bgCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.bgCamera.position.z = 30;

    this.bgRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    this.bgRenderer.setSize(window.innerWidth, window.innerHeight);
    this.bgRenderer.setPixelRatio(1);
    this.bgRenderer.setClearColor(0x000000, 0);

    const cubeColors = [0x3b82f6, 0x8b5cf6, 0x06b6d4, 0x10b981, 0x6366f1];
    for (let i = 0; i < 40; i++) {
      const size = Math.random() * 1.5 + 0.3;
      const geo = Math.random() > 0.5
        ? new THREE.BoxGeometry(size, size, size)
        : new THREE.OctahedronGeometry(size * 0.7, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: cubeColors[Math.floor(Math.random() * cubeColors.length)],
        wireframe: true,
        transparent: true,
        opacity: Math.random() * 0.15 + 0.05
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 40
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      mesh.userData['speedX'] = (Math.random() - 0.5) * 0.003;
      mesh.userData['speedY'] = (Math.random() - 0.5) * 0.003;
      mesh.userData['rotSpeedX'] = (Math.random() - 0.5) * 0.008;
      mesh.userData['rotSpeedY'] = (Math.random() - 0.5) * 0.008;
      this.bgCubes.push(mesh);
      this.bgScene.add(mesh);
    }

    window.addEventListener('resize', this.onResize);
    this.animateBg();
  }

  private onResize = (): void => {
    if (this.bgRenderer) {
      this.bgRenderer.setSize(window.innerWidth, window.innerHeight);
      this.bgCamera.aspect = window.innerWidth / window.innerHeight;
      this.bgCamera.updateProjectionMatrix();
    }
  };

  private animateBg = (): void => {
    this.bgAnimFrameId = requestAnimationFrame(this.animateBg);
    for (const cube of this.bgCubes) {
      cube.rotation.x += cube.userData['rotSpeedX'];
      cube.rotation.y += cube.userData['rotSpeedY'];
      cube.position.x += cube.userData['speedX'];
      cube.position.y += cube.userData['speedY'];
      // Wrap around
      if (cube.position.x > 45) cube.position.x = -45;
      if (cube.position.x < -45) cube.position.x = 45;
      if (cube.position.y > 35) cube.position.y = -35;
      if (cube.position.y < -35) cube.position.y = 35;
    }
    this.bgRenderer.render(this.bgScene, this.bgCamera);
  };

  // ═══════ DATA LOADING ═══════
  async loadDashboardData(): Promise<void> {
    try {
      const requests: Array<Promise<any>> = [
        this.dashboardService.getStats().toPromise(),
        this.ticketService.getTickets({ page: 0, size: this.isManagerView ? 60 : 5, sort: 'updatedAt,desc' }).toPromise()
      ];

      if (this.isManagerView) {
        requests.push(this.dashboardService.getAgentAvailability().toPromise());
      }

      const [stats, ticketsPage, availability] = await Promise.all(requests);

      this.stats = stats || null;
      this.managerTickets = ticketsPage?.content || [];
      this.recentTickets = this.managerTickets.slice(0, 5);
      this.managerAgentLoads = this.isManagerView
        ? this.buildManagerAgentLoads(availability || [], this.stats?.topAgents || [])
        : [];

      if (this.stats) {
        this.updateCharts();
        this.animateCounters();
        this.initSlaRings();
      }

      this.loading = false;
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.loading = false;
    }
  }

  get managerActionTickets(): Ticket[] {
    return [...this.managerTickets]
      .filter(ticket => this.needsManagerAttention(ticket))
      .sort((left, right) => this.getManagerTicketRank(right) - this.getManagerTicketRank(left))
      .slice(0, 6);
  }

  get unassignedManagerTickets(): Ticket[] {
    return this.managerTickets.filter(ticket => !ticket.assignedTo && !ticket.assignedAgent && !ticket.assignee);
  }

  get breachedManagerTickets(): Ticket[] {
    return this.managerTickets.filter(ticket => this.getTicketSlaState(ticket) === 'BREACHED');
  }

  get atRiskManagerTickets(): Ticket[] {
    return this.managerTickets.filter(ticket => this.getTicketSlaState(ticket) === 'AT_RISK');
  }

  get escalatedManagerTickets(): Ticket[] {
    return this.managerTickets.filter(ticket =>
      ticket.status === 'ESCALATED_SLA' ||
      ticket.status === 'ESCALATED_MANUAL' ||
      (ticket.escalationLevel ?? 0) > 0
    );
  }

  get managerPortfolios(): ManagerAgentPortfolio[] {
    const portfolios = new Map<string, ManagerAgentPortfolio>();
    const loadsById = new Map(this.managerAgentLoads.map(load => [load.agentId, load]));

    for (const ticket of this.managerTickets) {
      const assigned = ticket.assignedTo || ticket.assignedAgent || ticket.assignee;
      const key = assigned?.id ? `agent-${assigned.id}` : 'agent-unassigned';
      const load = assigned?.id ? loadsById.get(assigned.id) : undefined;
      const existing = portfolios.get(key) || {
        key,
        agentId: assigned?.id,
        agentName: assigned?.fullName || assigned?.firstName || 'Non assignes',
        loadPercent: load?.loadPercent || 0,
        currentTickets: load?.currentTickets || 0,
        maxTickets: load?.maxTickets || Math.max(1, this.unassignedManagerTickets.length),
        criticalTickets: 0,
        breachedTickets: 0,
        atRiskTickets: 0,
        tickets: [],
        status: load?.status,
        inShift: load?.inShift,
        statusReason: load?.statusReason
      };

      existing.tickets.push(ticket);
      if (ticket.priority === 'CRITICAL' || ticket.priority === 'SUPER_CRITICAL') {
        existing.criticalTickets += 1;
      }
      if (this.getTicketSlaState(ticket) === 'BREACHED') {
        existing.breachedTickets += 1;
      } else if (this.getTicketSlaState(ticket) === 'AT_RISK') {
        existing.atRiskTickets += 1;
      }

      portfolios.set(key, existing);
    }

    return [...portfolios.values()]
      .map(portfolio => ({
        ...portfolio,
        currentTickets: portfolio.currentTickets || portfolio.tickets.length,
        maxTickets: Math.max(portfolio.maxTickets || portfolio.tickets.length || 1, portfolio.tickets.length || 1),
        loadPercent: portfolio.loadPercent || Math.min(100, Math.round(((portfolio.currentTickets || portfolio.tickets.length || 0) / Math.max(portfolio.maxTickets || portfolio.tickets.length || 1, 1)) * 100)),
        tickets: [...portfolio.tickets]
          .sort((left, right) => this.getManagerTicketRank(right) - this.getManagerTicketRank(left))
          .slice(0, 3)
      }))
      .sort((left, right) => {
        const rightScore = right.criticalTickets * 4 + right.breachedTickets * 3 + right.atRiskTickets * 2 + right.currentTickets;
        const leftScore = left.criticalTickets * 4 + left.breachedTickets * 3 + left.atRiskTickets * 2 + left.currentTickets;
        return rightScore - leftScore;
      })
      .slice(0, 6);
  }

  get managerAlerts(): ManagerDashboardAlert[] {
    const alerts: ManagerDashboardAlert[] = [];

    for (const ticket of this.breachedManagerTickets.slice(0, 2)) {
      alerts.push({
        key: `breached-${ticket.id}`,
        level: 'critical',
        title: `${ticket.reference} depasse le SLA`,
        description: `${ticket.title} doit etre reattribue ou traite immediatement.`,
        ticket
      });
    }

    for (const portfolio of this.managerPortfolios
      .filter(item => item.loadPercent >= 90 || item.breachedTickets > 0)
      .slice(0, 2)) {
      const recommended = this.getRecommendedTransferTarget(portfolio);
      alerts.push({
        key: `portfolio-${portfolio.key}`,
        level: portfolio.breachedTickets > 0 ? 'critical' : 'warning',
        title: `${portfolio.agentName} est en surcharge`,
        description: recommended
          ? `Transfert conseille vers ${recommended.agentName}.`
          : 'Aucun agent de transfert ideal n est actuellement disponible.',
        portfolio
      });
    }

    if (this.unassignedManagerTickets.length > 0) {
      const firstUnassigned = this.unassignedManagerTickets[0];
      alerts.push({
        key: `unassigned-${firstUnassigned.id}`,
        level: 'info',
        title: `${this.unassignedManagerTickets.length} ticket(s) sans proprietaire`,
        description: `${firstUnassigned.reference} est en attente d affectation manager.`,
        ticket: firstUnassigned
      });
    }

    return alerts.slice(0, 5);
  }

  getManagerTicketContext(ticket: Ticket): string {
    if (ticket.nextExpectedAction) {
      return ticket.nextExpectedAction;
    }
    if (!ticket.assignedTo && !ticket.assignedAgent && !ticket.assignee) {
      return 'A assigner rapidement';
    }
    if (ticket.waitingOn === 'CLIENT') {
      return 'Attente de reponse client';
    }
    if (ticket.waitingOn === 'THIRD_PARTY') {
      return 'Attente tiers / fournisseur';
    }
    if (ticket.resolutionRejectedReason) {
      return 'Resolution refusee a reprendre';
    }
    if (ticket.lastCustomerResponseAt && ticket.status === 'IN_PROGRESS') {
      return 'Reponse client recue';
    }
    if (ticket.status === 'ESCALATED_SLA' || this.getTicketSlaState(ticket) === 'BREACHED') {
      return 'Escalade SLA a traiter';
    }
    if (ticket.status === 'ESCALATED_MANUAL') {
      return 'Escalade manuelle en supervision';
    }
    if (this.getTicketSlaState(ticket) === 'AT_RISK') {
      return 'SLA a risque';
    }
    if (ticket.priority === 'CRITICAL' || ticket.priority === 'SUPER_CRITICAL') {
      return 'Priorite critique';
    }
    return 'Suivi manager';
  }

  getAgentStatusLabel(status: string): string {
    switch (status) {
      case 'AVAILABLE':
        return 'Disponible';
      case 'BUSY':
        return 'Occupe';
      case 'ON_BREAK':
        return 'En pause';
      case 'OFFLINE':
        return 'Hors ligne';
      case 'AWAY':
        return 'Absent';
      default:
        return status || 'Statut inconnu';
    }
  }

  getAgentLoadTone(loadPercent: number): string {
    if (loadPercent >= 90) return 'load-danger';
    if (loadPercent >= 65) return 'load-warn';
    return 'load-ok';
  }

  getRecommendedTransferTarget(portfolio: ManagerAgentPortfolio): ManagerAgentLoad | null {
    return this.managerAgentLoads
      .filter(agent =>
        agent.agentId !== portfolio.agentId &&
        agent.status === 'AVAILABLE' &&
        agent.inShift &&
        agent.loadPercent < 65
      )
      .sort((left, right) => {
        if (left.loadPercent !== right.loadPercent) {
          return left.loadPercent - right.loadPercent;
        }
        return left.currentTickets - right.currentTickets;
      })[0] || null;
  }

  canManagerQuickAction(ticket: Ticket, action: 'assign' | 'take-charge' | 'manager-review'): boolean {
    return this.authService.canActOnTicket(ticket, action);
  }

  assignFromDashboard(ticket: Ticket): void {
    if (!ticket?.id || !this.canManagerQuickAction(ticket, 'assign')) {
      return;
    }

    const dialogRef = this.dialog.open(AssignDialogComponent, {
      width: '720px',
      disableClose: false,
      data: {
        currentAgentId: ticket.assignedTo?.id ?? ticket.assignedAgent?.id ?? ticket.assignee?.id ?? null,
        ticketId: ticket.id
      } as AssignDialogData
    });

    dialogRef.afterClosed().subscribe((result?: AssignDialogResult) => {
      if (!result?.agentId) {
        return;
      }

      this.ticketService.assignTicket(ticket.id!, result.agentId, result.source).subscribe({
        next: () => {
          this.snackBar.open('Ticket assigne depuis le dashboard manager', 'Fermer', { duration: 3000 });
          this.loadDashboardData();
        },
        error: (error) => {
          console.error('Error assigning ticket from dashboard:', error);
          const message = error?.error?.message || 'Erreur lors de l assignation';
          this.snackBar.open(message, 'Fermer', { duration: 4000 });
        }
      });
    });
  }

  takeChargeFromDashboard(ticket: Ticket): void {
    if (!ticket?.id || !this.canManagerQuickAction(ticket, 'take-charge')) {
      return;
    }

    this.ticketService.takeCharge(ticket.id).subscribe({
      next: () => {
        this.snackBar.open('Ticket pris en charge depuis le dashboard', 'Fermer', { duration: 3000 });
        this.loadDashboardData();
      },
      error: (error) => {
        console.error('Error taking charge from dashboard:', error);
        const message = error?.error?.message || 'Erreur lors de la prise en charge';
        this.snackBar.open(message, 'Fermer', { duration: 4000 });
      }
    });
  }

  requestManagerReviewFromDashboard(ticket: Ticket): void {
    if (!ticket?.id || !this.canManagerQuickAction(ticket, 'manager-review')) {
      return;
    }

    this.ticketService.requestManagerReview(ticket.id, 'Revue manager demandee depuis le dashboard').subscribe({
      next: () => {
        this.snackBar.open('Revue manager demandee', 'Fermer', { duration: 3000 });
        this.loadDashboardData();
      },
      error: (error) => {
        console.error('Error requesting manager review from dashboard:', error);
        const message = error?.error?.message || 'Erreur lors de la demande de revue manager';
        this.snackBar.open(message, 'Fermer', { duration: 4000 });
      }
    });
  }

  rebalancePortfolio(portfolio: ManagerAgentPortfolio): void {
    const target = this.getPortfolioRebalanceTarget(portfolio);
    if (!target) {
      this.snackBar.open('Aucun ticket reassignable dans ce portefeuille', 'Fermer', { duration: 3000 });
      return;
    }
    this.assignFromDashboard(target);
  }

  // ═══════ CARD PARALLAX TILT ═══════
  tiltCard(event: MouseEvent): void {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const cx = rect.width  / 2;
    const cy = rect.height / 2;
    const rotY =  ((x - cx) / cx) * 8;
    const rotX = -((y - cy) / cy) * 5;
    el.style.transform  = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px) scale(1.01)`;
    el.style.transition = 'transform 0.08s ease';
    el.style.zIndex     = '5';
  }

  resetCard(event: MouseEvent): void {
    const el = event.currentTarget as HTMLElement;
    el.style.transform  = '';
    el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
    el.style.zIndex     = '';
  }

  // ═══════ ANIMATED COUNTERS ═══════
  animateCounters(): void {
    if (!this.stats) return;
    const targets = {
      totalTickets:    this.stats.totalTickets    || 0,
      openTickets:     this.stats.openTickets     || 0,
      resolvedTickets: this.stats.resolvedTickets || 0,
      urgentTickets:   this.stats.urgentTickets   || 0
    };
    const duration = 1500;
    const startTime = performance.now();
    const keys = Object.keys(targets) as Array<keyof typeof targets>;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const prog    = Math.min(elapsed / duration, 1);
      const eased   = 1 - Math.pow(1 - prog, 3); // ease-out cubic
      this.ngZone.run(() => {
        for (const k of keys) {
          this.displayStats[k] = Math.round(targets[k] * eased);
        }
      });
      if (prog < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ═══════ SLA RING DATA ═══════
  initSlaRings(): void {
    const s = this.stats!;
    const buildOffsets = (pct: number) => ({
      offset:      314.16 * (1 - Math.min(Math.max(pct, 0), 100) / 100),
      innerOffset: 270.18 * (1 - Math.min(Math.max(pct, 0), 100) / 100)
    });

    const compliance = s.slaComplianceRate || 0;
    const onTrackPct = s.openTickets > 0
      ? Math.round(((s.slaOnTrackTickets || 0) / (s.openTickets || 1)) * 100) : 0;
    const resolvePct = s.totalTickets > 0
      ? Math.round(((s.resolvedTickets  || 0) / (s.totalTickets  || 1)) * 100) : 0;

    const complianceColor  = compliance  >= 80 ? '#34d399' : compliance  >= 50 ? '#fbbf24' : '#f87171';
    const onTrackColor     = onTrackPct  >= 80 ? '#06b6d4' : onTrackPct  >= 50 ? '#fbbf24' : '#f97316';
    const resolveColor     = resolvePct  >= 60 ? '#10b981' : '#3b82f6';

    this.slaRings = [
      {
        name: 'Conformité SLA',
        value: compliance,
        displayValue: `${Math.round(compliance)}%`,
        unit: 'COMPLIANCE',
        color: complianceColor,
        glowColor: `${complianceColor}40`,
        sublabel: compliance >= 80 ? 'EXCELLENT' : compliance >= 50 ? 'ATTENTION' : 'CRITIQUE',
        ...buildOffsets(compliance)
      },
      {
        name: 'Tickets SLA OK',
        value: onTrackPct,
        displayValue: `${onTrackPct}%`,
        unit: 'ON TRACK',
        color: onTrackColor,
        glowColor: `${onTrackColor}40`,
        sublabel: `${s.slaOnTrackTickets || 0} tickets`,
        ...buildOffsets(onTrackPct)
      },
      {
        name: 'Taux Résolution',
        value: resolvePct,
        displayValue: `${resolvePct}%`,
        unit: 'RÉSOLUTION',
        color: resolveColor,
        glowColor: `${resolveColor}40`,
        sublabel: 'TAUX GLOBAL',
        ...buildOffsets(resolvePct)
      },
      {
        name: 'Total Tickets',
        value: Math.min(s.totalTickets || 0, 100),
        displayValue: `${s.totalTickets || 0}`,
        unit: 'TICKETS',
        color: '#8b5cf6',
        glowColor: 'rgba(139,92,246,0.25)',
        sublabel: 'PORTEFEUILLE',
        ...buildOffsets(Math.min(s.totalTickets || 0, 100))
      },
      {
        name: 'Résolus Aujourd\'hui',
        value: Math.min((s.resolvedToday || 0) * 10, 100),
        displayValue: `${s.resolvedToday || 0}`,
        unit: 'RÉSOLUS',
        color: '#34d399',
        glowColor: 'rgba(52,211,153,0.25)',
        sublabel: 'AUJOURD\'HUI',
        ...buildOffsets(Math.min((s.resolvedToday || 0) * 10, 100))
      },
      {
        name: 'Temps Moyen',
        value: Math.max(0, Math.min(100, 100 - (s.avgResolutionTime || 0))),
        displayValue: s.avgResolutionTime ? `${Math.round(s.avgResolutionTime)}h` : '—',
        unit: 'RÉSOLUTION',
        color: '#f59e0b',
        glowColor: 'rgba(245,158,11,0.25)',
        sublabel: s.avgResolutionTime ? `${Math.round(s.avgResolutionTime)}h moy.` : 'N/A',
        ...buildOffsets(Math.max(0, Math.min(100, 100 - (s.avgResolutionTime || 0))))
      }
    ];
  }

  updateCharts(): void {
    if (!this.stats) return;

    if (this.stats.ticketsByStatus) {
      const statusOrder: TicketStatus[] = ['NEW', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ESCALATED_MANUAL', 'ESCALATED_SLA', 'RESOLVED', 'CLOSED'];
      this.statusChartData.datasets[0].data = statusOrder.map(
        status => this.stats!.ticketsByStatus![status] || 0
      );
    }

    if (this.stats.ticketsByPriority) {
      const priorityOrder: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'SUPER_CRITICAL'];
      this.priorityChartData.datasets[0].data = priorityOrder.map(
        priority => this.stats!.ticketsByPriority![priority] || 0
      );
    }

    const trend = (this.stats.dailyTrend || this.stats.ticketsTrend || []).slice(-7);
    const labels = trend.map(point =>
      new Date(point.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
    );
    const data = trend.map(point => point.created || 0);
    this.weeklyChartData.labels = labels;
    this.weeklyChartData.datasets[0].data = data;
  }

  getStatusLabel(status: TicketStatus): string {
    const labels: Record<TicketStatus, string> = {
      'NEW': 'Nouveau', 'OPEN': 'Ouvert', 'ASSIGNED': 'Assigné',
      'IN_PROGRESS': 'En cours', 'PENDING': 'En attente',
      'ESCALATED_MANUAL': 'Escalade manuelle', 'ESCALATED_SLA': 'Escalade active',
      'RESOLVED': 'Résolu', 'CLOSED': 'Fermé', 'CANCELLED': 'Annulé'
    };
    return labels[status] || status;
  }

  getPriorityLabel(priority: TicketPriority): string {
    const labels: Record<TicketPriority, string> = {
      'LOW': 'Basse', 'MEDIUM': 'Moyenne', 'HIGH': 'Haute', 'CRITICAL': 'Critique', 'SUPER_CRITICAL': 'Super Critique'
    };
    return labels[priority] || priority;
  }

  setSlaFilter(filter: 'ALL' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED'): void {
    this.slaFilter = filter;
  }

  get filteredRecentTickets(): Ticket[] {
    if (this.slaFilter === 'ALL') return this.recentTickets;
    return this.recentTickets.filter(ticket => this.getTicketSlaState(ticket) === this.slaFilter);
  }

  getTicketSlaState(ticket: Ticket): string {
    if ((ticket.escalationLevel ?? 0) >= 2 || ticket.legacyEscalated) {
      return 'BREACHED';
    }
    return ticket.slaPhase || ticket.slaState || 'ON_TRACK';
  }

  isSlaCriticalTicket(ticket: Ticket): boolean {
    if (!ticket) return false;
    if ((ticket.escalationLevel ?? 0) >= 2 || ticket.legacyEscalated || ticket.slaPhase === 'BREACHED' || ticket.slaState === 'BREACHED' || ticket.slaBreached) {
      return true;
    }
    if (!ticket.createdAt || !ticket.slaDeadline) return false;
    const start = new Date(ticket.createdAt).getTime();
    const end = new Date(ticket.slaDeadline).getTime();
    const now = Date.now();
    const total = end - start;
    if (total <= 0) return true;
    return ((now - start) / total) * 100 >= 80;
  }

  exportDashboard(): void {
    window.print();
  }

  private buildManagerAgentLoads(availability: AgentAvailability[], topAgents: AgentPerformance[]): ManagerAgentLoad[] {
    const topAgentsById = new Map(topAgents.map(agent => [agent.agentId, agent]));
    return availability
      .map(agent => {
        const performance = topAgentsById.get(agent.agentId);
        const currentTickets = Number(agent.currentTicketCount || 0);
        const maxTickets = Math.max(Number(agent.maxConcurrentTickets || 0), currentTickets, 1);
        const loadPercent = Math.min(100, Math.round((currentTickets / maxTickets) * 100));
        const averageResolutionHours = performance?.averageResolutionTime ?? performance?.avgResolutionTime;

        return {
          agentId: agent.agentId,
          agentName: agent.agentName,
          status: agent.status,
          statusReason: agent.statusReason || undefined,
          inShift: agent.isInShift !== false,
          currentTickets,
          maxTickets,
          loadPercent,
          averageResolutionLabel: performance?.formattedAverageResolutionTime
            || (averageResolutionHours ? `${Math.round(averageResolutionHours)}h moy.` : undefined),
          satisfactionLabel: performance?.averageSatisfactionRating != null
            ? `${performance.averageSatisfactionRating.toFixed(1)}/5 sat.`
            : undefined,
          slaLabel: performance?.slaComplianceRate != null
            ? `${Math.round(performance.slaComplianceRate)}% SLA`
            : undefined
        };
      })
      .sort((left, right) => {
        if (right.loadPercent !== left.loadPercent) {
          return right.loadPercent - left.loadPercent;
        }
        return left.agentName.localeCompare(right.agentName);
      })
      .slice(0, 8);
  }

  private needsManagerAttention(ticket: Ticket): boolean {
    if (!ticket) {
      return false;
    }
    const isUnassigned = !ticket.assignedTo && !ticket.assignedAgent && !ticket.assignee;
    return (
      isUnassigned ||
      this.getTicketSlaState(ticket) === 'BREACHED' ||
      this.getTicketSlaState(ticket) === 'AT_RISK' ||
      ticket.status === 'ESCALATED_SLA' ||
      ticket.status === 'ESCALATED_MANUAL' ||
      ticket.priority === 'CRITICAL' ||
      ticket.priority === 'SUPER_CRITICAL'
    );
  }

  private getManagerTicketRank(ticket: Ticket): number {
    let score = 0;
    if (!ticket.assignedTo && !ticket.assignedAgent && !ticket.assignee) score += 40;
    if (this.getTicketSlaState(ticket) === 'BREACHED') score += 35;
    if (this.getTicketSlaState(ticket) === 'AT_RISK') score += 20;
    if (ticket.status === 'ESCALATED_SLA') score += 25;
    if (ticket.status === 'ESCALATED_MANUAL') score += 18;
    if (ticket.priority === 'SUPER_CRITICAL') score += 30;
    if (ticket.priority === 'CRITICAL') score += 20;
    if (ticket.priority === 'HIGH') score += 10;
    return score;
  }

  private getPortfolioRebalanceTarget(portfolio: ManagerAgentPortfolio): Ticket | null {
    return [...portfolio.tickets]
      .filter(ticket => this.canManagerQuickAction(ticket, 'assign'))
      .sort((left, right) => this.getManagerTicketRank(right) - this.getManagerTicketRank(left))[0] || null;
  }
}
