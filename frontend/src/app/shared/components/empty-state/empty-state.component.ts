import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-empty-state',
    standalone: true,
    imports: [CommonModule, MatIconModule],
    template: `
    <div class="sf-empty" [class.sf-empty--compact]="compact">
      <div class="sf-empty__icon sf-animate-float">
        <mat-icon>{{ icon }}</mat-icon>
      </div>
      <h3 class="sf-empty__title">{{ title }}</h3>
      @if (description) {
        <p class="sf-empty__desc">{{ description }}</p>
      }
      <div class="sf-empty__actions">
        <ng-content></ng-content>
      </div>
    </div>
  `,
    styles: [`
    .sf-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--sf-space-12) var(--sf-space-8);
      border: 1px dashed rgba(var(--sf-text-rgb),0.09);
      border-radius: var(--sf-radius-xl);
      background: rgba(var(--sf-text-rgb),0.01);
    }

    .sf-empty--compact {
      padding: var(--sf-space-8) var(--sf-space-6);
    }

    .sf-empty__icon {
      width: 72px;
      height: 72px;
      border-radius: var(--sf-radius-xl);
      background: var(--sf-glass);
      border: 1px solid var(--sf-glass-border);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--sf-space-5);

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: var(--sf-text-3);
      }
    }

    .sf-empty__title {
      margin: 0 0 var(--sf-space-2);
      font-size: var(--sf-text-md);
      font-weight: 600;
      color: var(--sf-text-1);
      letter-spacing: -0.01em;
    }

    .sf-empty__desc {
      margin: 0 0 var(--sf-space-6);
      font-size: var(--sf-text-sm);
      color: var(--sf-text-3);
      max-width: 380px;
      line-height: 1.65;
    }

    .sf-empty__actions {
      display: flex;
      gap: var(--sf-space-3);
      flex-wrap: wrap;
      justify-content: center;

      &:empty { display: none; }
    }
  `]
})
export class EmptyStateComponent {
    @Input() icon = 'inbox';
    @Input() title = 'Aucun résultat';
    @Input() description = '';
    @Input() compact = false;
}
