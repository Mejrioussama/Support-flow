import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-skeleton',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div
      class="sf-skeleton"
      [style.width]="width"
      [style.height]="height"
      [style.border-radius]="borderRadius">
    </div>
  `,
    styles: [`
    :host { display: block; }

    .sf-skeleton {
      background: linear-gradient(
        90deg,
        rgba(var(--sf-text-rgb), 0.04) 25%,
        rgba(var(--sf-text-rgb), 0.09) 37%,
        rgba(var(--sf-text-rgb), 0.04) 63%
      );
      background-size: 400% 100%;
      animation: sf-shimmer 1.4s ease infinite;
    }

    @keyframes sf-shimmer {
      0%   { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `]
})
export class SkeletonComponent {
    @Input() width = '100%';
    @Input() height = '20px';
    @Input() borderRadius = 'var(--sf-radius-sm)';
}
