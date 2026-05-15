import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog" [class]="'type-' + (data.type || 'info')">
      <div class="dialog-icon">
        <mat-icon>
          {{ getIcon() }}
        </mat-icon>
      </div>
      
      <h2 mat-dialog-title>{{ data.title }}</h2>
      
      <mat-dialog-content>
        <p>{{ data.message }}</p>
      </mat-dialog-content>
      
      <mat-dialog-actions align="end">
        <button mat-stroked-button (click)="dialogRef.close(false)">
          {{ data.cancelText || 'Annuler' }}
        </button>
        <button mat-raised-button 
                [color]="data.type === 'danger' ? 'warn' : 'primary'"
                (click)="dialogRef.close(true)">
          {{ data.confirmText || 'Confirmer' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      text-align: center;
      padding: 16px;
      min-width: 300px;
      
      .dialog-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        margin: 0 auto 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        
        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
        }
      }
      
      &.type-info .dialog-icon {
        background: var(--glass-highlight);
        color: var(--sf-blue);
      }
      
      &.type-warning .dialog-icon {
        background: rgba(245, 158, 11, 0.1);
        color: var(--sf-yellow);
      }
      
      &.type-danger .dialog-icon {
        background: rgba(239, 68, 68, 0.1);
        color: var(--sf-red);
      }
      
      h2 {
        margin: 0 0 8px 0;
        font-size: 20px;
      }
      
      p {
        margin: 0;
        color: var(--text-muted);
      }
      
      mat-dialog-actions {
        margin-top: 24px;
        padding: 0;
        
        button {
          min-width: 100px;
        }
      }
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  getIcon(): string {
    switch (this.data.type) {
      case 'warning':
        return 'warning';
      case 'danger':
        return 'error';
      default:
        return 'help_outline';
    }
  }
}
