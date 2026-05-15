import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type StatCardColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'cyan';

@Component({
    selector: 'app-stat-card',
    standalone: true,
    imports: [CommonModule, MatIconModule],
    template: `
    <div class="sf-stat-card" [class]="'sf-stat-card--' + color">
      <div class="sf-stat-card__icon">
        <mat-icon>{{ icon }}</mat-icon>
      </div>
      <div class="sf-stat-card__body">
        <span class="sf-stat-card__value">{{ value }}</span>
        <span class="sf-stat-card__label">{{ label }}</span>
        @if (trend !== undefined && trend !== null) {
          <div class="sf-stat-card__trend" [class.sf-stat-card__trend--up]="trend >= 0" [class.sf-stat-card__trend--down]="trend < 0">
            <mat-icon>{{ trend >= 0 ? 'trending_up' : 'trending_down' }}</mat-icon>
            <span>{{ trend >= 0 ? '+' : '' }}{{ trend }}%</span>
          </div>
        }
      </div>
      @if (description) {
        <p class="sf-stat-card__desc">{{ description }}</p>
      }
    </div>
  `,
    styles: [`
    .sf-stat-card {
      display: flex;
      align-items: center;
      gap: var(--sf-space-5);
      padding: var(--sf-space-6);
      background: var(--sf-glass);
      border: 1px solid var(--sf-glass-border);
      border-radius: var(--sf-radius-xl);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      cursor: default;
      position: relative;
      overflow: hidden;
      transition:
        transform var(--sf-t-slow) var(--sf-ease-spring),
        box-shadow var(--sf-t-slow) var(--sf-ease),
        border-color var(--sf-t-base) var(--sf-ease);

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at top right, rgba(var(--sf-text-rgb),0.04), transparent 60%);
        pointer-events: none;
      }

      &:hover {
        transform: translateY(-4px) rotateX(2deg);
        box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        border-color: var(--sf-glass-shine);
      }
    }

    // ââÂÂâÂÂ¬ââÂÂâÂÂ¬ Icon wrapper ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬
    .sf-stat-card__icon {
      width: 56px; height: 56px;
      border-radius: var(--sf-radius-lg);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: transform var(--sf-t-slow) var(--sf-ease-spring);

      mat-icon { font-size: 28px; width: 28px; height: 28px; }

      .sf-stat-card:hover & { transform: scale(1.1) rotate(-3deg); }
    }

    // ââÂÂâÂÂ¬ââÂÂâÂÂ¬ Color variants ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬
    @mixin card-color($bg, $border, $text, $glow) {
      .sf-stat-card__icon {
        background: rgba($bg, 0.12);
        border: 1px solid rgba($border, 0.22);
        mat-icon { color: $text; filter: drop-shadow(0 0 6px rgba($glow, 0.5)); }
      }
    }

    .sf-stat-card--blue   .sf-stat-card__icon { background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.22); mat-icon { color: #60a5fa; filter: drop-shadow(0 0 6px rgba(96,165,250,0.5)); } }
    .sf-stat-card--green  .sf-stat-card__icon { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.22); mat-icon { color: #34d399; filter: drop-shadow(0 0 6px rgba(52,211,153,0.5)); } }
    .sf-stat-card--yellow .sf-stat-card__icon { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.22); mat-icon { color: #fbbf24; filter: drop-shadow(0 0 6px rgba(251,191,36,0.5)); } }
    .sf-stat-card--red    .sf-stat-card__icon { background: rgba(239,68,68,0.12);  border: 1px solid rgba(239,68,68,0.22);  mat-icon { color: #f87171; filter: drop-shadow(0 0 6px rgba(248,113,113,0.5)); } }
    .sf-stat-card--purple .sf-stat-card__icon { background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.22); mat-icon { color: #c084fc; filter: drop-shadow(0 0 6px rgba(192,132,252,0.5)); } }
    .sf-stat-card--cyan   .sf-stat-card__icon { background: rgba(6,182,212,0.12);  border: 1px solid rgba(6,182,212,0.22);  mat-icon { color: #22d3ee; filter: drop-shadow(0 0 6px rgba(34,211,238,0.5)); } }

    // ââÂÂâÂÂ¬ââÂÂâÂÂ¬ Body ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬ââÂÂâÂÂ¬
    .sf-stat-card__body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .sf-stat-card__value {
      display: block;
      font-size: var(--sf-text-3xl);
      font-weight: 800;
      font-family: var(--sf-font-mono);
      color: var(--sf-text-1);
      line-height: 1;
      letter-spacing: -0.04em;
      margin-bottom: 4px;
    }

    .sf-stat-card__label {
      display: block;
      font-size: var(--sf-text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--sf-text-2) !important;
    }

    .sf-stat-card__trend {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-top: var(--sf-space-2);
      font-size: var(--sf-text-xs);
      font-weight: 600;
      border-radius: var(--sf-radius-full);
      padding: 2px 8px;
      width: fit-content;

      mat-icon { font-size: 13px; width: 13px; height: 13px; }

      &--up   { color: #34d399; background: rgba(52,211,153,0.12); }
      &--down { color: #f87171; background: rgba(248,113,113,0.12); }
    }

    .sf-stat-card__desc {
      position: absolute;
      bottom: var(--sf-space-3);
      right: var(--sf-space-4);
      margin: 0;
      font-size: 9px;
      color: var(--sf-text-4);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
  `]
})
export class StatCardComponent {
    @Input() label = '';
    @Input() value: number | string = 0;
    @Input() icon = 'analytics';
    @Input() color: StatCardColor = 'blue';
    @Input() trend?: number | null;
    @Input() description?: string;
}
