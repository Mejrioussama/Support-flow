import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ValidationSuccessDialogData {
  ticketReference: string;
  closedAt: string;
}

export interface ValidationSuccessDialogResult {
  action: 'dashboard' | 'download' | 'close';
}

@Component({
  selector: 'app-validation-success-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="success-wrap">
      <div class="icon-wrap">
        <div class="icon-circle">
          <mat-icon>task_alt</mat-icon>
        </div>
      </div>

      <h2>Merci pour votre retour !</h2>
      <p class="subtitle">
        Votre ticket a ete valide et cloture avec succes. Votre satisfaction est notre priorite.
      </p>

      <div class="summary-card">
        <div class="summary-head">
          <span>REFERENCE TICKET</span>
          <strong>{{ data.ticketReference }}</strong>
        </div>
        <div class="summary-row">
          <span>Statut final :</span>
          <b class="ok">Resolu</b>
        </div>
        <div class="summary-row">
          <span>Date de cloture :</span>
          <b>{{ data.closedAt | date:'dd/MM/yyyy HH:mm' }}</b>
        </div>
      </div>

      <div class="actions">
        <button mat-raised-button color="primary" (click)="close('dashboard')">
          <mat-icon>dashboard</mat-icon>
          Retour au tableau de bord
        </button>
        <button mat-stroked-button (click)="close('download')">
          <mat-icon>download</mat-icon>
          Telecharger le recapitulatif
        </button>
      </div>
    </div>
  `,
  styles: [`
    .success-wrap {
      width: min(92vw, 560px);
      text-align: center;
      padding: 10px 6px 4px;
    }

    .icon-wrap {
      display: flex;
      justify-content: center;
      margin-bottom: 10px;
    }

    .icon-circle {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: rgba(249, 115, 22, 0.1);
      border: 2px solid rgba(249, 115, 22, 0.2);
      color: var(--sf-orange);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon-circle mat-icon {
      font-size: 30px;
      width: 30px;
      height: 30px;
    }

    h2 {
      margin: 0;
      font-size: 42px;
      line-height: 1.05;
      color: var(--text-main);
      font-weight: 800;
    }

    .subtitle {
      margin: 10px auto 16px;
      max-width: 460px;
      color: var(--text-muted);
      font-size: 16px;
      line-height: 1.45;
    }

    .summary-card {
      text-align: left;
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      background: var(--glass-highlight);
      padding: 14px 16px;
      margin-bottom: 16px;
    }

    .summary-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.4px;
    }

    .summary-head strong {
      background: rgba(var(--sf-text-rgb), 0.1);
      color: var(--sf-orange);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      color: var(--text-main);
      font-size: 14px;
    }

    .summary-row:last-child {
      margin-bottom: 0;
    }

    .ok {
      color: #16a34a;
      font-weight: 700;
    }

    .actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .actions button {
      height: 44px;
      border-radius: 10px;
      font-weight: 700;
    }
  `]
})
export class ValidationSuccessDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ValidationSuccessDialogData,
    private dialogRef: MatDialogRef<ValidationSuccessDialogComponent, ValidationSuccessDialogResult>
  ) {}

  close(action: ValidationSuccessDialogResult['action']): void {
    this.dialogRef.close({ action });
  }
}

