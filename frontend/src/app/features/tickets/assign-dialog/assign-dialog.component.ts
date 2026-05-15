import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AIService, AIAssignmentRecommendation, UserService } from '@core/services';
import { UserSummary } from '@core/models';

export interface AssignDialogData {
  currentAgentId?: number | null;
  ticketId?: number;
}

export interface AssignDialogResult {
  agentId: number;
  source?: 'MANUAL' | 'AI_RECOMMENDATION';
}

@Component({
  selector: 'app-assign-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatListModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="title-icon">person_add</mat-icon>
      Validation manager de l'assignation
    </h2>

    <mat-dialog-content>
      @if (loading) {
        <div class="loading">
          <mat-spinner diameter="30"></mat-spinner>
          <span>Préparation de la recommandation hybride...</span>
        </div>
      } @else {
        @if (aiRecommendation) {
          <div class="ai-card" [class.ai-card--fallback]="aiRecommendation.fallback_used">
            <div class="ai-card__header">
              <div>
                <span class="ai-eyebrow">Option 3 · Hybride IA recommande puis manager valide</span>
                <h3>IA recommande {{ aiRecommendation.recommended_agent_name || 'un agent de la shortlist' }}</h3>
              </div>
              <span class="ai-confidence">{{ aiRecommendation.confidence }}</span>
            </div>

            <p class="ai-rationale">{{ aiRecommendation.rationale }}</p>

            @if (aiRecommendation.skill_match) {
              <div class="ai-skill-match">
                <mat-icon>psychology</mat-icon>
                <span>{{ aiRecommendation.skill_match }}</span>
              </div>
            }

            <div class="ai-meta">
              <span>Validation manager requise</span>
              @if (aiRecommendation.model) {
                <span>{{ aiRecommendation.model }}</span>
              }
              @if (aiRecommendation.fallback_used) {
                <span>Mode secours</span>
              }
            </div>

            @if (aiRecommendation.manager_validation_note) {
              <p class="ai-note">{{ aiRecommendation.manager_validation_note }}</p>
            }

            <button mat-raised-button color="primary"
                    [disabled]="!aiRecommendation.recommended_agent_id"
                    (click)="validateAiRecommendation()">
              <mat-icon>verified</mat-icon>
              Valider la recommandation IA
            </button>
          </div>
        }

        <p class="subtitle">{{ getSubtitle() }}</p>

        @if (agents.length === 0) {
          <div class="no-agents">
            <mat-icon>person_off</mat-icon>
            <p>Aucun candidat d'assignation disponible</p>
          </div>
        } @else {
          <div class="agent-list">
            @for (agent of agents; track agent.id) {
              <div class="agent-card"
                   [class.recommended]="isAiRecommended(agent.id)"
                   [class.selected]="selectedAgentId === agent.id"
                   [class.agent-card--disabled]="!isAgentSelectable(agent)"
                   (click)="selectAgent(agent.id)">
                <div class="agent-avatar">
                  {{ getInitials(agent.firstName, agent.lastName) }}
                </div>
                <div class="agent-info">
                  <div class="agent-line">
                    <span class="agent-name">{{ getAgentDisplayName(agent) }}</span>
                    @if (isAiRecommended(agent.id)) {
                      <span class="recommended-badge">Reco IA</span>
                    }
                    @if (agent.assignmentStatusLabel && !isAgentSelectable(agent)) {
                      <span class="status-badge">{{ agent.assignmentStatusLabel }}</span>
                    }
                  </div>
                  <span class="agent-email">{{ agent.email }}</span>
                  @if (agent.recommendationScore !== undefined || agent.activeTickets !== undefined || agent.slaComplianceRate !== undefined || agent.expertiseScore !== undefined) {
                    <span class="agent-stats">
                      @if (agent.skillMatchType) {
                        <span>Match {{ getSkillMatchLabel(agent.skillMatchType) }}</span>
                      }
                      @if (agent.recommendationScore !== undefined) {
                        <span>Score {{ agent.recommendationScore | number:'1.1-3' }}</span>
                      }
                      @if (agent.activeTickets !== undefined) {
                        <span>Charge {{ agent.activeTickets }}</span>
                      }
                      @if (agent.slaComplianceRate !== undefined) {
                        <span>SLA {{ agent.slaComplianceRate | number:'1.0-0' }}%</span>
                      }
                      @if (agent.expertiseScore !== undefined) {
                        <span>Compétence {{ agent.expertiseScore | number:'1.0-0' }}%</span>
                      }
                    </span>
                  }
                  @if (agent.recommendationReason) {
                    <span class="agent-meta">{{ agent.recommendationReason }}</span>
                  }
                </div>
                @if (selectedAgentId === agent.id) {
                  <mat-icon class="check-icon">check_circle</mat-icon>
                }
              </div>
            }
          </div>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Annuler</button>
      <button mat-raised-button color="primary"
              [disabled]="!canConfirmSelection()"
              (click)="confirm()">
        <mat-icon>person_add</mat-icon>
        Assigner
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
    }

    .title-icon {
      color: #1976d2;
    }

    mat-dialog-content {
      min-width: 420px;
      max-height: 400px;
    }

    .subtitle {
      margin: 0 0 16px;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }

    .ai-card {
      margin-bottom: 16px;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid rgba(25, 118, 210, 0.2);
      background: linear-gradient(135deg, rgba(25, 118, 210, 0.1), rgba(25, 118, 210, 0.03));
    }

    .ai-card--fallback {
      border-color: rgba(255, 152, 0, 0.35);
      background: linear-gradient(135deg, rgba(255, 152, 0, 0.12), rgba(255, 152, 0, 0.03));
    }

    .ai-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;

      h3 {
        margin: 4px 0 0;
        font-size: 17px;
        font-weight: 600;
        color: #1f2937;
      }
    }

    .ai-eyebrow {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #1976d2;
    }

    .ai-confidence {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 74px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(25, 118, 210, 0.14);
      color: #0f4fa8;
      font-size: 12px;
      font-weight: 700;
    }

    .ai-rationale,
    .ai-note {
      margin: 0;
      color: #374151;
      line-height: 1.5;
      font-size: 13px;
    }

    .ai-skill-match {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 12px 0 8px;
      color: #1f2937;
      font-size: 13px;

      mat-icon {
        color: #1976d2;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .ai-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0;

      span {
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.58);
        color: #4b5563;
        font-size: 11px;
        font-weight: 600;
      }
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
      max-height: 280px;
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

      &.recommended {
        border-color: rgba(25, 118, 210, 0.35);
      }

      &.agent-card--disabled {
        cursor: not-allowed;
        opacity: 0.72;
        border-style: dashed;
      }

      &.agent-card--disabled:hover {
        border-color: #e0e0e0;
        background: transparent;
        transform: none;
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
    }

    .agent-line {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .agent-name {
      font-weight: 500;
      font-size: 14px;
      color: #333;
    }

    .recommended-badge {
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(25, 118, 210, 0.1);
      color: #0f4fa8;
      font-size: 11px;
      font-weight: 700;
    }

    .status-badge {
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(239, 68, 68, 0.12);
      color: #b91c1c;
      font-size: 11px;
      font-weight: 700;
    }

    .agent-email {
      font-size: 12px;
      color: #999;
    }

    .agent-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
      font-size: 11px;
      color: #6b7280;
      font-weight: 600;
    }

    .agent-meta {
      font-size: 11px;
      color: #5f6368;
      margin-top: 4px;
      line-height: 1.35;
    }

    .check-icon {
      color: #1976d2;
      flex-shrink: 0;
    }

    mat-dialog-actions {
      padding: 8px 24px 16px;
    }
  `]
})
export class AssignDialogComponent implements OnInit {
  agents: UserSummary[] = [];
  selectedAgentId: number | null = null;
  loading = true;
  aiRecommendation: AIAssignmentRecommendation | null = null;
  private userSelectedAgent = false;

  constructor(
    private dialogRef: MatDialogRef<AssignDialogComponent>,
    @Inject(MAT_DIALOG_DATA) private data: AssignDialogData,
    private userService: UserService,
    private aiService: AIService
  ) {}

  ngOnInit(): void {
    this.selectedAgentId = null;

    if (this.data.ticketId) {
      this.loadAssignmentCandidates();
      this.loadAiRecommendation(this.data.ticketId);
      return;
    }

    this.loadAvailableAgents();
  }

  private loadAiRecommendation(ticketId: number): void {
    this.aiService.getAssignmentRecommendation(ticketId).pipe(
      catchError((error) => {
        console.error('Error loading hybrid recommendation:', error);
        return of(null);
      })
    ).subscribe((recommendation) => {
      if (!recommendation?.candidates?.length) {
        return;
      }

      this.aiRecommendation = recommendation;
      this.mergeRecommendationCandidates(recommendation.candidates);
      if (
        !this.userSelectedAgent &&
        !this.selectedAgentId &&
        recommendation.recommended_agent_id &&
        this.isAgentSelectable(recommendation.recommended_agent_id)
      ) {
        this.selectedAgentId = recommendation.recommended_agent_id;
      }
    });
  }

  private loadAssignmentCandidates(): void {
    if (!this.data.ticketId) {
      this.loadAvailableAgents();
      return;
    }

    this.userService.getAssignmentCandidates(this.data.ticketId).pipe(
      catchError((recommendedError) => {
        console.error('Error loading assignment candidates:', recommendedError);
        return this.userService.getRecommendedAgents(this.data.ticketId!);
      })
    ).subscribe({
      next: (agents) => this.applyAgents(agents || []),
      error: (error) => {
        console.error('Error loading assignment candidates fallback:', error);
        this.agents = [];
        this.loading = false;
      }
    });
  }

  private loadAvailableAgents(): void {
    this.userService.getAvailableAgents().subscribe({
      next: (agents) => this.applyAgents(agents || []),
      error: (error) => {
        console.error('Error loading agents:', error);
        this.agents = [];
        this.loading = false;
      }
    });
  }

  private applyAgents(agents: UserSummary[]): void {
    this.agents = this.sortAgents(agents);
    this.syncSelection();
    this.loading = false;
  }

  private mergeRecommendationCandidates(candidates: UserSummary[]): void {
    if (this.agents.length === 0) {
      this.applyAgents(candidates);
      return;
    }

    const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
    this.agents = this.sortAgents(this.agents.map(agent => {
      const candidate = byId.get(agent.id);
      return candidate
        ? {
            ...agent,
            ...candidate,
            assignmentEligible: agent.assignmentEligible,
            assignmentStatus: agent.assignmentStatus,
            assignmentStatusLabel: agent.assignmentStatusLabel
          }
        : agent;
    }));
    this.syncSelection();
  }

  private hasAgent(agentId: number): boolean {
    return this.agents.some(agent => agent.id === agentId);
  }

  selectAgent(id: number): void {
    if (!this.isAgentSelectable(id)) {
      return;
    }
    this.userSelectedAgent = true;
    this.selectedAgentId = id;
  }

  isAiRecommended(agentId: number): boolean {
    return this.aiRecommendation?.recommended_agent_id === agentId;
  }

  isAgentSelectable(agent: UserSummary | number): boolean {
    const candidate = typeof agent === 'number'
      ? this.agents.find(item => item.id === agent)
      : agent;
    return !!candidate && candidate.assignmentEligible !== false;
  }

  canConfirmSelection(): boolean {
    return this.selectedAgentId !== null && this.isAgentSelectable(this.selectedAgentId);
  }

  getSubtitle(): string {
    return this.aiRecommendation
      ? 'Vous pouvez valider la proposition IA ou choisir un autre agent. Les profils grises expliquent pourquoi ils ne sont pas eligibles.'
      : 'Selectionnez l\'agent a qui assigner ce ticket. Les profils grises restent visibles avec leur raison.';
  }

  getAgentDisplayName(agent: UserSummary): string {
    return agent.fullName || `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || agent.username || 'Agent';
  }

  getSkillMatchLabel(type?: string): string {
    switch (type) {
      case 'PRIMARY':
        return 'principal';
      case 'SECONDARY':
        return 'secondaire';
      case 'MANAGER_FALLBACK':
        return 'manager';
      default:
        return 'fallback';
    }
  }

  getInitials(firstName?: string, lastName?: string): string {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || '?';
  }

  validateAiRecommendation(): void {
    if (this.aiRecommendation?.recommended_agent_id && this.isAgentSelectable(this.aiRecommendation.recommended_agent_id)) {
      this.dialogRef.close({
        agentId: this.aiRecommendation.recommended_agent_id,
        source: 'AI_RECOMMENDATION'
      } as AssignDialogResult);
    }
  }

  confirm(): void {
    if (this.selectedAgentId && this.isAgentSelectable(this.selectedAgentId)) {
      this.dialogRef.close({
        agentId: this.selectedAgentId,
        source: this.isAiRecommended(this.selectedAgentId) ? 'AI_RECOMMENDATION' : 'MANUAL'
      } as AssignDialogResult);
    }
  }

  private syncSelection(): void {
    if (this.selectedAgentId && !this.isAgentSelectable(this.selectedAgentId)) {
      this.selectedAgentId = null;
    }
    const selectableAgents = this.agents.filter(agent => this.isAgentSelectable(agent));
    if (!this.selectedAgentId && selectableAgents.length === 1) {
      this.selectedAgentId = selectableAgents[0].id;
    }
  }

  private sortAgents(agents: UserSummary[]): UserSummary[] {
    return [...agents].sort((left, right) => {
      const leftDisabled = !this.isAgentSelectable(left);
      const rightDisabled = !this.isAgentSelectable(right);
      if (leftDisabled !== rightDisabled) {
        return leftDisabled ? 1 : -1;
      }

      const leftRecommended = this.isAiRecommended(left.id);
      const rightRecommended = this.isAiRecommended(right.id);
      if (leftRecommended !== rightRecommended) {
        return leftRecommended ? -1 : 1;
      }

      const leftScore = left.recommendationScore ?? -1;
      const rightScore = right.recommendationScore ?? -1;
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return this.getAgentDisplayName(left).localeCompare(this.getAgentDisplayName(right));
    });
  }
}
