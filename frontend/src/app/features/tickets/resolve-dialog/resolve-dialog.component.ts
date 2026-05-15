import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ResolveDialogData {
  ticketReference?: string;
  ticketTitle?: string;
}

export interface ResolveDialogResult {
  summary: string;
  diagnostic: string;
  rootCause: string;
  actionsTaken: string;
  nextRecommendation: string;
}

@Component({
  selector: 'app-resolve-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="resolve-dialog">
      <div class="head">
        <div class="title-wrap">
          <div class="title-icon">
            <mat-icon>task_alt</mat-icon>
          </div>
          <div>
            <h2>Resoudre le ticket</h2>
            <p>{{ data.ticketReference || '-' }} - Finaliser la solution client</p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="close()" aria-label="Fermer">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="context-box">
        <div class="label">TICKET</div>
        <div class="text">{{ data.ticketTitle || 'Aucun titre disponible' }}</div>
      </div>

      <div class="input-block">
        <label for="resolution-summary">Resume de la resolution</label>
        <textarea
          id="resolution-summary"
          rows="5"
          maxlength="1200"
          [(ngModel)]="summary"
          placeholder="Explique ce qui a ete analyse, corrige, et les verifications effectuees..."
        ></textarea>
        <div class="meta-row">
          <span>Minimum 10 caracteres</span>
          <span>{{ summary.trim().length }}/1200</span>
        </div>
      </div>

      <div class="input-grid">
        <div class="input-block">
          <label for="resolution-diagnostic">Diagnostic</label>
          <textarea
            id="resolution-diagnostic"
            rows="4"
            maxlength="2000"
            [(ngModel)]="diagnostic"
            placeholder="Symptomes observes, analyse effectuee, source probable..."
          ></textarea>
        </div>

        <div class="input-block">
          <label for="resolution-root-cause">Cause racine</label>
          <textarea
            id="resolution-root-cause"
            rows="4"
            maxlength="2000"
            [(ngModel)]="rootCause"
            placeholder="Cause principale ou element ayant declenche l'incident..."
          ></textarea>
        </div>

        <div class="input-block">
          <label for="resolution-actions">Action realisee</label>
          <textarea
            id="resolution-actions"
            rows="4"
            maxlength="2000"
            [(ngModel)]="actionsTaken"
            placeholder="Corrections appliquees, tests, reconfiguration, relance..."
          ></textarea>
        </div>

        <div class="input-block">
          <label for="resolution-next-step">Recommandation</label>
          <textarea
            id="resolution-next-step"
            rows="3"
            maxlength="1000"
            [(ngModel)]="nextRecommendation"
            placeholder="Prevention, surveillance, action suivante recommandee..."
          ></textarea>
        </div>
      </div>

      <div class="actions">
        <button mat-stroked-button (click)="close()">
          <mat-icon>close</mat-icon>
          Annuler
        </button>
        <button mat-raised-button color="primary" [disabled]="!isValid()" (click)="confirm()">
          <mat-icon>check_circle</mat-icon>
          Valider la resolution
        </button>
      </div>
    </div>
  `,
  styles: [`
    .resolve-dialog {
      width: min(94vw, 640px);
      padding: 6px 2px 2px;
      color: #0f172a;
    }

    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 14px;
    }

    .title-wrap {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .title-icon {
      width: 38px;
      height: 38px;
      border-radius: 11px;
      background: linear-gradient(145deg, #e0f2fe, #dbeafe);
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.15);
    }

    h2 {
      margin: 0;
      font-size: 27px;
      line-height: 1.08;
      font-weight: 800;
      letter-spacing: -0.01em;
    }

    .head p {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
    }

    .close-btn {
      color: #94a3b8;
      margin-top: -4px;
    }

    .context-box {
      border: 1px solid #dbeafe;
      border-radius: 10px;
      background: linear-gradient(180deg, #f8fbff, #f3f8ff);
      padding: 12px;
      margin-bottom: 14px;
    }

    .context-box .label {
      font-size: 11px;
      font-weight: 800;
      color: #2563eb;
      margin-bottom: 6px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .context-box .text {
      color: #334155;
      font-size: 14px;
      line-height: 1.45;
    }

    .input-block label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 6px;
    }

    .input-block textarea {
      width: 100%;
      min-height: 112px;
      border-radius: 10px;
      border: 1px solid #d8e1ec;
      background: #fff;
      padding: 10px 12px;
      font: inherit;
      color: #0f172a;
      resize: vertical;
      outline: none;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .input-block textarea:focus {
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
    }

    .meta-row {
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
      font-weight: 600;
    }

    .input-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 14px;
    }

    .actions {
      margin-top: 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .actions button {
      height: 44px;
      border-radius: 9px;
      font-weight: 700;
    }

    @media (max-width: 640px) {
      .resolve-dialog {
        width: min(96vw, 96vw);
      }

      h2 {
        font-size: 22px;
      }

      .actions {
        grid-template-columns: 1fr;
      }

      .input-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ResolveDialogComponent {
  summary = '';
  diagnostic = '';
  rootCause = '';
  actionsTaken = '';
  nextRecommendation = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ResolveDialogData,
    private dialogRef: MatDialogRef<ResolveDialogComponent, ResolveDialogResult>
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    if (!this.isValid()) return;
    this.dialogRef.close({
      summary: this.summary.trim(),
      diagnostic: this.diagnostic.trim(),
      rootCause: this.rootCause.trim(),
      actionsTaken: this.actionsTaken.trim(),
      nextRecommendation: this.nextRecommendation.trim()
    });
  }

  isValid(): boolean {
    return this.summary.trim().length >= 10
      && this.diagnostic.trim().length >= 10
      && this.rootCause.trim().length >= 10
      && this.actionsTaken.trim().length >= 10
      && this.nextRecommendation.trim().length >= 5;
  }
}
