import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type PriorityValue = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'SUPER_CRITICAL';

const PRIORITY_CONFIG: Record<PriorityValue, { label: string; icon: string; color: string; bg: string; border: string; pulse: boolean }> = {
    LOW: { label: 'Basse', icon: 'south', color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.25)', pulse: false },
    MEDIUM: { label: 'Moyenne', icon: 'east', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)', pulse: false },
  HIGH: { label: 'Haute', icon: 'north', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', pulse: false },
  CRITICAL: { label: 'Critique', icon: 'bolt', color: '#f87171', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)', pulse: true },
  SUPER_CRITICAL: { label: 'Super critique', icon: 'warning', color: '#fb7185', bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.32)', pulse: true },
};

@Component({
    selector: 'app-priority-badge',
    standalone: true,
    imports: [CommonModule, MatIconModule],
    template: `
    <span class="sf-priority-badge"
          [class.sf-priority-badge--pulse]="config.pulse"
          [style.color]="config.color"
          [style.background]="config.bg"
          [style.border-color]="config.border">
      <mat-icon>{{ config.icon }}</mat-icon>
      {{ config.label }}
    </span>
  `,
    styles: [`
    .sf-priority-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 11px;
      border-radius: var(--sf-radius-sm, 8px);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border: 1px solid transparent;
      white-space: nowrap;

      mat-icon { font-size: 13px; width: 13px; height: 13px; }
    }

    .sf-priority-badge--pulse {
      animation: sf-neon-pulse-red 2s infinite;
    }
  `]
})
export class PriorityBadgeComponent {
    @Input() set priority(val: string) {
        this.config = PRIORITY_CONFIG[val as PriorityValue] ?? PRIORITY_CONFIG['LOW'];
    }
    config = PRIORITY_CONFIG['LOW'];
}
