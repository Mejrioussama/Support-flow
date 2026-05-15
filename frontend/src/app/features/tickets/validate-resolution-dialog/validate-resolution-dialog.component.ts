import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ValidateResolutionDialogData {
  ticketReference?: string;
  assignedAgentName?: string;
  resolutionSummary?: string;
  resolutionDetails?: {
    diagnostic?: string;
    rootCause?: string;
    actionsTaken?: string;
    nextRecommendation?: string;
  };
}

export interface ValidateResolutionDialogResult {
  action: 'confirm' | 'reject' | 'cancel';
  rating?: number;
  comment?: string;
}

@Component({
  selector: 'app-validate-resolution-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="validate-dialog">
      <div class="head">
        <div class="title-wrap">
          <div class="title-icon">
            <mat-icon>verified</mat-icon>
          </div>
          <div>
            <h2>Validation de la resolution</h2>
            <p>Ticket {{ data.ticketReference || '-' }} - Traite par {{ data.assignedAgentName || 'Agent support' }}</p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="close('cancel')">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="solution-box">
        <div class="label">SOLUTION PROPOSEE</div>
        <div class="text">
          {{ data.resolutionSummary || "Le ticket a ete analyse et corrige. Merci de confirmer si le service est retabli de votre cote." }}
        </div>
      </div>

      @if (data.resolutionDetails) {
        <div class="details-grid">
          <div class="detail-box">
            <span>Diagnostic</span>
            <strong>{{ data.resolutionDetails.diagnostic || 'Non renseigne' }}</strong>
          </div>
          <div class="detail-box">
            <span>Cause racine</span>
            <strong>{{ data.resolutionDetails.rootCause || 'Non renseignee' }}</strong>
          </div>
          <div class="detail-box">
            <span>Action realisee</span>
            <strong>{{ data.resolutionDetails.actionsTaken || 'Non renseignee' }}</strong>
          </div>
          <div class="detail-box">
            <span>Recommandation</span>
            <strong>{{ data.resolutionDetails.nextRecommendation || 'Non renseignee' }}</strong>
          </div>
        </div>
      }

      <div class="rate-block">
        <h3>Comment evaluez-vous cette resolution ?</h3>
        <div class="stars">
          @for (star of [1, 2, 3, 4, 5]; track star) {
            <button
              type="button"
              class="star-btn"
              [class.active]="star <= rating"
              [attr.aria-label]="'Noter ' + star + ' etoiles'"
              (click)="setRating(star)">
              <mat-icon>{{ star <= rating ? 'star' : 'star_border' }}</mat-icon>
            </button>
          }
        </div>
        <div class="scale">
          <span>INSUFFISANT</span>
          <span>EXCELLENT</span>
        </div>
      </div>

      <div class="comment-block">
        <label>{{ rejectMode ? 'Motif du refus' : 'Commentaire client' }}</label>
        <textarea
          rows="3"
          [(ngModel)]="comment"
          [placeholder]="rejectMode ? 'Expliquez pourquoi la resolution ne repond pas encore au besoin...' : 'Partagez votre retour ou un contexte complementaire...'"></textarea>
      </div>

      @if (rejectMode && !comment.trim()) {
        <div class="inline-error">Un motif est obligatoire pour refuser la resolution.</div>
      }

      <div class="actions">
        <button mat-stroked-button class="reject-btn" color="warn" (click)="close('reject')">
          <mat-icon>cancel</mat-icon>
          Refuser la solution
        </button>
        <button mat-raised-button class="confirm-btn" color="primary" [disabled]="rating < 1" (click)="close('confirm')">
          <mat-icon>check_circle</mat-icon>
          Accepter et cloturer
        </button>
      </div>
    </div>
  `,
  styles: [`
    .validate-dialog {
      width: min(92vw, 620px);
      padding: 10px 4px 2px;
    }

    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .title-wrap {
      display: flex;
      gap: 10px;
    }

    .title-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #eef5ff;
      color: #3b82f6;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    h2 {
      margin: 0;
      font-size: 29px;
      font-weight: 800;
      line-height: 1.05;
      color: #0f172a;
    }

    .head p {
      margin: 4px 0 0;
      color: #7d8ba3;
      font-size: 12px;
      font-weight: 500;
    }

    .close-btn {
      color: #94a3b8;
    }

    .solution-box {
      border: 1px solid #dfebfd;
      background: #f2f7ff;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 16px;
    }

    .solution-box .label {
      color: #3b82f6;
      font-size: 11px;
      font-weight: 800;
      margin-bottom: 8px;
      letter-spacing: 0.08em;
    }

    .solution-box .text {
      color: #334155;
      line-height: 1.5;
      font-size: 14px;
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }

    .detail-box {
      border: 1px solid #dfebfd;
      background: #f8fbff;
      border-radius: 10px;
      padding: 12px;
      display: grid;
      gap: 6px;
    }

    .detail-box span {
      color: #64748b;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 800;
    }

    .detail-box strong {
      color: #1e293b;
      font-size: 13px;
      line-height: 1.5;
    }

    .rate-block {
      text-align: center;
      margin-bottom: 16px;
    }

    .rate-block h3 {
      margin: 0 0 8px;
      font-size: 22px;
      color: #1f2937;
      font-weight: 800;
    }

    .stars {
      display: flex;
      justify-content: center;
      gap: 4px;
      margin-bottom: 8px;
    }

    .star-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      color: #cbd5e1;
      transition: transform 0.16s ease, color 0.16s ease, filter 0.16s ease;
      padding: 1px;
      border-radius: 8px;
    }

    .star-btn.active {
      color: #fbbf24;
    }

    .star-btn:hover {
      transform: translateY(-1px) scale(1.05);
      filter: brightness(1.05);
    }

    .star-btn mat-icon {
      width: 36px;
      height: 36px;
      font-size: 36px;
    }

    .scale {
      display: flex;
      justify-content: space-between;
      color: #9aa6b8;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.4px;
      padding: 0 8px;
    }

    .comment-block {
      margin-bottom: 10px;
    }

    .comment-block label {
      display: block;
      margin-bottom: 6px;
      font-weight: 700;
      color: #334155;
      font-size: 13px;
    }

    .comment-block textarea {
      width: 100%;
      border: 1px solid #dbe2ea;
      border-radius: 8px;
      padding: 10px 12px;
      font: inherit;
      resize: vertical;
      min-height: 72px;
      background: #fff;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .comment-block textarea:focus {
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
      outline: none;
    }

    .inline-error {
      margin-bottom: 12px;
      color: #dc2626;
      font-size: 12px;
      font-weight: 700;
    }

    .actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding-top: 4px;
    }

    .actions button {
      height: 44px;
      font-weight: 700;
      border-radius: 8px;
    }

    .reject-btn {
      border-color: #fda4af !important;
      color: #e11d48 !important;
      background: #fff;
    }

    .confirm-btn {
      box-shadow: 0 8px 18px rgba(37, 99, 235, 0.3) !important;
    }

    @media (max-width: 640px) {
      .validate-dialog,
      .details-grid,
      .actions {
        width: min(96vw, 96vw);
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ValidateResolutionDialogComponent {
  rating = 5;
  comment = '';
  rejectMode = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ValidateResolutionDialogData,
    private dialogRef: MatDialogRef<ValidateResolutionDialogComponent, ValidateResolutionDialogResult>
  ) {}

  setRating(value: number): void {
    this.rating = value;
  }

  close(action: 'confirm' | 'reject' | 'cancel'): void {
    if (action === 'cancel') {
      this.dialogRef.close({ action });
      return;
    }

    if (action === 'reject') {
      this.rejectMode = true;
      if (!this.comment.trim()) {
        return;
      }
    }

    this.dialogRef.close({
      action,
      rating: this.rating || undefined,
      comment: this.comment?.trim() || undefined
    });
  }
}
