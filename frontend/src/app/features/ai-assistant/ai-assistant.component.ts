import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom, Observable } from 'rxjs';

import {
  AIService,
  AIStatus,
  AITrends,
  TicketService
} from '@core/services';
import { Ticket } from '@core/models';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  duration?: number;
  model?: string;
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatTabsModule,
    MatSnackBarModule
  ],
  template: `
    <div class="ai-wrapper">
      <div class="glow-grid-bg"></div>
      <div class="scanline-overlay"></div>

      <div class="ai-container sf-animate-fade-in">
        <!-- Hero Header -->
        <div class="ai-hero">
          <div class="hud-corner hud-corner--tl"></div>
          <div class="hud-corner hud-corner--tr"></div>
          <div class="hud-corner hud-corner--bl"></div>
          <div class="hud-corner hud-corner--br"></div>
          <div class="hero-content">
            <div class="hero-text-block">
              <div class="hero-kicker">
                <span class="kicker-dot" [class.online]="status?.ollama_available"></span>
                <span>AI ASSISTANT</span>
                <span class="kicker-line"></span>
              </div>
              <h1 class="hero-title">
                Assistant
                <span class="hero-title-accent">Intelligence Artificielle</span>
              </h1>
              <p class="hero-subtitle">
                Analyse, diagnostic et suggestions propulsés par
                <strong>{{ status?.model || '...' }}</strong>
              </p>
            </div>
            <div class="status-badges">
              <div class="status-badge" [class.online]="status?.ollama_available" [class.offline]="status && !status.ollama_available">
                <span class="badge-dot"></span>
                <span>{{ status?.ollama_available ? 'ONLINE' : 'OFFLINE' }}</span>
              </div>
              @if (status?.available_models?.length) {
                <div class="model-chips">
                  @for (m of status!.available_models; track m) {
                    <span class="model-chip" [class.active]="m === status!.model">{{ m }}</span>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="ai-grid">
          <!-- LEFT: Chat Panel -->
          <div class="chat-panel glass-panel">
            <div class="panel-header">
              <mat-icon>chat</mat-icon>
              <span>Chat IA</span>
              <button mat-icon-button matTooltip="Effacer la conversation" (click)="clearChat()" class="clear-btn">
                <mat-icon>delete_sweep</mat-icon>
              </button>
            </div>

            <div class="chat-messages" #chatContainer>
              @if (chatMessages.length === 0) {
                <div class="chat-empty">
                  <mat-icon class="empty-icon">psychology</mat-icon>
                  <p>Posez une question à l'assistant IA</p>
                  <div class="suggestion-chips">
                    <button mat-stroked-button class="suggestion-chip" (click)="askSuggestion('Quelles sont les tendances des tickets cette semaine ?')">
                      <mat-icon>trending_up</mat-icon> Tendances tickets
                    </button>
                    <button mat-stroked-button class="suggestion-chip" (click)="askSuggestion('Comment améliorer le temps de résolution ?')">
                      <mat-icon>speed</mat-icon> Améliorer résolution
                    </button>
                    <button mat-stroked-button class="suggestion-chip" (click)="askSuggestion('Quels tickets nécessitent une attention urgente ?')">
                      <mat-icon>priority_high</mat-icon> Tickets urgents
                    </button>
                  </div>
                </div>
              }
              @for (msg of chatMessages; track msg.timestamp) {
                <div class="chat-msg" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
                  <div class="msg-avatar">
                    <mat-icon>{{ msg.role === 'user' ? 'person' : 'smart_toy' }}</mat-icon>
                  </div>
                  <div class="msg-bubble">
                    <div class="msg-content">{{ msg.content }}</div>
                    @if (msg.duration) {
                      <div class="msg-meta">
                        <span>{{ msg.model }}</span>
                        <span>{{ msg.duration | number:'1.1-1' }}s</span>
                      </div>
                    }
                  </div>
                </div>
              }
              @if (chatLoading) {
                <div class="chat-msg assistant">
                  <div class="msg-avatar">
                    <mat-icon>smart_toy</mat-icon>
                  </div>
                  <div class="msg-bubble typing">
                    <div class="typing-dots">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              }
            </div>

            <div class="chat-input-bar">
              <mat-form-field appearance="outline" class="chat-input-field">
                <input matInput
                  placeholder="Posez votre question..."
                  [(ngModel)]="chatInput"
                  (keydown.enter)="sendMessage()"
                  [disabled]="chatLoading">
              </mat-form-field>
              <button mat-fab class="send-btn" (click)="sendMessage()" [disabled]="chatLoading || !chatInput.trim()">
                <mat-icon>send</mat-icon>
              </button>
            </div>

            <!-- Ticket context input -->
            <div class="ticket-context">
              <mat-form-field appearance="outline" class="ticket-id-field">
                <mat-label>ID ou référence ticket (contexte optionnel)</mat-label>
                <input matInput [(ngModel)]="contextTicketInput" placeholder="ex: 13, 1013 ou SF-1013">
              </mat-form-field>
            </div>
          </div>

          <!-- RIGHT: Tools Panel -->
          <div class="tools-panel">
            <!-- Ticket Tools -->
            <div class="glass-panel tool-card">
              <div class="panel-header">
                <mat-icon>build</mat-icon>
                <span>Outils Ticket</span>
              </div>
              <div class="tool-input-row">
                <mat-form-field appearance="outline" class="tool-ticket-field">
                  <mat-label>ID ou référence du ticket</mat-label>
                  <input matInput [(ngModel)]="toolTicketInput" placeholder="ex: 13, 1013 ou SF-1013">
                </mat-form-field>
              </div>
              <div class="tool-buttons">
                <button mat-stroked-button class="tool-btn tool-btn--analyze" (click)="analyzeTicket()" [disabled]="!hasTicketLookup(toolTicketInput) || toolLoading">
                  <mat-icon>analytics</mat-icon> Analyser
                </button>
                <button mat-stroked-button class="tool-btn tool-btn--diagnose" (click)="diagnoseTicket()" [disabled]="!hasTicketLookup(toolTicketInput) || toolLoading">
                  <mat-icon>biotech</mat-icon> Diagnostiquer
                </button>
                <button mat-stroked-button class="tool-btn tool-btn--suggest" (click)="suggestResponse()" [disabled]="!hasTicketLookup(toolTicketInput) || toolLoading">
                  <mat-icon>lightbulb</mat-icon> Suggérer Réponse
                </button>
                <button mat-stroked-button class="tool-btn tool-btn--escalation" (click)="escalationSummary()" [disabled]="!hasTicketLookup(toolTicketInput) || toolLoading">
                  <mat-icon>trending_up</mat-icon> Résumé Escalade
                </button>
              </div>
            </div>

            <!-- Trends -->
            <div class="glass-panel tool-card">
              <div class="panel-header">
                <mat-icon>insights</mat-icon>
                <span>Tendances</span>
              </div>
              <div class="tool-input-row">
                <mat-form-field appearance="outline" class="tool-ticket-field">
                  <mat-label>Période (jours)</mat-label>
                  <input matInput type="number" [(ngModel)]="trendsDays" placeholder="30">
                </mat-form-field>
                <button mat-stroked-button class="tool-btn tool-btn--trends" (click)="loadTrends()" [disabled]="toolLoading">
                  <mat-icon>query_stats</mat-icon> Analyser
                </button>
              </div>
            </div>

            <!-- Results Panel -->
            @if (toolLoading) {
              <div class="glass-panel result-card">
                <div class="result-loading">
                  <mat-spinner diameter="40"></mat-spinner>
                  <span>L'IA réfléchit...</span>
                </div>
              </div>
            }

            @if (toolResult) {
              <div class="glass-panel result-card sf-animate-fade-in">
                <div class="panel-header">
                  <mat-icon>{{ toolResultIcon }}</mat-icon>
                  <span>{{ toolResultTitle }}</span>
                  @if (toolResultDuration) {
                    <span class="result-duration">{{ toolResultDuration | number:'1.1-1' }}s</span>
                  }
                </div>
                <div class="result-body">
                  <pre class="result-text">{{ toolResult }}</pre>
                </div>
              </div>
            }

            @if (trendsData) {
              <div class="glass-panel result-card sf-animate-fade-in">
                <div class="panel-header">
                  <mat-icon>insights</mat-icon>
                  <span>Résultats Tendances</span>
                  <span class="result-duration">{{ trendsData.duration_s | number:'1.1-1' }}s</span>
                </div>
                <div class="trends-metrics">
                  <div class="trend-metric">
                    <span class="trend-value">{{ trendsData.metrics_summary.total }}</span>
                    <span class="trend-label">Total</span>
                  </div>
                  <div class="trend-metric">
                    <span class="trend-value trend-green">{{ trendsData.metrics_summary.resolved }}</span>
                    <span class="trend-label">Résolus</span>
                  </div>
                  <div class="trend-metric">
                    <span class="trend-value trend-red">{{ (trendsData.metrics_summary.breach_rate * 100) | number:'1.0-0' }}%</span>
                    <span class="trend-label">Taux Breach</span>
                  </div>
                  <div class="trend-metric">
                    <span class="trend-value trend-orange">{{ (trendsData.metrics_summary.escalation_rate * 100) | number:'1.0-0' }}%</span>
                    <span class="trend-label">Taux Escalade</span>
                  </div>
                </div>
                <div class="result-body">
                  <pre class="result-text">{{ trendsData.insights }}</pre>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; min-height: 100vh; }

    .ai-wrapper {
      position: relative;
      min-height: 100vh;
      background: linear-gradient(135deg, #0a0e1a 0%, #101829 40%, #0d1520 100%);
      padding: 0 0 40px 0;
      overflow-x: hidden;
    }

    .glow-grid-bg {
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background-image:
        linear-gradient(rgba(0,255,231,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,255,231,0.03) 1px, transparent 1px);
      background-size: 60px 60px;
    }

    .scanline-overlay {
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background: repeating-linear-gradient(
        0deg, transparent, transparent 2px, rgba(0,255,231,0.008) 2px, rgba(0,255,231,0.008) 4px
      );
    }

    /* Hero */
    .ai-hero {
      position: relative;
      padding: 40px 48px 32px;
      margin: 0 24px 32px;
      border-radius: 24px;
      background: linear-gradient(135deg, rgba(0,255,231,0.06) 0%, rgba(120,80,255,0.04) 100%);
      border: 1px solid rgba(0,255,231,0.12);
      overflow: hidden;
    }

    .hud-corner {
      position: absolute; width: 20px; height: 20px;
      border-color: rgba(0,255,231,0.3); border-style: solid; border-width: 0;
    }
    .hud-corner--tl { top: 8px; left: 8px; border-top-width: 2px; border-left-width: 2px; }
    .hud-corner--tr { top: 8px; right: 8px; border-top-width: 2px; border-right-width: 2px; }
    .hud-corner--bl { bottom: 8px; left: 8px; border-bottom-width: 2px; border-left-width: 2px; }
    .hud-corner--br { bottom: 8px; right: 8px; border-bottom-width: 2px; border-right-width: 2px; }

    .hero-content {
      display: flex; justify-content: space-between; align-items: center;
      position: relative; z-index: 1;
    }

    .hero-kicker {
      display: flex; align-items: center; gap: 10px;
      font-size: 11px; font-weight: 700; letter-spacing: 3px;
      color: rgba(0,255,231,0.7); text-transform: uppercase; margin-bottom: 12px;
    }
    .kicker-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: rgba(255,60,60,0.8);
      box-shadow: 0 0 8px rgba(255,60,60,0.5);
    }
    .kicker-dot.online {
      background: rgba(0,255,150,0.8);
      box-shadow: 0 0 8px rgba(0,255,150,0.5);
      animation: pulse-dot 2s ease-in-out infinite;
    }
    .kicker-line {
      flex: 1; height: 1px;
      background: linear-gradient(90deg, rgba(0,255,231,0.3), transparent);
    }

    .hero-title {
      font-size: 32px; font-weight: 800; color: #fff; margin: 0 0 8px;
      line-height: 1.2;
    }
    .hero-title-accent {
      display: block;
      background: linear-gradient(135deg, #00ffe7, #7c5cff);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }

    .hero-subtitle {
      font-size: 14px; color: rgba(255,255,255,0.5); margin: 0;
    }
    .hero-subtitle strong {
      color: rgba(0,255,231,0.8);
    }

    .status-badges {
      display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
    }
    .status-badge {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px; border-radius: 20px; font-size: 11px; font-weight: 700;
      letter-spacing: 2px; border: 1px solid rgba(255,255,255,0.1);
      background: rgba(0,0,0,0.3);
    }
    .status-badge.online { border-color: rgba(0,255,150,0.3); color: #00ff96; }
    .status-badge.offline { border-color: rgba(255,60,60,0.3); color: #ff3c3c; }
    .badge-dot {
      width: 8px; height: 8px; border-radius: 50%;
    }
    .online .badge-dot {
      background: #00ff96; box-shadow: 0 0 8px rgba(0,255,150,0.6);
      animation: pulse-dot 2s ease-in-out infinite;
    }
    .offline .badge-dot {
      background: #ff3c3c; box-shadow: 0 0 8px rgba(255,60,60,0.6);
    }

    .model-chips {
      display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;
    }
    .model-chip {
      padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: 600;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.5); letter-spacing: 0.5px;
    }
    .model-chip.active {
      background: rgba(0,255,231,0.1); border-color: rgba(0,255,231,0.3);
      color: #00ffe7;
    }

    /* Main Grid */
    .ai-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding: 0 24px;
      position: relative; z-index: 1;
    }

    /* Glass Panel */
    .glass-panel {
      background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      backdrop-filter: blur(20px);
      overflow: hidden;
    }

    .panel-header {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.9);
      letter-spacing: 0.5px;
    }
    .panel-header mat-icon {
      color: #00ffe7; font-size: 20px; width: 20px; height: 20px;
    }
    .panel-header .clear-btn {
      margin-left: auto;
    }
    .panel-header .clear-btn mat-icon {
      color: rgba(255,255,255,0.4);
      font-size: 18px; width: 18px; height: 18px;
    }

    /* Chat Panel */
    .chat-panel {
      display: flex; flex-direction: column;
      height: calc(100vh - 280px);
      min-height: 500px;
    }

    .chat-messages {
      flex: 1; overflow-y: auto; padding: 16px 20px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .chat-messages::-webkit-scrollbar { width: 4px; }
    .chat-messages::-webkit-scrollbar-track { background: transparent; }
    .chat-messages::-webkit-scrollbar-thumb {
      background: rgba(0,255,231,0.2); border-radius: 2px;
    }

    .chat-empty {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 16px;
      color: rgba(255,255,255,0.3);
    }
    .empty-icon {
      font-size: 64px; width: 64px; height: 64px;
      color: rgba(0,255,231,0.15);
    }
    .chat-empty p {
      font-size: 15px; margin: 0;
    }
    .suggestion-chips {
      display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
      margin-top: 8px;
    }
    .suggestion-chip {
      font-size: 11px !important;
      color: rgba(0,255,231,0.7) !important;
      border-color: rgba(0,255,231,0.2) !important;
      text-transform: none !important;
    }
    .suggestion-chip mat-icon {
      font-size: 14px; width: 14px; height: 14px; margin-right: 4px;
    }

    /* Chat Messages */
    .chat-msg {
      display: flex; gap: 10px; max-width: 85%;
    }
    .chat-msg.user { align-self: flex-end; flex-direction: row-reverse; }
    .chat-msg.assistant { align-self: flex-start; }

    .msg-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .user .msg-avatar {
      background: linear-gradient(135deg, #7c5cff, #b44cff);
    }
    .assistant .msg-avatar {
      background: linear-gradient(135deg, #00ffe7, #00b4d8);
    }
    .msg-avatar mat-icon {
      font-size: 16px; width: 16px; height: 16px; color: #fff;
    }

    .msg-bubble {
      padding: 12px 16px; border-radius: 16px;
      font-size: 13px; line-height: 1.6;
    }
    .user .msg-bubble {
      background: linear-gradient(135deg, rgba(124,92,255,0.2), rgba(180,76,255,0.15));
      border: 1px solid rgba(124,92,255,0.2);
      color: rgba(255,255,255,0.9);
      border-bottom-right-radius: 4px;
    }
    .assistant .msg-bubble {
      background: linear-gradient(135deg, rgba(0,255,231,0.08), rgba(0,180,216,0.06));
      border: 1px solid rgba(0,255,231,0.12);
      color: rgba(255,255,255,0.85);
      border-bottom-left-radius: 4px;
    }

    .msg-meta {
      display: flex; gap: 10px; margin-top: 6px;
      font-size: 10px; color: rgba(255,255,255,0.3);
    }

    .msg-bubble.typing {
      padding: 16px 20px;
    }
    .typing-dots {
      display: flex; gap: 5px;
    }
    .typing-dots span {
      width: 7px; height: 7px; border-radius: 50%;
      background: rgba(0,255,231,0.5);
      animation: typing-bounce 1.4s ease-in-out infinite;
    }
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

    /* Chat Input */
    .chat-input-bar {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px 8px;
    }
    .chat-input-field {
      flex: 1;
    }
    .chat-input-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255,255,255,0.03) !important;
      border-radius: 16px !important;
    }
    .chat-input-field ::ng-deep .mdc-notched-outline__leading,
    .chat-input-field ::ng-deep .mdc-notched-outline__notch,
    .chat-input-field ::ng-deep .mdc-notched-outline__trailing {
      border-color: rgba(0,255,231,0.15) !important;
    }
    .chat-input-field ::ng-deep .mat-mdc-input-element {
      color: rgba(255,255,255,0.9) !important;
      font-size: 13px;
    }
    .chat-input-field ::ng-deep .mat-mdc-form-field-focus-indicator { display: none; }

    .send-btn {
      width: 44px !important; height: 44px !important;
      background: linear-gradient(135deg, #00ffe7, #00b4d8) !important;
      box-shadow: 0 4px 20px rgba(0,255,231,0.3) !important;
    }
    .send-btn mat-icon { color: #0a0e1a; }
    .send-btn:disabled {
      background: rgba(255,255,255,0.05) !important;
      box-shadow: none !important;
    }
    .send-btn:disabled mat-icon { color: rgba(255,255,255,0.2); }

    .ticket-context {
      padding: 0 16px 12px;
    }
    .ticket-id-field {
      width: 200px;
    }
    .ticket-id-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255,255,255,0.02) !important;
    }
    .ticket-id-field ::ng-deep .mdc-notched-outline__leading,
    .ticket-id-field ::ng-deep .mdc-notched-outline__notch,
    .ticket-id-field ::ng-deep .mdc-notched-outline__trailing {
      border-color: rgba(255,255,255,0.08) !important;
    }
    .ticket-id-field ::ng-deep .mat-mdc-form-field-label {
      color: rgba(255,255,255,0.3) !important;
    }
    .ticket-id-field ::ng-deep .mat-mdc-input-element {
      color: rgba(255,255,255,0.7) !important; font-size: 12px;
    }

    /* Tools Panel */
    .tools-panel {
      display: flex; flex-direction: column; gap: 20px;
    }

    .tool-card {
      padding-bottom: 16px;
    }

    .tool-input-row {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 20px 0;
    }
    .tool-ticket-field {
      width: 160px;
    }
    .tool-ticket-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255,255,255,0.03) !important;
    }
    .tool-ticket-field ::ng-deep .mdc-notched-outline__leading,
    .tool-ticket-field ::ng-deep .mdc-notched-outline__notch,
    .tool-ticket-field ::ng-deep .mdc-notched-outline__trailing {
      border-color: rgba(255,255,255,0.1) !important;
    }
    .tool-ticket-field ::ng-deep .mat-mdc-form-field-label {
      color: rgba(255,255,255,0.3) !important;
    }
    .tool-ticket-field ::ng-deep .mat-mdc-input-element {
      color: rgba(255,255,255,0.8) !important;
    }

    .tool-buttons {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 10px; padding: 12px 20px;
    }

    .tool-btn {
      font-size: 12px !important; font-weight: 600 !important;
      text-transform: none !important;
      border-radius: 12px !important;
      padding: 8px 12px !important;
      height: auto !important;
    }
    .tool-btn mat-icon {
      font-size: 16px; width: 16px; height: 16px; margin-right: 6px;
    }
    .tool-btn--analyze {
      color: #00ffe7 !important; border-color: rgba(0,255,231,0.25) !important;
    }
    .tool-btn--diagnose {
      color: #7c5cff !important; border-color: rgba(124,92,255,0.25) !important;
    }
    .tool-btn--suggest {
      color: #ffd600 !important; border-color: rgba(255,214,0,0.25) !important;
    }
    .tool-btn--escalation {
      color: #ff6b6b !important; border-color: rgba(255,107,107,0.25) !important;
    }
    .tool-btn--trends {
      color: #00b4d8 !important; border-color: rgba(0,180,216,0.25) !important;
    }
    .tool-btn:disabled {
      color: rgba(255,255,255,0.15) !important;
      border-color: rgba(255,255,255,0.05) !important;
    }

    /* Result Card */
    .result-card {
      overflow: hidden;
    }
    .result-loading {
      display: flex; align-items: center; gap: 16px;
      padding: 32px 20px;
      color: rgba(255,255,255,0.5); font-size: 13px;
    }
    .result-loading mat-spinner ::ng-deep circle {
      stroke: #00ffe7;
    }

    .result-duration {
      margin-left: auto;
      font-size: 11px; font-weight: 400;
      color: rgba(0,255,231,0.6);
      padding: 2px 8px; border-radius: 8px;
      background: rgba(0,255,231,0.08);
    }

    .result-body {
      padding: 16px 20px;
    }
    .result-text {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 12px; line-height: 1.7;
      color: rgba(255,255,255,0.75);
      white-space: pre-wrap; word-wrap: break-word;
      margin: 0;
      max-height: 300px; overflow-y: auto;
    }
    .result-text::-webkit-scrollbar { width: 3px; }
    .result-text::-webkit-scrollbar-thumb {
      background: rgba(0,255,231,0.2); border-radius: 2px;
    }

    /* Trends Metrics */
    .trends-metrics {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 12px; padding: 16px 20px 0;
    }
    .trend-metric {
      display: flex; flex-direction: column; align-items: center;
      padding: 12px 8px; border-radius: 12px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
    }
    .trend-value {
      font-size: 22px; font-weight: 800; color: #fff;
    }
    .trend-value.trend-green { color: #00ff96; }
    .trend-value.trend-red { color: #ff6b6b; }
    .trend-value.trend-orange { color: #ffa726; }
    .trend-label {
      font-size: 10px; color: rgba(255,255,255,0.4);
      margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;
    }

    /* Animations */
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    @keyframes typing-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    .sf-animate-fade-in {
      animation: sfFadeIn 0.5s ease-out;
    }
    @keyframes sfFadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .ai-grid { grid-template-columns: 1fr; }
      .chat-panel { height: auto; min-height: 400px; max-height: 60vh; }
      .ai-hero { margin: 0 12px 24px; padding: 24px; }
      .hero-content { flex-direction: column; align-items: flex-start; gap: 16px; }
      .status-badges { align-items: flex-start; }
      .ai-grid { padding: 0 12px; }
    }
  `]
})
export class AIAssistantComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatContainer') chatContainer!: ElementRef;

  status: AIStatus | null = null;
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  chatLoading = false;
  contextTicketInput = '';

  toolTicketInput = '';
  toolLoading = false;
  toolResult: string | null = null;
  toolResultIcon = 'info';
  toolResultTitle = '';
  toolResultDuration: number | null = null;

  trendsDays = 30;
  trendsData: AITrends | null = null;

  private shouldScrollChat = false;

  constructor(
    private aiService: AIService,
    private ticketService: TicketService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollChat) {
      this.scrollChatToBottom();
      this.shouldScrollChat = false;
    }
  }

  loadStatus(): void {
    this.aiService.getStatus().subscribe({
      next: (s) => this.status = s,
      error: () => this.status = {
        status: 'error', ollama_available: false, model: 'N/A',
        available_models: [], checked_at: new Date().toISOString()
      }
    });
  }

  // Chat
  async sendMessage(): Promise<void> {
    const text = this.chatInput.trim();
    if (!text || this.chatLoading) return;

    let contextTicketId: number | undefined;
    try {
      contextTicketId = await this.resolveOptionalTicketId(this.contextTicketInput);
    } catch (error) {
      this.showLookupError(error);
      return;
    }

    this.chatMessages.push({
      role: 'user', content: text, timestamp: new Date()
    });
    this.chatInput = '';
    this.chatLoading = true;
    this.shouldScrollChat = true;

    const history = this.chatMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    this.aiService.chat(text, contextTicketId, history).subscribe({
      next: (res) => {
        this.chatMessages.push({
          role: 'assistant', content: res.answer, timestamp: new Date(),
          duration: res.duration_s, model: res.model
        });
        this.chatLoading = false;
        this.shouldScrollChat = true;
      },
      error: (err) => {
        this.chatMessages.push({
          role: 'assistant',
          content: 'Erreur: Impossible de contacter l\'IA. Vérifiez que le service est en ligne.',
          timestamp: new Date()
        });
        this.chatLoading = false;
        this.shouldScrollChat = true;
      }
    });
  }

  askSuggestion(text: string): void {
    this.chatInput = text;
    this.sendMessage();
  }

  clearChat(): void {
    this.chatMessages = [];
  }

  // Ticket Tools
  async analyzeTicket(): Promise<void> {
    await this.runTicketTool(
      (ticketId) => this.aiService.analyzeTicket(ticketId),
      (res) => {
        this.toolResult = res.raw || JSON.stringify(res.analysis, null, 2);
        this.toolResultIcon = 'analytics';
        this.toolResultTitle = `Analyse Ticket #${res.ticket_reference || res.ticket_id}`;
        this.toolResultDuration = res.duration_s;
      }
    );
  }

  async diagnoseTicket(): Promise<void> {
    await this.runTicketTool(
      (ticketId) => this.aiService.diagnoseTicket(ticketId),
      (res) => {
        this.toolResult = res.diagnosis;
        this.toolResultIcon = 'biotech';
        this.toolResultTitle = `Diagnostic Ticket #${res.ticket_reference || res.ticket_id}`;
        this.toolResultDuration = res.duration_s;
      }
    );
  }

  async suggestResponse(): Promise<void> {
    await this.runTicketTool(
      (ticketId) => this.aiService.suggestResponse(ticketId),
      (res) => {
        this.toolResult = res.suggestions;
        this.toolResultIcon = 'lightbulb';
        this.toolResultTitle = `Suggestion Ticket #${res.ticket_reference || res.ticket_id}`;
        this.toolResultDuration = res.duration_s;
      }
    );
  }

  async escalationSummary(): Promise<void> {
    await this.runTicketTool(
      (ticketId) => this.aiService.escalationSummary(ticketId),
      (res) => {
        this.toolResult = res.summary;
        this.toolResultIcon = 'trending_up';
        this.toolResultTitle = `Escalade Ticket #${res.ticket_reference || res.ticket_id} (Niveau ${res.escalation_level})`;
        this.toolResultDuration = res.duration_s;
      }
    );
  }

  loadTrends(): void {
    this.toolLoading = true;
    this.toolResult = null;
    this.trendsData = null;
    this.aiService.analyzeTrends(this.trendsDays).subscribe({
      next: (res) => {
        this.trendsData = res;
        this.toolLoading = false;
      },
      error: (err) => this.handleToolError(err)
    });
  }

  private handleToolError(err: any): void {
    this.toolLoading = false;
    this.toolResult = 'Erreur: ' + (err.error?.message || err.message || 'Service IA indisponible');
    this.toolResultIcon = 'error';
    this.toolResultTitle = 'Erreur';
    this.toolResultDuration = null;
    this.snackBar.open('Erreur lors de l\'appel IA', 'OK', {
      duration: 4000,
      panelClass: ['snack-error']
    });
  }

  hasTicketLookup(value: string | null | undefined): boolean {
    return this.normalizeTicketLookup(value).length > 0;
  }

  private async runTicketTool<T extends { ticket_id: number; ticket_reference?: string }>(
    action: (ticketId: number) => Observable<T>,
    onSuccess: (result: T) => void
  ): Promise<void> {
    if (!this.hasTicketLookup(this.toolTicketInput) || this.toolLoading) {
      return;
    }

    this.toolLoading = true;
    this.toolResult = null;
    this.trendsData = null;

    try {
      const ticket = await this.resolveTicket(this.toolTicketInput);
      const result = await firstValueFrom(action(ticket.id));
      this.toolTicketInput = ticket.reference || String(ticket.id);
      onSuccess(result);
      this.toolLoading = false;
    } catch (error) {
      this.handleToolError(error);
    }
  }

  private async resolveOptionalTicketId(input: string): Promise<number | undefined> {
    if (!this.hasTicketLookup(input)) {
      return undefined;
    }

    const ticket = await this.resolveTicket(input);
    this.contextTicketInput = ticket.reference || String(ticket.id);
    return ticket.id;
  }

  private async resolveTicket(input: string): Promise<Ticket> {
    const normalized = this.normalizeTicketLookup(input);
    if (!normalized) {
      throw new Error('Saisissez un ID ou une référence de ticket.');
    }

    const numericCandidate = /^\d+$/.test(normalized) ? Number(normalized) : null;
    const referenceCandidates = this.buildReferenceCandidates(normalized);

    if (numericCandidate !== null) {
      try {
        return await firstValueFrom(this.ticketService.getTicketById(numericCandidate));
      } catch (error) {
        if (!this.isLookupMiss(error)) {
          throw error;
        }
      }
    }

    for (const reference of referenceCandidates) {
      try {
        return await firstValueFrom(this.ticketService.getTicketByReference(reference));
      } catch (error) {
        if (!this.isLookupMiss(error)) {
          throw error;
        }
      }
    }

    throw new Error(`Ticket introuvable: ${normalized}`);
  }

  private buildReferenceCandidates(normalized: string): string[] {
    const candidates = new Set<string>();

    if (normalized.startsWith('SF-')) {
      candidates.add(normalized);
    } else if (normalized.startsWith('SF')) {
      candidates.add(`SF-${normalized.slice(2)}`);
      candidates.add(normalized);
    } else {
      candidates.add(`SF-${normalized}`);
      candidates.add(normalized);
    }

    return Array.from(candidates);
  }

  private normalizeTicketLookup(value: string | null | undefined): string {
    return (value || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  private isLookupMiss(error: any): boolean {
    const message = String(error?.error?.message || error?.message || '').toLowerCase();
    return error?.status === 404
      || error?.status === 400
      || (error?.status === 500 && message.includes('ticket'));
  }

  private showLookupError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Ticket introuvable';
    this.snackBar.open(message, 'OK', {
      duration: 4000,
      panelClass: ['snack-error']
    });
  }

  private scrollChatToBottom(): void {
    try {
      const el = this.chatContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
