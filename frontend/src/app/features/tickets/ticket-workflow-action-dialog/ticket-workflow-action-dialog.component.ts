import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { WaitingOn } from '@core/models';

export interface TicketWorkflowActionDialogData {
  title: string;
  subtitle?: string;
  submitLabel: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  defaultReason?: string;
  requireReason?: boolean;
  waitingOnEnabled?: boolean;
  defaultWaitingOn?: WaitingOn;
  minutesEnabled?: boolean;
  defaultMinutes?: number;
}

export interface TicketWorkflowActionDialogResult {
  reason: string;
  waitingOn?: WaitingOn;
  minutes?: number;
}

@Component({
  selector: 'app-ticket-workflow-action-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule
  ],
  template: `
    <div class="workflow-dialog">
      <div class="head">
        <div>
          <h2>{{ data.title }}</h2>
          @if (data.subtitle) {
            <p>{{ data.subtitle }}</p>
          }
        </div>
        <button mat-icon-button type="button" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      @if (data.waitingOnEnabled) {
        <mat-form-field appearance="outline" class="full">
          <mat-label>En attente de</mat-label>
          <mat-select [(ngModel)]="waitingOn">
            <mat-option value="CLIENT">Client</mat-option>
            <mat-option value="THIRD_PARTY">Tiers / fournisseur</mat-option>
            <mat-option value="MANAGER">Manager</mat-option>
            <mat-option value="AGENT">Agent</mat-option>
          </mat-select>
        </mat-form-field>
      }

      @if (data.minutesEnabled) {
        <mat-form-field appearance="outline" class="full">
          <mat-label>Minutes a ajouter</mat-label>
          <input matInput type="number" min="1" max="10080" [(ngModel)]="minutes" />
        </mat-form-field>
      }

      <mat-form-field appearance="outline" class="full">
        <mat-label>{{ data.reasonLabel || 'Motif' }}</mat-label>
        <textarea
          matInput
          rows="5"
          maxlength="500"
          [(ngModel)]="reason"
          [placeholder]="data.reasonPlaceholder || 'Precisez le contexte metier...'"
        ></textarea>
        <mat-hint align="end">{{ reason.trim().length }}/500</mat-hint>
      </mat-form-field>

      <div class="actions">
        <button mat-stroked-button type="button" (click)="close()">Annuler</button>
        <button mat-raised-button color="primary" type="button" [disabled]="!isValid()" (click)="confirm()">
          {{ data.submitLabel }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .workflow-dialog {
      width: min(94vw, 620px);
      padding: 4px 2px 2px;
      color: #0f172a;
    }

    .head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 14px;
    }

    h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      line-height: 1.1;
    }

    p {
      margin: 6px 0 0;
      color: #64748b;
      font-size: 13px;
    }

    .full {
      width: 100%;
      margin-bottom: 8px;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 8px;
    }

    @media (max-width: 640px) {
      .actions {
        flex-direction: column-reverse;
      }

      .actions button {
        width: 100%;
      }
    }
  `]
})
export class TicketWorkflowActionDialogComponent {
  reason = this.data.defaultReason || '';
  waitingOn: WaitingOn = this.data.defaultWaitingOn || 'CLIENT';
  minutes = this.data.defaultMinutes || 60;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: TicketWorkflowActionDialogData,
    private dialogRef: MatDialogRef<TicketWorkflowActionDialogComponent, TicketWorkflowActionDialogResult>
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  isValid(): boolean {
    const reasonOk = this.data.requireReason === false || this.reason.trim().length >= 5;
    const minutesOk = !this.data.minutesEnabled || (this.minutes >= 1 && this.minutes <= 10080);
    const waitingOk = !this.data.waitingOnEnabled || !!this.waitingOn;
    return reasonOk && minutesOk && waitingOk;
  }

  confirm(): void {
    if (!this.isValid()) {
      return;
    }
    this.dialogRef.close({
      reason: this.reason.trim(),
      waitingOn: this.waitingOn,
      minutes: this.minutesEnabled() ? this.minutes : undefined
    });
  }

  private minutesEnabled(): boolean {
    return !!this.data.minutesEnabled;
  }
}
