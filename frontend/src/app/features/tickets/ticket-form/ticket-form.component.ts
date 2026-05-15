import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { debounceTime, switchMap } from 'rxjs/operators';
import { firstValueFrom, of, Subscription } from 'rxjs';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { AIService, AIAssignmentRecommendation, TicketService, ClientService, UserService, AuthService, KnowledgeBaseService } from '@core/services';
import { Ticket, Client, User, TicketPriority, TicketCategory, UserSummary, KnowledgeArticle } from '@core/models';

@Component({
  selector: 'app-ticket-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    FileUploadModule,
    ProgressBarModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <div class="ticket-form overflow-y-auto">
      <p-toast position="top-right"></p-toast>
      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="48" class="neon-spinner"></mat-spinner>
          <p>Préparation de votre demande...</p>
        </div>
      } @else {
        <div class="layout">
          <section class="main-content">
            <header class="page-header glass-panel highlight-border">
              <div class="header-info">
                <div class="title-row">
                  <mat-icon class="header-icon neon-text">confirmation_number</mat-icon>
                  <h1 class="neon-title">{{ isEditMode ? 'Modifier le Ticket' : 'Créer un Nouveau Ticket' }}</h1>
                </div>
                <p class="subtitle">Soumettez votre demande et notre équipe technique reviendra vers vous rapidement.</p>
              </div>
            </header>

            <mat-card class="form-card glass-panel highlight-border">
              <mat-card-content>
                <form [formGroup]="ticketForm" (ngSubmit)="onSubmit()" class="sf-form">
                  
                  <!-- Section: Title -->
                  <div class="form-section">
                    <div class="section-header">
                      <mat-icon class="section-icon">title</mat-icon>
                      <h3>Sujet du ticket</h3>
                    </div>
                    <mat-form-field appearance="outline" class="full-width glass-input">
                      <mat-label>Titre descriptif</mat-label>
                      <input matInput formControlName="title" placeholder="Ex: Impossible de me connecter au tableau de bord">
                      @if (ticketForm.get('title')?.hasError('required')) {
                        <mat-error>Le titre est obligatoire</mat-error>
                      }
                      @if (ticketForm.get('title')?.hasError('minlength')) {
                        <mat-error>Le titre doit faire au moins 5 caractères</mat-error>
                      }
                    </mat-form-field>
                  </div>

                  <!-- Section: Type Selection -->
                  <div class="form-section">
                    <div class="section-header">
                      <mat-icon class="section-icon">category</mat-icon>
                      <h3>Type de demande</h3>
                    </div>
                    <div class="type-selection-grid">
                      @for (t of quickTypes; track t.value) {
                        <div class="type-card" 
                             [class.active]="isTypeSelected(t.value)" 
                             (click)="setType(t.value)">
                          <div class="type-icon-wrapper">
                            <mat-icon>{{ t.icon }}</mat-icon>
                          </div>
                          <span class="type-label">{{ t.label }}</span>
                          <div class="active-indicator"></div>
                        </div>
                        <span>{{ selectedFiles.length }} fichier(s) prÃªt(s) Ã  l'envoi</span>
                      }
                    </div>
                  </div>

                  <!-- Section: Qualification -->
                  <div class="form-section">
                    <div class="section-header">
                      <mat-icon class="section-icon">priority_high</mat-icon>
                      <h3>Qualification & Priorité</h3>
                    </div>
                    <div class="qualification-row">
                      <mat-form-field appearance="outline" class="glass-input">
                        <mat-label>Urgence</mat-label>
                        <mat-select formControlName="urgency" (selectionChange)="onQualificationChange()">
                          @for (u of severities; track u.value) {
                            <mat-option [value]="u.value">{{ u.label }}</mat-option>
                          }
                        </mat-select>
                        <mat-icon matPrefix class="field-icon">speed</mat-icon>
                      </mat-form-field>

                      <mat-form-field appearance="outline" class="glass-input">
                        <mat-label>Impact</mat-label>
                        <mat-select formControlName="impact" (selectionChange)="onQualificationChange()">
                          @for (i of impacts; track i.value) {
                            <mat-option [value]="i.value">{{ i.label }}</mat-option>
                          }
                        </mat-select>
                        <mat-icon matPrefix class="field-icon">assessment</mat-icon>
                      </mat-form-field>
                    </div>

                    @if (calculatedPriority) {
                      <div class="priority-insight-card glass-panel" [class]="'p-' + calculatedPriority.toLowerCase()">
                        <div class="insight-content">
                          <div class="priority-info">
                            <span class="insight-label">Priorité calculée automatiquement :</span>
                            <div class="priority-v-badge" [class]="calculatedPriority.toLowerCase()">
                              <mat-icon class="pulse-icon">bolt</mat-icon>
                              <span>{{ getPriorityLabel(calculatedPriority) }}</span>
                            </div>
                          </div>
                          @if (slaEstimate) {
                            <div class="sla-insight">
                              <mat-icon>schedule</mat-icon>
                              <span>Délai de résolution estimé : <strong>{{ slaEstimate }}</strong></span>
                            </div>
                          }
                          <div class="prime-priority-progress">
                            <div class="progress-labels">
                              <span>IntensitÃ© SLA</span>
                              <strong>{{ getPriorityProgressValue() }}%</strong>
                            </div>
                            <p-progressBar [value]="getPriorityProgressValue()" [showValue]="false"></p-progressBar>
                          </div>
                        <span>{{ selectedFiles.length }} fichier(s) prÃªt(s) Ã  l'envoi</span>
                      </div>
                      </div>
                    

                    
                      <mat-form-field appearance="outline" class="full-width glass-input">
                        <mat-label>Domaine / compétence</mat-label>
                        <mat-select formControlName="category">
                          <mat-option [value]="''">Non précisé</mat-option>
                          @for (category of availableCategories; track category.value) {
                            <mat-option [value]="category.value">{{ category.label }}</mat-option>
                          }
                        </mat-select>
                        <mat-icon matPrefix class="field-icon">hub</mat-icon>
                        <mat-hint>Améliore la recommandation d'assignation basée sur les compétences.</mat-hint>
                      </mat-form-field>
                    }
                  </div>

                  <!-- Section: Description -->
                  <div class="form-section">
                    <div class="section-header">
                      <mat-icon class="section-icon">description</mat-icon>
                      <h3>Description détaillée</h3>
                    </div>
                    <mat-form-field appearance="outline" class="full-width glass-input">
                      <mat-label>Que se passe-t-il ?</mat-label>
                      <textarea matInput formControlName="description" rows="6" 
                                placeholder="Détaillez les étapes pour reproduire le problème ou fournissez les détails de votre demande..."></textarea>
                    </mat-form-field>
                  </div>

                  @if (isClient && !isEditMode) {
                    <div class="form-section">
                      <div class="section-header">
                        <mat-icon class="section-icon">auto_stories</mat-icon>
                        <h3>Solutions recommandÃ©es avant envoi</h3>
                      </div>

                      <div class="knowledge-assist-panel glass-panel highlight-border">
                        <div class="knowledge-assist-top">
                          <div>
                            <span class="knowledge-eyebrow">Portail client autonome</span>
                            <h4>VÃ©rifions d'abord si une solution connue peut vous aider</h4>
                            <p>SupportFlow analyse votre brouillon et propose des articles dÃ©jÃ  validÃ©s par le support avant d'ouvrir un nouveau ticket.</p>
                          </div>
                          <button
                            type="button"
                            mat-stroked-button
                            class="knowledge-refresh-btn"
                            [disabled]="knowledgeSuggestionsLoading"
                            (click)="refreshKnowledgeSuggestions(true)">
                            <mat-icon>{{ knowledgeSuggestionsLoading ? 'hourglass_top' : 'manage_search' }}</mat-icon>
                            {{ knowledgeSuggestionsLoading ? 'Analyse...' : 'Actualiser les suggestions' }}
                          </button>
                        </div>

                        @if (knowledgeSuggestionsLoading) {
                          <div class="knowledge-state">
                            <mat-spinner diameter="26"></mat-spinner>
                            <span>Recherche de solutions connues dans la base de connaissance...</span>
                          </div>
                        } @else if (knowledgeSuggestionsError) {
                          <div class="knowledge-state knowledge-state--error">
                            <mat-icon>error_outline</mat-icon>
                            <span>{{ knowledgeSuggestionsError }}</span>
                          </div>
                        } @else if (knowledgeSolvedArticleId) {
                          <div class="knowledge-state knowledge-state--success">
                            <mat-icon>check_circle</mat-icon>
                            <div>
                              <strong>Parfait, une solution semble vous aider.</strong>
                              <p>Vous pouvez fermer cette page si le besoin est couvert, ou crÃ©er quand mÃªme un ticket si le problÃ¨me persiste.</p>
                            </div>
                            <button type="button" mat-button class="knowledge-anyway-btn" (click)="submitAfterKnowledgeReview()">
                              CrÃ©er quand mÃªme le ticket
                            </button>
                          </div>
                        } @else if (knowledgeSuggestions.length > 0 && !knowledgeSuggestionsDismissed) {
                          <div class="knowledge-results-header">
                            <strong>{{ knowledgeSuggestions.length }} article(s) recommandÃ©(s)</strong>
                            <span>Consultez d'abord ces pistes avant d'envoyer au support.</span>
                          </div>

                          <div class="knowledge-list">
                            @for (article of knowledgeSuggestions; track article.id) {
                              <article class="knowledge-card">
                                <div class="knowledge-card__top">
                                  <div>
                                    <span class="knowledge-card__category">{{ article.category || 'Support' }}</span>
                                    <h5>{{ article.title }}</h5>
                                  </div>
                                  <div class="knowledge-card__metrics">
                                    <span><mat-icon>thumb_up</mat-icon>{{ article.helpfulCount || 0 }}</span>
                                    <span><mat-icon>visibility</mat-icon>{{ article.views || 0 }}</span>
                                  </div>
                                </div>

                                <p class="knowledge-card__summary">{{ article.summary || article.content }}</p>

                                @if (article.tags?.length) {
                                  <div class="knowledge-card__tags">
                                    @for (tag of article.tags | slice:0:4; track tag) {
                                      <span>{{ tag }}</span>
                                    }
                                  </div>
                                }

                                <details class="knowledge-card__details">
                                  <summary>Voir la solution dÃ©taillÃ©e</summary>
                                  <pre>{{ article.content }}</pre>
                                </details>

                                <div class="knowledge-card__actions">
                                  <button
                                    type="button"
                                    mat-raised-button
                                    color="primary"
                                    class="knowledge-help-btn"
                                    [disabled]="hasMarkedKnowledgeArticleHelpful(article.id)"
                                    (click)="markKnowledgeArticleHelpful(article, true)">
                                    <mat-icon>task_alt</mat-icon>
                                    {{ hasMarkedKnowledgeArticleHelpful(article.id) ? 'Solution retenue' : 'Cela m aide' }}
                                  </button>
                                  <button type="button" mat-button class="knowledge-anyway-btn" (click)="submitAfterKnowledgeReview()">
                                    CrÃ©er quand mÃªme le ticket
                                  </button>
                                </div>
                              </article>
                            }
                          </div>
                        } @else if (canRequestKnowledgeSuggestions()) {
                          <div class="knowledge-state knowledge-state--neutral">
                            <mat-icon>tips_and_updates</mat-icon>
                            <div>
                              <strong>Aucune solution suffisamment proche n'a Ã©tÃ© trouvÃ©e.</strong>
                              <p>Vous pouvez envoyer le ticket: l'Ã©quipe support prendra le relais avec votre contexte complet.</p>
                            </div>
                            <button type="button" mat-button class="knowledge-anyway-btn" (click)="submitAfterKnowledgeReview()">
                              CrÃ©er quand mÃªme le ticket
                            </button>
                          </div>
                        } @else {
                          <div class="knowledge-state knowledge-state--neutral">
                            <mat-icon>edit_note</mat-icon>
                            <span>Ajoutez un titre clair ou une description plus prÃ©cise pour obtenir des suggestions automatiques.</span>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Section: Attachments -->
                  <div class="form-section">
                    <div class="section-header">
                      <mat-icon class="section-icon">attachment</mat-icon>
                      <h3>Pièces jointes</h3>
                    </div>
                    <div class="prime-upload-shell glass-panel">
                      <p-fileUpload
                        name="attachments[]"
                        [multiple]="true"
                        accept=".png,.jpg,.jpeg,.pdf,.txt,.log,.csv,.xlsx,.doc,.docx"
                        [maxFileSize]="10485760"
                        [showUploadButton]="false"
                        [showCancelButton]="false"
                        chooseLabel="Ajouter des fichiers"
                        invalidFileSizeMessageSummary="Fichier trop volumineux"
                        invalidFileSizeMessageDetail="La taille maximale autorisÃ©e est de 10 Mo."
                        (onSelect)="onPrimeFilesSelected($event)">
                      </p-fileUpload>
                      <div class="mobile-upload-hint">
                        <span>Compatible mobile et desktop, pour captures, PDF, logs et exports.</span>
                        <p class="drop-text">Glissez-déposez vos fichiers ici ou <button type="button" class="text-link" (click)="fileInput.click()">parcourir</button></p>
                      </div>
                    </div>

                    <input #fileInput type="file" multiple hidden (change)="onFilesSelected($event)">

                    @if (selectedFiles.length > 0) {
                      <div class="selected-files-grid">
                        @for (file of selectedFiles; track file.name + file.size) {
                          <div class="file-pill glass-panel">
                            <mat-icon class="f-icon">insert_drive_file</mat-icon>
                            <span class="f-name">{{ file.name }}</span>
                            <button type="button" mat-icon-button class="remove-f" (click)="removeFile(file)">
                              <mat-icon>close</mat-icon>
                            </button>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  @if (!isClient) {
                    <div class="staff-assignment-section glass-panel highlight-border">
                      <div class="section-header">
                        <mat-icon class="section-icon">admin_panel_settings</mat-icon>
                        <h3>Attribution Staff</h3>
                      </div>

                      <div class="assignment-toolbar">
                        <p class="assignment-hint">Option 3 hybride: l'IA recommande, le manager valide ou choisit un autre agent.</p>
                        <button type="button"
                                mat-stroked-button
                                class="recommendation-refresh-btn"
                                [disabled]="assignmentRecommendationLoading"
                                (click)="refreshAssignmentRecommendationPreview(true)">
                          <mat-icon>{{ assignmentRecommendationLoading ? 'hourglass_top' : 'auto_awesome' }}</mat-icon>
                          {{ assignmentRecommendationLoading ? 'Analyse...' : 'Actualiser recommandation IA' }}
                        </button>
                      </div>

                      @if (assignmentRecommendationLoading) {
                        <div class="recommendation-loading">
                          <mat-spinner diameter="26"></mat-spinner>
                          <span>Calcul de la meilleure assignation selon les compétences, la charge et le SLA...</span>
                        </div>
                      } @else if (assignmentRecommendation) {
                        <div class="assignment-recommendation-card" [class.assignment-recommendation-card--fallback]="assignmentRecommendation.fallback_used">
                          <div class="assignment-recommendation-header">
                            <div>
                              <span class="recommendation-eyebrow">IA + règles métier</span>
                              <h4>{{ assignmentRecommendation.recommended_agent_name || 'Agent recommandé' }}</h4>
                            </div>
                            <span class="recommendation-confidence">{{ assignmentRecommendation.confidence }}</span>
                          </div>

                          <p class="recommendation-rationale">{{ assignmentRecommendation.rationale }}</p>

                          @if (assignmentRecommendation.skill_match) {
                            <div class="recommendation-skill-match">
                              <mat-icon>psychology</mat-icon>
                              <span>{{ assignmentRecommendation.skill_match }}</span>
                            </div>
                          }

                          <div class="recommendation-meta">
                            <span>Validation manager requise</span>
                            @if (assignmentRecommendation.model) {
                              <span>{{ assignmentRecommendation.model }}</span>
                            }
                            @if (assignmentRecommendation.fallback_used) {
                              <span>Mode secours</span>
                            }
                          </div>

                          @if (assignmentRecommendation.manager_validation_note) {
                            <p class="recommendation-note">{{ assignmentRecommendation.manager_validation_note }}</p>
                          }

                          <button type="button"
                                  mat-raised-button
                                  color="primary"
                                  [disabled]="!assignmentRecommendation.recommended_agent_id"
                                  (click)="validateAssignmentRecommendation()">
                            <mat-icon>verified</mat-icon>
                            Valider la recommandation IA
                          </button>
                        </div>
                      } @else if (assignmentRecommendationError) {
                        <p class="recommendation-error">{{ assignmentRecommendationError }}</p>
                      }

                      @if (recommendationCandidates.length > 0) {
                        <div class="recommendation-shortlist">
                          @for (agent of recommendationCandidates; track agent.id) {
                            <button type="button"
                                    class="recommended-agent-card"
                                    [class.recommended-agent-card--selected]="isSelectedAgent(agent.id)"
                                    [class.recommended-agent-card--ai]="isRecommendedAgent(agent.id)"
                                    (click)="selectRecommendedAgent(agent.id)">
                              <div class="recommended-agent-topline">
                                <strong>{{ getUserDisplayName(agent) }}</strong>
                                @if (isRecommendedAgent(agent.id)) {
                                  <span class="recommended-agent-badge">Reco IA</span>
                                }
                              </div>
                              <div class="recommended-agent-metrics">
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
                              </div>
                              @if (agent.recommendationReason) {
                                <span class="recommended-agent-reason">{{ agent.recommendationReason }}</span>
                              }
                            </button>
                          }
                        </div>
                      }

                      <div class="staff-row">
                        <mat-form-field appearance="outline" class="glass-input">
                          <mat-label>Client</mat-label>
                          <mat-select formControlName="clientId">
                            @for (client of clients; track client.id) {
                              <mat-option [value]="client.id">{{ client.name || client.companyName }}</mat-option>
                            }
                          </mat-select>
                          @if (ticketForm.get('clientId')?.hasError('required') && ticketForm.get('clientId')?.touched) {
                            <mat-error>Le client est obligatoire pour créer un ticket staff</mat-error>
                          }
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="glass-input">
                          <mat-label>Assigner à</mat-label>
                          <mat-select formControlName="assignedToId">
                            <mat-option [ngValue]="null">Non assigné</mat-option>
                            @for (user of users; track user.id) {
                              <mat-option [value]="user.id">{{ getUserDisplayName(user) }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                      </div>
                    </div>
                  }

                  <div class="form-footer">
                    <button mat-button type="button" class="cancel-btn" routerLink="/tickets">Annuler</button>
                    <button mat-raised-button color="primary" type="submit" 
                            class="submit-btn neon-btn"
                            [disabled]="saving">
                      @if (saving) {
                        <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
                      } @else {
                        <mat-icon>send</mat-icon>
                        <span>{{ isEditMode ? 'Enregistrer les modifications' : 'Envoyer le ticket' }}</span>
                      }
                    </button>
                  </div>
                  @if (submitAttempted && ticketForm.invalid) {
                    <p class="form-validation-summary">Vérifiez les champs obligatoires avant d'envoyer le ticket.</p>
                  }
                </form>
              </mat-card-content>
            </mat-card>
          </section>

          <aside class="sidebar-info">
            <mat-card class="info-widget glass-panel highlight-border sla-widget">
              <mat-card-content>
                <div class="widget-header">
                  <mat-icon class="neon-text">verified_user</mat-icon>
                  <h4>Service Level Agreement</h4>
                </div>
                <p>Délais de réponse garantis selon la matrice d'urgence et d'impact.</p>
                <div class="sla-list">
                  <div class="sla-item">
                    <span class="sla-dot super-critical"></span>
                    <span class="sla-name">Super Critique</span>
                    <span class="sla-val">2 Minutes</span>
                  </div>
                  <div class="sla-item">
                    <span class="sla-dot critical"></span>
                    <span class="sla-name">Critique</span>
                    <span class="sla-val">4 Heures</span>
                  </div>
                  <div class="sla-item">
                    <span class="sla-dot high"></span>
                    <span class="sla-name">Haute</span>
                    <span class="sla-val">8 Heures</span>
                  </div>
                  <div class="sla-item">
                    <span class="sla-dot medium"></span>
                    <span class="sla-name">Moyenne</span>
                    <span class="sla-val">24 Heures</span>
                  </div>
                  <div class="sla-item">
                    <span class="sla-dot low"></span>
                    <span class="sla-name">Basse</span>
                    <span class="sla-val">72 Heures</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="info-widget glass-panel tips-widget">
              <mat-card-content>
                <div class="widget-header">
                  <mat-icon class="text-orange">lightbulb</mat-icon>
                  <h4>Conseils rapides</h4>
                </div>
                <ul class="tips-list">
                  <li>
                    <mat-icon>auto_fix_high</mat-icon>
                    <p>Soyez aussi précis que possible pour une résolution rapide.</p>
                  </li>
                  <li>
                    <mat-icon>add_a_photo</mat-icon>
                    <p>Joignez des captures d'écran des messages d'erreur.</p>
                  </li>
                  <li>
                    <mat-icon>auto_stories</mat-icon>
                    <p>Consultez la base de connaissances en premier.</p>
                  </li>
                </ul>
              </mat-card-content>
            </mat-card>
          </aside>
        </div>
      }
    </div>
  `,
  styles: [`
    .ticket-form {
      padding: 32px 24px;
      max-width: 1400px;
      margin: 0 auto;
      height: 100%;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 300px;
      gap: 16px;
      color: var(--text-muted);
    }

    .layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 32px;
      align-items: start;
    }

    .page-header {
      margin-bottom: 24px;
      padding: 24px 32px;
      border-radius: 20px;
      
      .title-row {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 8px;
        
        .header-icon {
          font-size: 32px; width: 32px; height: 32px;
          filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.5));
        }
        
        h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
      }
      
      .subtitle { margin: 0; color: var(--text-muted); font-size: 15px; max-width: 600px; }
    }

    .form-card {
      border-radius: 20px !important;
      padding: 8px;
      
      .mat-mdc-card-content { padding: 24px !important; }
    }

    .form-section {
      margin-bottom: 32px;
      
      .section-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
        
        .section-icon { color: var(--text-muted); font-size: 20px; width: 20px; height: 20px; opacity: 0.7; }
        h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--text-main) !important; text-transform: uppercase; letter-spacing: 0.5px; }
      }
    }

    .full-width { width: 100%; }

    // Type Selection Cards
    .type-selection-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;

      > span {
        display: none;
      }
    }

    .type-card {
      position: relative;
      background: rgba(var(--sf-text-rgb), 0.03);
      border: 1px solid rgba(var(--sf-text-rgb), 0.08);
      border-radius: 16px;
      padding: 20px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;

      .type-icon-wrapper {
        width: 44px; height: 44px;
        border-radius: 12px;
        background: rgba(var(--sf-text-rgb), 0.05);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        transition: all 0.3s;
        
        mat-icon { font-size: 24px; }
      }

      .type-label { font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

      .active-indicator {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 3px;
        background: transparent;
        transition: all 0.3s;
      }

      &:hover {
        background: rgba(var(--sf-text-rgb), 0.06);
        border-color: rgba(var(--sf-text-rgb), 0.15);
        transform: translateY(-2px);
        
        .type-icon-wrapper { color: var(--text-main); background: rgba(var(--sf-text-rgb), 0.1); }
      }

      &.active {
        background: rgba(59, 130, 246, 0.08);
        border-color: var(--accent-blue);
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
        
        .type-icon-wrapper { color: var(--accent-blue); background: rgba(59, 130, 246, 0.15); }
        .type-label { color: var(--text-main); }
        .active-indicator { background: var(--accent-blue); box-shadow: 0 0 10px var(--accent-blue); }
      }
    }

    // Qualification
    .qualification-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .field-icon { color: var(--text-muted); margin-right: 8px; font-size: 20px; }

    .priority-insight-card {
      margin-top: 16px;
      padding: 20px;
      border-radius: 16px;
      background: rgba(var(--sf-text-rgb), 0.02) !important;

      > span {
        display: none;
      }
      
      .insight-content { display: flex; flex-direction: column; gap: 12px; }
      
      .priority-info {
        display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
        .insight-label { font-size: 13px; color: var(--text-muted); font-weight: 500; }
      }

      .priority-v-badge {
        display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 10px; font-weight: 800; font-size: 14px; text-transform: uppercase;
        &.low { color: #94a3b8; background: rgba(148, 163, 184, 0.1); }
        &.medium { color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
        &.high { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
        &.critical { color: #ef4444; background: rgba(239, 68, 68, 0.1); box-shadow: 0 0 15px rgba(239, 68, 68, 0.2); }
        .pulse-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .sla-insight {
        display: flex; align-items: center; gap: 8px; font-size: 13px; color: #10b981; font-weight: 600;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }

      .prime-priority-progress {
        display: grid;
        gap: 8px;
      }

      .progress-labels {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 12px;
        color: var(--text-muted);
      }
    }

    // Dropzone
    .prime-upload-shell {
      padding: 18px;
      border-radius: 16px;
      border: 1px dashed rgba(59, 130, 246, 0.24);
      background: rgba(59, 130, 246, 0.03);
    }

    .mobile-upload-hint {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 12px;
      color: var(--text-muted);
      font-size: 12px;
      flex-wrap: wrap;
    }

    .modern-dropzone {
      border: 2px dashed rgba(var(--sf-text-rgb), 0.1);
      border-radius: 16px;
      padding: 32px;
      background: rgba(var(--sf-text-rgb), 0.02);
      transition: all 0.3s;
      text-align: center;
      
      .dropzone-content {
        display: flex; flex-direction: column; align-items: center; gap: 12px;
        .icon-circle { 
          width: 56px; height: 56px; border-radius: 50%; background: rgba(59, 130, 246, 0.1); 
          display: flex; align-items: center; justify-content: center; color: var(--accent-blue);
          mat-icon { font-size: 28px; width: 28px; height: 28px; }
        }
        .drop-text { margin: 0; font-size: 15px; color: var(--text-main); font-weight: 500; }
        .text-link { background: none; border: none; color: var(--accent-blue); font-weight: 700; cursor: pointer; text-decoration: underline; padding: 0; }
        .file-hint { font-size: 12px; color: var(--text-muted); }
      }
      
      &:hover, &.drag-over { border-color: var(--accent-blue); background: rgba(59, 130, 246, 0.05); }
    }

    .selected-files-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .file-pill {
      display: inline-flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px; border-radius: 12px; font-size: 12px;
      .f-icon { font-size: 16px; width: 16px; height: 16px; color: var(--accent-blue); }
      .f-name { font-weight: 600; color: var(--text-main); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .remove-f { width: 24px; height: 24px; line-height: 24px; color: var(--text-muted); &:hover { color: var(--neon-red); } mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    }

    // Staff Section
    .staff-assignment-section {
      margin-top: 12px;
      padding: 24px;
      background: rgba(0, 0, 0, 0.2) !important;
      .staff-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    }

    .assignment-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .assignment-hint {
      margin: 0;
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1.5;
      max-width: 560px;
    }

    .recommendation-refresh-btn {
      white-space: nowrap;
    }

    .recommendation-loading {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 0;
      color: var(--text-main);
      font-size: 13px;
    }

    .assignment-recommendation-card {
      margin-bottom: 16px;
      padding: 18px;
      border-radius: 16px;
      border: 1px solid rgba(59, 130, 246, 0.2);
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.03));
    }

    .assignment-recommendation-card--fallback {
      border-color: rgba(245, 158, 11, 0.3);
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.03));
    }

    .assignment-recommendation-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;

      h4 {
        margin: 4px 0 0;
        font-size: 18px;
        color: var(--text-main);
      }
    }

    .recommendation-eyebrow {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--accent-blue);
    }

    .recommendation-confidence {
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.14);
      color: var(--accent-blue);
      font-size: 12px;
      font-weight: 700;
    }

    .recommendation-rationale,
    .recommendation-note,
    .recommendation-error {
      margin: 0;
      font-size: 13px;
      line-height: 1.55;
    }

    .recommendation-skill-match {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 12px 0 8px;
      color: var(--text-main);
      font-size: 13px;

      mat-icon {
        color: var(--accent-blue);
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .recommendation-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0;

      span {
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-muted);
        font-size: 11px;
        font-weight: 600;
      }
    }

    .recommendation-error {
      margin-bottom: 16px;
      color: #fca5a5;
    }

    .recommendation-shortlist {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .recommended-agent-card {
      background: rgba(var(--sf-text-rgb), 0.03);
      border: 1px solid rgba(var(--sf-text-rgb), 0.08);
      border-radius: 14px;
      padding: 14px;
      text-align: left;
      color: var(--text-main);
      cursor: pointer;
      transition: all 0.25s ease;

      &:hover {
        transform: translateY(-1px);
        border-color: rgba(59, 130, 246, 0.28);
        background: rgba(59, 130, 246, 0.06);
      }
    }

    .recommended-agent-card--selected {
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2) inset;
      background: rgba(59, 130, 246, 0.08);
    }

    .recommended-agent-card--ai {
      border-color: rgba(59, 130, 246, 0.2);
    }

    .recommended-agent-topline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;

      strong {
        font-size: 14px;
      }
    }

    .recommended-agent-badge {
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.14);
      color: var(--accent-blue);
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }

    .recommended-agent-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .recommended-agent-reason {
      display: block;
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .knowledge-assist-panel {
      padding: 20px;
      border-radius: 18px;
      display: grid;
      gap: 16px;
      background: linear-gradient(135deg, rgba(8, 26, 52, 0.88), rgba(7, 15, 34, 0.92));
    }

    .knowledge-assist-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;

      h4 {
        margin: 6px 0 8px;
        color: var(--text-main);
        font-size: 18px;
      }

      p {
        margin: 0;
        color: var(--text-muted);
        font-size: 13px;
        line-height: 1.55;
        max-width: 680px;
      }
    }

    .knowledge-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(34, 211, 238, 0.12);
      color: #67e8f9;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .knowledge-refresh-btn {
      white-space: nowrap;
    }

    .knowledge-state {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.03);
      color: var(--text-main);

      p {
        margin: 4px 0 0;
        color: var(--text-muted);
        font-size: 12px;
        line-height: 1.5;
      }
    }

    .knowledge-state--error {
      border-color: rgba(248, 113, 113, 0.22);
      background: rgba(127, 29, 29, 0.18);
      color: #fecaca;
    }

    .knowledge-state--success {
      border-color: rgba(16, 185, 129, 0.24);
      background: rgba(6, 95, 70, 0.2);
      color: #d1fae5;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .knowledge-state--neutral {
      border-color: rgba(59, 130, 246, 0.2);
    }

    .knowledge-results-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;

      strong {
        color: var(--text-main);
        font-size: 15px;
      }

      span {
        color: var(--text-muted);
        font-size: 12px;
      }
    }

    .knowledge-list {
      display: grid;
      gap: 14px;
    }

    .knowledge-card {
      padding: 18px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.035);
      display: grid;
      gap: 12px;
    }

    .knowledge-card__top {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
      flex-wrap: wrap;

      h5 {
        margin: 4px 0 0;
        color: var(--text-main);
        font-size: 16px;
      }
    }

    .knowledge-card__category {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.14);
      color: #93c5fd;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .knowledge-card__metrics {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;

      span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--text-muted);
        font-size: 11px;
        font-weight: 600;
      }

      mat-icon {
        width: 15px;
        height: 15px;
        font-size: 15px;
      }
    }

    .knowledge-card__summary {
      margin: 0;
      color: var(--text-main);
      font-size: 13px;
      line-height: 1.6;
    }

    .knowledge-card__tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      span {
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-muted);
        font-size: 11px;
        font-weight: 600;
      }
    }

    .knowledge-card__details {
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 10px;

      summary {
        cursor: pointer;
        color: #7dd3fc;
        font-size: 12px;
        font-weight: 700;
      }

      pre {
        margin: 12px 0 0;
        white-space: pre-wrap;
        font-family: inherit;
        font-size: 12px;
        line-height: 1.65;
        color: var(--text-main);
      }
    }

    .knowledge-card__actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .knowledge-help-btn {
      min-height: 44px;
    }

    .knowledge-anyway-btn {
      color: #cbd5e1;
      font-weight: 700;
    }

    .form-footer {
      display: flex; justify-content: flex-end; align-items: center; gap: 16px; margin-top: 32px; padding-top: 32px; border-top: 1px solid rgba(var(--sf-text-rgb), 0.1);
      .cancel-btn { height: 48px; padding: 0 24px; font-weight: 600; color: var(--text-muted); }
      .submit-btn { 
        height: 52px; padding: 0 32px; border-radius: 14px !important; font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 10px;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
    }

    // Sidebar
    .sidebar-info { display: flex; flex-direction: column; gap: 24px; }
    .info-widget {
      padding: 8px; border-radius: 20px !important;
      .mat-mdc-card-content { padding: 20px !important; }
      .widget-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; mat-icon { font-size: 22px; width: 22px; height: 22px; } h4 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main) !important; } }
      p { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 20px; }
    }

    .sla-list { display: grid; gap: 10px; }
    .sla-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(var(--sf-text-rgb), 0.03); border-radius: 12px; font-size: 13px; border: 1px solid rgba(var(--sf-text-rgb), 0.05);
      .sla-dot { width: 6px; height: 6px; border-radius: 50%; }
      .sla-name { font-weight: 600; flex: 1; }
      .sla-val { color: var(--text-muted); font-family: 'Space Grotesk', monospace; font-size: 11px; }
      .sla-dot.super-critical { background: #8B0000; box-shadow: 0 0 8px #8B0000; animation: pulse 1s infinite; }
      .sla-dot.critical { background: #ef4444; box-shadow: 0 0 6px #ef4444; }
      .sla-dot.high { background: #f59e0b; }
      .sla-dot.medium { background: #3b82f6; }
      .sla-dot.low { background: #10b981; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    }

    .tips-list {
      list-style: none; padding: 0; margin: 0; display: grid; gap: 16px;
      li {
        display: flex; gap: 12px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--accent-blue); opacity: 0.8; margin-top: 2px; }
        p { margin: 0; font-size: 13px; color: var(--text-main); font-weight: 500; }
      }
    }

    @media (max-width: 1100px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    }

    @media (max-width: 600px) {
      .ticket-form { padding: 16px; }
      .page-header { padding: 20px; h1 { font-size: 22px; } }
      .sidebar-info { grid-template-columns: 1fr; }
      .qualification-row { grid-template-columns: 1fr; }
      .staff-row { grid-template-columns: 1fr; }
      .knowledge-assist-top,
      .knowledge-card__top,
      .knowledge-card__actions,
      .knowledge-state--success { grid-template-columns: 1fr; }
      .knowledge-assist-top,
      .knowledge-card__top,
      .knowledge-card__actions,
      .knowledge-state--success {
        display: grid;
      }
      .form-footer { flex-direction: column-reverse; .submit-btn { width: 100%; } .cancel-btn { width: 100%; } }
    }
  `]
})
export class TicketFormComponent implements OnInit, OnDestroy {
  ticketForm!: FormGroup;
  isEditMode = false;
  ticketId?: number;
  loading = true;
  saving = false;
  isClient = false;
  isDragging = false;
  calculatedPriority: TicketPriority | null = null;
  slaEstimate: string | null = null;
  initialAssignedAgentId: number | null = null;
  ticketReference: string | null = null;

  clients: Client[] = [];
  users: User[] = [];
  selectedFiles: File[] = [];
  recommendationCandidates: UserSummary[] = [];
  assignmentRecommendation: AIAssignmentRecommendation | null = null;
  assignmentRecommendationLoading = false;
  assignmentRecommendationError = '';
  knowledgeSuggestions: KnowledgeArticle[] = [];
  knowledgeSuggestionsLoading = false;
  knowledgeSuggestionsError = '';
  knowledgeSuggestionsDismissed = false;
  knowledgeSolvedArticleId: number | null = null;
  knowledgeHelpfulArticleIds = new Set<number>();
  submitAttempted = false;
  private formSubscriptions: Subscription[] = [];

  ticketTypes = [
    { value: 'INCIDENT', label: 'Incident' },
    { value: 'BUG', label: 'Bug' },
    { value: 'FEATURE_REQUEST', label: 'Demande d\'évolution' },
    { value: 'QUESTION', label: 'Question' },
    { value: 'TASK', label: 'Tâche' }
  ];

  severities = [
    { value: 'LOW', label: 'Faible' },
    { value: 'MEDIUM', label: 'Moyenne' },
    { value: 'HIGH', label: 'Élevée' },
    { value: 'CRITICAL', label: 'Critique' },
    { value: 'SUPER_CRITICAL', label: 'Super Critique (2min)' }
  ];

  impacts = [
    { value: 'LOW', label: 'Faible' },
    { value: 'MEDIUM', label: 'Moyen' },
    { value: 'HIGH', label: 'Fort' },
    { value: 'CRITICAL', label: 'Critique' }
  ];

  quickTypes = [
    { value: 'BUG', label: 'BUG', icon: 'bug_report' },
    { value: 'FEATURE_REQUEST', label: 'FEATURE', icon: 'auto_awesome' },
    { value: 'QUESTION', label: 'QUESTION', icon: 'help_outline' },
    { value: 'TASK', label: 'TASK', icon: 'task_alt' }
  ];

  severityUi = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'CRITICAL', label: 'Urgent' },
    { value: 'SUPER_CRITICAL', label: 'Super Critical' }
  ];

  availableCategories = [
    { value: 'Authentification', label: 'Authentification' },
    { value: 'Interface', label: 'Interface' },
    { value: 'Reporting', label: 'Reporting' },
    { value: 'Support', label: 'Support' },
    { value: 'Réseau', label: 'Réseau' },
    { value: 'Sécurité', label: 'Sécurité' },
    { value: 'Logiciel', label: 'Logiciel' },
    { value: 'Matériel', label: 'Matériel' },
    { value: 'Base de données', label: 'Base de données' },
    { value: 'Email', label: 'Email' },
    { value: 'Compte', label: 'Compte' }
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private ticketService: TicketService,
    private clientService: ClientService,
    private userService: UserService,
    private authService: AuthService,
    private aiService: AIService,
    private knowledgeBaseService: KnowledgeBaseService,
    private snackBar: MatSnackBar,
    private messageService: MessageService
  ) {
    this.isClient = this.authService.isClient();
    this.initForm();
  }

  ngOnInit(): void {
    this.ticketId = this.route.snapshot.params['id'];
    this.isEditMode = !!this.ticketId && this.route.snapshot.url.some(s => s.path === 'edit');
    this.setupRecommendationWatcher();
    this.setupKnowledgeSuggestionWatcher();

    this.loadData();
  }

  ngOnDestroy(): void {
    this.formSubscriptions.forEach(subscription => subscription.unsubscribe());
  }

  initForm(): void {
    this.ticketForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      description: [''],
      clientId: [null, this.isClient ? [] : Validators.required],
      type: ['INCIDENT', Validators.required],
      severity: ['MEDIUM'],
      urgency: ['MEDIUM', Validators.required],
      impact: ['MEDIUM', Validators.required],
      category: [''],
      assignedToId: [null],
      contactName: [''],
      contactEmail: ['', Validators.email],
      contactPhone: ['']
    });
    this.calculatePriority();
  }

  async loadData(): Promise<void> {
    try {
      // Pour les non-CLIENT, charger les clients et utilisateurs
      if (!this.isClient) {
        const [clientsPage, usersPage] = await Promise.all([
          this.clientService.getClients({ page: 0, size: 100 }).toPromise(),
          this.userService.getUsers({ page: 0, size: 100 }).toPromise()
        ]);

        this.clients = clientsPage?.content || [];
        this.users = (usersPage?.content || []).filter(user => this.isAssignableUser(user));
      }

      // If edit mode, load ticket data
      if (this.isEditMode && this.ticketId) {
        const ticket = await this.ticketService.getTicket(this.ticketId).toPromise();
        if (ticket) {
          this.ticketReference = ticket.reference || null;
          this.ticketForm.patchValue({
            title: ticket.title,
            description: ticket.description,
            clientId: ticket.client?.id,
            type: ticket.type || 'INCIDENT',
            severity: ticket.severity || 'MEDIUM',
            impact: ticket.impact || 'MEDIUM',
            category: ticket.category,
            assignedToId: ticket.assignedTo?.id,
            contactName: ticket.contactName,
            contactEmail: ticket.contactEmail,
            contactPhone: ticket.contactPhone
          });
          this.initialAssignedAgentId = ticket.assignedTo?.id ?? null;
        }
      }

      this.loading = false;
      if (!this.isClient) {
        this.refreshAssignmentRecommendationPreview();
      } else if (!this.isEditMode) {
        this.refreshKnowledgeSuggestions();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.loading = false;
    }
  }

  onSubmit(): void {
    this.submitAttempted = true;

    if (this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      this.showToast('warn', 'Formulaire incomplet', this.getFormValidationMessage());
      this.snackBar.open(this.getFormValidationMessage(), 'Fermer', { duration: 3500 });
      return;
    }

    this.saving = true;
    const formData = this.ticketForm.value;

    // Build ticket data matching TicketCreateDTO
    const ticketData: any = {
      title: formData.title,
      description: formData.description || '',
      type: formData.type,
      severity: formData.severity,
      impact: formData.impact,
      category: formData.category || null
    };

    // Pour les non-CLIENT, inclure le clientId
    if (!this.isClient && formData.clientId) {
      ticketData.clientId = formData.clientId;
    }

    const assignedAgentId = !this.isClient ? (formData.assignedToId ?? null) : null;

    const request = this.isEditMode && this.ticketId
      ? this.ticketService.updateTicket(this.ticketId, ticketData).pipe(
        switchMap((updated) => {
          if (this.shouldAssignAfterSave(assignedAgentId)) {
            return this.ticketService.assignTicket(updated.id, assignedAgentId!, this.getAssignmentSource(assignedAgentId));
          }
          return of(updated);
        })
      )
      : this.ticketService.createTicket(ticketData).pipe(
        switchMap((created) => {
          if (!this.isClient && assignedAgentId) {
            return this.ticketService.assignTicket(created.id, assignedAgentId, this.getAssignmentSource(assignedAgentId));
          }
          return of(created);
        })
      );

    request.subscribe({
      next: async (ticket) => {
        try {
          if (!this.isEditMode && this.selectedFiles.length > 0) {
            await Promise.all(
              this.selectedFiles.map(file => firstValueFrom(this.ticketService.uploadAttachment(ticket.id, file)))
            );
          }
          this.saving = false;
          this.snackBar.open(
            this.isEditMode ? 'Ticket mis à jour avec succès' : 'Ticket créé avec succès',
            'Fermer',
            { duration: 3000 }
          );
          this.showToast(
            'success',
            this.isEditMode ? 'Ticket mis Ã  jour' : 'Ticket crÃ©Ã©',
            this.selectedFiles.length > 0
              ? 'Le ticket et ses piÃ¨ces jointes sont prÃªts pour le workflow.'
              : 'Le ticket a Ã©tÃ© transmis au support.'
          );
          this.router.navigate(['/tickets', ticket.id]);
        } catch (uploadError) {
          this.saving = false;
          console.error('Error uploading attachments:', uploadError);
          this.showToast('warn', 'Ticket enregistrÃ©', 'Les piÃ¨ces jointes n\'ont pas toutes pu Ãªtre transfÃ©rÃ©es.');
          this.snackBar.open('Ticket créé, mais erreur upload pièces jointes', 'Fermer', { duration: 4000 });
          this.router.navigate(['/tickets', ticket.id]);
        }
      },
      error: (error) => {
        this.saving = false;
        console.error('Error saving ticket:', error);
        const message = error?.error?.message || error?.message || 'Erreur lors de l\'enregistrement';
        this.showToast('error', 'Enregistrement impossible', message);
        this.snackBar.open(message, 'Fermer', { duration: 4000 });
      }
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer?.files) {
      this.handleFiles(event.dataTransfer.files);
    }
  }

  onFilesSelected(event: any): void {
    if (event.target.files) {
      this.handleFiles(event.target.files);
    }
  }

  onPrimeFilesSelected(event: any): void {
    const files = event?.files as File[] | undefined;
    if (!files?.length) {
      return;
    }

    this.handleFiles(files as unknown as FileList);
  }

  private handleFiles(files: FileList): void {
    const maxSize = 10 * 1024 * 1024;
    for (let i = 0; i < files.length; i++) {
      const currentFile = files[i];
      if (!currentFile) {
        continue;
      }

      if (currentFile.size <= maxSize) {
        const alreadySelected = this.selectedFiles.some(file =>
          file.name === currentFile.name && file.size === currentFile.size && file.lastModified === currentFile.lastModified
        );

        if (!alreadySelected) {
          this.selectedFiles.push(currentFile);
        }
      } else {
        this.showToast('warn', 'Fichier refusÃ©', `${currentFile.name} dÃ©passe 10 Mo.`);
        this.snackBar.open(`Fichier ${currentFile.name} trop volumineux (> 10 Mo)`, 'Fermer', { duration: 3000 });
      }
    }
  }

  removeFile(file: File): void {
    this.selectedFiles = this.selectedFiles.filter(f => f !== file);
  }

  setType(type: string): void {
    this.ticketForm.patchValue({ type });
  }

  isTypeSelected(type: string): boolean {
    return this.ticketForm.get('type')?.value === type;
  }

  onQualificationChange(): void {
    this.calculatePriority();
  }

  calculatePriority(): void {
    const urgency = this.ticketForm.get('urgency')?.value as TicketPriority || 'MEDIUM';
    const impact = this.ticketForm.get('impact')?.value as TicketPriority || 'MEDIUM';

    const priority = this.computePriorityFromMatrix(urgency, impact);

    this.calculatedPriority = priority;
    this.ticketForm.patchValue({ severity: priority }, { emitEvent: false });

    // SLA Estimation
    const slaMinutes: Record<TicketPriority, number> = {
      'SUPER_CRITICAL': 2,
      'CRITICAL': 240,
      'HIGH': 480,
      'MEDIUM': 1440,
      'LOW': 4320
    };
    const minutes = slaMinutes[priority] || 1440;
    const eta = new Date(Date.now() + minutes * 60 * 1000);
    const label = minutes < 60 ? `${minutes}min` : `${minutes / 60}h`;
    this.slaEstimate = `${eta.toLocaleDateString('fr-FR')} ${eta.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (dans ${label})`;
  }

  getPriorityProgressValue(): number {
    switch (this.calculatedPriority) {
      case 'LOW':
        return 20;
      case 'MEDIUM':
        return 45;
      case 'HIGH':
        return 70;
      case 'CRITICAL':
        return 90;
      case 'SUPER_CRITICAL':
        return 100;
      default:
        return 0;
    }
  }

  private computePriorityFromMatrix(urgency: TicketPriority, impact: TicketPriority): TicketPriority {
    const matrix: Record<TicketPriority, Record<TicketPriority, TicketPriority>> = {
      LOW: {
        LOW: 'LOW',
        MEDIUM: 'LOW',
        HIGH: 'MEDIUM',
        CRITICAL: 'MEDIUM',
        SUPER_CRITICAL: 'HIGH'
      },
      MEDIUM: {
        LOW: 'LOW',
        MEDIUM: 'MEDIUM',
        HIGH: 'HIGH',
        CRITICAL: 'HIGH',
        SUPER_CRITICAL: 'CRITICAL'
      },
      HIGH: {
        LOW: 'MEDIUM',
        MEDIUM: 'HIGH',
        HIGH: 'HIGH',
        CRITICAL: 'CRITICAL',
        SUPER_CRITICAL: 'SUPER_CRITICAL'
      },
      CRITICAL: {
        LOW: 'MEDIUM',
        MEDIUM: 'HIGH',
        HIGH: 'CRITICAL',
        CRITICAL: 'CRITICAL',
        SUPER_CRITICAL: 'SUPER_CRITICAL'
      },
      SUPER_CRITICAL: {
        LOW: 'HIGH',
        MEDIUM: 'CRITICAL',
        HIGH: 'SUPER_CRITICAL',
        CRITICAL: 'SUPER_CRITICAL',
        SUPER_CRITICAL: 'SUPER_CRITICAL'
      }
    };
    return matrix[urgency]?.[impact] || 'MEDIUM';
  }

  getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      'LOW': 'Basse',
      'MEDIUM': 'Moyenne',
      'HIGH': 'Haute',
      'CRITICAL': 'Critique',
      'SUPER_CRITICAL': 'Super Critique'
    };
    return labels[priority] || priority;
  }

  refreshKnowledgeSuggestions(manual = false): void {
    if (!this.isClient || this.isEditMode) {
      return;
    }

    if (!this.canRequestKnowledgeSuggestions()) {
      this.knowledgeSuggestions = [];
      this.knowledgeSuggestionsError = '';
      this.knowledgeSuggestionsLoading = false;
      this.knowledgeSuggestionsDismissed = false;
      this.knowledgeSolvedArticleId = null;

      if (manual) {
        this.snackBar.open('Ajoutez un titre ou plus de contexte pour lancer la recherche dans la base de connaissance.', 'Fermer', { duration: 3200 });
      }
      return;
    }

    this.knowledgeSuggestionsLoading = true;
    this.knowledgeSuggestionsError = '';
    this.knowledgeSuggestionsDismissed = false;

    this.knowledgeBaseService.suggestForDraft(this.buildKnowledgeSuggestionRequest()).subscribe({
      next: (articles) => {
        this.knowledgeSuggestions = articles || [];
        this.knowledgeSuggestionsLoading = false;
      },
      error: (error) => {
        console.error('Error loading knowledge suggestions:', error);
        this.knowledgeSuggestionsLoading = false;
        this.knowledgeSuggestions = [];
        this.knowledgeSuggestionsError = 'Impossible de charger les suggestions de la base de connaissance pour le moment.';

        if (manual) {
          this.snackBar.open(this.knowledgeSuggestionsError, 'Fermer', { duration: 3500 });
        }
      }
    });
  }

  canRequestKnowledgeSuggestions(): boolean {
    const title = (this.ticketForm.get('title')?.value || '').trim();
    const description = (this.ticketForm.get('description')?.value || '').trim();
    const category = (this.ticketForm.get('category')?.value || '').trim();
    return title.length >= 5 || description.length >= 20 || category.length >= 3;
  }

  hasMarkedKnowledgeArticleHelpful(articleId?: number): boolean {
    if (!articleId) {
      return false;
    }
    return this.knowledgeHelpfulArticleIds.has(articleId);
  }

  markKnowledgeArticleHelpful(article: KnowledgeArticle, helpful: boolean): void {
    if (!article.id || this.hasMarkedKnowledgeArticleHelpful(article.id)) {
      return;
    }

    this.knowledgeBaseService.markHelpful(article.id, helpful).subscribe({
      next: () => {
        this.knowledgeHelpfulArticleIds.add(article.id!);
        this.knowledgeSolvedArticleId = article.id!;
        this.showToast('success', 'Solution retenue', 'Parfait. Vous pouvez fermer cette page si le besoin est couvert, ou crÃ©er tout de mÃªme un ticket si le problÃ¨me persiste.');
      },
      error: (error) => {
        console.error('Error marking knowledge article helpful:', error);
        this.showToast('warn', 'Retour non enregistrÃ©', "L'article reste consultable, mais le feedback utile n'a pas pu Ãªtre transmis.");
      }
    });
  }

  submitAfterKnowledgeReview(): void {
    if (this.ticketForm.invalid) {
      this.onSubmit();
      return;
    }
    this.knowledgeSuggestionsDismissed = true;
    this.onSubmit();
  }

  refreshAssignmentRecommendationPreview(manual = false): void {
    if (this.isClient) {
      return;
    }

    if (!this.canRequestAssignmentRecommendation()) {
      this.assignmentRecommendation = null;
      this.recommendationCandidates = [];
      this.assignmentRecommendationError = '';
      this.assignmentRecommendationLoading = false;

      if (manual) {
        this.snackBar.open('Renseignez au moins le titre du ticket pour obtenir une recommandation IA', 'Fermer', { duration: 3000 });
      }
      return;
    }

    this.assignmentRecommendationLoading = true;
    this.assignmentRecommendationError = '';

    this.aiService.getAssignmentRecommendationPreview(this.buildAssignmentRecommendationPreviewRequest()).subscribe({
      next: (recommendation) => {
        this.assignmentRecommendation = recommendation;
        this.recommendationCandidates = recommendation.candidates?.slice(0, 5) || [];
        this.assignmentRecommendationLoading = false;
      },
      error: (error) => {
        console.error('Error loading assignment recommendation preview:', error);
        this.assignmentRecommendationLoading = false;
        this.recommendationCandidates = [];
        this.assignmentRecommendation = null;
        this.assignmentRecommendationError = 'La recommandation IA est indisponible pour le moment.';

        if (manual) {
          this.snackBar.open(this.assignmentRecommendationError, 'Fermer', { duration: 3500 });
        }
      }
    });
  }

  validateAssignmentRecommendation(): void {
    if (!this.assignmentRecommendation?.recommended_agent_id) {
      return;
    }

    this.ticketForm.patchValue({ assignedToId: this.assignmentRecommendation.recommended_agent_id });
  }

  selectRecommendedAgent(agentId: number): void {
    this.ticketForm.patchValue({ assignedToId: agentId });
  }

  isRecommendedAgent(agentId: number): boolean {
    return this.assignmentRecommendation?.recommended_agent_id === agentId;
  }

  isSelectedAgent(agentId: number): boolean {
    return this.ticketForm.get('assignedToId')?.value === agentId;
  }

  getUserDisplayName(user: any): string {
    const fullName = (user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim()).trim();
    return fullName || user.username || 'Utilisateur';
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

  private setupRecommendationWatcher(): void {
    if (this.isClient) {
      return;
    }

    const subscription = this.ticketForm.valueChanges
      .pipe(debounceTime(500))
      .subscribe(() => {
        if (!this.loading) {
          this.refreshAssignmentRecommendationPreview();
        }
      });

    this.formSubscriptions.push(subscription);
  }

  private setupKnowledgeSuggestionWatcher(): void {
    if (!this.isClient || this.isEditMode) {
      return;
    }

    const subscription = this.ticketForm.valueChanges
      .pipe(debounceTime(600))
      .subscribe(() => {
        if (!this.loading) {
          this.knowledgeSolvedArticleId = null;
          this.refreshKnowledgeSuggestions();
        }
      });

    this.formSubscriptions.push(subscription);
  }

  private canRequestAssignmentRecommendation(): boolean {
    const title = (this.ticketForm.get('title')?.value || '').trim();
    return title.length >= 5;
  }

  private buildKnowledgeSuggestionRequest() {
    return {
      title: this.ticketForm.get('title')?.value || '',
      description: this.ticketForm.get('description')?.value || '',
      category: this.ticketForm.get('category')?.value || this.ticketForm.get('type')?.value || ''
    };
  }

  private buildAssignmentRecommendationPreviewRequest() {
    return {
      ticketId: this.ticketId,
      reference: this.ticketReference || 'BROUILLON',
      title: this.ticketForm.get('title')?.value || '',
      description: this.ticketForm.get('description')?.value || '',
      type: this.ticketForm.get('type')?.value || '',
      severity: this.ticketForm.get('severity')?.value || '',
      impact: this.ticketForm.get('impact')?.value || '',
      category: this.ticketForm.get('category')?.value || '',
      assignedAgentId: this.ticketForm.get('assignedToId')?.value || null
    };
  }

  private shouldAssignAfterSave(assignedAgentId: number | null): boolean {
    if (this.isClient || !assignedAgentId) {
      return false;
    }

    if (!this.isEditMode) {
      return true;
    }

    return assignedAgentId !== this.initialAssignedAgentId;
  }

  private getAssignmentSource(assignedAgentId: number | null): 'MANUAL' | 'AI_RECOMMENDATION' | undefined {
    if (!assignedAgentId) {
      return undefined;
    }

    return this.assignmentRecommendation?.recommended_agent_id === assignedAgentId
      ? 'AI_RECOMMENDATION'
      : 'MANUAL';
  }

  private isAssignableUser(user: User): boolean {
    const role = user.role || (Array.isArray(user.roles) ? user.roles[0] : undefined);
    return role === 'SUPPORT_AGENT' || role === 'SUPPORT_MANAGER';
  }

  private getFormValidationMessage(): string {
    if (!this.isClient && this.ticketForm.get('clientId')?.hasError('required')) {
      return 'Sélectionnez un client avant de créer le ticket.';
    }

    if (this.ticketForm.get('title')?.hasError('required')) {
      return 'Le titre du ticket est obligatoire.';
    }

    if (this.ticketForm.get('title')?.hasError('minlength')) {
      return 'Le titre du ticket doit contenir au moins 5 caractères.';
    }

    return 'Le formulaire contient des champs invalides.';
  }

  private showToast(severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail, life: 3500 });
  }
}
