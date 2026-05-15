import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export type TicketStatusValue =
  | 'NEW'
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PENDING'
  | 'ESCALATED_MANUAL'
  | 'ESCALATED_SLA'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';

const STATUS_CONFIG: Record<TicketStatusValue, { label: string; color: string; bg: string; border: string }> = {
  NEW: { label: 'Nouveau', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.28)' },
  OPEN: { label: 'Ouvert', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.28)' },
  ASSIGNED: { label: 'Assigne', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.28)' },
  IN_PROGRESS: { label: 'En cours', color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.28)' },
  PENDING: { label: 'En attente', color: '#f472b6', bg: 'rgba(244,114,182,0.08)', border: 'rgba(244,114,182,0.28)' },
  ESCALATED_MANUAL: { label: 'Escalade manuelle', color: '#fb7185', bg: 'rgba(251,113,133,0.10)', border: 'rgba(251,113,133,0.30)' },
  ESCALATED_SLA: { label: 'Escalade active', color: '#f87171', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.32)' },
  RESOLVED: { label: 'Resolue', color: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.30)' },
  CLOSED: { label: 'Cloture', color: '#9ca3af', bg: 'rgba(156,163,175,0.06)', border: 'rgba(156,163,175,0.22)' },
  CANCELLED: { label: 'Annule', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.28)' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="sf-status-badge"
      [class.sf-status-badge--pulse]="config.color === '#f87171'"
      [style.color]="config.color"
      [style.background]="config.bg"
      [style.border-color]="config.border"
    >
      <span class="sf-status-badge__dot"></span>
      {{ config.label }}
    </span>
  `,
  styles: [`
    .sf-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: var(--sf-radius-full, 9999px);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border: 1px solid transparent;
      white-space: nowrap;
      transition: box-shadow var(--sf-t-base, 250ms) ease;
    }

    .sf-status-badge:hover {
      box-shadow: 0 0 12px currentColor;
    }

    .sf-status-badge__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }

    .sf-status-badge--pulse {
      animation: sf-neon-pulse-red 2s infinite;
    }
  `]
})
export class StatusBadgeComponent {
  @Input() set status(value: string) {
    this.config = STATUS_CONFIG[value as TicketStatusValue] ?? {
      label: value,
      color: '#9ca3af',
      bg: 'rgba(156,163,175,0.06)',
      border: 'rgba(156,163,175,0.22)'
    };
  }

  config = STATUS_CONFIG.NEW;
}
