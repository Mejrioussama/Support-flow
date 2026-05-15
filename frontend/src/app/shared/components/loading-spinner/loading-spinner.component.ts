import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="loading-container" [class.overlay]="overlay" [class.fullscreen]="fullscreen">
      <div class="spinner-wrapper">
        <mat-spinner [diameter]="diameter"></mat-spinner>
        @if (message) {
          <p class="loading-message">{{ message }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 48px;
      
      &.overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(var(--sf-text-rgb), 0.8);
        z-index: 100;
        padding: 0;
      }
      
      &.fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(var(--sf-text-rgb), 0.9);
        z-index: 1000;
        padding: 0;
      }
    }
    
    .spinner-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    
    .loading-message {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
  `]
})
export class LoadingSpinnerComponent {
  @Input() diameter = 40;
  @Input() message?: string;
  @Input() overlay = false;
  @Input() fullscreen = false;
}
