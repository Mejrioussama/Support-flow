import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatListModule } from '@angular/material/list';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { TicketService, AuthService, WebSocketService, UserService, AIService, AICopilot, AIKnowledgeDraft, NotificationService, KnowledgeBaseService } from '@core/services';
import { Ticket, Comment, Attachment, TicketArchiveDocument as TicketArchiveDocumentApi, TicketHistoryEntry, TicketStatus, TicketPriority, UserSummary, WorkflowStatus, WorkflowTrace, Notification, WaitingOn, isSlaNotification, KnowledgeArticle } from '@core/models';
import { environment } from '@env/environment';
import { EscalateDialogComponent, EscalateDialogResult } from '../escalate-dialog/escalate-dialog.component';
import { AssignDialogComponent, AssignDialogResult, AssignDialogData } from '../assign-dialog/assign-dialog.component';
import {
  ValidateResolutionDialogComponent,
  ValidateResolutionDialogData,
  ValidateResolutionDialogResult
} from '../validate-resolution-dialog/validate-resolution-dialog.component';
import {
  ValidationSuccessDialogComponent,
  ValidationSuccessDialogData,
  ValidationSuccessDialogResult
} from '../validation-success-dialog/validation-success-dialog.component';
import { ResolveDialogComponent, ResolveDialogResult } from '../resolve-dialog/resolve-dialog.component';
import { AlfrescoPreviewDialogComponent, AlfrescoPreviewDialogData } from '../alfresco-preview-dialog/alfresco-preview-dialog.component';
import {
  TicketWorkflowActionDialogComponent,
  TicketWorkflowActionDialogData,
  TicketWorkflowActionDialogResult
} from '../ticket-workflow-action-dialog/ticket-workflow-action-dialog.component';

type TicketAlfrescoDocument = {
  id: string;
  label: string;
  kind: 'archive' | 'folder' | 'document' | 'attachment';
  synced: boolean;
  ref?: string | null;
  relativePath?: string | null;
  mimeType?: string | null;
  meta?: string | null;
  attachment?: Attachment;
};

type TicketAlfrescoTreeRow = TicketAlfrescoDocument & {
  depth: number;
  displayLabel: string;
  isFolderLike: boolean;
};

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatDialogModule,
    AlfrescoPreviewDialogComponent
  ],
  template: `
    <div class="ticket-detail-ui">
      @if (loading) {
        <div class="loading-state glass-card">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Synchronisation du ticket en cours...</p>
        </div>
      } @else if (ticket) {
        <div class="cosmos-shell">
          <div class="shell-body">
            <div class="content-area content-area--full">
              <section class="hero glass-card reveal delay-2">
          <div class="hero-top-line">
            <a routerLink="/tickets" class="breadcrumb-link">Tickets</a>
            <mat-icon>chevron_right</mat-icon>
            <span>{{ ticket.reference }}</span>
          </div>

          <div class="hero-grid">
            <div class="hero-main">
              <div class="hero-badges">
                <span class="chip-id">{{ ticket.reference }}</span>
                <span class="status-badge" [class]="'status-' + ticket.status.toLowerCase()">{{ getStatusLabel(ticket.status) }}</span>
                <span class="priority-badge" [class]="'priority-' + ticket.priority.toLowerCase()">{{ getPriorityLabel(ticket.priority) }}</span>
                @if (ticket.archived) {
                  <span class="archive-badge"><mat-icon>inventory_2</mat-icon>Archive</span>
                }
                @if (workflowStatus) {
                  <span class="archive-badge" [matTooltip]="workflowStatus.currentActivity || ''">
                    <mat-icon>account_tree</mat-icon>
                    WF {{ getWorkflowStatusLabel() }}
                  </span>
                }
              </div>

              <h1>{{ ticket.title }}</h1>
              <p class="hero-meta">
                Signale par {{ ticket.createdByUser?.firstName || getClientDisplayName() || 'Client' }}
                • {{ ticket.createdAt | date:'dd MMM yyyy, HH:mm' }}
              </p>
            </div>

            <div class="hero-actions">
              <div
                class="action-summary-panel"
                [class.action-summary-panel--urgent]="getActionTone() === 'urgent'"
                [class.action-summary-panel--pending]="getActionTone() === 'pending'"
                [class.action-summary-panel--stable]="getActionTone() === 'stable'">
                <span class="action-summary-panel__eyebrow">Centre de pilotage</span>
                <strong>{{ getRecommendedActionLabel() }}</strong>
                <p>{{ getRecommendedActionDescription() }}</p>
                <div class="action-summary-panel__meta">
                  <span>
                    <mat-icon>person</mat-icon>
                    {{ getAssignedAgentDisplayName() || 'Non assigne' }}
                  </span>
                  <span>
                    <mat-icon>schedule</mat-icon>
                    {{ getSlaPhaseLabel() }}
                  </span>
                </div>
              </div>

              <div class="hero-actions__grid">
                @if (canAct('assign')) {
                  <button
                    mat-stroked-button
                    class="action-btn action-btn--secondary"
                    [disabled]="!canTriggerAction('assign')"
                    [matTooltip]="getActionTooltip('assign')"
                    (click)="openAssignDialog()">
                    <mat-icon>person_add</mat-icon>
                    <span class="action-btn__content">
                      <span class="action-btn__label">Assigner</span>
                      <span class="action-btn__hint">Choisir le bon owner</span>
                    </span>
                  </button>
                }
                @if (canAct('take-charge')) {
                  <button
                    mat-raised-button
                    color="primary"
                    class="action-btn action-btn--primary"
                    [disabled]="!canTriggerAction('take-charge')"
                    [matTooltip]="getActionTooltip('take-charge')"
                    (click)="takeCharge()">
                    <mat-icon>bolt</mat-icon>
                    <span class="action-btn__content">
                      <span class="action-btn__label">Prendre le ticket</span>
                      <span class="action-btn__hint">Lancer le traitement</span>
                    </span>
                  </button>
                }
                @if (canAct('resolve')) {
                  <button
                    mat-raised-button
                    color="accent"
                    class="action-btn action-btn--success"
                    [disabled]="!canTriggerAction('resolve')"
                    [matTooltip]="getActionTooltip('resolve')"
                    (click)="resolveTicket()">
                    <mat-icon>task_alt</mat-icon>
                    <span class="action-btn__content">
                      <span class="action-btn__label">Resoudre</span>
                      <span class="action-btn__hint">Formaliser la solution</span>
                    </span>
                  </button>
                }
                @if (canAct('escalate')) {
                  <button
                    mat-stroked-button
                    color="warn"
                    class="action-btn action-btn--danger"
                    [disabled]="!canTriggerAction('escalate')"
                    [matTooltip]="getActionTooltip('escalate')"
                    (click)="escalateTicket()">
                    <mat-icon>trending_up</mat-icon>
                    <span class="action-btn__content">
                      <span class="action-btn__label">Escalader</span>
                      <span class="action-btn__hint">Faire intervenir un niveau superieur</span>
                    </span>
                  </button>
                }
              </div>
            </div>
          </div>

          @if (ticket.slaState === 'AT_RISK' || ticket.slaState === 'BREACHED' || (ticket.escalationLevel && ticket.escalationLevel > 1) || ticket.legacyEscalated || ticket.slaPaused || getSlaProgressPercent() >= 75) {
            <div class="sla-banner" [class.breached]="ticket.slaState === 'BREACHED' || (ticket.escalationLevel && ticket.escalationLevel > 1) || ticket.legacyEscalated" [class.paused]="ticket.slaPaused" [class.critical]="ticket.slaState === 'AT_RISK'">
              <mat-icon>{{ ticket.slaPaused ? 'pause_circle' : (isSlaBreached() ? 'error' : 'schedule') }}</mat-icon>
              <div>
                <strong>{{ getSlaPhaseLabel() }}</strong>
                <p>{{ ticket.slaPaused ? 'Chrono SLA en pause' : (getSlaProgressPercent() | number:'1.0-0') + '% — Reste: ' + getSlaRemainingText() }}</p>
              </div>
            </div>
          }
          <div class="ticket-signal-strip">
            <button type="button" class="signal-pill" (click)="activeTab = 'workflow'">
              <span class="signal-pill__label">Alertes SLA</span>
              <span class="signal-pill__count">{{ ticketSlaAlertsCount }}</span>
            </button>
            <button type="button" class="signal-pill" (click)="activeTab = 'history'">
              <span class="signal-pill__label">Notifications</span>
              <span class="signal-pill__count">{{ ticketUnreadNotificationsCount }}</span>
            </button>
            <button type="button" class="signal-pill" (click)="activeTab = 'history'">
              <span class="signal-pill__label">Actions requises</span>
              <span class="signal-pill__count">{{ ticketActionRequiredCount }}</span>
            </button>
          </div>
            </section>

              <section class="layout-grid">
            <article class="main-panel glass-card reveal delay-3">
            <div class="tab-row">
              <button [class.active]="activeTab === 'details'" (click)="activeTab = 'details'">Details</button>
              <button [class.active]="activeTab === 'attachments'" (click)="activeTab = 'attachments'">Pieces jointes ({{ ticket.attachments?.length || 0 }})</button>
              <button [class.active]="activeTab === 'comments'" (click)="activeTab = 'comments'">Commentaires ({{ ticket.comments?.length || 0 }})</button>
              <button [class.active]="activeTab === 'workflow'" (click)="activeTab = 'workflow'">Workflow</button>
              <button [class.active]="activeTab === 'history'" (click)="activeTab = 'history'">Historique</button>
            </div>

            <div class="tab-body">
              @if (activeTab === 'details') {
                <div class="details-grid">
                  <div class="detail-block">
                    <h3>Issue Summary</h3>
                    <p>{{ ticket.description || 'Aucun descriptif detaille fourni pour ce ticket.' }}</p>
                  </div>
                  <div class="meta-cards">
                    <div class="meta-card">
                      <span>Impact Level</span>
                      <strong>{{ getPriorityLabel(ticket.priority) }}</strong>
                    </div>
                    <div class="meta-card">
                      <span>System Node</span>
                      <strong>{{ ticket.reference }}</strong>
                    </div>
                  </div>
                </div>

                @if (!isClient) {
                  <div class="copilot-inline glass-card">
                    <div class="copilot-header">
                      <div>
                        <h3>AI Copilot</h3>
                        <p>Résumé opérationnel du ticket</p>
                      </div>
                      <button mat-stroked-button class="copilot-refresh" [disabled]="copilotLoading || !ticket?.id" (click)="loadCopilot()">
                        <mat-icon>{{ copilotLoading ? 'hourglass_top' : 'auto_awesome' }}</mat-icon>
                        {{ copilotLoading ? 'Analyse...' : 'Actualiser' }}
                      </button>
                    </div>

                    @if (copilotError) {
                      <div class="copilot-error">{{ copilotError }}</div>
                    } @else if (copilotLoading && !copilotData) {
                      <div class="copilot-loading">
                        <mat-spinner diameter="26"></mat-spinner>
                        <span>Le copilot prépare une synthèse du ticket...</span>
                      </div>
                    } @else if (copilotData) {
                      <div class="copilot-meta">
                        <span>{{ copilotData.model }}</span>
                        <span>{{ copilotData.duration_s | number:'1.1-1' }}s</span>
                      </div>

                      <div class="copilot-grid">
                        <div class="copilot-section copilot-section--wide">
                          <span class="copilot-label">Résumé</span>
                          <p>{{ copilotData.copilot.SUMMARY || 'Résumé indisponible.' }}</p>
                        </div>

                        <div class="copilot-section">
                          <span class="copilot-label">Cause probable</span>
                          <p>{{ copilotData.copilot.LIKELY_CAUSE || 'Cause non déterminée.' }}</p>
                        </div>

                        <div class="copilot-section">
                          <span class="copilot-label">Réponse client suggérée</span>
                          <p>{{ copilotData.copilot.CUSTOMER_REPLY || 'Réponse client non disponible.' }}</p>
                        </div>

                        <div class="copilot-section copilot-section--wide">
                          <span class="copilot-label">Prochaines actions</span>
                          <div class="copilot-pills">
                            @for (item of splitCopilotField(copilotData.copilot.NEXT_ACTIONS); track item) {
                              <span class="copilot-pill">{{ item }}</span>
                            }
                          </div>
                        </div>

                        @if (splitCopilotField(copilotData.copilot.RISKS).length > 0) {
                          <div class="copilot-section">
                            <span class="copilot-label">Risques</span>
                            <div class="copilot-pills">
                              @for (item of splitCopilotField(copilotData.copilot.RISKS); track item) {
                                <span class="copilot-pill copilot-pill--risk">{{ item }}</span>
                              }
                            </div>
                          </div>
                        }

                        @if (splitCopilotField(copilotData.copilot.KB_HINTS).length > 0) {
                          <div class="copilot-section">
                            <span class="copilot-label">Pistes KB</span>
                            <div class="copilot-pills">
                              @for (item of splitCopilotField(copilotData.copilot.KB_HINTS); track item) {
                                <span class="copilot-pill copilot-pill--kb">{{ item }}</span>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <p class="empty-text">Aucune synthèse IA disponible pour ce ticket.</p>
                    }
                  </div>
                }

                <div class="attachments-preview">
                  <h3>Pieces Jointes</h3>
                  @if (ticket.attachments && ticket.attachments.length > 0) {
                    <div class="preview-list">
                      @for (attachment of ticket.attachments.slice(0, 4); track attachment.id) {
                        <button class="preview-item" (click)="downloadAttachment(attachment)">
                          <mat-icon>description</mat-icon>
                          <div>
                            <strong>{{ attachment.originalName || attachment.fileName }}</strong>
                            <span>{{ attachment.fileSize | number }} bytes</span>
                          </div>
                        </button>
                      }
                    </div>
                  } @else {
                    <p class="empty-text">Aucune piece jointe pour le moment.</p>
                  }
                </div>

                <div class="quick-communication">
                  <h3>Communications</h3>
                  @if (ticket.comments && ticket.comments.length > 0) {
                    <div class="comments-list">
                      @for (comment of ticket.comments.slice(0, 2); track comment.id) {
                        @if (!comment.isInternal || !isClient) {
                          <div class="comment" [class.internal]="comment.isInternal">
                            <div class="comment-avatar">{{ getInitials(comment.author?.firstName, comment.author?.lastName) }}</div>
                            <div class="comment-content">
                              <div class="comment-head">
                                <strong>{{ comment.author?.firstName }} {{ comment.author?.lastName }}</strong>
                                <span>{{ comment.createdAt | date:'HH:mm' }}</span>
                              </div>
                              <p>{{ comment.content }}</p>
                            </div>
                          </div>
                        }
                      }
                    </div>
                  }
                  <div class="send-box">
                    <textarea rows="2" [(ngModel)]="newComment" placeholder="Write a response..."></textarea>
                    <button mat-mini-fab color="primary" [disabled]="!newComment.trim()" (click)="addComment()">
                      <mat-icon>send</mat-icon>
                    </button>
                  </div>
                </div>
              }

              @if (activeTab === 'attachments') {
                <div class="upload-area">
                  <mat-icon>cloud_upload</mat-icon>
                  <p>Selectionner un fichier a joindre au ticket</p>
                  <button mat-stroked-button (click)="fileInput.click()">
                    <mat-icon>attach_file</mat-icon>
                    Parcourir
                  </button>
                  <input #fileInput type="file" hidden (change)="onFileSelected($event)">
                </div>

                @if (selectedFile) {
                  <div class="upload-form">
                    <p>Fichier: {{ selectedFile.name }}</p>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Description</mat-label>
                      <input matInput [(ngModel)]="attachmentDescription">
                    </mat-form-field>
                    <button mat-raised-button color="primary" (click)="uploadSelectedFile()">Uploader</button>
                  </div>
                }

                @if (ticket.attachments && ticket.attachments.length > 0) {
                  <mat-list class="attachments-list">
                    @for (attachment of ticket.attachments; track attachment.id) {
                      <mat-list-item>
                        <mat-icon matListItemIcon>description</mat-icon>
                        <span matListItemTitle>{{ attachment.originalName || attachment.fileName }}</span>
                        <span matListItemLine>{{ attachment.fileSize | number }} bytes</span>
                        <button mat-icon-button (click)="downloadAttachment(attachment)"><mat-icon>download</mat-icon></button>
                        @if (!isClient) {
                          <button mat-icon-button color="warn" (click)="removeAttachment(attachment)"><mat-icon>delete</mat-icon></button>
                        }
                      </mat-list-item>
                    }
                  </mat-list>
                } @else {
                  <p class="empty-text">Aucune piece jointe.</p>
                }
              }

              @if (activeTab === 'comments') {
                <div class="comment-editor">
                  <textarea rows="4" [(ngModel)]="newComment" placeholder="Ecrire une reponse..."></textarea>
                  <button mat-raised-button color="primary" [disabled]="!newComment.trim()" (click)="addComment()">Envoyer</button>
                </div>

                <div class="comments-list full-list">
                  @if (ticket.comments && ticket.comments.length > 0) {
                    @for (comment of ticket.comments; track comment.id) {
                      @if (!comment.isInternal || !isClient) {
                        <div class="comment" [class.internal]="comment.isInternal">
                          <div class="comment-avatar">{{ getInitials(comment.author?.firstName, comment.author?.lastName) }}</div>
                          <div class="comment-content">
                            <div class="comment-head">
                              <strong>{{ comment.author?.firstName }} {{ comment.author?.lastName }}</strong>
                              <span>{{ comment.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                            </div>
                            <p>{{ comment.content }}</p>
                          </div>
                        </div>
                      }
                    }
                  } @else {
                    <p class="empty-text">Aucun commentaire.</p>
                  }
                </div>
              }

              @if (activeTab === 'history') {
                <div class="history-list">
                  @if (ticketHistory.length > 0) {
                    @for (entry of ticketHistory; track entry.id) {
                      <div class="history-item">
                        <div class="dot"></div>
                        <div>
                          <strong>{{ entry.description || formatHistory(entry) }}</strong>
                          <span>{{ entry.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                        </div>
                      </div>
                    }
                  } @else {
                    <p class="empty-text">Aucun historique.</p>
                  }
                </div>
              }

              @if (activeTab === 'workflow') {
                <div class="process-tracker">
                  <div class="pt-header">
                    <span class="pt-title">Process Camunda</span>
                    <span class="pt-instance" *ngIf="workflowStatus">
                      {{ workflowStatus.processDefinitionKey || workflowStatus.processInstanceId }} · {{ getWorkflowStatusLabel() }}
                    </span>
                  </div>

                  <div class="pt-flow">
                    @for (step of workflowTrace?.steps || []; track $index; let i = $index) {
                      @if (i > 0) {
                        <div class="pt-connector">
                          <div class="pt-line" [class.done]="isStepDone(i - 1)"></div>
                        </div>
                      }
                      <div class="pt-node"
                           [class.selected]="selectedStep === $index"
                           (click)="selectedStep = selectedStep === $index ? -1 : $index">
                        <div class="pt-circle" [class.done]="step.endTime" [class.active]="!step.endTime">
                          <mat-icon>{{ getStepIcon(step) }}</mat-icon>
                          <div class="pt-check" *ngIf="step.endTime">
                            <mat-icon>check</mat-icon>
                          </div>
                          <div class="pt-spinner" *ngIf="!step.endTime"></div>
                        </div>
                        <div class="pt-label" [class.done]="step.endTime" [class.active]="!step.endTime">
                          {{ step.activityName || step.activityId }}
                        </div>
                        <div class="pt-time">{{ (step.endTime || step.startTime) | date:'HH:mm:ss' }}</div>
                      </div>
                    }
                  </div>

                  @if (selectedStep >= 0 && workflowTrace?.steps?.[selectedStep]) {
                    <div class="pt-detail">
                      <strong>{{ workflowTrace!.steps![selectedStep].activityName }}</strong>
                      <div>Début : {{ workflowTrace!.steps![selectedStep].startTime | date:'HH:mm:ss' }}</div>
                      <div *ngIf="workflowTrace!.steps![selectedStep].endTime">
                        Fin : {{ workflowTrace!.steps![selectedStep].endTime | date:'HH:mm:ss' }}
                      </div>
                      <div *ngIf="!workflowTrace!.steps![selectedStep].endTime" style="color: var(--accent)">
                        En cours…
                      </div>
                    </div>
                  }

                  <div class="pt-sla">
                    <span class="pt-sla-title">Surveillance SLA</span>
                    <div class="pt-sla-pills">
                      <span class="sla-pill" [class.triggered]="getSlaProgressPercent() >= 75">75%</span>
                      <span class="sla-pill escalade" [class.triggered]="isSlaBreached()">100%</span>
                    </div>
                  </div>
                </div>
              }
            </div>
          </article>

          <aside class="side-column">
            @if (ticket.slaDeadline) {
              <div class="side-card sla-card glass-card reveal delay-4" [class]="'sla-state--' + getSlaProgressClass()">
                <div class="sla-header">
                  <h3>SLA</h3>
                  <span class="sla-badge" [class]="getSlaProgressClass()">{{ getSlaPhaseLabel() }}</span>
                </div>

                <div class="sla-ring" [class]="getSlaProgressClass()">
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <circle class="ring-track" cx="50" cy="50" r="42"></circle>
                    <circle class="ring-value" cx="50" cy="50" r="42" [attr.stroke-dasharray]="slaRingCircumference" [attr.stroke-dashoffset]="getSlaRingOffset()"></circle>
                  </svg>
                  <div class="sla-ring-content">
                    <span class="sla-ring-percent">{{ getSlaProgressPercent() | number:'1.0-0' }}%</span>
                  </div>
                </div>

                <div class="sla-countdown" [class.breached]="isSlaBreached()" [class.paused]="ticket.slaPaused">
                  {{ ticket.slaPaused ? (ticket.slaOperationalStatus || 'EN PAUSE') : getSlaRemainingText() }}
                </div>
                
                <div class="sla-deadline-row">
                  <span>Deadline</span>
                  <strong>{{ ticket.slaDeadline | date:'dd/MM HH:mm' }}</strong>
                </div>

                <!-- SLA Phase Progress -->
                <div class="sla-phases">
                  <div class="sla-phases-track">
                    <div class="sla-phases-fill" [style.width.%]="getSlaProgressPercent()"></div>
                  </div>
                  <div class="sla-phases-labels">
                    <span>0%</span>
                    <span [class.active]="getSlaProgressPercent() >= 75">75%</span>
                    <span>100%</span>
                  </div>
                </div>

                <!-- Compact metadata -->
                @if (ticket.slaTotalPausedMinutes || ticket.slaExtendedMinutes || ticket.slaBusinessHoursOnly) {
                  <div class="sla-details">
                    @if (ticket.slaTotalPausedMinutes && ticket.slaTotalPausedMinutes > 0) {
                      <div class="sla-detail-row"><span>Temps pause</span><strong>{{ ticket.slaTotalPausedMinutes }} min</strong></div>
                    }
                    @if (ticket.slaExtendedMinutes && ticket.slaExtendedMinutes > 0) {
                      <div class="sla-detail-row"><span>Extension</span><strong>+{{ ticket.slaExtendedMinutes }} min</strong></div>
                    }
                    @if (ticket.slaBusinessHoursOnly) {
                      <div class="sla-detail-row"><span>Horaires</span><strong>{{ ticket.slaCalendarLabel || 'Heures ouvrées' }}</strong></div>
                    }
                    @if (ticket.slaOperationalStatus) {
                      <div class="sla-detail-row"><span>Statut</span><strong>{{ ticket.slaOperationalStatus }}</strong></div>
                    }
                  </div>
                }

                <!-- Escalation Summary -->
                @if (ticket.escalationLevel && ticket.escalationLevel > 0) {
                  <div class="escalation-indicator" [class]="'escalation-level-' + ticket.escalationLevel">
                    <div class="escalation-header">
                      <mat-icon>{{ ticket.escalationLevel >= 3 ? 'priority_high' : ticket.escalationLevel >= 2 ? 'supervisor_account' : 'swap_horiz' }}</mat-icon>
                      <span class="escalation-label">{{ getEscalationStepLabel(ticket.escalationLevel) }}</span>
                    </div>
                    <div class="escalation-desc">
                      {{ getEscalationStepDescription(ticket.escalationLevel) }}
                    </div>
                    @if (ticket.escalationCount && ticket.escalationCount > 1) {
                      <div class="escalation-count">{{ ticket.escalationCount }} interventions SLA</div>
                    }
                  </div>
                }

                <!-- Actions — clean 2-column grid -->
                <div class="sla-actions">
                  @if (!isClient && !ticket.slaPaused && !isSlaBreached() && canAct('sla-pause')) {
                    <button class="sla-btn sla-btn--secondary" (click)="pauseSlaClock()">
                      <mat-icon>pause</mat-icon> Pause
                    </button>
                  }
                  @if (!isClient && ticket.slaPaused && canAct('sla-resume')) {
                    <button class="sla-btn sla-btn--primary" (click)="resumeSlaClock()">
                      <mat-icon>play_arrow</mat-icon> Reprendre
                    </button>
                  }
                  @if (canAct('sla-extend')) {
                    <button class="sla-btn sla-btn--secondary" (click)="extendSlaDuration()">
                      <mat-icon>more_time</mat-icon> Prolonger
                    </button>
                  }
                  @if (canAct('manager-review') && !ticket.slaPaused) {
                    <button class="sla-btn sla-btn--danger" [disabled]="!canTriggerAction('manager-review')" (click)="triggerSlaEscalation()">
                      <mat-icon>supervisor_account</mat-icon> Revue manager
                    </button>
                  }
                </div>
              </div>
            }

            <div class="side-card glass-card reveal delay-5">
              <h3>Informations</h3>
              <div class="kv"><span>Client</span><strong>{{ getClientDisplayName() }}</strong></div>
              <div class="kv"><span>Agent assigne</span><strong>{{ getAssignedAgentDisplayName() || 'Non assigne' }}</strong></div>
              <div class="kv"><span>Cree le</span><strong>{{ ticket.createdAt | date:'dd/MM/yyyy HH:mm' }}</strong></div>
              <div class="kv"><span>Maj</span><strong>{{ ticket.updatedAt | date:'dd/MM/yyyy HH:mm' }}</strong></div>
              @if (ticket.archiveReference) {
                <div class="kv"><span>Ref archive</span><strong>{{ ticket.archiveReference }}</strong></div>
              }
              <button
                type="button"
                class="alfresco-link-btn"
                [disabled]="!getAlfrescoShareUrl()"
                (click)="openAlfrescoShare()">
                <mat-icon>folder_open</mat-icon>
                Ouvrir dans Alfresco Share
              </button>
            </div>

            <div class="side-card glass-card reveal delay-5">
              <h3>Documents Alfresco</h3>
              <div class="alfresco-filters">
                <button type="button" class="alfresco-filter" [class.active]="alfrescoFilter === 'all'" (click)="alfrescoFilter = 'all'">Tous</button>
                <button type="button" class="alfresco-filter" [class.active]="alfrescoFilter === 'folders'" (click)="alfrescoFilter = 'folders'">Dossiers</button>
                <button type="button" class="alfresco-filter" [class.active]="alfrescoFilter === 'reports'" (click)="alfrescoFilter = 'reports'">Rapports</button>
                <button type="button" class="alfresco-filter" [class.active]="alfrescoFilter === 'attachments'" (click)="alfrescoFilter = 'attachments'">Pieces jointes</button>
              </div>
              @if (getAlfrescoTreeRows().length > 0) {
                <div class="alfresco-tree">
                  @for (row of getAlfrescoTreeRows(); track row.id) {
                    <div class="alfresco-tree__row" [style.paddingLeft.px]="10 + row.depth * 18">
                      <div class="alfresco-tree__main">
                        <div class="alfresco-tree__title-row">
                          <div class="alfresco-tree__title">
                            @if (row.isFolderLike) {
                              <button type="button" class="alfresco-tree__toggle" (click)="toggleAlfrescoFolder(row.id)">
                                <mat-icon>{{ isAlfrescoExpanded(row.id) ? 'expand_more' : 'chevron_right' }}</mat-icon>
                              </button>
                            }
                            <mat-icon class="alfresco-tree__icon">{{ getAlfrescoIcon(row) }}</mat-icon>
                            <strong>{{ row.displayLabel }}</strong>
                          </div>
                          <span class="alfresco-doc__badge" [class.synced]="row.synced" [class.pending]="!row.synced">
                            {{ row.synced ? 'Synchronise' : 'En attente' }}
                          </span>
                        </div>
                        <div class="alfresco-doc__meta">
                          <span>{{ getAlfrescoKindLabel(row) }}</span>
                          @if (row.meta) {
                            <span>{{ row.meta }}</span>
                          }
                          @if (row.ref) {
                            <span class="alfresco-doc__ref">{{ row.ref }}</span>
                          }
                        </div>
                      </div>
                      <div class="alfresco-doc__actions">
                        @if (canPreviewAlfrescoDocument(row)) {
                          <button
                            type="button"
                            class="alfresco-doc__action"
                            (click)="previewAlfrescoDocument(row)">
                            <mat-icon>visibility</mat-icon>
                            Apercu
                          </button>
                        }
                        <button
                          type="button"
                          class="alfresco-doc__action"
                          [disabled]="!getAlfrescoDocumentUrl(row)"
                          (click)="openAlfrescoDocument(row)">
                          <mat-icon>open_in_new</mat-icon>
                          Share
                        </button>
                        @if (canDownloadAlfrescoDocument(row)) {
                          <button
                            type="button"
                            class="alfresco-doc__action"
                            (click)="downloadAlfrescoDocument(row)">
                            <mat-icon>download</mat-icon>
                            Telecharger
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <p class="empty-text">
                  Aucun document GED visible pour ce ticket. Les pieces jointes apparaissent ici des qu'elles sont synchronisees ou archivees.
                </p>
              }
            </div>

            <!-- Escalation Timeline -->
            @if (escalationEvents.length > 0) {
              <div class="side-card glass-card reveal delay-6">
                <h3>Suivi SLA</h3>
                <div class="esc-timeline">
                  @for (event of escalationEvents; track event.id) {
                    <div class="esc-event" [class]="'esc-level-' + event.toLevel" [class.blocked]="event.wasBlocked">
                      <div class="esc-event-dot"></div>
                      <div class="esc-event-content">
                        <div class="esc-event-header">
                          <span class="esc-level-badge">{{ getEscalationStepShortLabel(event.toLevel) }}</span>
                          <span class="esc-event-reason">{{ getEscReasonLabel(event.reason) }}</span>
                          @if (event.wasBlocked) {
                            <span class="esc-blocked-tag">En attente</span>
                          }
                        </div>
                        @if (event.fromAgentName || event.toAgentName) {
                          <div class="esc-agents">
                            {{ event.fromAgentName || '—' }} → {{ event.toAgentName || '—' }}
                          </div>
                        }
                        <div class="esc-event-time">{{ event.createdAt | date:'dd/MM HH:mm:ss' }}</div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <div class="side-card glass-card reveal delay-6">
              <h3>Parcours client</h3>
              @if (!isClient && canRequestCustomerInput()) {
                <div class="journey-card">
                  <strong>Demande d'informations complementaires</strong>
                  <p>Le ticket passera en attente client et le chrono SLA sera mis en pause jusqu'au retour.</p>
                  <button mat-stroked-button [disabled]="isValidatingResolution" (click)="markWaitingForCustomer()">
                    <mat-icon>pause_circle</mat-icon>
                    Mettre en attente client
                  </button>
                </div>
              } @else if (isClient && isWaitingForCustomerState()) {
                <div class="journey-card journey-card--info">
                  <strong>Retour client attendu</strong>
                  <p>Le support attend des informations complementaires. Repondez via la zone <em>Communications</em> ci-dessous pour relancer le traitement.</p>
                  @if (ticket.pendingReason) {
                    <small>Motif: {{ ticket.pendingReason }}</small>
                  }
                </div>
              } @else if (isClient && ticket.status === 'RESOLVED') {
                <div class="journey-card">
                  <strong>Validation de la resolution</strong>
                  <p>Consultez la solution proposee puis ouvrez l assistant de validation pour accepter ou refuser proprement la resolution.</p>
                  @if (ticket.resolutionSummary) {
                    <div class="journey-summary">
                      <span>Resume</span>
                      <strong>{{ ticket.resolutionSummary }}</strong>
                    </div>
                  }
                  @if (ticket.resolutionDetails) {
                    <div class="journey-resolution">
                      <div><span>Diagnostic</span><strong>{{ ticket.resolutionDetails.diagnostic }}</strong></div>
                      <div><span>Cause racine</span><strong>{{ ticket.resolutionDetails.rootCause }}</strong></div>
                      <div><span>Action realisee</span><strong>{{ ticket.resolutionDetails.actionsTaken }}</strong></div>
                      <div><span>Recommendation</span><strong>{{ ticket.resolutionDetails.nextRecommendation }}</strong></div>
                    </div>
                  }
                  <button mat-raised-button color="primary" class="journey-cta" [disabled]="isValidatingResolution" (click)="validateAndClose()">
                    <mat-icon>verified</mat-icon>
                    Ouvrir la validation client
                  </button>
                </div>
              } @else {
                <p class="empty-text">Le parcours client s'affichera ici quand une action metier sera attendue.</p>
              }
            </div>

            <div class="side-card glass-card reveal delay-6">
              <h3>Centre d'action</h3>
              <div class="action-highlight" [class.action-highlight--urgent]="getActionTone() === 'urgent'">
                <span class="action-highlight__eyebrow">Action recommandee</span>
                <strong>{{ getRecommendedActionLabel() }}</strong>
                <p>{{ getRecommendedActionDescription() }}</p>
                <div class="action-highlight__stats">
                  <span>{{ getStatusLabel(ticket.status) }}</span>
                  <span>{{ getPriorityLabel(ticket.priority) }}</span>
                  <span>{{ getAssignedAgentDisplayName() || 'Sans owner' }}</span>
                </div>
              </div>

              <div class="why-here-card">
                <span>Pourquoi ce ticket est ici ?</span>
                <strong>{{ ticket.nextExpectedAction || getRecommendedActionLabel() }}</strong>
                <p>{{ getRoleAwareTicketSummary() }}</p>
              </div>

              @if (!isClient && ticket.lastCustomerResponseAt && ticket.status === 'IN_PROGRESS') {
                <div class="action-alert action-alert--info">
                  <mat-icon>reply</mat-icon>
                  <div>
                    <strong>Reponse client recue</strong>
                    <p>{{ ticket.lastCustomerResponseAt | date:'dd/MM/yyyy HH:mm' }}. Reprenez l analyse et apportez une reponse au client.</p>
                  </div>
                </div>
              }

              @if (!isClient && ticket.resolutionRejectedReason) {
                <div class="action-alert action-alert--danger">
                  <mat-icon>warning</mat-icon>
                  <div>
                    <strong>Resolution refusee</strong>
                    <p>{{ ticket.resolutionRejectedReason }}</p>
                  </div>
                </div>
              }

              <div class="action-group">
                <div class="action-group__title">Actions principales</div>
                <div class="side-actions side-actions--primary">
                  @if (isClient && ticket.status === 'RESOLVED') {
                    <button mat-raised-button color="primary" class="action-panel-btn action-panel-btn--primary" [disabled]="isValidatingResolution" (click)="validateAndClose()">
                      <mat-icon [class.spin]="isValidatingResolution">{{ isValidatingResolution ? 'autorenew' : 'verified' }}</mat-icon>
                      Valider ou refuser la solution
                    </button>
                  }
                  @if (canAct('assign')) {
                    <button mat-stroked-button class="action-panel-btn" [disabled]="!canTriggerAction('assign')" (click)="openAssignDialog()">
                      <mat-icon>person_add</mat-icon>
                      Assigner
                    </button>
                  }
                  @if (canAct('take-charge')) {
                    <button mat-raised-button color="primary" class="action-panel-btn action-panel-btn--primary" [disabled]="!canTriggerAction('take-charge')" (click)="takeCharge()">
                      <mat-icon>bolt</mat-icon>
                      Prendre en charge
                    </button>
                  }
                  @if (canAct('resolve')) {
                    <button mat-raised-button color="accent" class="action-panel-btn action-panel-btn--success" [disabled]="!canTriggerAction('resolve')" (click)="resolveTicket()">
                      <mat-icon>task_alt</mat-icon>
                      Resoudre
                    </button>
                  }
                  @if (canAct('escalate')) {
                    <button mat-stroked-button color="warn" class="action-panel-btn action-panel-btn--danger" [disabled]="!canTriggerAction('escalate')" (click)="escalateTicket()">
                      <mat-icon>trending_up</mat-icon>
                      Escalader
                    </button>
                  }
                  @if (canAct('close') && !(isClient && ticket.status === 'RESOLVED')) {
                    <button mat-raised-button color="primary" class="action-panel-btn action-panel-btn--primary" [disabled]="isValidatingResolution" (click)="validateAndClose()">
                      <mat-icon [class.spin]="isValidatingResolution">{{ isValidatingResolution ? 'autorenew' : 'task_alt' }}</mat-icon>
                      {{ isClient ? 'Valider la solution' : 'Cloturer le ticket' }}
                    </button>
                  }
                </div>
              </div>

              <div class="action-group">
                <div class="action-group__title">Actions secondaires</div>
                <div class="side-actions side-actions--secondary">
                  @if (canAct('change-status')) {
                    <button mat-stroked-button class="action-panel-btn" [matMenuTriggerFor]="statusMenu">
                      <mat-icon>sync_alt</mat-icon>
                      Changer statut
                    </button>
                    <mat-menu #statusMenu="matMenu">
                      @for (option of statusOptions; track option.value) {
                        <button mat-menu-item (click)="updateStatus(option.value)">{{ option.label }}</button>
                      }
                    </mat-menu>
                  }
                  @if (canAct('reopen')) {
                    <button mat-stroked-button class="action-panel-btn" [disabled]="!canTriggerAction('reopen')" (click)="reopenTicket()">
                      <mat-icon>replay</mat-icon>
                      Reouvrir
                    </button>
                  }
                  @if (canArchive()) {
                    <button mat-stroked-button color="warn" class="action-panel-btn action-panel-btn--danger" (click)="archiveTicket()">
                      <mat-icon>inventory_2</mat-icon>
                      Archiver
                    </button>
                  }
                  <button mat-stroked-button class="action-panel-btn" (click)="openAlfrescoShare()">
                    <mat-icon>folder_open</mat-icon>
                    Alfresco Share
                  </button>
                  <button mat-stroked-button class="action-panel-btn" (click)="shareTicket()">
                    <mat-icon>share</mat-icon>
                    Partager
                  </button>
                  @if (!isClient && ['RESOLVED', 'CLOSED'].includes(ticket.status)) {
                    <button mat-stroked-button class="action-panel-btn" [disabled]="isGeneratingKb" (click)="generateKnowledgeDraft()">
                      <mat-icon [class.spin]="isGeneratingKb">{{ isGeneratingKb ? 'autorenew' : 'auto_awesome' }}</mat-icon>
                      {{ isGeneratingKb ? 'Generation KB...' : 'Generer brouillon KB' }}
                    </button>
                    <button mat-stroked-button class="action-panel-btn" [disabled]="isCreatingKnowledgeArticle || !canCreateKnowledgeArticle()" (click)="createKnowledgeArticle()">
                      <mat-icon [class.spin]="isCreatingKnowledgeArticle">{{ isCreatingKnowledgeArticle ? 'autorenew' : 'library_add' }}</mat-icon>
                      {{ isCreatingKnowledgeArticle ? 'Creation article...' : 'Creer article KB' }}
                    </button>
                  }
                </div>
              </div>
              @if (knowledgeDraftPreview) {
                <div class="knowledge-preview">
                  <span>Capitalisation</span>
                  <strong>Brouillon d article de connaissance</strong>
                  <pre>{{ knowledgeDraftPreview }}</pre>
                  <button mat-stroked-button class="action-panel-btn" routerLink="/ai-assistant">
                    <mat-icon>smart_toy</mat-icon>
                    Ouvrir AI Assistant
                  </button>
                </div>
              }
              @if (!isClient) {
                <div class="knowledge-links-card">
                  <div class="knowledge-links-card__head">
                    <div>
                      <span>Base de connaissance</span>
                      <strong>Articles lies au ticket</strong>
                    </div>
                    <button mat-stroked-button class="action-panel-btn" routerLink="/knowledge-base">
                      <mat-icon>menu_book</mat-icon>
                      Ouvrir la KB
                    </button>
                  </div>

                  @if (knowledgeArticlesLoading) {
                    <div class="knowledge-links-empty">Chargement des articles lies...</div>
                  } @else if (linkedKnowledgeArticles.length === 0 && suggestedKnowledgeArticles.length === 0) {
                    <div class="knowledge-links-empty">Aucun article lie ou suggere pour ce ticket.</div>
                  } @else {
                    @if (linkedKnowledgeArticles.length > 0) {
                      <div class="knowledge-links-group">
                        <span class="knowledge-links-label">Articles crees depuis ce ticket</span>
                        @for (article of linkedKnowledgeArticles; track article.id) {
                          <a class="knowledge-link-item" routerLink="/knowledge-base">
                            <div>
                              <strong>{{ article.title }}</strong>
                              <p>{{ article.summary || article.content }}</p>
                            </div>
                            <div class="knowledge-link-meta">
                              <span>{{ article.category || 'Support' }}</span>
                              <span>{{ article.helpfulCount || 0 }} utiles</span>
                            </div>
                          </a>
                        }
                      </div>
                    }

                    @if (suggestedKnowledgeArticles.length > 0) {
                      <div class="knowledge-links-group">
                        <span class="knowledge-links-label">Suggestions proches</span>
                        @for (article of suggestedKnowledgeArticles | slice:0:4; track article.id) {
                          <a class="knowledge-link-item" routerLink="/knowledge-base">
                            <div>
                              <strong>{{ article.title }}</strong>
                              <p>{{ article.summary || article.content }}</p>
                            </div>
                            <div class="knowledge-link-meta">
                              <span>{{ article.category || 'Support' }}</span>
                              <span>{{ article.views || 0 }} vues</span>
                            </div>
                          </a>
                        }
                      </div>
                    }
                  }
                </div>
              }
              @if (showResolutionSuccess) {
                <div class="success-box"><mat-icon>check_circle</mat-icon>{{ resolutionSuccessMessage }}</div>
              }
            </div>
          </aside>
              </section>
            </div>
          </div>


        </div>
      } @else {
        <div class="not-found glass-card">
          <mat-icon>error_outline</mat-icon>
          <h2>Ticket non trouve</h2>
          <button mat-raised-button color="primary" routerLink="/tickets">Retour a la liste</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .ticket-detail-ui {
      --bg: #070d19;
      --panel: rgba(19, 26, 40, 0.74);
      --panel-alt: rgba(11, 17, 30, 0.78);
      --line: rgba(0, 227, 253, 0.2);
      --line-soft: rgba(0, 227, 253, 0.1);
      --text: #dce4f3;
      --muted: #8f9bb5;
      --accent: #00e3fd;
      --accent-2: #82f7ff;
      min-height: calc(100vh - 72px);
      padding: 24px;
      color: var(--text);
      background:
        radial-gradient(circle at 0% -20%, rgba(0, 227, 253, 0.12), transparent 42%),
        radial-gradient(circle at 100% 0%, rgba(97, 70, 255, 0.08), transparent 40%),
        var(--bg);
      font-family: 'Manrope', sans-serif;
    }

    .glass-card {
      background: var(--panel);
      border: 1px solid var(--line-soft);
      border-radius: 16px;
      backdrop-filter: blur(14px);
      box-shadow: 0 16px 38px rgba(0, 0, 0, 0.28);
      transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
    }

    .glass-card:hover {
      border-color: var(--line);
      box-shadow: 0 22px 42px rgba(0, 0, 0, 0.34), 0 0 0 1px rgba(0, 227, 253, 0.1) inset;
      transform: translateY(-1px);
    }

    .reveal {
      opacity: 0;
      transform: translateY(10px) scale(0.995);
      animation: revealUp 520ms cubic-bezier(0.18, 0.8, 0.25, 1) forwards;
    }

    .delay-1 { animation-delay: 40ms; }
    .delay-2 { animation-delay: 90ms; }
    .delay-3 { animation-delay: 150ms; }
    .delay-4 { animation-delay: 210ms; }
    .delay-5 { animation-delay: 260ms; }
    .delay-6 { animation-delay: 310ms; }

    @keyframes revealUp {
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .cosmos-shell {
      display: grid;
      gap: 14px;
    }

    .topbar {
      min-height: 64px;
      border-radius: 14px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(10, 15, 26, 0.86);
      box-shadow: 0 0 24px rgba(0, 227, 253, 0.08);
    }

    .brand-block {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--accent);
      text-shadow: 0 0 10px rgba(0, 227, 253, 0.45);
      font-size: 15px;
      white-space: nowrap;
    }

    .top-search {
      border: 1px solid var(--line-soft);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.02);
      padding: 4px 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 320px;
    }

    .top-search mat-icon {
      color: var(--accent);
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .top-search input {
      background: transparent;
      border: none;
      outline: none;
      color: var(--text);
      width: 100%;
      font-size: 12px;
      font-family: inherit;
    }

    .top-search input::placeholder {
      color: rgba(220, 228, 243, 0.45);
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .top-actions button {
      color: #9ca3af;
      transition: transform 160ms ease, color 160ms ease;
    }

    .top-actions button:hover {
      color: var(--accent);
      transform: translateY(-1px);
    }

    .operator-id {
      margin-left: 4px;
      border-left: 1px solid var(--line-soft);
      padding-left: 10px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      line-height: 1.1;
    }

    .operator-id strong {
      font-size: 10px;
      letter-spacing: 0.1em;
      color: var(--accent-2);
      font-family: 'Space Grotesk', sans-serif;
    }

    .operator-id small {
      color: var(--muted);
      font-size: 10px;
    }

    .shell-body {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
      align-items: start;
    }

    .content-area--full {
      width: 100%;
    }

    .left-rail {
      position: sticky;
      top: 10px;
      padding: 12px;
      background: rgba(10, 15, 26, 0.86);
    }

    .left-rail nav {
      display: grid;
      gap: 4px;
      margin-bottom: 12px;
    }

    .left-rail a {
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 10px;
      padding: 9px 10px;
      color: #93a2be;
      text-decoration: none;
      font-size: 12px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border: 1px solid transparent;
      transition: all 0.2s ease;
    }

    .left-rail a:hover {
      color: var(--accent);
      border-color: var(--line-soft);
      background: rgba(0, 227, 253, 0.06);
    }

    .left-rail a.active {
      color: var(--accent);
      border-color: var(--line);
      background: rgba(0, 227, 253, 0.1);
    }

    .deploy-btn {
      width: 100%;
      border-radius: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 11px;
    }

    .content-area {
      min-width: 0;
      display: grid;
      gap: 14px;
    }

    .loading-state,
    .not-found {
      min-height: 300px;
      display: grid;
      place-items: center;
      gap: 10px;
      text-align: center;
      padding: 28px;
    }

    .hero {
      padding: 20px;
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
    }

    .hero::before {
      content: '';
      position: absolute;
      inset: -120% 30% auto -30%;
      height: 220%;
      transform: rotate(18deg);
      background: linear-gradient(90deg, transparent, rgba(130, 247, 255, 0.08), transparent);
      animation: scanLine 6s linear infinite;
      pointer-events: none;
    }

    @keyframes scanLine {
      0% { transform: translateX(-28%) rotate(18deg); }
      100% { transform: translateX(32%) rotate(18deg); }
    }

    .hero-top-line {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 14px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .hero-top-line .breadcrumb-link {
      color: var(--accent-2);
      text-decoration: none;
    }

    .hero-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: start;
    }

    .hero-main h1 {
      margin: 8px 0 6px;
      font-size: 30px;
      line-height: 1.1;
      font-family: 'Space Grotesk', sans-serif;
      color: #f0f7ff;
      text-shadow: 0 0 20px rgba(130, 247, 255, 0.14);
    }

    .hero-meta {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }

    .hero-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip-id,
    .status-badge,
    .priority-badge,
    .archive-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border: 1px solid var(--line-soft);
      background: rgba(255, 255, 255, 0.03);
    }

    .chip-id {
      color: var(--accent);
      border-color: var(--line);
      box-shadow: inset 0 0 12px rgba(0, 227, 253, 0.2);
    }

    .status-open { color: #7dd3fc; }
    .status-assigned { color: #a78bfa; }
    .status-in_progress { color: #f9a8d4; }
    .status-pending { color: #fde68a; }
    .status-escalated_manual,
    .status-escalated_sla { color: #fca5a5; }
    .status-resolved { color: #86efac; }
    .status-closed { color: #cbd5e1; }
    .status-cancelled { color: #94a3b8; }

    .priority-low { color: #cbd5e1; }
    .priority-medium { color: #7dd3fc; }
    .priority-high { color: #fdba74; }
    .priority-critical {
      color: #fda4af;
      border-color: rgba(251, 113, 133, 0.35);
      box-shadow: 0 0 16px rgba(251, 113, 133, 0.25);
    }

    .archive-badge {
      color: #fde68a;
      border-color: rgba(245, 158, 11, 0.35);
    }

    .hero-actions {
      display: grid;
      gap: 12px;
      min-width: min(100%, 430px);
    }

    .hero-actions__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .action-summary-panel {
      display: grid;
      gap: 10px;
      padding: 14px;
      border-radius: 18px;
      border: 1px solid rgba(130, 247, 255, 0.16);
      background:
        radial-gradient(circle at top right, rgba(0, 227, 253, 0.15), transparent 42%),
        linear-gradient(180deg, rgba(10, 19, 36, 0.94), rgba(9, 15, 29, 0.92));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .action-summary-panel--urgent {
      border-color: rgba(248, 113, 113, 0.26);
      background:
        radial-gradient(circle at top right, rgba(248, 113, 113, 0.16), transparent 42%),
        linear-gradient(180deg, rgba(34, 12, 18, 0.92), rgba(18, 9, 17, 0.92));
    }

    .action-summary-panel--pending {
      border-color: rgba(250, 204, 21, 0.22);
      background:
        radial-gradient(circle at top right, rgba(250, 204, 21, 0.12), transparent 42%),
        linear-gradient(180deg, rgba(27, 22, 10, 0.92), rgba(16, 14, 10, 0.92));
    }

    .action-summary-panel--stable {
      border-color: rgba(52, 211, 153, 0.22);
      background:
        radial-gradient(circle at top right, rgba(52, 211, 153, 0.12), transparent 42%),
        linear-gradient(180deg, rgba(10, 24, 22, 0.92), rgba(9, 16, 20, 0.92));
    }

    .action-summary-panel__eyebrow {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(130, 247, 255, 0.86);
    }

    .action-summary-panel strong {
      font-size: 17px;
      color: #f8fbff;
      line-height: 1.2;
    }

    .action-summary-panel p {
      margin: 0;
      color: #a8b8d1;
      font-size: 12px;
      line-height: 1.55;
    }

    .action-summary-panel__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .action-summary-panel__meta span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.05);
      color: #dce8f7;
      font-size: 11px;
    }

    .action-summary-panel__meta mat-icon {
      width: 14px;
      height: 14px;
      font-size: 14px;
      color: var(--accent-2);
    }

    .action-btn {
      min-height: 62px;
      border-radius: 14px !important;
      justify-content: flex-start !important;
      padding: 10px 12px !important;
      text-align: left;
      box-shadow: none !important;
    }

    .action-btn__content {
      display: grid;
      gap: 2px;
      text-align: left;
    }

    .action-btn__label {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.01em;
    }

    .action-btn__hint {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.3;
    }

    .action-btn--primary,
    .action-btn--success,
    .action-btn--danger,
    .action-btn--secondary {
      backdrop-filter: blur(8px);
    }

    .action-btn--primary {
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.95), rgba(59, 130, 246, 0.85)) !important;
      color: #f8fbff !important;
    }

    .action-btn--success {
      background: linear-gradient(135deg, rgba(219, 39, 119, 0.95), rgba(239, 68, 68, 0.85)) !important;
      color: #fff7fb !important;
    }

    .action-btn--secondary {
      border-color: rgba(130, 247, 255, 0.22) !important;
      background: rgba(8, 20, 38, 0.72) !important;
      color: var(--text) !important;
    }

    .action-btn--danger {
      border-color: rgba(248, 113, 113, 0.24) !important;
      background: rgba(60, 15, 24, 0.72) !important;
      color: #fecaca !important;
    }

    .hero-actions button[disabled],
    .side-actions button[disabled] {
      opacity: 0.45;
      cursor: not-allowed;
      filter: saturate(0.65);
    }

    .sla-banner {
      margin-top: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid rgba(250, 204, 21, 0.25);
      background: rgba(250, 204, 21, 0.06);
      color: #fde68a;
      font-size: 13px;
    }

    .sla-banner.breached {
      border-color: rgba(248, 113, 113, 0.3);
      background: rgba(248, 113, 113, 0.06);
      color: #fecaca;
    }

    .sla-banner.critical {
      border-color: rgba(249, 115, 22, 0.3);
      background: rgba(249, 115, 22, 0.06);
      color: #fed7aa;
    }

    .sla-banner.paused {
      border-color: rgba(167, 139, 250, 0.25);
      background: rgba(167, 139, 250, 0.06);
      color: #c4b5fd;
    }

    .sla-banner strong { font-weight: 600; }

    .sla-banner p {
      margin: 2px 0 0;
      font-size: 11px;
      color: inherit;
      opacity: 0.7;
    }

    .ticket-signal-strip {
      margin-top: 14px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .signal-pill {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 16px;
      border: 1px solid rgba(248, 113, 113, 0.18);
      background:
        radial-gradient(circle at top, rgba(248, 113, 113, 0.16), transparent 58%),
        rgba(10, 19, 38, 0.82);
      color: #ffe3e3;
      cursor: pointer;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .signal-pill:hover {
      transform: translateY(-1px);
      border-color: rgba(248, 113, 113, 0.35);
      box-shadow: 0 10px 24px rgba(127, 29, 29, 0.22);
    }

    .signal-pill__label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255, 226, 226, 0.88);
    }

    .signal-pill__count {
      min-width: 38px;
      width: 38px;
      height: 38px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(180deg, #fb7185 0%, #b91c1c 100%);
      color: white;
      font-size: 14px;
      font-weight: 800;
      box-shadow:
        0 0 0 4px rgba(127, 29, 29, 0.18),
        0 0 18px rgba(248, 113, 113, 0.38);
    }

    .layout-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 20px;
      align-items: start;
    }

    .main-panel {
      overflow: hidden;
    }

    .tab-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      border-bottom: 1px solid var(--line-soft);
      padding: 12px;
      background: var(--panel-alt);
    }

    .tab-row button {
      border: 1px solid transparent;
      background: transparent;
      color: var(--muted);
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tab-row button:hover {
      color: #cfe7ff;
      border-color: rgba(130, 247, 255, 0.2);
      background: rgba(130, 247, 255, 0.05);
    }

    .tab-row button.active {
      color: var(--accent);
      border-color: var(--line);
      background: rgba(0, 227, 253, 0.12);
    }

    .tab-body {
      padding: 16px;
      min-height: 460px;
    }

    .details-grid {
      display: grid;
      gap: 14px;
      margin-bottom: 18px;
    }

    .detail-block h3,
    .attachments-preview h3,
    .quick-communication h3 {
      margin: 0 0 8px;
      color: var(--accent-2);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-family: 'Space Grotesk', sans-serif;
    }

    .detail-block p {
      margin: 0;
      color: #cfdaec;
      line-height: 1.6;
    }

    .meta-cards {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .meta-card {
      border: 1px solid var(--line-soft);
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      padding: 12px;
      display: grid;
      gap: 6px;
    }

    .meta-card span {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .preview-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .preview-item {
      border: 1px solid var(--line-soft);
      background: rgba(255, 255, 255, 0.02);
      border-radius: 10px;
      color: var(--text);
      padding: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }

    .preview-item:hover {
      border-color: var(--line);
      transform: translateY(-1px) scale(1.005);
      box-shadow: 0 0 0 1px rgba(130, 247, 255, 0.12) inset;
    }

    .preview-item strong {
      display: block;
      font-size: 12px;
      line-height: 1.3;
      word-break: break-word;
    }

    .preview-item span {
      display: block;
      color: var(--muted);
      font-size: 11px;
    }

    .send-box {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: end;
    }

    textarea {
      width: 100%;
      border-radius: 10px;
      border: 1px solid var(--line-soft);
      background: rgba(5, 10, 20, 0.65);
      color: var(--text);
      padding: 10px 12px;
      resize: vertical;
      min-height: 44px;
      font-family: inherit;
      outline: none;
    }

    textarea:focus {
      border-color: var(--line);
      box-shadow: 0 0 0 2px rgba(0, 227, 253, 0.15);
    }

    button[mat-raised-button],
    button[mat-stroked-button] {
      transition: transform 180ms ease, box-shadow 180ms ease;
    }

    button[mat-raised-button]:hover,
    button[mat-stroked-button]:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
    }

    button[mat-raised-button][disabled]:hover,
    button[mat-stroked-button][disabled]:hover {
      transform: none;
      box-shadow: none;
    }

    .comment-editor {
      display: grid;
      gap: 10px;
      margin-bottom: 12px;
    }

    .comments-list {
      display: grid;
      gap: 10px;
    }

    .comment {
      display: grid;
      grid-template-columns: 38px 1fr;
      gap: 10px;
      padding: 10px;
      border: 1px solid var(--line-soft);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.02);
    }

    .comment.internal {
      border-color: rgba(250, 204, 21, 0.35);
      background: rgba(250, 204, 21, 0.08);
    }

    .comment-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: rgba(0, 227, 253, 0.14);
      color: var(--accent-2);
      font-weight: 700;
      font-size: 12px;
    }

    .comment-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      margin-bottom: 4px;
    }

    .comment-head span {
      color: var(--muted);
      white-space: nowrap;
    }

    .comment-content p {
      margin: 0;
      color: #cfdaec;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .upload-area {
      display: grid;
      justify-items: center;
      gap: 8px;
      padding: 18px;
      border: 1px dashed var(--line);
      border-radius: 12px;
      margin-bottom: 12px;
      text-align: center;
      color: var(--muted);
    }

    .upload-form {
      margin-bottom: 12px;
    }

    .attachments-list .mat-mdc-list-item-title {
      color: var(--text) !important;
    }

    .attachments-list .mat-mdc-list-item-line {
      color: var(--muted) !important;
    }

    .history-list {
      display: grid;
      gap: 10px;
    }

    .history-item {
      display: grid;
      grid-template-columns: 10px 1fr;
      gap: 10px;
      border: 1px solid var(--line-soft);
      border-radius: 10px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.02);
    }

    .history-item .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      margin-top: 5px;
      box-shadow: 0 0 8px rgba(0, 227, 253, 0.8);
    }

    .history-item strong {
      display: block;
      margin-bottom: 4px;
      font-size: 13px;
    }

    .history-item span {
      color: var(--muted);
      font-size: 12px;
    }

    .side-column {
      display: grid;
      gap: 12px;
    }

    .side-card {
      padding: 14px;
    }

    .side-card h3 {
      margin: 0 0 10px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent-2);
      font-family: 'Space Grotesk', sans-serif;
    }

    .kv {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
      border-bottom: 1px solid var(--line-soft);
      padding: 8px 0;
      font-size: 12px;
    }

    .kv:last-child {
      border-bottom: none;
    }

    .kv span {
      color: var(--muted);
    }

    .kv strong {
      text-align: right;
      word-break: break-word;
    }

    /* ── SLA Card ── */
    .sla-card {
      overflow: hidden;
    }

    .sla-card.sla-state--paused {
      border-color: rgba(167, 139, 250, 0.3);
    }
    .sla-card.sla-state--breached {
      border-color: rgba(248, 113, 113, 0.3);
    }
    .sla-card.sla-state--critical {
      border-color: rgba(249, 115, 22, 0.3);
    }

    .sla-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .sla-header h3 { margin: 0; }

    .sla-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 3px 10px;
      border-radius: 20px;
    }
    .sla-badge.on-track { background: rgba(52, 211, 153, 0.15); color: #34d399; }
    .sla-badge.risk { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .sla-badge.critical { background: rgba(249, 115, 22, 0.15); color: #f97316; }
    .sla-badge.breached { background: rgba(248, 113, 113, 0.15); color: #f87171; }
    .sla-badge.paused { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }

    .sla-ring {
      width: 96px;
      height: 96px;
      position: relative;
      margin: 0 auto 8px;
    }

    .sla-ring svg {
      width: 96px;
      height: 96px;
      transform: rotate(-90deg);
    }

    .sla-ring .ring-track {
      fill: none;
      stroke: rgba(255, 255, 255, 0.06);
      stroke-width: 6;
    }

    .sla-ring .ring-value {
      fill: none;
      stroke-width: 6;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      stroke: #34d399;
    }

    .sla-ring.risk .ring-value { stroke: #f59e0b; }
    .sla-ring.critical .ring-value { stroke: #f97316; }
    .sla-ring.breached .ring-value { stroke: #f87171; }
    .sla-ring.paused .ring-value { stroke: #a78bfa; opacity: 0.6; }

    .sla-ring-content {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .sla-ring-percent {
      font-size: 18px;
      font-weight: 800;
      font-family: 'Space Grotesk', monospace;
      letter-spacing: -0.02em;
    }

    .sla-countdown {
      text-align: center;
      font-size: 28px;
      font-family: 'Space Grotesk', monospace;
      font-weight: 700;
      color: #e2e8f0;
      letter-spacing: -0.02em;
      margin: 4px 0 12px;
    }
    .sla-countdown.breached { color: #f87171; }
    .sla-countdown.paused { color: #a78bfa; font-size: 16px; font-weight: 600; }

    .sla-deadline-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      font-size: 12px;
      margin-bottom: 12px;
    }
    .sla-deadline-row span { color: var(--muted); }
    .sla-deadline-row strong { color: #e2e8f0; }

    /* Phase progress track */
    .sla-phases { margin-bottom: 12px; }

    .sla-phases-track {
      height: 4px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      overflow: hidden;
      position: relative;
    }

    .sla-phases-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, #34d399 0%, #f59e0b 50%, #f97316 75%, #f87171 100%);
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .sla-phases-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
      font-size: 9px;
      color: rgba(255, 255, 255, 0.2);
      font-weight: 500;
    }
    .sla-phases-labels span.active { color: rgba(255, 255, 255, 0.7); }

    /* Details rows */
    .sla-details {
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 8px;
      margin-bottom: 10px;
    }

    .sla-detail-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 11px;
    }
    .sla-detail-row span { color: var(--muted); }
    .sla-detail-row strong { color: #cbd5e1; font-weight: 500; }

    /* Escalation indicator */
    .escalation-indicator {
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding: 10px 0;
      margin-bottom: 8px;
    }
    .escalation-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 12px;
    }
    .escalation-header mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .escalation-desc { font-size: 11px; color: var(--muted); margin-top: 2px; padding-left: 22px; }
    .escalation-count { font-size: 10px; color: rgba(255,255,255,0.3); padding-left: 22px; margin-top: 2px; }
    .escalation-level-1 .escalation-header { color: #f59e0b; }
    .escalation-level-2 .escalation-header { color: #f97316; }
    .escalation-level-3 .escalation-header { color: #f87171; }

    /* Escalation Timeline */
    .esc-timeline { position: relative; padding-left: 16px; }
    .esc-event { position: relative; padding: 0 0 12px 12px; border-left: 2px solid rgba(255,255,255,0.08); }
    .esc-event:last-child { border-left-color: transparent; padding-bottom: 0; }
    .esc-event-dot {
      position: absolute; left: -6px; top: 2px;
      width: 10px; height: 10px; border-radius: 50%;
      background: #64748b; border: 2px solid var(--bg-card, #1e293b);
    }
    .esc-level-1 .esc-event-dot { background: #f59e0b; }
    .esc-level-2 .esc-event-dot { background: #f97316; }
    .esc-level-3 .esc-event-dot { background: #f87171; }
    .esc-event.blocked .esc-event-dot { background: #64748b; opacity: 0.5; }
    .esc-event-header { display: flex; align-items: center; gap: 6px; font-size: 11px; }
    .esc-level-badge {
      font-size: 9px; font-weight: 800; letter-spacing: 0.05em;
      padding: 1px 6px; border-radius: 4px;
      background: rgba(255,255,255,0.08); color: #94a3b8;
    }
    .esc-level-1 .esc-level-badge { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .esc-level-2 .esc-level-badge { background: rgba(249,115,22,0.15); color: #f97316; }
    .esc-level-3 .esc-level-badge { background: rgba(248,113,113,0.15); color: #f87171; }
    .esc-event-reason { color: #e2e8f0; font-weight: 600; }
    .esc-blocked-tag {
      font-size: 9px; padding: 1px 5px; border-radius: 3px;
      background: rgba(100,116,139,0.2); color: #94a3b8;
    }
    .esc-agents { font-size: 10px; color: var(--muted); margin-top: 2px; }
    .esc-event-time { font-size: 9px; color: rgba(255,255,255,0.25); margin-top: 1px; }

    /* SLA action buttons */
    .sla-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .sla-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 7px 10px;
      border: none;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .sla-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .sla-btn--primary {
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
    }
    .sla-btn--primary:hover { background: rgba(99, 102, 241, 0.35); }

    .sla-btn--secondary {
      background: rgba(255, 255, 255, 0.05);
      color: #94a3b8;
    }
    .sla-btn--secondary:hover { background: rgba(255, 255, 255, 0.1); }

    .sla-btn--danger {
      background: rgba(248, 113, 113, 0.12);
      color: #f87171;
    }
    .sla-btn--danger:hover { background: rgba(248, 113, 113, 0.25); }
    .sla-btn--danger:disabled { opacity: 0.3; cursor: not-allowed; }

    .side-actions {
      display: grid;
      gap: 8px;
    }

    .side-actions button {
      width: 100%;
      border-radius: 12px;
    }

    .action-highlight {
      display: grid;
      gap: 10px;
      padding: 14px;
      border-radius: 14px;
      border: 1px solid rgba(130, 247, 255, 0.16);
      background:
        radial-gradient(circle at top right, rgba(0, 227, 253, 0.12), transparent 40%),
        rgba(8, 18, 34, 0.82);
      margin-bottom: 14px;
    }

    .action-highlight--urgent {
      border-color: rgba(248, 113, 113, 0.22);
      background:
        radial-gradient(circle at top right, rgba(248, 113, 113, 0.14), transparent 40%),
        rgba(31, 12, 19, 0.82);
    }

    .action-highlight__eyebrow,
    .action-group__title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(130, 247, 255, 0.78);
    }

    .action-highlight strong {
      font-size: 16px;
      color: #f8fbff;
    }

    .action-highlight p {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .action-highlight__stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .action-highlight__stats span {
      border-radius: 999px;
      padding: 4px 9px;
      background: rgba(255, 255, 255, 0.05);
      color: #d6e4f4;
      font-size: 11px;
    }

    .why-here-card,
    .knowledge-preview {
      display: grid;
      gap: 8px;
      padding: 14px;
      border-radius: 14px;
      margin-bottom: 14px;
      background: rgba(9, 18, 38, 0.78);
      border: 1px solid rgba(121, 152, 255, 0.18);
    }

    .why-here-card span,
    .knowledge-preview span {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(156, 203, 255, 0.8);
    }

    .why-here-card strong,
    .knowledge-preview strong {
      font-size: 15px;
      color: #f8fbff;
    }

    .why-here-card p {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .knowledge-preview pre {
      margin: 0;
      padding: 12px;
      border-radius: 12px;
      background: rgba(6, 14, 30, 0.86);
      border: 1px solid rgba(121, 152, 255, 0.14);
      color: #d9ecff;
      white-space: pre-wrap;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.6;
      max-height: 240px;
      overflow: auto;
    }

    .knowledge-links-card {
      display: grid;
      gap: 12px;
      padding: 14px;
      border-radius: 14px;
      margin-bottom: 14px;
      background: rgba(8, 16, 32, 0.82);
      border: 1px solid rgba(103, 232, 249, 0.14);
    }

    .knowledge-links-card__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .knowledge-links-card__head span,
    .knowledge-links-label {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(156, 203, 255, 0.8);
    }

    .knowledge-links-card__head strong {
      display: block;
      margin-top: 2px;
      font-size: 15px;
      color: #f8fbff;
    }

    .knowledge-links-group {
      display: grid;
      gap: 8px;
    }

    .knowledge-link-item {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 12px;
      border-radius: 12px;
      text-decoration: none;
      color: inherit;
      background: rgba(12, 24, 44, 0.82);
      border: 1px solid rgba(103, 232, 249, 0.08);
    }

    .knowledge-link-item strong {
      display: block;
      margin-bottom: 4px;
      color: #f8fbff;
      font-size: 13px;
    }

    .knowledge-link-item p {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }

    .knowledge-link-meta {
      min-width: 92px;
      display: grid;
      align-content: start;
      justify-items: end;
      gap: 6px;
      color: #67e8f9;
      font-size: 11px;
    }

    .knowledge-links-empty {
      padding: 12px;
      border-radius: 12px;
      border: 1px dashed rgba(103, 232, 249, 0.18);
      color: var(--muted);
      background: rgba(8, 14, 26, 0.72);
      font-size: 12px;
    }

    .action-alert {
      display: grid;
      grid-template-columns: 20px 1fr;
      gap: 12px;
      padding: 12px;
      border-radius: 14px;
      margin-bottom: 14px;
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid rgba(96, 165, 250, 0.18);
    }

    .action-alert mat-icon {
      color: #7dd3fc;
    }

    .action-alert strong {
      display: block;
      margin-bottom: 4px;
      font-size: 13px;
      color: #f8fbff;
    }

    .action-alert p {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .action-alert--danger {
      border-color: rgba(248, 113, 113, 0.22);
      background: rgba(59, 14, 24, 0.76);
    }

    .action-alert--danger mat-icon {
      color: #fca5a5;
    }

    .action-group {
      display: grid;
      gap: 10px;
    }

    .action-group + .action-group {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .side-actions--primary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .side-actions--secondary {
      grid-template-columns: 1fr;
    }

    .action-panel-btn {
      min-height: 46px;
      justify-content: flex-start !important;
      gap: 8px;
      padding-left: 12px !important;
      padding-right: 12px !important;
      background: rgba(8, 20, 38, 0.72) !important;
      border-color: rgba(130, 247, 255, 0.16) !important;
      color: var(--text) !important;
    }

    .action-panel-btn--primary {
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.95), rgba(59, 130, 246, 0.84)) !important;
      color: #f8fbff !important;
    }

    .action-panel-btn--success {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(6, 182, 212, 0.8)) !important;
      color: #effff9 !important;
    }

    .action-panel-btn--danger {
      border-color: rgba(248, 113, 113, 0.2) !important;
      background: rgba(62, 16, 24, 0.76) !important;
      color: #fecaca !important;
    }

    .journey-card {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
    }

    .journey-card--info {
      border-color: rgba(34,211,238,0.22);
      background: rgba(34,211,238,0.08);
    }

    .journey-card strong {
      color: var(--text-main);
      font-size: 13px;
    }

    .journey-card p {
      margin: 0;
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .journey-card textarea {
      width: 100%;
      min-height: 86px;
      resize: vertical;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(4,10,25,0.55);
      color: var(--text-main);
      padding: 10px 12px;
      font: inherit;
      box-sizing: border-box;
    }

    .journey-summary {
      display: grid;
      gap: 4px;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(10, 18, 35, 0.58);
      border: 1px solid rgba(96, 165, 250, 0.16);
    }

    .journey-summary span {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #7dd3fc;
    }

    .journey-summary strong {
      font-size: 13px;
      line-height: 1.55;
      color: #f8fbff;
    }

    .journey-cta {
      justify-self: start;
      border-radius: 12px;
    }

    .rating-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .rating-chip {
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.04);
      color: var(--text-muted);
      padding: 6px 10px;
      border-radius: 999px;
      cursor: pointer;
      font-weight: 700;
      transition: all 0.2s ease;
    }

    .rating-chip.active {
      color: #67e8f9;
      border-color: rgba(34,211,238,0.3);
      background: rgba(34,211,238,0.1);
      box-shadow: 0 0 0 1px rgba(34,211,238,0.18) inset;
    }

    .alfresco-link-btn {
      width: 100%;
      margin-top: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid rgba(0, 227, 253, 0.2);
      border-radius: 12px;
      background: rgba(8, 20, 38, 0.72);
      color: var(--text);
      padding: 10px 14px;
      cursor: pointer;
      transition: border-color 180ms ease, transform 180ms ease, background 180ms ease;
    }

    .alfresco-link-btn:hover:not(:disabled) {
      border-color: rgba(0, 227, 253, 0.45);
      background: rgba(10, 27, 51, 0.88);
      transform: translateY(-1px);
    }

    .alfresco-link-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .alfresco-tree {
      display: grid;
      gap: 10px;
    }

    .alfresco-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    .alfresco-filter {
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--muted);
      padding: 6px 10px;
      font-size: 11px;
      cursor: pointer;
      transition: border-color 180ms ease, color 180ms ease, background 180ms ease;
    }

    .alfresco-filter.active {
      border-color: rgba(0, 227, 253, 0.34);
      color: var(--accent-2);
      background: rgba(0, 227, 253, 0.1);
    }

    .alfresco-tree__row {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
      padding: 12px;
      display: grid;
      gap: 10px;
      position: relative;
    }

    .alfresco-tree__row::before {
      content: '';
      position: absolute;
      left: 14px;
      top: 12px;
      bottom: 12px;
      width: 1px;
      background: rgba(0, 227, 253, 0.12);
    }

    .alfresco-tree__main {
      display: grid;
      gap: 6px;
      position: relative;
      z-index: 1;
    }

    .alfresco-tree__title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .alfresco-tree__title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .alfresco-tree__toggle {
      border: none;
      background: transparent;
      color: var(--muted);
      width: 18px;
      height: 18px;
      padding: 0;
      display: inline-grid;
      place-items: center;
      cursor: pointer;
      flex-shrink: 0;
    }

    .alfresco-tree__toggle mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .alfresco-tree__title-row strong {
      font-size: 12px;
      color: var(--text);
      word-break: break-word;
    }

    .alfresco-tree__icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--accent-2);
      flex-shrink: 0;
    }

    .alfresco-doc__badge {
      flex-shrink: 0;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .alfresco-doc__badge.synced {
      background: rgba(34, 197, 94, 0.16);
      color: #86efac;
    }

    .alfresco-doc__badge.pending {
      background: rgba(245, 158, 11, 0.16);
      color: #fcd34d;
    }

    .alfresco-doc__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      color: var(--muted);
      font-size: 11px;
    }

    .alfresco-doc__meta span {
      border-radius: 999px;
      padding: 3px 8px;
      background: rgba(255, 255, 255, 0.04);
    }

    .alfresco-doc__ref {
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    .alfresco-doc__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      position: relative;
      z-index: 1;
    }

    .alfresco-doc__action {
      border: 1px solid rgba(0, 227, 253, 0.18);
      border-radius: 10px;
      background: rgba(8, 20, 38, 0.68);
      color: var(--text);
      padding: 8px 10px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
    }

    .alfresco-doc__action:hover {
      border-color: rgba(0, 227, 253, 0.45);
      background: rgba(10, 27, 51, 0.88);
      transform: translateY(-1px);
    }

    .alfresco-doc__action:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
      border-color: rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.04);
    }

    .copilot-inline {
      margin: 16px 0 18px;
      padding: 16px;
      display: grid;
      gap: 12px;
      border-color: rgba(0, 227, 253, 0.18);
      background:
        radial-gradient(circle at top right, rgba(0, 227, 253, 0.08), transparent 38%),
        linear-gradient(180deg, rgba(9, 16, 28, 0.95), rgba(13, 22, 37, 0.92));
    }

    .copilot-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .copilot-section--wide {
      grid-column: 1 / -1;
    }

    .copilot-card {
      display: grid;
      gap: 12px;
      border-color: rgba(0, 227, 253, 0.18);
      background:
        radial-gradient(circle at top right, rgba(0, 227, 253, 0.08), transparent 38%),
        linear-gradient(180deg, rgba(9, 16, 28, 0.95), rgba(13, 22, 37, 0.92));
    }

    .copilot-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .copilot-header h3 {
      margin-bottom: 4px;
    }

    .copilot-header p {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
    }

    .copilot-refresh {
      white-space: nowrap;
      border-radius: 10px;
      border-color: rgba(0, 227, 253, 0.24);
      color: var(--accent-2);
    }

    .copilot-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 10px;
      color: rgba(130, 247, 255, 0.82);
    }

    .copilot-meta span {
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(0, 227, 253, 0.08);
      border: 1px solid rgba(0, 227, 253, 0.12);
    }

    .copilot-loading {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      font-size: 12px;
    }

    .copilot-error {
      border-radius: 10px;
      padding: 10px 12px;
      color: #fca5a5;
      background: rgba(127, 29, 29, 0.28);
      border: 1px solid rgba(248, 113, 113, 0.22);
      font-size: 12px;
    }

    .copilot-section {
      display: grid;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .copilot-section p {
      margin: 0;
      font-size: 12px;
      line-height: 1.6;
      color: #dbe7f8;
    }

    .copilot-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--accent-2);
      font-weight: 700;
    }

    .copilot-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .copilot-pill {
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 11px;
      line-height: 1.4;
      color: #dffafe;
      background: rgba(8, 145, 178, 0.18);
      border: 1px solid rgba(34, 211, 238, 0.16);
    }

    .copilot-pill--risk {
      color: #fecaca;
      background: rgba(127, 29, 29, 0.2);
      border-color: rgba(248, 113, 113, 0.22);
    }

    .copilot-pill--kb {
      color: #fde68a;
      background: rgba(133, 77, 14, 0.18);
      border-color: rgba(250, 204, 21, 0.22);
    }

    .mobile-dock {
      display: none;
      position: fixed;
      left: 8px;
      right: 8px;
      bottom: 8px;
      z-index: 20;
      border-radius: 14px;
      padding: 8px;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      background: rgba(8, 14, 26, 0.9);
      box-shadow: 0 0 24px rgba(0, 227, 253, 0.12);
    }

    .mobile-dock button {
      border: none;
      background: transparent;
      color: #93a2be;
      border-radius: 10px;
      padding: 6px 4px;
      display: grid;
      place-items: center;
      gap: 2px;
      cursor: pointer;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .mobile-dock button span {
      font-size: 9px;
      line-height: 1;
    }

    .mobile-dock button.active {
      color: var(--accent);
      background: rgba(0, 227, 253, 0.1);
    }

    .success-box {
      margin-top: 10px;
      border-radius: 10px;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #86efac;
      border: 1px solid rgba(34, 197, 94, 0.28);
      background: rgba(34, 197, 94, 0.12);
    }

    .empty-text {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }

    .process-tracker {
      display: grid;
      gap: 14px;
      padding: 6px 2px;
    }

    .pt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 10px;
      padding: 10px 12px;
      background: rgba(8, 17, 36, 0.55);
    }

    .pt-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text);
      text-transform: uppercase;
    }

    .pt-instance {
      font-size: 12px;
      color: var(--muted);
      text-align: right;
      word-break: break-all;
    }

    .pt-flow {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 8px;
    }

    .pt-connector {
      display: flex;
      align-items: center;
      height: 72px;
      min-width: 34px;
    }

    .pt-line {
      width: 34px;
      height: 2px;
      background: rgba(148, 163, 184, 0.34);
      transition: all .2s ease;
    }

    .pt-line.done {
      background: rgba(34, 197, 94, 0.85);
      box-shadow: 0 0 10px rgba(34, 197, 94, 0.35);
    }

    .pt-node {
      width: 120px;
      text-align: center;
      cursor: pointer;
      user-select: none;
      transition: transform .18s ease;
    }

    .pt-node:hover {
      transform: translateY(-1px);
    }

    .pt-node.selected .pt-label {
      color: var(--text);
      font-weight: 700;
    }

    .pt-circle {
      position: relative;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 2px solid rgba(148, 163, 184, 0.42);
      margin: 0 auto 8px;
      display: grid;
      place-items: center;
      background: rgba(15, 23, 42, 0.78);
      color: #93c5fd;
    }

    .pt-circle.done {
      border-color: rgba(34, 197, 94, 0.88);
      color: #86efac;
      background: rgba(21, 128, 61, 0.2);
    }

    .pt-circle.active {
      border-color: rgba(59, 130, 246, 0.9);
      color: #bae6fd;
      box-shadow: 0 0 14px rgba(59, 130, 246, 0.35);
    }

    .pt-check {
      position: absolute;
      right: -4px;
      bottom: -4px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #22c55e;
      color: #052e16;
      display: grid;
      place-items: center;
      font-size: 12px;
      border: 1px solid rgba(187, 247, 208, 0.9);
    }

    .pt-check mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
      line-height: 13px;
    }

    .pt-spinner {
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: rgba(56, 189, 248, 0.95);
      animation: spinAnim 1s linear infinite;
      pointer-events: none;
    }

    .pt-label {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.25;
      min-height: 30px;
    }

    .pt-label.done {
      color: #86efac;
    }

    .pt-label.active {
      color: #7dd3fc;
    }

    .pt-time {
      margin-top: 3px;
      font-size: 11px;
      color: rgba(148, 163, 184, 0.85);
    }

    .pt-detail {
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.55);
      padding: 10px 12px;
      display: grid;
      gap: 4px;
      font-size: 12px;
      color: var(--muted);
    }

    .pt-detail strong {
      color: var(--text);
    }

    .pt-sla {
      border: 1px dashed rgba(148, 163, 184, 0.3);
      border-radius: 10px;
      background: rgba(8, 17, 36, 0.45);
      padding: 10px 12px;
      display: grid;
      gap: 8px;
    }

    .pt-sla-title {
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    .pt-sla-pills {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .sla-pill {
      font-size: 11px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      color: rgba(148, 163, 184, 0.95);
      background: rgba(15, 23, 42, 0.65);
      border-radius: 999px;
      padding: 4px 10px;
      line-height: 1.2;
    }

    .sla-pill.triggered {
      border-color: rgba(245, 158, 11, 0.9);
      color: #fde68a;
      background: rgba(245, 158, 11, 0.2);
    }

    .full-width {
      width: 100%;
    }

    .spin {
      animation: spinAnim 0.9s linear infinite;
    }

    @keyframes spinAnim {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 1080px) {
      .layout-grid {
        grid-template-columns: 1fr;
      }

      .copilot-grid {
        grid-template-columns: 1fr;
      }

      .copilot-section--wide {
        grid-column: auto;
      }

      .hero-grid {
        grid-template-columns: 1fr;
      }

      .hero-actions {
        min-width: 0;
      }

      .hero-actions__grid,
      .side-actions--primary {
        grid-template-columns: 1fr;
      }

      .preview-list {
        grid-template-columns: 1fr;
      }

      .top-search {
        min-width: 220px;
      }
    }

    @media (max-width: 640px) {
      .ticket-detail-ui {
        padding: 10px 10px 20px;
      }

      .ticket-signal-strip {
        grid-template-columns: 1fr;
      }

      .meta-cards {
        grid-template-columns: 1fr;
      }

      .send-box {
        grid-template-columns: 1fr;
      }

      .reveal,
      .delay-1,
      .delay-2,
      .delay-3,
      .delay-4,
      .delay-5,
      .delay-6 {
        animation-delay: 0ms;
      }
    }
  `]
})
export class TicketDetailComponent implements OnInit, OnDestroy {
  ticket: Ticket | null = null;
  workflowStatus: WorkflowStatus | null = null;
  workflowTrace: WorkflowTrace | null = null;
  selectedStep = -1;
  activeTab: 'details' | 'attachments' | 'comments' | 'workflow' | 'history' = 'details';
  ticketHistory: TicketHistoryEntry[] = [];
  loading = true;
  newComment = '';
  selectedFile: File | null = null;
  attachmentDescription = '';
  private wsSubs: Subscription[] = [];
  private slaClockInterval: any = null;
  private liveReloadTimer: any = null;
  private commentsReloadTimer: any = null;
  nowMs = Date.now();
  readonly slaRingCircumference = 2 * Math.PI * 42;
  isValidatingResolution = false;
  showResolutionSuccess = false;
  resolutionSuccessMessage = '';
  clientValidationComment = '';
  clientSatisfactionRating = 5;
  private validationWatchdogSoft: any = null;
  private validationWatchdogHard: any = null;

  /** Smart agent recommendations for SLA breach âÂÂ loaded when SLA is critical */
  recommendedAgents: UserSummary[] = [];
  escalationEvents: any[] = [];
  copilotData: AICopilot | null = null;
  copilotLoading = false;
  copilotError = '';
  allNotifications: Notification[] = [];
  ticketNotifications: Notification[] = [];
  alfrescoDocuments: TicketAlfrescoDocument[] = [];
  alfrescoFilter: 'all' | 'folders' | 'reports' | 'attachments' = 'all';
  alfrescoExpandedFolders: Record<string, boolean> = {};
  private previewObjectUrls: string[] = [];
  isGeneratingKb = false;
  knowledgeDraftPreview = '';
  isCreatingKnowledgeArticle = false;
  relatedKnowledgeArticles: KnowledgeArticle[] = [];
  knowledgeArticlesLoading = false;

  statusOptions: { value: TicketStatus; label: string }[] = [
    { value: 'NEW', label: 'Nouveau' },
    { value: 'OPEN', label: 'Ouvert' },
    { value: 'ASSIGNED', label: 'Assigne' },
    { value: 'IN_PROGRESS', label: 'En cours' },
    { value: 'PENDING', label: 'En attente' },
    { value: 'ESCALATED_MANUAL', label: 'Escalade manuelle' },
    { value: 'RESOLVED', label: 'Resolu' },
    { value: 'CLOSED', label: 'Ferme' }
  ];

  isClient = false;
  isAgent = false;
  isManager = false;
  currentUserId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ticketService: TicketService,
    private authService: AuthService,
    private userService: UserService,
    private aiService: AIService,
    private knowledgeBaseService: KnowledgeBaseService,
    private notificationService: NotificationService,
    private dialog: MatDialog,
    private wsService: WebSocketService
  ) {
    this.refreshRoleFlags();
  }

  private refreshRoleFlags(): void {
    this.isClient = this.authService.isClient();
    this.isManager = this.authService.isManager();
    const hasAgentRole = this.authService.hasRole('SUPPORT_AGENT');
    this.isAgent = hasAgentRole && !this.isManager;
  }

  private normalizeTicket(ticket: Ticket): Ticket {
    const assignedUser = ticket.assignedTo || ticket.assignedAgent || ticket.assignee;
    const normalizedClient = ticket.client
      ? {
        ...ticket.client,
        name: ticket.client.name || ticket.client.companyName || ticket.client.code || 'Client'
      }
      : ticket.client;

    return {
      ...ticket,
      assignedTo: assignedUser,
      assignedAgent: assignedUser,
      assignee: assignedUser,
      client: normalizedClient,
      comments: ticket.comments || [],
      attachments: ticket.attachments || []
    };
  }

  getClientDisplayName(): string {
    const fullName = ((this.ticket?.createdByUser?.firstName || '') + ' ' + (this.ticket?.createdByUser?.lastName || '')).trim();
    return this.ticket?.client?.name || this.ticket?.client?.companyName || this.ticket?.client?.code || fullName || '-';
  }

  getAssignedAgentDisplayName(): string {
    const assignedUser = this.ticket?.assignedTo || this.ticket?.assignedAgent || this.ticket?.assignee;
    if (!assignedUser) {
      return '';
    }

    const fullName = ((assignedUser.firstName || '') + ' ' + (assignedUser.lastName || '')).trim();
    return fullName || assignedUser.username || '-';
  }

  get ticketUnreadNotificationsCount(): number {
    return this.ticketNotifications.filter(notification => this.isUnreadNotification(notification)).length;
  }

  get ticketSlaAlertsCount(): number {
    return this.ticketNotifications.filter(notification =>
      this.isUnreadNotification(notification) && isSlaNotification(notification)
    ).length;
  }

  get ticketActionRequiredCount(): number {
    return this.ticketNotifications.filter(notification =>
      this.isUnreadNotification(notification) && !!notification.actionRequired
    ).length;
  }

  getRecommendedActionLabel(): string {
    if (!this.ticket) {
      return 'Pilotage ticket';
    }

    if (this.isClient && this.ticket.status === 'RESOLVED') {
      return 'Valider la solution';
    }

    if (!this.getAssignedAgentDisplayName() && this.canAct('assign')) {
      return 'Assigner un responsable';
    }

    if (this.canAct('take-charge') && ['OPEN', 'ASSIGNED', 'ESCALATED_MANUAL', 'ESCALATED_SLA'].includes(this.ticket.status)) {
      return 'Prendre le ticket en charge';
    }

    if (this.canRequestCustomerInput() && this.ticket.status === 'IN_PROGRESS') {
      return 'Attendre un retour client';
    }

    if (this.canAct('resolve') && ['ASSIGNED', 'IN_PROGRESS', 'ESCALATED_MANUAL', 'ESCALATED_SLA'].includes(this.ticket.status)) {
      return 'Finaliser la resolution';
    }

    if (this.canAct('close')) {
      return 'Cloturer le ticket';
    }

    if (this.canAct('reopen')) {
      return 'Reouvrir le ticket';
    }

    return 'Suivre le traitement';
  }

  getRecommendedActionDescription(): string {
    if (!this.ticket) {
      return 'Le detail ticket centralise l etat, les alertes et les actions disponibles.';
    }

    if (this.isClient && this.ticket.status === 'RESOLVED') {
      return 'Confirmez si la solution repond au besoin ou refusez-la avec un commentaire precis.';
    }

    if (!this.getAssignedAgentDisplayName() && this.canAct('assign')) {
      return 'Le ticket n a pas encore d owner. Affectez un agent pour lancer le traitement sans perdre de temps.';
    }

    if (this.canAct('take-charge') && ['OPEN', 'ASSIGNED', 'ESCALATED_MANUAL', 'ESCALATED_SLA'].includes(this.ticket.status)) {
      return 'Prenez la responsabilite du ticket pour demarrer le diagnostic et clarifier la suite du traitement.';
    }

    if (this.canRequestCustomerInput() && this.ticket.status === 'IN_PROGRESS') {
      return 'Mettez le ticket en attente client si des informations complementaires sont necessaires.';
    }

    if (this.canAct('resolve') && ['ASSIGNED', 'IN_PROGRESS', 'ESCALATED_MANUAL', 'ESCALATED_SLA'].includes(this.ticket.status)) {
      return 'La resolution semble mature. Formalisez la solution et preparez la validation finale.';
    }

    if (this.canAct('close')) {
      return 'La resolution est prete a etre validee. Cloturez proprement le ticket pour terminer le cycle.';
    }

    if (this.canAct('reopen')) {
      return 'Le ticket peut etre relance si un nouveau besoin ou un refus de solution apparait.';
    }

    return 'Utilisez les panneaux de droite pour suivre le SLA, les documents et les transitions metier.';
  }

  getRoleAwareTicketSummary(): string {
    if (!this.ticket) {
      return 'Le detail ticket centralise les etapes, les alertes et les actions disponibles.';
    }

    if (this.isClient) {
      if (this.ticket.status === 'PENDING' && this.ticket.waitingOn === 'CLIENT') {
        return this.ticket.pendingReason || 'Le support a besoin d informations complementaires pour poursuivre le traitement.';
      }
      if (this.ticket.status === 'RESOLVED') {
        return 'Une solution a ete proposee. Relisez-la et validez-la pour fermer le ticket.';
      }
      return 'Cette vue vous permet de suivre votre demande, les communications publiques et les documents lies.';
    }

    if (this.isManager) {
      return this.ticket.nextExpectedAction || 'Supervisez l owner, les risques SLA et l arbitrage necessaire sur ce ticket.';
    }

    if (this.ticket.lastCustomerResponseAt) {
      return 'Le client a repondu. Reprenez l analyse et apportez une action concrete pour faire avancer le ticket.';
    }

    if (this.ticket.resolutionRejectedReason) {
      return 'La solution precedente a ete refusee. Requalifiez le besoin puis proposez une nouvelle resolution.';
    }

    return this.ticket.nextExpectedAction || 'Le ticket est positionne ici pour guider la prochaine action agent.';
  }

  getActionTone(): 'active' | 'urgent' | 'pending' | 'stable' {
    if (!this.ticket) {
      return 'active';
    }

    if (this.isSlaBreached() || this.ticket.status === 'ESCALATED_MANUAL' || this.ticket.status === 'ESCALATED_SLA' || this.ticketActionRequiredCount > 0) {
      return 'urgent';
    }

    if (this.ticket.status === 'PENDING' || !!this.ticket.slaPaused) {
      return 'pending';
    }

    if (this.ticket.status === 'RESOLVED' || this.ticket.status === 'CLOSED') {
      return 'stable';
    }

    return 'active';
  }

  ngOnInit(): void {
    this.refreshRoleFlags();
    this.loadCurrentUser();
    this.startSlaClock();
    this.notificationService.loadUnreadNotifications();
    this.wsSubs.push(
      this.notificationService.getNotifications().subscribe(notifications => {
        this.allNotifications = notifications || [];
        this.syncTicketNotifications();
      })
    );
    this.wsSubs.push(
      this.route.queryParamMap.subscribe(params => {
        const requestedTab = params.get('tab');
        if (requestedTab && ['details', 'attachments', 'comments', 'workflow', 'history'].includes(requestedTab)) {
          this.activeTab = requestedTab as 'details' | 'attachments' | 'comments' | 'workflow' | 'history';
        }
      })
    );
    const ticketId = this.route.snapshot.paramMap.get('id');
    if (ticketId) {
      this.loadTicket(+ticketId);
      this.subscribeToLiveUpdates(+ticketId);
    }
  }
  ngOnDestroy(): void {
    this.wsSubs.forEach(s => s.unsubscribe());
    if (this.liveReloadTimer) {
      clearTimeout(this.liveReloadTimer);
      this.liveReloadTimer = null;
    }
    if (this.commentsReloadTimer) {
      clearTimeout(this.commentsReloadTimer);
      this.commentsReloadTimer = null;
    }
    if (this.slaClockInterval) {
      clearInterval(this.slaClockInterval);
      this.slaClockInterval = null;
    }
    this.stopValidationWatchdog();
    this.previewObjectUrls.forEach(url => URL.revokeObjectURL(url));
    this.previewObjectUrls = [];
  }

  private startSlaClock(): void {
    this.slaClockInterval = setInterval(() => {
      this.nowMs = Date.now();
    }, 1000);
  }

  private subscribeToLiveUpdates(ticketId: number): void {
    // Live status updates
    this.wsSubs.push(
      this.wsService.subscribeToTicket(ticketId).subscribe(event => {
        // Only accept WS status updates if we are not currently performing a manual status change
        if (event.type === 'STATUS_CHANGE' && this.ticket && !this.isValidatingResolution) {
          this.ticket.status = event.newStatus as TicketStatus;
        } else if (event.type === 'CAMUNDA_TASK' || event.type === 'TICKET_UPDATE') {
          // For major updates, we might still want to reload but carefully
          if (!this.isValidatingResolution) {
            this.scheduleLiveReload(ticketId);
          }
        }
      })
    );

    // Live new comments
    this.wsSubs.push(
      this.wsService.subscribeToTicketComments(ticketId).subscribe(event => {
        if (event.type === 'NEW_COMMENT' && this.ticket?.comments) {
          this.scheduleCommentsReload(ticketId);
        }
      })
    );
  }

  private scheduleLiveReload(ticketId: number): void {
    if (this.liveReloadTimer) {
      return;
    }

    this.liveReloadTimer = setTimeout(() => {
      this.liveReloadTimer = null;
      this.loadTicket(ticketId);
    }, 350);
  }

  private scheduleCommentsReload(ticketId: number): void {
    if (this.commentsReloadTimer) {
      return;
    }

    this.commentsReloadTimer = setTimeout(() => {
      this.commentsReloadTimer = null;
      this.loadComments(ticketId);
      this.loadHistory(ticketId);
    }, 500);
  }

  private loadCurrentUser(): void {
    if (!this.isAgent) {
      this.currentUserId = null;
      return;
    }

    const userInfo = this.authService.getUserInfo();
    const targetEmail = userInfo.email?.toLowerCase();
    const targetUsername = userInfo.username?.toLowerCase();

    this.userService.getAvailableAgents().subscribe({
      next: (agents) => {
        const matched = agents.find(agent => {
          const agentEmail = agent.email?.toLowerCase();
          const agentUsername = agent.username?.toLowerCase();
          return (targetEmail && agentEmail === targetEmail) ||
            (targetUsername && agentUsername === targetUsername);
        });
        this.currentUserId = matched?.id ?? null;
      },
      error: (error) => {
        console.error('Error resolving current agent:', error);
        this.currentUserId = null;
      }
    });
  }

  hasManagerPrivileges(): boolean {
    return this.authService.isManager();
  }

  canAct(action: string): boolean {
    if (!this.ticket) return false;
    return this.authService.canActOnTicket(this.ticket, action);
  }

  isWaitingForCustomerState(): boolean {
    return !!this.ticket
      && this.ticket.status === 'PENDING'
      && !!this.ticket.slaPaused;
  }

  canRequestCustomerInput(): boolean {
    if (!this.ticket || this.isClient || !this.canAct('sla-pause')) {
      return false;
    }
    return this.ticket.status === 'ASSIGNED'
      || this.ticket.status === 'IN_PROGRESS'
      || this.ticket.status === 'ESCALATED_MANUAL'
      || this.ticket.status === 'ESCALATED_SLA'
      || (this.ticket.status === 'PENDING' && !this.ticket.slaPaused);
  }

  canTriggerAction(action: string): boolean {
    return this.canAct(action);
  }

  getActionTooltip(action: string): string {
    if (this.canTriggerAction(action)) return '';
    
    const tooltips: Record<string, string> = {
      'assign': 'Vous n\'avez pas la permission d\'assigner ce ticket',
      'take-charge': 'Statut du ticket ne permet pas cette action',
      'resolve': 'Vous ne pouvez pas résoudre ce ticket',
      'escalate': 'Vous ne pouvez pas escalader ce ticket'
    };
    
    return tooltips[action] || 'Action non disponible';
  }

  canArchive(): boolean {
    if (!this.ticket) return false;
    return this.canAct('archive');
  }

  loadTicket(id: number): void {
    this.loading = true;
    this.ticketService.getTicket(id).subscribe({
      next: (ticket) => {
        this.ticket = this.normalizeTicket(ticket);
        this.knowledgeDraftPreview = '';
        this.relatedKnowledgeArticles = [];
        this.syncTicketNotifications();
        this.loadWorkflowStatus(ticket.id);
        this.loadWorkflowTrace(ticket.id);
        this.isValidatingResolution = false;
        this.stopValidationWatchdog();
        this.loadComments(ticket.id);
        this.loadAlfrescoDocuments(ticket.id);
        this.loadAttachments(ticket.id);
        this.loadHistory(ticket.id);
        if (!this.isClient) {
          this.loadRelatedKnowledgeArticles(ticket.id);
        }
        this.loading = false;
        if (!this.isClient) {
          this.loadCopilot();
        } else {
          this.copilotData = null;
          this.copilotError = '';
          this.copilotLoading = false;
        }
        // Load recommended agents when SLA is critical or breached (manager only)
        if (this.isManager && (this.ticket.slaState === 'BREACHED' || (this.ticket.escalationLevel ?? 0) > 1 || this.ticket.legacyEscalated || this.ticket.slaBreached)) {
          this.loadRecommendedAgents(this.ticket.id);
        }
        // Load escalation timeline
        if (this.ticket.escalationLevel && this.ticket.escalationLevel > 0) {
          this.loadEscalationHistory(this.ticket.id);
        }
      },
      error: (error) => {
        console.error('Error loading ticket:', error);
        this.alfrescoDocuments = [];
        this.loading = false;
      }
    });
  }

  loadCopilot(): void {
    if (!this.ticket?.id || this.isClient) return;

    this.copilotLoading = true;
    this.copilotError = '';
    this.aiService.copilot(this.ticket.id).subscribe({
      next: (copilot) => {
        this.copilotData = copilot;
        this.copilotLoading = false;
      },
      error: (error) => {
        console.error('Error loading AI copilot:', error);
        this.copilotLoading = false;
        this.copilotData = null;
        this.copilotError = 'Le Copilot IA est indisponible pour ce ticket.';
      }
    });
  }

  splitCopilotField(value?: string): string[] {
    if (!value) return [];
    return value
      .split('|')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private loadWorkflowStatus(ticketId: number): void {
    this.ticketService.getWorkflowStatus(ticketId).subscribe({
      next: (status) => {
        this.workflowStatus = status;
      },
      error: () => {
        this.workflowStatus = null;
      }
    });
  }

  private loadWorkflowTrace(ticketId: number): void {
    this.ticketService.getWorkflowTrace(ticketId).subscribe({
      next: (trace) => {
        this.workflowTrace = trace;
      },
      error: () => {
        this.workflowTrace = null;
      }
    });
  }

  getWorkflowStatusLabel(): string {
    const status = this.workflowStatus?.processStatus || 'N/A';
    if (status === 'COMPLETED') return 'COMPLETED';
    if (status === 'ACTIVE') return 'ACTIVE';
    if (status === 'SUSPENDED') return 'SUSPENDED';
    if (status === 'ERROR') return 'ERROR';
    return status;
  }

  isStepDone(index: number): boolean {
    return !!this.workflowTrace?.steps?.[index]?.endTime;
  }

  getStepIcon(step: any): string {
    const id = (step.activityId || '').toLowerCase();
    if (id.includes('start') || id.includes('create')) return 'radio_button_unchecked';
    if (id.includes('end') || id.includes('close')) return 'radio_button_checked';
    if (id.includes('gateway') || id.includes('valid')) return 'diamond';
    if (id.includes('archive')) return 'inventory_2';
    return 'task_alt';
  }

  private loadRecommendedAgents(ticketId: number): void {
    this.userService.getRecommendedAgents(ticketId).subscribe({
      next: (agents) => { this.recommendedAgents = agents.slice(0, 3); },
      error: () => { this.recommendedAgents = []; }
    });
  }

  private loadEscalationHistory(ticketId: number): void {
    this.ticketService.getEscalationHistory(ticketId).subscribe({
      next: (events) => { this.escalationEvents = events; },
      error: () => { this.escalationEvents = []; }
    });
  }

  getEscReasonLabel(reason: string): string {
    const labels: Record<string, string> = {
      'SLA_BREACH': 'SLA depasse',
      'STUCK_ASSIGNED': 'Ticket en attente',
      'MANUAL': 'Intervention manuelle',
      'NO_AGENT_AVAILABLE': 'Aucun agent disponible',
      'MANAGER_OVERRIDE': 'Decision manager',
      'COOLDOWN_SKIP': 'Protection anti-boucle',
      'FATIGUE_BLOCKED': 'Reaffectation differee'
    };
    return labels[reason] || reason;
  }

  getEscalationStepLabel(level?: number | null): string {
    switch (level) {
      case 1: return 'Reaffectation intelligente';
      case 2: return 'Supervision manager';
      case 3: return 'Prise en charge manager';
      default: return 'Suivi SLA';
    }
  }

  getEscalationStepShortLabel(level?: number | null): string {
    switch (level) {
      case 1: return 'Reaffectation';
      case 2: return 'Supervision';
      case 3: return 'Prise en charge';
      default: return 'SLA';
    }
  }

  getEscalationStepDescription(level?: number | null): string {
    switch (level) {
      case 1: return 'Le ticket a ete reaffecte automatiquement vers un agent plus adapte.';
      case 2: return 'Le manager est alerte et suit le ticket de pres.';
      case 3: return 'Le manager reprend directement le traitement du ticket.';
      default: return 'Suivi SLA en cours.';
    }
  }

  getStatusLabel(status: TicketStatus): string {
    if (status === 'ESCALATED_SLA') {
      return 'Escalade active';
    }
    return this.statusOptions.find(s => s.value === status)?.label || status;
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

  getInitials(firstName?: string, lastName?: string): string {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  }

  isSlaBreached(): boolean {
    if (!this.ticket) return false;
    if (this.ticket.slaBreached || this.ticket.slaState === 'BREACHED') {
      return true;
    }
    if (!this.ticket.slaDeadline) return false;
    return new Date(this.ticket.slaDeadline) < new Date();
  }

  getSlaRemainingText(): string {
    if (this.ticket?.slaRemainingTime) {
      return this.ticket.slaRemainingTime;
    }
    if (!this.ticket?.slaDeadline) return '--:--';
    const now = this.nowMs;
    const deadline = new Date(this.ticket.slaDeadline).getTime();
    const diff = deadline - now;
    if (diff <= 0) return '00:00:00';
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  getSlaProgressPercent(): number {
    if (typeof this.ticket?.slaConsumedPercent === 'number') {
      return Math.max(4, Math.min(100, this.ticket.slaConsumedPercent));
    }
    if (!this.ticket?.createdAt || !this.ticket?.slaDeadline) return 0;
    const start = new Date(this.ticket.createdAt).getTime();
    const end = new Date(this.ticket.slaDeadline).getTime();
    const now = this.nowMs;
    const total = end - start;
    if (total <= 0) return 100;
    const used = now - start;
    const percent = (used / total) * 100;
    return Math.max(4, Math.min(100, percent));
  }

  getSlaClockAngle(): number {
    const percent = this.getSlaProgressPercent();
    return Math.round((percent / 100) * 360);
  }

  getSlaRingOffset(): number {
    const progress = this.getSlaProgressPercent();
    return this.slaRingCircumference * (1 - progress / 100);
  }

  getSlaProgressClass(): 'on-track' | 'risk' | 'breached' | 'paused' {
    if (this.ticket?.slaPaused) return 'paused';
    if (this.ticket?.slaState === 'BREACHED' || this.isSlaBreached()) return 'breached';
    if (this.ticket?.slaState === 'AT_RISK' || this.getSlaProgressPercent() >= 75) return 'risk';
    return 'on-track';
  }

  getSlaPhaseLabel(): string {
    if (this.ticket?.slaPaused) return this.ticket.slaOperationalStatus || 'En pause';
    const cls = this.getSlaProgressClass();
    switch (cls) {
      case 'breached': return 'Depassement';
      case 'risk': return 'A risque';
      default: return this.ticket?.slaOperationalStatus || 'Sous controle';
    }
  }

  getSlaStateLabel(): string {
    if (!this.ticket) return '';
    if (this.ticket.slaOperationalStatus) return this.ticket.slaOperationalStatus;
    if (this.ticket.slaPaused) return 'Chrono en pause';
    if (this.isSlaBreached() || this.ticket.slaState === 'BREACHED') return 'Deadline depassee';
    if (this.getSlaProgressPercent() >= 75) return 'Alerte preventive envoyee';
    return 'Sous controle';
  }

  getSlaStageLabel(): string {
    const progress = this.getSlaProgressPercent();
    if (this.ticket?.slaPaused) return this.ticket.slaOperationalStatus || 'En pause';
    if ((this.ticket?.escalationLevel ?? 0) > 1 || this.ticket?.legacyEscalated || this.isSlaBreached() || progress >= 100) {
      return 'Escalade active (L2/L3)';
    }
    if (progress >= 75) {
      return 'Ticket a risque (75%)';
    }
    return this.ticket?.slaCalendarLabel ? `SLA sous controle · ${this.ticket.slaCalendarLabel}` : 'SLA sous controle';
  }

  triggerSlaEscalation(): void {
    if (!this.ticket || !this.isManager) return;
    const dialogRef = this.dialog.open<TicketWorkflowActionDialogComponent, TicketWorkflowActionDialogData, TicketWorkflowActionDialogResult>(
      TicketWorkflowActionDialogComponent,
      {
        width: '620px',
        maxWidth: '95vw',
        data: {
          title: 'Demander une revue manager',
          subtitle: 'Precisez pourquoi une supervision ou un arbitrage est necessaire.',
          submitLabel: 'Demander la revue',
          reasonLabel: 'Motif de la revue',
          reasonPlaceholder: 'Expliquer le risque, le blocage ou la decision attendue...',
          requireReason: true
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.reason) return;
      this.ticketService.requestManagerReview(this.ticket!.id, result.reason).subscribe({
        next: (updatedTicket) => {
          this.ticket = updatedTicket;
          this.loadHistory(updatedTicket.id!);
        },
        error: (error) => {
          console.error('Error requesting manager review:', error);
          this.showActionError("Impossible de declencher la revue manager");
        }
      });
    });
  }

  pauseSlaClock(): void {
    if (!this.ticket || !this.canTriggerAction('sla-pause')) return;
    const dialogRef = this.dialog.open<TicketWorkflowActionDialogComponent, TicketWorkflowActionDialogData, TicketWorkflowActionDialogResult>(
      TicketWorkflowActionDialogComponent,
      {
        width: '620px',
        maxWidth: '95vw',
        data: {
          title: 'Mettre le SLA en pause',
          subtitle: 'Le motif sera visible dans l historique et la supervision manager.',
          submitLabel: 'Mettre en pause',
          reasonLabel: 'Motif de la pause SLA',
          reasonPlaceholder: 'Ex: attente client, dependance fournisseur, fenetre de maintenance...',
          requireReason: true
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.reason) return;
      this.ticketService.pauseSla(this.ticket!.id, result.reason).subscribe({
        next: (updatedTicket) => {
          this.ticket = updatedTicket;
          this.loadHistory(updatedTicket.id!);
        },
        error: (error) => {
          console.error('Error pausing SLA:', error);
          this.showActionError("Impossible de mettre le SLA en pause");
        }
      });
    });
  }

  resumeSlaClock(): void {
    if (!this.ticket || !this.canTriggerAction('sla-resume')) return;
    const confirmed = confirm('Reprendre le chrono SLA ?');
    if (!confirmed) return;

    this.ticketService.resumeSla(this.ticket.id).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
      },
      error: (error) => {
        console.error('Error resuming SLA:', error);
        alert("Impossible de reprendre le SLA");
      }
    });
  }

  extendSlaDuration(): void {
    if (!this.ticket || !this.canTriggerAction('sla-extend')) return;
    const dialogRef = this.dialog.open<TicketWorkflowActionDialogComponent, TicketWorkflowActionDialogData, TicketWorkflowActionDialogResult>(
      TicketWorkflowActionDialogComponent,
      {
        width: '620px',
        maxWidth: '95vw',
        data: {
          title: 'Prolonger le SLA',
          subtitle: 'Renseignez une justification claire pour la gouvernance manager.',
          submitLabel: 'Prolonger',
          reasonLabel: 'Justification',
          reasonPlaceholder: 'Expliquer pourquoi une extension SLA est necessaire...',
          minutesEnabled: true,
          defaultMinutes: 60,
          requireReason: true
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.reason || !result.minutes) return;
      this.ticketService.extendSla(this.ticket!.id, result.minutes, result.reason).subscribe({
        next: (updatedTicket) => {
          this.ticket = updatedTicket;
          this.loadHistory(updatedTicket.id!);
        },
        error: (error) => {
          console.error('Error extending SLA:', error);
          this.showActionError("Impossible de prolonger le SLA");
        }
      });
    });
  }

  shareTicket(): void {
    if (!this.ticket) return;
    const url = `${window.location.origin}/tickets/${this.ticket.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Lien du ticket copié');
    }).catch(() => {
      window.prompt('Copiez ce lien:', url);
    });
  }

  generateKnowledgeDraft(): void {
    if (!this.ticket || this.isGeneratingKb) {
      return;
    }

    this.isGeneratingKb = true;
    this.aiService.generateKbArticle(this.ticket.id).subscribe({
      next: (draft) => {
        this.knowledgeDraftPreview = this.formatKnowledgeDraft(draft);
        this.isGeneratingKb = false;
        this.showActionInfo('Brouillon KB genere avec succes.');
      },
      error: (error) => {
        console.error('Error generating KB draft:', error);
        this.isGeneratingKb = false;
        this.showActionError(error?.error?.message || 'Impossible de generer le brouillon KB.');
      }
    });
  }

  createKnowledgeArticle(): void {
    if (!this.ticket || this.isCreatingKnowledgeArticle || !this.canCreateKnowledgeArticle()) {
      return;
    }

    this.isCreatingKnowledgeArticle = true;
    this.knowledgeBaseService.createFromTicket(this.ticket.id).subscribe({
      next: (article) => {
        this.isCreatingKnowledgeArticle = false;
        this.showActionInfo(`Article KB cree: ${article.title}`);
        this.loadRelatedKnowledgeArticles(this.ticket!.id);
      },
      error: (error) => {
        console.error('Error creating KB article:', error);
        this.isCreatingKnowledgeArticle = false;
        this.showActionError(error?.error?.message || 'Impossible de creer l article KB depuis ce ticket.');
      }
    });
  }

  canCreateKnowledgeArticle(): boolean {
    if (!this.ticket || this.isClient) {
      return false;
    }
    return ['RESOLVED', 'CLOSED'].includes(this.ticket.status) && !!this.ticket.resolutionSummary;
  }

  get linkedKnowledgeArticles(): KnowledgeArticle[] {
    return this.relatedKnowledgeArticles.filter(article => article.sourceTicketId === this.ticket?.id);
  }

  get suggestedKnowledgeArticles(): KnowledgeArticle[] {
    return this.relatedKnowledgeArticles.filter(article => article.sourceTicketId !== this.ticket?.id);
  }

  private loadRelatedKnowledgeArticles(ticketId: number): void {
    this.knowledgeArticlesLoading = true;
    this.knowledgeBaseService.getRelatedArticlesForTicket(ticketId).subscribe({
      next: (articles) => {
        this.relatedKnowledgeArticles = articles || [];
        this.knowledgeArticlesLoading = false;
      },
      error: (error) => {
        console.error('Error loading related KB articles:', error);
        this.relatedKnowledgeArticles = [];
        this.knowledgeArticlesLoading = false;
      }
    });
  }

  getAlfrescoDocumentEntries(): TicketAlfrescoDocument[] {
    return this.alfrescoDocuments;
  }

  getAlfrescoTreeRows(): TicketAlfrescoTreeRow[] {
    const sortedDocuments = [...this.alfrescoDocuments].sort((left, right) => this.compareAlfrescoDocuments(left, right));
    const visibleDocuments = sortedDocuments.filter(document => this.isAlfrescoVisible(document, sortedDocuments));

    return visibleDocuments
      .map(document => {
        const depth = this.getAlfrescoDepth(document);
        const displayLabel = this.getAlfrescoDisplayLabel(document);
        const isFolderLike = document.kind === 'archive' || document.kind === 'folder';
        return {
          ...document,
          depth,
          displayLabel,
          isFolderLike
        };
      });
  }

  getAlfrescoShareUrl(): string | null {
    const archiveDocument = this.alfrescoDocuments.find(doc => doc.kind === 'archive');
    if (archiveDocument) {
      return this.getAlfrescoDocumentUrl(archiveDocument);
    }

    if (!this.ticket) {
      return null;
    }

    const baseUrl = environment.alfresco?.shareUrl?.trim();
    if (!baseUrl) {
      return null;
    }

    const searchTerm = this.ticket.reference || `${this.ticket.id}`;
    return `${baseUrl}/page/search?term=${encodeURIComponent(searchTerm)}`;
  }

  getAlfrescoDocumentUrl(document: TicketAlfrescoDocument): string | null {
    const baseUrl = environment.alfresco?.shareUrl?.trim();
    if (!baseUrl) {
      return null;
    }

    const nodeRef = this.normalizeAlfrescoNodeRef(document.ref);
    if (nodeRef) {
      const page = document.kind === 'archive' || document.kind === 'folder'
        ? 'folder-details'
        : 'document-details';
      return `${baseUrl}/page/${page}?nodeRef=${encodeURIComponent(nodeRef)}`;
    }

    if (document.kind === 'attachment' || document.kind === 'document') {
      return null;
    }

    const searchTerm = this.ticket?.reference || `${this.ticket?.id ?? ''}`;
    return searchTerm ? `${baseUrl}/page/search?term=${encodeURIComponent(searchTerm)}` : null;
  }

  openAlfrescoShare(): void {
    const url = this.getAlfrescoShareUrl();
    if (!url) {
      this.showActionError("Lien Alfresco indisponible pour ce ticket.");
      return;
    }

    window.open(url, '_blank', 'noopener');
  }

  openAlfrescoDocument(document: TicketAlfrescoDocument): void {
    const url = this.getAlfrescoDocumentUrl(document);
    if (!url) {
      this.showActionError("Lien Alfresco indisponible pour ce document.");
      return;
    }

    window.open(url, '_blank', 'noopener');
  }

  toggleAlfrescoFolder(folderId: string): void {
    this.alfrescoExpandedFolders[folderId] = !this.isAlfrescoExpanded(folderId);
  }

  isAlfrescoExpanded(folderId: string): boolean {
    return this.alfrescoExpandedFolders[folderId] !== false;
  }

  getAlfrescoIcon(document: TicketAlfrescoDocument): string {
    switch (document.kind) {
      case 'archive':
        return 'inventory_2';
      case 'folder':
        return 'folder';
      case 'attachment':
        return 'attach_file';
      default:
        return this.resolveDocumentIcon(document.label, document.meta);
    }
  }

  getAlfrescoKindLabel(document: TicketAlfrescoDocument): string {
    switch (document.kind) {
      case 'archive':
        return 'Dossier ticket';
      case 'folder':
        return 'Sous-dossier';
      case 'attachment':
        return document.synced ? 'Piece jointe archivee' : 'Piece jointe locale';
      default:
        return 'Document archive';
    }
  }

  canPreviewAlfrescoDocument(document: TicketAlfrescoDocument): boolean {
    if (document.kind === 'archive' || document.kind === 'folder') {
      return false;
    }
    return this.isPreviewableMime(document) || this.isPreviewableName(document.label);
  }

  canDownloadAlfrescoDocument(document: TicketAlfrescoDocument): boolean {
    if (document.kind === 'archive' || document.kind === 'folder') {
      return false;
    }
    return !!document.attachment || !!document.synced;
  }

  previewAlfrescoDocument(documentItem: TicketAlfrescoDocument): void {
    this.loadAlfrescoDocumentBlob(documentItem, (blob, mimeType) => {
      const objectUrl = URL.createObjectURL(blob);
      this.previewObjectUrls.push(objectUrl);

      const dialogRef = this.dialog.open(AlfrescoPreviewDialogComponent, {
        width: 'min(96vw, 1120px)',
        maxWidth: '96vw',
        autoFocus: false,
        data: {
          title: this.getAlfrescoDisplayLabel(documentItem),
          objectUrl,
          mimeType
        } as AlfrescoPreviewDialogData
      });

      dialogRef.afterClosed().subscribe(() => {
        URL.revokeObjectURL(objectUrl);
        this.previewObjectUrls = this.previewObjectUrls.filter(url => url !== objectUrl);
      });
    });
  }

  downloadAlfrescoDocument(documentItem: TicketAlfrescoDocument): void {
    if (documentItem.attachment) {
      this.downloadAttachment(documentItem.attachment);
      return;
    }

    this.loadAlfrescoDocumentBlob(documentItem, (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = this.getAlfrescoDisplayLabel(documentItem) || documentItem.label || 'document';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  private normalizeAlfrescoNodeRef(ref?: string | null): string | null {
    if (!ref) {
      return null;
    }

    const normalized = ref.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.includes('://')) {
      return normalized;
    }

    return `workspace://SpacesStore/${normalized}`;
  }

  private formatFileSize(size?: number): string | null {
    if (!size || size <= 0) {
      return null;
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    const digits = unitIndex === 0 ? 0 : 1;
    return `${value.toFixed(digits)} ${units[unitIndex]}`;
  }

  private compareAlfrescoDocuments(left: TicketAlfrescoDocument, right: TicketAlfrescoDocument): number {
    const pathLeft = this.getAlfrescoComparablePath(left);
    const pathRight = this.getAlfrescoComparablePath(right);
    const pathCompare = pathLeft.localeCompare(pathRight, undefined, { sensitivity: 'base' });
    if (pathCompare !== 0) {
      return pathCompare;
    }

    const folderWeightLeft = left.kind === 'archive' || left.kind === 'folder' ? 0 : 1;
    const folderWeightRight = right.kind === 'archive' || right.kind === 'folder' ? 0 : 1;
    if (folderWeightLeft !== folderWeightRight) {
      return folderWeightLeft - folderWeightRight;
    }

    return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
  }

  private getAlfrescoComparablePath(document: TicketAlfrescoDocument): string {
    return (document.relativePath || document.label || '').replace(/\\/g, '/');
  }

  private isAlfrescoVisible(document: TicketAlfrescoDocument, allDocuments: TicketAlfrescoDocument[]): boolean {
    if (!this.matchesAlfrescoFilter(document)) {
      if (!this.shouldKeepAsFilterAncestor(document, allDocuments)) {
        return false;
      }
    }

    const documentPath = this.getAlfrescoComparablePath(document);
    if (!documentPath) {
      return true;
    }

    const segments = documentPath.split('/').filter(Boolean);
    while (segments.length > 1) {
      segments.pop();
      const ancestorPath = segments.join('/');
      const ancestor = allDocuments.find(item => this.getAlfrescoComparablePath(item) === ancestorPath);
      if (ancestor && !this.isAlfrescoExpanded(ancestor.id)) {
        return false;
      }
    }

    return true;
  }

  private matchesAlfrescoFilter(document: TicketAlfrescoDocument): boolean {
    switch (this.alfrescoFilter) {
      case 'folders':
        return document.kind === 'archive' || document.kind === 'folder';
      case 'reports':
        return document.kind === 'document';
      case 'attachments':
        return document.kind === 'attachment';
      default:
        return true;
    }
  }

  private shouldKeepAsFilterAncestor(document: TicketAlfrescoDocument, allDocuments: TicketAlfrescoDocument[]): boolean {
    if (!(document.kind === 'archive' || document.kind === 'folder')) {
      return false;
    }

    const documentPath = this.getAlfrescoComparablePath(document);
    if (!documentPath) {
      return false;
    }

    const prefix = `${documentPath}/`;
    return allDocuments.some(candidate =>
      candidate.id !== document.id &&
      this.matchesAlfrescoFilter(candidate) &&
      this.getAlfrescoComparablePath(candidate).startsWith(prefix)
    );
  }

  private getAlfrescoDepth(document: TicketAlfrescoDocument): number {
    const normalizedPath = this.getAlfrescoComparablePath(document);
    if (!normalizedPath) {
      return 0;
    }

    return Math.max(0, normalizedPath.split('/').filter(Boolean).length - 1);
  }

  private getAlfrescoDisplayLabel(document: TicketAlfrescoDocument): string {
    const normalizedPath = this.getAlfrescoComparablePath(document);
    if (!normalizedPath) {
      return document.label;
    }

    const segments = normalizedPath.split('/').filter(Boolean);
    return segments[segments.length - 1] || document.label;
  }

  private resolveDocumentIcon(label?: string | null, meta?: string | null): string {
    const value = `${label || ''} ${meta || ''}`.toLowerCase();
    if (value.includes('.pdf')) {
      return 'picture_as_pdf';
    }
    if (value.includes('.xls') || value.includes('.xlsx') || value.includes('.csv')) {
      return 'table_chart';
    }
    if (value.includes('.json') || value.includes('.xml') || value.includes('.txt') || value.includes('.log')) {
      return 'description';
    }
    if (value.includes('.png') || value.includes('.jpg') || value.includes('.jpeg') || value.includes('.gif') || value.includes('.webp')) {
      return 'image';
    }
    return 'insert_drive_file';
  }

  private isPreviewableMime(document: TicketAlfrescoDocument): boolean {
    const value = `${document.mimeType || ''}`.toLowerCase();
    return value === 'application/pdf' || value.startsWith('image/');
  }

  private isPreviewableName(fileName?: string | null): boolean {
    const value = `${fileName || ''}`.toLowerCase();
    return value.endsWith('.pdf')
      || value.endsWith('.png')
      || value.endsWith('.jpg')
      || value.endsWith('.jpeg')
      || value.endsWith('.gif')
      || value.endsWith('.webp');
  }

  private loadAlfrescoDocumentBlob(
    document: TicketAlfrescoDocument,
    onSuccess: (blob: Blob, mimeType: string) => void
  ): void {
    if (!this.ticket) {
      this.showActionError("Ticket introuvable pour charger le document.");
      return;
    }

    if (document.attachment) {
      this.ticketService.downloadAttachmentBinary(document.attachment.id!).subscribe({
        next: (blob) => onSuccess(blob, blob.type || document.mimeType || this.guessMimeTypeFromName(document.label)),
        error: (error) => {
          console.error('Error loading attachment preview:', error);
          this.showActionError("Impossible de charger la piece jointe.");
        }
      });
      return;
    }

    if (!document.ref) {
      this.showActionError("Document non synchronise dans Alfresco.");
      return;
    }

    this.ticketService.downloadAlfrescoDocumentBinary(this.ticket.id, document.ref).subscribe({
      next: (blob) => onSuccess(blob, blob.type || document.mimeType || this.guessMimeTypeFromName(document.label)),
      error: (error) => {
        console.error('Error loading Alfresco document:', error);
        this.showActionError("Impossible de charger le document Alfresco.");
      }
    });
  }

  private guessMimeTypeFromName(fileName?: string | null): string {
    const value = `${fileName || ''}`.toLowerCase();
    if (value.endsWith('.pdf')) return 'application/pdf';
    if (value.endsWith('.png')) return 'image/png';
    if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
    if (value.endsWith('.gif')) return 'image/gif';
    if (value.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
  }

  archiveTicket(): void {
    if (!this.ticket || !this.canArchive()) return;

    const ticketId = this.ticket.id;

    this.ticketService.archiveTicket(ticketId).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
        this.loadAlfrescoDocuments(updatedTicket.id);
        this.loadHistory(updatedTicket.id);
        this.playResolutionSuccess('Ticket archive avec succes.');
      },
      error: (error) => {
        console.error('Error archiving ticket:', error);
        this.ticketService.getTicket(ticketId).subscribe({
          next: (latestTicket) => {
            this.ticket = latestTicket;
            this.loadAlfrescoDocuments(latestTicket.id);
            this.loadHistory(latestTicket.id);
            if (latestTicket.archived) {
              this.playResolutionSuccess('Ticket archive avec succes.');
              return;
            }
            this.showActionError("Impossible d'archiver le ticket.");
          },
          error: () => {
            this.showActionError("Impossible d'archiver le ticket.");
          }
        });
      }
    });
  }

  updateStatus(status: TicketStatus): void {
    if (!this.ticket) return;

    this.ticketService.updateTicketStatus(this.ticket.id, status).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
      },
      error: (error) => {
        console.error('Error updating status:', error);
      }
    });
  }

  addComment(): void {
    if (!this.ticket || !this.newComment.trim()) return;
    const shouldResumeWorkflow = this.isClient && this.isWaitingForCustomerState();

    this.ticketService.addComment(this.ticket.id, this.newComment).subscribe({
      next: (comment) => {
        if (this.ticket) {
          if (!this.ticket.comments) {
            this.ticket.comments = [];
          }
          this.ticket.comments.unshift(comment);
        }
        this.newComment = '';
        if (shouldResumeWorkflow && this.ticket) {
          this.loadTicket(this.ticket.id);
          this.loadHistory(this.ticket.id);
          this.playResolutionSuccess('Votre reponse a ete envoyee. Le ticket repasse en traitement.');
        }
      },
      error: (error) => {
        console.error('Error adding comment:', error);
        this.showActionError("Impossible d'envoyer votre reponse pour le moment.");
      }
    });
  }

  assignToMe(): void {
    if (!this.ticket) return;

    if (!this.currentUserId) {
      this.loadCurrentUser();
      return;
    }

    if (this.ticket.assignedTo?.id === this.currentUserId) {
      return;
    }

    this.ticketService.assignTicket(this.ticket.id, this.currentUserId).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
      },
      error: (error) => {
        console.error('Error assigning ticket:', error);
      }
    });
  }

  openAssignDialog(): void {
    if (!this.ticket) return;
    
    if (!this.canTriggerAction('assign')) {
      this.showActionError('Vous n\'avez pas la permission d\'assigner ce ticket.');
      return;
    }

    const dialogRef = this.dialog.open(AssignDialogComponent, {
      width: '720px',
      disableClose: false,
      data: {
        currentAgentId: this.ticket.assignedTo?.id ?? null,
        ticketId: this.ticket.id
      } as AssignDialogData
    });

    dialogRef.afterClosed().subscribe((result?: AssignDialogResult) => {
      if (result?.agentId) {
        this.ticketService.assignTicket(this.ticket.id, result.agentId, result.source).subscribe({
          next: (updatedTicket) => {
            this.ticket = updatedTicket;
            this.showActionInfo(
              result.source === 'AI_RECOMMENDATION'
                ? 'Recommandation IA validée et ticket assigné'
                : 'Ticket assigné avec succès'
            );
          },
          error: (error) => {
            console.error('Error assigning ticket:', error);
            const errorMsg = error?.error?.message || 'Erreur lors de l\'assignation';
            this.showActionError(`Impossible d'assigner le ticket: ${errorMsg}`);
          }
        });
      }
    });
  }

  closeTicket(): void {
    this.updateStatus('CLOSED');
  }

  // Actions spécifiques à l'agent
  takeCharge(): void {
    if (!this.ticket) return;
    
    if (!this.canTriggerAction('take-charge')) {
      this.showActionError('Vous ne pouvez pas prendre ce ticket (statut ou permissions insuffisantes).');
      return;
    }

    this.ticketService.takeCharge(this.ticket.id).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
        this.showActionInfo('Ticket pris en charge avec succès');
      },
      error: (error) => {
        console.error('Error taking charge:', error);
        const errorMsg = error?.error?.message || 'Erreur inconnue';
        this.showActionError(`Impossible de prendre le ticket: ${errorMsg}`);
      }
    });
  }

  resolveTicket(): void {
    if (!this.ticket || this.isValidatingResolution || !this.canTriggerAction('resolve')) return;

    const dialogRef = this.dialog.open<ResolveDialogComponent, { ticketReference: string; ticketTitle: string }, ResolveDialogResult>(
      ResolveDialogComponent,
      {
        width: '680px',
        maxWidth: '95vw',
        autoFocus: false,
        disableClose: false,
        data: {
          ticketReference: this.ticket.reference,
          ticketTitle: this.ticket.title
        }
      }
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (!result?.summary) return;

      this.isValidatingResolution = true;
      this.startValidationWatchdog('resolution');
      this.ticketService.resolveTicket(this.ticket!.id, {
        resolutionSummary: result.summary,
        resolutionDetails: {
          diagnostic: result.diagnostic,
          rootCause: result.rootCause,
          actionsTaken: result.actionsTaken,
          nextRecommendation: result.nextRecommendation
        }
      }).subscribe({
        next: (updatedTicket) => {
          this.ticket = updatedTicket;
          this.playResolutionSuccess('Resolution enregistree avec succes');
        },
        error: (error) => {
          console.error('Error resolving ticket:', error);
          this.isValidatingResolution = false;
          this.stopValidationWatchdog();
          this.showActionError("Echec de validation. Veuillez reessayer.");
        },
        complete: () => {
          this.isValidatingResolution = false;
          this.stopValidationWatchdog();
        }
      });
    });
  }

  escalateTicket(): void {
    if (!this.ticket) return;
    
    if (!this.canTriggerAction('escalate')) {
      this.showActionError('Vous n\'avez pas la permission d\'escalader ce ticket.');
      return;
    }

    const dialogRef = this.dialog.open(EscalateDialogComponent, {
      width: '550px',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe((result: EscalateDialogResult) => {
      if (result && this.ticket) {
        this.ticketService.escalateTicket(this.ticket.id, result.agentId, result.motif).subscribe({
          next: (updatedTicket) => {
            this.ticket = updatedTicket;
            this.showActionInfo('Ticket escaladé avec succès');
          },
          error: (error) => {
            console.error('Error escalating ticket:', error);
            const errorMsg = error?.error?.message || 'Erreur inconnue';
            this.showActionError(`Impossible d'escalader le ticket: ${errorMsg}`);
          }
        });
      }
    });
  }

  reopenTicket(): void {
    if (!this.ticket || !this.canTriggerAction('reopen')) return;

    this.isValidatingResolution = true;
    this.ticketService.changeStatus(this.ticket.id, 'IN_PROGRESS').subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
        this.isValidatingResolution = false;
        this.playResolutionSuccess('Ticket réouvert avec succès.');
      },
      error: (error) => {
        console.error('Error reopening ticket:', error);
        this.isValidatingResolution = false;
        this.showActionError("Impossible de réouvrir le ticket.");
      }
    });
  }

  markWaitingForCustomer(): void {
    if (!this.ticket || !this.canRequestCustomerInput() || this.isValidatingResolution) return;
    const dialogRef = this.dialog.open<TicketWorkflowActionDialogComponent, TicketWorkflowActionDialogData, TicketWorkflowActionDialogResult>(
      TicketWorkflowActionDialogComponent,
      {
        width: '620px',
        maxWidth: '95vw',
        data: {
          title: 'Mettre le ticket en attente',
          subtitle: 'Precisez qui doit repondre et ce qui manque pour reprendre le traitement.',
          submitLabel: 'Confirmer',
          reasonLabel: 'Motif / informations attendues',
          reasonPlaceholder: 'Decrivez les informations necessaires ou le blocage metier...',
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

      this.isValidatingResolution = true;
      this.ticketService.waitForCustomer(this.ticket!.id, result.waitingOn, result.reason).subscribe({
        next: (updatedTicket) => {
          this.ticket = updatedTicket;
          this.loadHistory(updatedTicket.id);
          this.playResolutionSuccess('Ticket passe en attente. Le SLA est maintenant en pause.');
        },
        error: (error) => {
          console.error('Error marking ticket waiting for customer:', error);
          const errorMsg = error?.error?.message || 'Impossible de mettre le ticket en attente.';
          this.showActionError(errorMsg);
        },
        complete: () => {
          this.isValidatingResolution = false;
        }
      });
    });
  }

  // Actions spécifiques au client
  acceptSolution(): void {
    if (!this.ticket || this.ticket.status !== 'RESOLVED' || this.isValidatingResolution) return;

    const rating = Number(this.clientSatisfactionRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      this.showActionError('Veuillez saisir une note valide entre 1 et 5.');
      return;
    }
    const comment = this.clientValidationComment.trim();

    this.isValidatingResolution = true;
    this.startValidationWatchdog('close');

    this.ticketService.closeTicketWithSatisfaction(this.ticket.id, rating, comment).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
        this.clientValidationComment = '';
        this.clientSatisfactionRating = 5;
        this.loadHistory(updatedTicket.id);
        this.playResolutionSuccess('Solution acceptee. Ticket cloture avec succes.');
      },
      error: (error) => {
        console.error('Error accepting solution:', error);
        this.showActionError('Impossible d\'accepter la solution pour le moment.');
      },
      complete: () => {
        this.isValidatingResolution = false;
        this.stopValidationWatchdog();
      }
    });
  }

  rejectSolution(): void {
    if (!this.ticket || this.ticket.status !== 'RESOLVED' || this.isValidatingResolution) return;

    const reason = this.clientValidationComment.trim();
    if (!reason) {
      this.showActionError('Veuillez renseigner un motif de refus.');
      return;
    }

    this.isValidatingResolution = true;
    this.startValidationWatchdog('resolution');

    this.ticketService.rejectResolution(this.ticket.id, reason).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
        this.clientValidationComment = '';
        this.loadComments(updatedTicket.id);
        this.loadHistory(updatedTicket.id);
        this.playResolutionSuccess('Solution refusee. Le ticket repasse en traitement.');
      },
      error: (error) => {
        console.error('Error rejecting solution:', error);
        this.showActionError('Impossible de refuser la solution pour le moment.');
      },
      complete: () => {
        this.isValidatingResolution = false;
        this.stopValidationWatchdog();
      }
    });
  }

  validateAndClose(): void {
    if (!this.ticket || this.isValidatingResolution) return;

    const assignedAgentName = this.ticket.assignedTo
      ? `${this.ticket.assignedTo.firstName || ''} ${this.ticket.assignedTo.lastName || ''}`.trim()
      : 'Support Agent';

    const dialogData: ValidateResolutionDialogData = {
      ticketReference: this.ticket.reference,
      assignedAgentName,
      resolutionSummary: this.ticket.resolutionSummary,
      resolutionDetails: this.ticket.resolutionDetails
    };

    const dialogRef = this.dialog.open<
      ValidateResolutionDialogComponent,
      ValidateResolutionDialogData,
      ValidateResolutionDialogResult
    >(ValidateResolutionDialogComponent, {
      width: '620px',
      maxWidth: '95vw',
      autoFocus: false,
      disableClose: false,
      panelClass: 'validation-dialog-panel',
      backdropClass: 'validation-dialog-backdrop',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result || result.action === 'cancel') return;

      if (result.action === 'reject') {
        this.isValidatingResolution = true;
        this.startValidationWatchdog('resolution');
        this.ticketService.rejectResolution(this.ticket!.id, result.comment).subscribe({
          next: (updatedTicket) => {
            this.ticket = updatedTicket;
            this.isValidatingResolution = false;
            this.stopValidationWatchdog();
            this.loadComments(this.ticket.id);
            this.loadHistory(this.ticket.id);
            this.playResolutionSuccess('Solution rejetee. Ticket repasse en traitement.');
          },
          error: (error) => {
            console.error('Error rejecting resolution:', error);
            this.isValidatingResolution = false;
            this.stopValidationWatchdog();
            this.showActionError("Erreur lors du rejet. Veuillez reessayer.");
          }
        });
        return;
      }

      const rating = result.rating ?? 0;
      if (rating < 1 || rating > 5) return;

      this.isValidatingResolution = true;
      this.startValidationWatchdog('close');

      this.ticketService.closeTicketWithSatisfaction(this.ticket!.id, rating, result.comment || '').subscribe({
        next: (updatedTicket) => {
          this.ticket = updatedTicket;
          this.isValidatingResolution = false;
          this.stopValidationWatchdog();

          this.playResolutionSuccess('Résolution validée et ticket clôturé');

          // Show success dialog ONLY after server confirmation
          this.openValidationSuccessDialog(new Date().toISOString());
        },
        error: (error) => {
          console.error('Error closing ticket:', error);
          this.isValidatingResolution = false;
          this.stopValidationWatchdog();
          this.showActionError("Impossible de clôturer le ticket. Vérifie la session puis réessaie.");
        }
      });
    });
  }

  private openValidationSuccessDialog(closedAt: string): void {
    const successData: ValidationSuccessDialogData = {
      ticketReference: this.ticket?.reference || 'N/A',
      closedAt: closedAt
    };
    const successRef = this.dialog.open<
      ValidationSuccessDialogComponent,
      ValidationSuccessDialogData,
      ValidationSuccessDialogResult
    >(ValidationSuccessDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      autoFocus: false,
      disableClose: false,
      panelClass: 'validation-dialog-panel',
      backdropClass: 'validation-dialog-backdrop',
      data: successData
    });

    successRef.afterClosed().subscribe((actionResult) => {
      if (!actionResult) return;
      if (actionResult.action === 'dashboard') {
        this.router.navigate(['/dashboard']);
        return;
      }
      if (actionResult.action === 'download') {
        this.downloadTicketSummary();
      }
    });
  }

  private playResolutionSuccess(message: string): void {
    this.resolutionSuccessMessage = message;
    this.showResolutionSuccess = true;
    setTimeout(() => {
      this.showResolutionSuccess = false;
    }, 2800);
  }

  private startValidationWatchdog(action: 'resolution' | 'close'): void {
    this.stopValidationWatchdog();
    // Soft timeout: tell user operation is slow, but do not fail yet.
    this.validationWatchdogSoft = setTimeout(() => {
      if (!this.isValidatingResolution) return;
      this.showActionInfo(
        action === 'close'
          ? 'Validation en cours... reponse serveur lente.'
          : 'Traitement en cours... reponse serveur lente.'
      );
    }, 15000);

    // Hard timeout: fail only after a long delay.
    this.validationWatchdogHard = setTimeout(() => {
      if (!this.isValidatingResolution) return;
      this.isValidatingResolution = false;
      this.showActionError(
        action === 'close'
          ? "Validation depassee (timeout). La cloture n'a pas ete confirmee."
          : "Validation depassee (timeout). L'action n'a pas ete confirmee."
      );
    }, 90000);
  }

  private stopValidationWatchdog(): void {
    if (this.validationWatchdogSoft) {
      clearTimeout(this.validationWatchdogSoft);
      this.validationWatchdogSoft = null;
    }
    if (this.validationWatchdogHard) {
      clearTimeout(this.validationWatchdogHard);
      this.validationWatchdogHard = null;
    }
  }

  private formatKnowledgeDraft(draft: AIKnowledgeDraft): string {
    const sections: string[] = [];
    if (draft.title) {
      sections.push(`Titre: ${draft.title}`);
    }
    if (draft.category) {
      sections.push(`Categorie: ${draft.category}`);
    }
    if (Array.isArray(draft.tags) && draft.tags.length > 0) {
      sections.push(`Tags: ${draft.tags.join(', ')}`);
    }
    if (draft.summary) {
      sections.push(`Resume:\n${draft.summary}`);
    }
    if (draft.article) {
      sections.push(`Article:\n${draft.article}`);
    } else if (draft.content) {
      sections.push(`Contenu:\n${draft.content}`);
    }

    return sections.length > 0
      ? sections.join('\n\n')
      : JSON.stringify(draft, null, 2);
  }

  private showActionError(message: string): void {
    alert(message);
  }

  private showActionInfo(message: string): void {
    console.info(message);
    // Show success message - could be replaced with Toast notification system
    const prevMsg = this.resolutionSuccessMessage;
    this.resolutionSuccessMessage = message;
    this.showResolutionSuccess = true;
    setTimeout(() => {
      this.showResolutionSuccess = false;
      this.resolutionSuccessMessage = prevMsg;
    }, 3000);
  }

  private downloadTicketSummary(): void {
    if (!this.ticket) return;
    const payload = {
      reference: this.ticket.reference,
      title: this.ticket.title,
      status: this.ticket.status,
      priority: this.ticket.priority,
      closedAt: this.ticket.closedAt || new Date().toISOString(),
      satisfactionRating: this.ticket.satisfactionRating ?? null,
      satisfactionComment: this.ticket.satisfactionComment ?? ''
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.ticket.reference || 'ticket'}-recapitulatif.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  changeSlaDueDate(): void {
    if (!this.ticket || !this.isManager) return;

    const current = this.ticket.slaDeadline ? new Date(this.ticket.slaDeadline) : new Date();
    const defaultValue = this.formatForDatetimeLocal(current);
    const input = prompt('Nouvelle date SLA (format: YYYY-MM-DDTHH:mm)', defaultValue);

    if (!input) return;

    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      alert('Format de date invalide. Utilise YYYY-MM-DDTHH:mm');
      return;
    }

    const dueDateIso = parsed.toISOString().slice(0, 19);

    this.ticketService.updateSlaDueDate(this.ticket.id, dueDateIso).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
      },
      error: (error) => {
        console.error('Error updating SLA due date:', error);
        alert("Impossible de modifier la date SLA");
      }
    });
  }

  private formatForDatetimeLocal(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  private loadComments(ticketId: number): void {
    const comments$ = this.isClient
      ? this.ticketService.getPublicComments(ticketId)
      : this.ticketService.getComments(ticketId);

    comments$.subscribe({
      next: (comments) => {
        if (this.ticket) {
          this.ticket.comments = comments;
        }
      },
      error: (error) => console.error('Error loading comments:', error)
    });
  }

  private loadAttachments(ticketId: number): void {
    this.ticketService.getAttachments(ticketId).subscribe({
      next: (attachments) => {
        if (this.ticket) {
          this.ticket.attachments = attachments;
        }
        this.loadAlfrescoDocuments(ticketId);
      },
      error: (error) => console.error('Error loading attachments:', error)
    });
  }

  private loadAlfrescoDocuments(ticketId: number): void {
    this.ticketService.getAlfrescoDocuments(ticketId).subscribe({
      next: (documents) => {
        this.alfrescoDocuments = documents.map(document => this.mapAlfrescoDocument(document));
        this.alfrescoDocuments
          .filter(document => document.kind === 'archive' || document.kind === 'folder')
          .forEach(document => {
            if (this.alfrescoExpandedFolders[document.id] === undefined) {
              this.alfrescoExpandedFolders[document.id] = true;
            }
          });
      },
      error: (error) => {
        console.error('Error loading Alfresco documents:', error);
        this.alfrescoDocuments = [];
      }
    });
  }

  private mapAlfrescoDocument(document: TicketArchiveDocumentApi): TicketAlfrescoDocument {
    const attachment = document.attachmentId
      ? (this.ticket?.attachments || []).find(item => item.id === document.attachmentId)
      : undefined;

    let meta = document.relativePath || null;
    if (document.kind === 'attachment' && !document.synced) {
      meta = this.formatFileSize(document.fileSize ?? undefined) || document.relativePath || 'Piece jointe locale';
    } else if (document.fileSize && !meta) {
      meta = this.formatFileSize(document.fileSize);
    }

    return {
      id: document.id,
      label: document.label,
      kind: document.kind,
      synced: document.synced,
      ref: document.ref,
      relativePath: document.relativePath,
      mimeType: document.mimeType,
      meta,
      attachment
    };
  }

  private loadHistory(ticketId: number): void {
    this.ticketService.getTicketHistory(ticketId).subscribe({
      next: (page) => {
        this.ticketHistory = page.content || [];
      },
      error: (error) => {
        console.error('Error loading history:', error);
        this.ticketHistory = [];
      }
    });
  }

  private syncTicketNotifications(): void {
    if (!this.ticket) {
      this.ticketNotifications = [];
      return;
    }

    const ticketId = this.ticket.id;
    const ticketReference = this.ticket.reference;

    this.ticketNotifications = this.allNotifications.filter(notification =>
      notification.ticketId === ticketId ||
      (!!ticketReference && notification.ticketReference === ticketReference) ||
      notification.link === `/tickets/${ticketId}`
    );
  }

  private isUnreadNotification(notification: Notification): boolean {
    return !(notification.isRead || notification.read);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null;
  }

  uploadSelectedFile(): void {
    if (!this.ticket || !this.selectedFile) return;

    this.ticketService.uploadAttachment(this.ticket.id, this.selectedFile, this.attachmentDescription).subscribe({
      next: () => {
        this.selectedFile = null;
        this.attachmentDescription = '';
        this.loadAttachments(this.ticket!.id);
        this.loadHistory(this.ticket!.id);
      },
      error: (error) => console.error('Error uploading attachment:', error)
    });
  }

  downloadAttachment(attachment: Attachment): void {
    if (!attachment.id) return;
    this.ticketService.downloadAttachmentBinary(attachment.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = attachment.originalName || attachment.fileName || `attachment-${attachment.id}`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: (error) => {
        console.error('Error downloading attachment:', error);
        this.showActionError("Impossible de telecharger la piece jointe.");
      }
    });
  }

  removeAttachment(attachment: Attachment): void {
    if (!attachment.id || !this.ticket) return;

    this.ticketService.deleteAttachment(attachment.id).subscribe({
      next: () => {
        this.loadAttachments(this.ticket!.id);
        this.loadHistory(this.ticket!.id);
      },
      error: (error) => console.error('Error deleting attachment:', error)
    });
  }

  formatHistory(entry: TicketHistoryEntry): string {
    const oldValue = entry.oldValue ? ` (${entry.oldValue}` : '';
    const newValue = entry.newValue ? ` -> ${entry.newValue})` : oldValue ? ')' : '';
    return `${entry.action}${oldValue}${newValue}`;
  }
}


