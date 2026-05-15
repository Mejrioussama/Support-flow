import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Ticket } from '@core/models';

@Component({
  selector: 'app-sla-indicator',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="sla" [class]="'sla--' + state.toLowerCase()" [matTooltip]="tooltipText">
      <span class="sla-dot"></span>
      <span class="sla-text">{{ label }}</span>
      @if (remainingTime) {
        <span class="sla-time">{{ remainingTime }}</span>
      }
    </div>
  `,
  styles: [`
    .sla {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    .sla-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .sla-text { letter-spacing: 0.02em; }
    .sla-time {
      font-family: 'Space Grotesk', monospace;
      opacity: 0.7;
      font-size: 10px;
      font-weight: 500;
    }

    .sla--on_track { color: #34d399; background: rgba(52, 211, 153, 0.08); }
    .sla--on_track .sla-dot { background: #34d399; }

    .sla--at_risk { color: #fbbf24; background: rgba(245, 158, 11, 0.08); }
    .sla--at_risk .sla-dot { background: #fbbf24; animation: pulse 2s infinite; }

    .sla--breached { color: #f87171; background: rgba(248, 113, 113, 0.1); }
    .sla--breached .sla-dot { background: #f87171; animation: pulse 1s infinite; }

    .sla--paused { color: #a78bfa; background: rgba(167, 139, 250, 0.08); }
    .sla--paused .sla-dot { background: #a78bfa; opacity: 0.6; }

    .sla--resolved { color: #94a3b8; background: rgba(148, 163, 184, 0.06); }
    .sla--resolved .sla-dot { background: #94a3b8; }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.3); }
    }
  `]
})
export class SlaIndicatorComponent {
  @Input() ticket?: Ticket;
  @Input() showTime = true;

  get state(): string {
    if (!this.ticket) return 'UNKNOWN';
    if (this.ticket.status === 'CLOSED' || this.ticket.status === 'RESOLVED') return 'RESOLVED';
    if (this.ticket.slaPaused) return 'PAUSED';
    if (this.isBreached()) return 'BREACHED';
    if (this.ticket.slaState === 'AT_RISK' || this.getConsumedRatio() >= 0.75) return 'AT_RISK';
    return 'ON_TRACK';
  }

  get label(): string {
    const states: Record<string, string> = {
      ON_TRACK: 'OK',
      AT_RISK: 'A risque',
      BREACHED: 'Depasse',
      PAUSED: 'Pause',
      RESOLVED: 'Termine',
      UNKNOWN: '—'
    };
    return states[this.state] || this.state;
  }

  get tooltipText(): string {
    if (!this.ticket?.slaDeadline) return 'Pas de delai SLA defini';
    const date = new Date(this.ticket.slaDeadline).toLocaleString();
    const calendar = this.ticket.slaCalendarLabel ? ` · ${this.ticket.slaCalendarLabel}` : '';
    const status = this.ticket.slaOperationalStatus ? ` · ${this.ticket.slaOperationalStatus}` : '';
    return `Echeance SLA: ${date}${calendar}${status}`;
  }

  get remainingTime(): string | null {
    if (this.ticket?.slaRemainingTime) {
      return this.ticket.slaRemainingTime;
    }
    if (!this.ticket?.slaDeadline) return null;
    const deadline = new Date(this.ticket.slaDeadline).getTime();
    const now = Date.now();
    const diff = deadline - now;
    if (diff <= 0) return 'DEPASSE';

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }

  private isBreached(): boolean {
    if (!this.ticket) return false;
    if (this.ticket.slaBreached || this.ticket.slaState === 'BREACHED') return true;
    if (!this.ticket.slaDeadline) return false;
    return Date.now() >= new Date(this.ticket.slaDeadline).getTime();
  }

  private getConsumedRatio(): number {
    if (!this.ticket?.createdAt || !this.ticket?.slaDeadline) return 0;
    const start = new Date(this.ticket.createdAt).getTime();
    const end = new Date(this.ticket.slaDeadline).getTime();
    const now = Date.now();
    const total = end - start;
    if (total <= 0) return 1;
    const used = now - start;
    return Math.max(0, Math.min(1, used / total));
  }
}
