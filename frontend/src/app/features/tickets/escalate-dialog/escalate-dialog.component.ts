import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { UserService } from '@core/services';

export interface EscalateDialogResult {
  agentId: number;
  motif: string;
}

@Component({
  selector: 'app-escalate-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatChipsModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="title-icon">arrow_upward</mat-icon>
      Escalader le ticket
    </h2>
    
    <mat-dialog-content>
      @if (loading) {
        <div class="loading">
          <mat-spinner diameter="30"></mat-spinner>
          <span>Chargement des agents...</span>
        </div>
      } @else {
        <p class="subtitle">Sélectionnez l'agent vers lequel escalader ce ticket :</p>
        
        @if (agents.length === 0) {
          <div class="no-agents">
            <mat-icon>person_off</mat-icon>
            <p>Aucun agent disponible</p>
          </div>
        } @else {
          <div class="agent-list">
            @for (agent of agents; track agent.id) {
              <div class="agent-card" 
                   [class.selected]="selectedAgentId === agent.id"
                   (click)="selectAgent(agent.id)">
                <div class="agent-avatar">
                  {{ getInitials(agent.firstName, agent.lastName) }}
                </div>
                <div class="agent-info">
                  <span class="agent-name">{{ agent.firstName }} {{ agent.lastName }}</span>
                  <span class="agent-role">{{ getRoleLabel(agent.role) }}</span>
                  <span class="agent-email">{{ agent.email }}</span>
                </div>
                @if (selectedAgentId === agent.id) {
                  <mat-icon class="check-icon">check_circle</mat-icon>
                }
              </div>
            }
          </div>
        }
        
        <mat-form-field appearance="outline" class="full-width motif-field">
          <mat-label>Motif de l'escalade</mat-label>
          <textarea matInput 
                    [(ngModel)]="motif" 
                    rows="3" 
                    placeholder="Décrivez la raison de l'escalade..."
                    required></textarea>
        </mat-form-field>
      }
    </mat-dialog-content>
    
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Annuler</button>
      <button mat-raised-button color="warn" 
              [disabled]="!selectedAgentId || !motif.trim()"
              (click)="confirm()">
        <mat-icon>arrow_upward</mat-icon>
        Escalader
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
    }
    
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 16px 24px;
      
      .title-icon {
        color: #ff9800;
      }
    }
    
    mat-dialog-content {
      min-width: 450px;
      max-height: 500px;
    }
    
    .subtitle {
      margin: 0 0 16px;
      color: #666;
      font-size: 14px;
    }
    
    .loading {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px;
      justify-content: center;
    }
    
    .no-agents {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      color: #999;
      
      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
      }
    }
    
    .agent-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
      max-height: 250px;
      overflow-y: auto;
    }
    
    .agent-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      
      &:hover {
        border-color: #90caf9;
        background: #f5f9ff;
      }
      
      &.selected {
        border-color: #1976d2;
        background: #e3f2fd;
      }
    }
    
    .agent-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #1976d2;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
    }
    
    .agent-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      
      .agent-name {
        font-weight: 500;
        font-size: 14px;
        color: #333;
      }
      
      .agent-role {
        font-size: 12px;
        color: #1976d2;
        font-weight: 500;
      }
      
      .agent-email {
        font-size: 12px;
        color: #999;
      }
    }
    
    .check-icon {
      color: #1976d2;
      flex-shrink: 0;
    }
    
    .motif-field {
      margin-top: 8px;
    }
    
    .full-width {
      width: 100%;
    }
    
    mat-dialog-actions {
      padding: 8px 24px 16px;
    }
  `]
})
export class EscalateDialogComponent implements OnInit {
  agents: any[] = [];
  selectedAgentId: number | null = null;
  motif = '';
  loading = true;

  constructor(
    private dialogRef: MatDialogRef<EscalateDialogComponent>,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.userService.getAvailableAgents().subscribe({
      next: (agents) => {
        this.agents = agents;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading agents:', err);
        this.loading = false;
      }
    });
  }

  selectAgent(id: number): void {
    this.selectedAgentId = id;
  }

  getInitials(firstName?: string, lastName?: string): string {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || '?';
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      'SUPPORT_AGENT': 'Agent Support',
      'SUPPORT_MANAGER': 'Manager Support',
      'ADMIN': 'Administrateur'
    };
    return labels[role] || role;
  }

  confirm(): void {
    if (this.selectedAgentId && this.motif.trim()) {
      this.dialogRef.close({
        agentId: this.selectedAgentId,
        motif: this.motif.trim()
      } as EscalateDialogResult);
    }
  }
}
