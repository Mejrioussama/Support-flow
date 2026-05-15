import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type AlfrescoPreviewDialogData = {
  title: string;
  objectUrl: string;
  mimeType: string;
};

@Component({
  selector: 'app-alfresco-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="preview-dialog">
      <div class="preview-dialog__header">
        <div>
          <h2>{{ data.title }}</h2>
          <p>{{ data.mimeType }}</p>
        </div>
        <button mat-icon-button type="button" aria-label="Fermer" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="preview-dialog__body">
        @if (isImage()) {
          <img class="preview-dialog__image" [src]="data.objectUrl" [alt]="data.title">
        } @else if (isPdf()) {
          <iframe class="preview-dialog__frame" [src]="data.objectUrl" title="Apercu PDF"></iframe>
        } @else {
          <div class="preview-dialog__empty">
            <mat-icon>visibility_off</mat-icon>
            <p>Apercu non disponible pour ce type de document.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .preview-dialog {
      width: min(94vw, 1100px);
      max-width: 1100px;
      height: min(90vh, 860px);
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 12px;
      color: #e2e8f0;
      background: #081120;
    }

    .preview-dialog__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .preview-dialog__header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
    }

    .preview-dialog__header p {
      margin: 4px 0 0;
      color: #94a3b8;
      font-size: 12px;
    }

    .preview-dialog__body {
      min-height: 0;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 14px;
      overflow: hidden;
      background: rgba(15, 23, 42, 0.82);
    }

    .preview-dialog__image,
    .preview-dialog__frame {
      width: 100%;
      height: 100%;
      display: block;
      border: none;
      background: #0f172a;
    }

    .preview-dialog__image {
      object-fit: contain;
    }

    .preview-dialog__empty {
      height: 100%;
      display: grid;
      place-items: center;
      gap: 10px;
      text-align: center;
      color: #94a3b8;
      padding: 24px;
    }

    .preview-dialog__empty mat-icon {
      width: 32px;
      height: 32px;
      font-size: 32px;
    }
  `]
})
export class AlfrescoPreviewDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AlfrescoPreviewDialogData,
    private dialogRef: MatDialogRef<AlfrescoPreviewDialogComponent>
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  isImage(): boolean {
    return this.data.mimeType.startsWith('image/');
  }

  isPdf(): boolean {
    return this.data.mimeType === 'application/pdf';
  }
}
