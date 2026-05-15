import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Notification, parseSuggestedActions } from '@core/models';

/**
 * SLA Notification Item - Smart UI Component
 *
 * Affiche une notification SLA enrichie avec:
 * - Badge simple (sous controle / a risque / depasse)
 * - Progress bar coloree selon l'urgence
 * - Actions suggerees cliquables
 * - Recommandation intelligente d'agent (si disponible)
 */
@Component({
  selector: 'app-sla-notification-item',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="sla-notif-item" [class]="phaseClass" [class.unread]="isUnread" (click)="onItemClick()">
      <div class="sla-notif-header">
        <div class="sla-icon-wrap" [class]="phaseClass">
          <span class="sla-emoji">{{ phaseEmoji }}</span>
        </div>
        <div class="sla-notif-meta">
          <div class="sla-title-row">
            <span class="sla-notif-title">{{ displayTitle }}</span>
            <span class="sla-badge" [class]="phaseBadgeClass">{{ phaseBadgeLabel }}</span>
          </div>
          <span class="sla-ref" *ngIf="notif.ticketReference">{{ notif.ticketReference }}</span>
        </div>
      </div>

      <div class="sla-progress-wrap" *ngIf="notif.slaPercentage != null">
        <div class="sla-progress-bar">
          <div class="sla-progress-fill" [style.width.%]="cappedPercent" [class]="phaseClass"></div>
        </div>
        <span class="sla-progress-label">{{ cappedPercent }}% consomme</span>
      </div>

      <p class="sla-notif-message">{{ displayMessage }}</p>

      <div class="sla-recommend" *ngIf="notif.recommendedAgent">
        <mat-icon class="recommend-icon">psychology</mat-icon>
        <span>
          <strong>Recommandation intelligente IA :</strong>
          Reassigner a <em>{{ notif.recommendedAgent }}</em>
        </span>
      </div>

      <div class="sla-actions" *ngIf="notif.actionRequired && suggestedActions.length > 0">
        <span class="actions-label">Actions recommandees :</span>
        <div class="actions-list">
          <button
            *ngFor="let action of suggestedActions"
            mat-stroked-button
            class="action-btn"
            [class]="phaseClass"
            (click)="onActionClick(action, $event)"
            [matTooltip]="action">
            {{ action }}
          </button>
        </div>
      </div>

      <div class="sla-notif-footer">
        <span class="sla-time">{{ timeAgo }}</span>
        <a *ngIf="notif.link" [routerLink]="notif.link" class="sla-view-link" (click)="onViewTicket($event)">
          Voir le ticket ->
        </a>
      </div>
    </div>
  `,
  styles: [`
    .sla-notif-item {
      padding: 14px 16px;
      border-radius: 12px;
      margin-bottom: 6px;
      background: rgba(var(--sf-text-rgb),0.04);
      border: 1px solid rgba(var(--sf-text-rgb),0.08);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }
    .sla-notif-item:hover { background: rgba(var(--sf-text-rgb),0.08); transform: translateX(2px); }
    .sla-notif-item.unread { border-left: 3px solid; }
    .sla-notif-item.unread.phase-risk { border-left-color: #f97316; }
    .sla-notif-item.unread.phase-100 { border-left-color: #ef4444; }
    .sla-notif-item.unread.phase-other { border-left-color: #a5b4fc; }

    .sla-notif-header {
      display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px;
    }
    .sla-icon-wrap {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 18px; font-weight: 700;
    }
    .sla-icon-wrap.phase-risk { background: rgba(249,115,22,0.15); color: #f97316; }
    .sla-icon-wrap.phase-100 { background: rgba(239,68,68,0.15); color: #ef4444; }
    .sla-icon-wrap.phase-other { background: rgba(165,180,252,0.15); color: #818cf8; }

    .sla-notif-meta { flex: 1; min-width: 0; }
    .sla-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 2px; }
    .sla-notif-title { font-weight: 600; font-size: 13px; color: rgba(var(--sf-text-rgb),0.9); }
    .sla-ref { font-size: 11px; color: rgba(var(--sf-text-rgb),0.5); }

    .sla-badge {
      font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 8px; text-transform: uppercase;
    }
    .badge-risk { background: rgba(249,115,22,0.2); color: #f97316; border: 1px solid rgba(249,115,22,0.4); }
    .badge-100 { background: rgba(239,68,68,0.25); color: #f87171; border: 1px solid rgba(239,68,68,0.5); animation: pulse-badge 2s infinite; }
    .badge-other { background: rgba(165,180,252,0.15); color: #a5b4fc; border: 1px solid rgba(165,180,252,0.3); }

    @keyframes pulse-badge {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
      50% { box-shadow: 0 0 8px 2px rgba(239,68,68,0.2); }
    }

    .sla-progress-wrap {
      display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
    }
    .sla-progress-bar {
      flex: 1; height: 5px; border-radius: 999px; background: rgba(var(--sf-text-rgb),0.1); overflow: hidden;
    }
    .sla-progress-fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
    .sla-progress-fill.phase-risk { background: linear-gradient(90deg, #f97316, #ef4444); }
    .sla-progress-fill.phase-100 { background: linear-gradient(90deg, #ef4444, #dc2626); }
    .sla-progress-fill.phase-other { background: linear-gradient(90deg, #a5b4fc, #818cf8); }
    .sla-progress-label { font-size: 11px; color: rgba(var(--sf-text-rgb),0.5); white-space: nowrap; }

    .sla-notif-message {
      font-size: 12px; color: rgba(var(--sf-text-rgb),0.7); margin: 0 0 8px 0;
      line-height: 1.5; white-space: pre-line;
    }

    .sla-recommend {
      display: flex; align-items: flex-start; gap: 6px;
      padding: 8px 10px; border-radius: 8px;
      background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25);
      font-size: 12px; color: rgba(var(--sf-text-rgb),0.85);
      margin-bottom: 8px;
    }
    .recommend-icon { font-size: 16px; width: 16px; height: 16px; color: #a5b4fc; margin-top: 1px; flex-shrink: 0; }

    .sla-actions { margin-bottom: 8px; }
    .actions-label { font-size: 11px; color: rgba(var(--sf-text-rgb),0.5); display: block; margin-bottom: 6px; }
    .actions-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .action-btn {
      font-size: 11px !important; padding: 2px 10px !important; height: 26px !important;
      min-height: 26px !important; line-height: 22px !important; border-radius: 6px !important;
    }
    .action-btn.phase-risk { color: #f97316 !important; border-color: rgba(249,115,22,0.4) !important; }
    .action-btn.phase-100 { color: #f87171 !important; border-color: rgba(239,68,68,0.5) !important; }
    .action-btn.phase-other { color: #a5b4fc !important; border-color: rgba(165,180,252,0.3) !important; }
    .action-btn:hover { opacity: 0.8; }

    .sla-notif-footer { display: flex; align-items: center; justify-content: space-between; }
    .sla-time { font-size: 11px; color: rgba(var(--sf-text-rgb),0.35); }
    .sla-view-link {
      font-size: 11px; color: #a5b4fc; text-decoration: none; font-weight: 500;
    }
    .sla-view-link:hover { color: #c7d2fe; text-decoration: underline; }
  `]
})
export class SlaNotificationItemComponent {
  @Input() notif!: Notification;
  @Output() read = new EventEmitter<Notification>();
  @Output() actionSelected = new EventEmitter<{ notification: Notification; action: string }>();

  get isUnread(): boolean {
    return !(this.notif.isRead || this.notif.read);
  }

  get phaseClass(): string {
    const pct = this.notif.slaPercentage;
    if (pct == null) return 'phase-other';
    if (pct >= 100) return 'phase-100';
    if (pct >= 75) return 'phase-risk';
    return 'phase-other';
  }

  get phaseEmoji(): string {
    const pct = this.notif.slaPercentage;
    if (pct == null) return 'i';
    if (pct >= 100) return '!';
    if (pct >= 75) return '!';
    return 'i';
  }

  get phaseBadgeClass(): string {
    const pct = this.notif.slaPercentage;
    if (pct == null) return 'badge-other';
    if (pct >= 100) return 'badge-100';
    if (pct >= 75) return 'badge-risk';
    return 'badge-other';
  }

  get phaseBadgeLabel(): string {
    const pct = this.notif.slaPercentage;
    if (pct == null) return 'SLA';
    if (pct >= 100) return 'SLA DEPASSE';
    if (pct >= 75) return 'A RISQUE';
    return 'SOUS CONTROLE';
  }

  get cappedPercent(): number {
    return Math.min(100, this.notif.slaPercentage ?? 0);
  }

  get suggestedActions(): string[] {
    return parseSuggestedActions(this.notif);
  }

  get displayTitle(): string {
    switch (this.notif.type) {
      case 'SLA_WARNING_50':
        return 'Suivi SLA';
      case 'SLA_WARNING_80':
        return 'Ticket a risque';
      case 'SLA_ESCALATION':
      case 'SLA_BREACHED':
        return 'SLA depasse';
      case 'SLA_CRITICAL_EVENT':
        return 'Escalade prolongee';
      default:
        return this.notif.title;
    }
  }

  get displayMessage(): string {
    switch (this.notif.type) {
      case 'SLA_WARNING_50':
        return `Ticket ${this.notif.ticketReference ?? ''} : point de controle SLA enregistre.`.trim();
      case 'SLA_WARNING_80':
        return `Ticket ${this.notif.ticketReference ?? ''} : proche du depassement SLA. Supervision ou reaffectation recommandee.`.trim();
      case 'SLA_ESCALATION':
      case 'SLA_BREACHED':
        return `Ticket ${this.notif.ticketReference ?? ''} : SLA depasse. Intervention manager requise.`.trim();
      case 'SLA_CRITICAL_EVENT':
        return `Ticket ${this.notif.ticketReference ?? ''} : escalation prolongee, suivi prioritaire requis.`.trim();
      default:
        return this.notif.message;
    }
  }

  get timeAgo(): string {
    if (!this.notif.createdAt) return '';
    const diff = Date.now() - new Date(this.notif.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'a l\'instant';
    if (mins < 60) return `il y a ${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    return `il y a ${Math.floor(hrs / 24)}j`;
  }

  onItemClick(): void {
    this.read.emit(this.notif);
  }

  onActionClick(action: string, event: MouseEvent): void {
    event.stopPropagation();
    this.actionSelected.emit({ notification: this.notif, action });
    this.read.emit(this.notif);
  }

  onViewTicket(event: MouseEvent): void {
    event.stopPropagation();
    this.read.emit(this.notif);
  }
}
