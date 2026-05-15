import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-page-header',
    standalone: true,
    imports: [CommonModule, MatIconModule],
    template: `
    <header class="sf-page-header" [class.sf-page-header--compact]="compact">
      <div class="sf-page-header__left">
        @if (icon) {
          <div class="sf-page-header__icon-wrap">
            <mat-icon>{{ icon }}</mat-icon>
          </div>
        }
        <div class="sf-page-header__text">
          @if (kicker) {
            <p class="sf-page-header__kicker">{{ kicker }}</p>
          }
          <h1 class="sf-page-header__title">{{ title }}</h1>
          @if (subtitle) {
            <p class="sf-page-header__subtitle">{{ subtitle }}</p>
          }
        </div>
      </div>
      <div class="sf-page-header__actions">
        <ng-content></ng-content>
      </div>
    </header>
  `,
    styles: [`
    .sf-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sf-space-4);
      padding: var(--sf-space-6) var(--sf-space-8);
      margin-bottom: var(--sf-space-6);
      background: var(--sf-glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--sf-glass-border);
      border-top: 1px solid rgba(var(--sf-text-rgb),0.14);
      border-left: 1px solid rgba(var(--sf-text-rgb),0.09);
      border-radius: var(--sf-radius-xl);
      box-shadow: var(--sf-shadow-md);
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(var(--sf-text-rgb),0.15), transparent);
      }
    }

    .sf-page-header--compact {
      padding: var(--sf-space-4) var(--sf-space-6);
      margin-bottom: var(--sf-space-4);
    }

    .sf-page-header__left {
      display: flex;
      align-items: center;
      gap: var(--sf-space-4);
      min-width: 0;
    }

    .sf-page-header__icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: var(--sf-radius-lg);
      background: rgba(59, 130, 246, 0.10);
      border: 1px solid rgba(59, 130, 246, 0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform var(--sf-t-slow) var(--sf-ease-spring),
                  box-shadow var(--sf-t-base) var(--sf-ease);

      mat-icon {
        font-size: 26px;
        width: 26px;
        height: 26px;
        color: var(--sf-blue);
        filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.45));
      }

      .sf-page-header:hover & {
        transform: scale(1.05);
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.18);
      }
    }

    .sf-page-header__kicker {
      margin: 0 0 3px;
      font-size: var(--sf-text-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--sf-cyan);
    }

    .sf-page-header__title {
      margin: 0;
      font-size: var(--sf-text-2xl);
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 1.1;
      background: linear-gradient(135deg, var(--sf-text-1) 0%, #a5b4fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;

      .sf-page-header--compact & {
        font-size: var(--sf-text-xl);
      }
    }

    .sf-page-header__subtitle {
      margin: 4px 0 0;
      font-size: var(--sf-text-sm);
      color: var(--sf-text-3);
      line-height: 1.5;
    }

    .sf-page-header__actions {
      display: flex;
      align-items: center;
      gap: var(--sf-space-3);
      flex-shrink: 0;
    }

    @media (max-width: 640px) {
      .sf-page-header {
        flex-direction: column;
        align-items: flex-start;
        padding: var(--sf-space-5);
      }
      .sf-page-header__title { font-size: var(--sf-text-xl); }
      .sf-page-header__actions { width: 100%; flex-wrap: wrap; }
    }
  `]
})
export class PageHeaderComponent {
    @Input() title = '';
    @Input() subtitle = '';
    @Input() kicker = '';
    @Input() icon = '';
    @Input() compact = false;
}
