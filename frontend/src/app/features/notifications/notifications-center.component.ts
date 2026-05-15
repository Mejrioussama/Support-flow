import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Notification, Page, Ticket, TicketResolveRequest, isSlaNotification, parseSuggestedActions } from '@core/models';
import { AuthService, NotificationService, TicketService } from '@core/services';
import { AssignDialogComponent, AssignDialogData, AssignDialogResult } from '../tickets/assign-dialog/assign-dialog.component';
import { EscalateDialogComponent, EscalateDialogResult } from '../tickets/escalate-dialog/escalate-dialog.component';
import { ResolveDialogComponent, ResolveDialogResult } from '../tickets/resolve-dialog/resolve-dialog.component';
import { firstValueFrom } from 'rxjs';

type NotificationFilter = 'all' | 'unread' | 'sla' | 'assignment' | 'customer' | 'system';
type NotificationGroupMode = 'flat' | 'ticket' | 'type';

@Component({
  selector: 'app-notifications-center',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  template: `
    <div class="notifications-page">
      <section class="hero-card">
        <div class="hero-copy">
          <a routerLink="/dashboard" class="crumb">Tableau de bord</a>
          <span class="eyebrow">Signal Center</span>
          <h1>Notifications et alertes SupportFlow</h1>
          <p>
            Suivez les signaux SLA, les assignations, les reponses client et les actions systeme
            depuis un centre d alertes clair, filtrable et oriente action.
          </p>

          <div class="hero-stats">
            <div class="hero-stat">
              <span class="hero-stat__label">Non lues</span>
              <strong>{{ unreadCount }}</strong>
            </div>
            <div class="hero-stat">
              <span class="hero-stat__label">SLA / urgentes</span>
              <strong>{{ slaCount }}</strong>
            </div>
            <div class="hero-stat">
              <span class="hero-stat__label">Action requise</span>
              <strong>{{ actionRequiredCount }}</strong>
            </div>
            <div class="hero-stat">
              <span class="hero-stat__label">Reponses client</span>
              <strong>{{ customerResponseCount }}</strong>
            </div>
          </div>
        </div>

        <div class="hero-actions">
          <button mat-stroked-button class="action-btn" type="button" (click)="refresh()">
            <mat-icon>refresh</mat-icon>
            Actualiser
          </button>
          <button mat-stroked-button class="action-btn" type="button" (click)="markAllAsRead()" [disabled]="unreadCount === 0">
            <mat-icon>done_all</mat-icon>
            Tout lire
          </button>
          <button mat-raised-button class="action-btn action-btn--primary" type="button" (click)="deleteReadNotifications()" [disabled]="readCount === 0">
            <mat-icon>auto_delete</mat-icon>
            Nettoyer les lues
          </button>
        </div>
      </section>

      <section class="control-grid">
        <article class="panel-card filters-card">
          <div class="section-head">
            <div class="section-icon">
              <mat-icon>tune</mat-icon>
            </div>
            <div>
              <h2>Filtres intelligents</h2>
              <p>Affinez le centre d alertes par type, priorite operationnelle et recherche texte.</p>
            </div>
          </div>

          <div class="filter-pills">
            @for (filter of filterOptions; track filter.value) {
              <button
                type="button"
                class="filter-pill"
                [class.active]="selectedFilter === filter.value"
                (click)="selectedFilter = filter.value">
                <mat-icon>{{ filter.icon }}</mat-icon>
                {{ filter.label }}
                <span class="filter-pill__count">{{ getFilterCount(filter.value) }}</span>
              </button>
            }
          </div>

          <div class="filter-row">
            <mat-form-field appearance="outline">
              <mat-label>Recherche</mat-label>
              <input matInput [(ngModel)]="searchTerm" placeholder="Ticket, message, type..." />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Etat</mat-label>
              <mat-select [(ngModel)]="readState">
                <mat-option value="all">Toutes</mat-option>
                <mat-option value="unread">Non lues</mat-option>
                <mat-option value="read">Lues</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="group-pills">
            @for (mode of groupModes; track mode.value) {
              <button
                type="button"
                class="group-pill"
                [class.active]="groupMode === mode.value"
                (click)="groupMode = mode.value">
                <mat-icon>{{ mode.icon }}</mat-icon>
                {{ mode.label }}
              </button>
            }
          </div>
        </article>

        <article class="panel-card side-card">
          <span class="eyebrow">Pilotage</span>
          <strong>{{ filteredNotifications.length }} notification{{ filteredNotifications.length > 1 ? 's' : '' }} visibles</strong>
          <p>{{ getNarrative() }}</p>

          <div class="side-list">
            <div class="side-row">
              <span>Derniere recharge</span>
              <strong>{{ lastRefreshedAt | date:'HH:mm:ss' }}</strong>
            </div>
            <div class="side-row">
              <span>Page chargee</span>
              <strong>{{ notifications.length }} / {{ totalElements }}</strong>
            </div>
            <div class="side-row">
              <span>Focus courant</span>
              <strong>{{ getFilterLabel(selectedFilter) }}</strong>
            </div>
          </div>
        </article>
      </section>

      <section class="panel-card stream-card">
        <div class="section-head section-head--space">
          <div class="section-head__copy">
            <div class="section-icon section-icon--violet">
              <mat-icon>notifications_active</mat-icon>
            </div>
            <div>
              <h2>Flux de notifications</h2>
              <p>Chaque ligne donne le contexte ticket, le signal metier et les actions rapides utiles.</p>
            </div>
          </div>

          <div class="stream-actions">
            <button mat-stroked-button class="action-btn action-btn--compact" type="button" (click)="toggleSelectAllVisible()"
              [disabled]="filteredNotifications.length === 0 || bulkActionRunning">
              <mat-icon>{{ allVisibleSelected ? 'deselect' : 'select_all' }}</mat-icon>
              {{ allVisibleSelected ? 'Tout deselectionner' : 'Tout selectionner' }}
            </button>
            <button mat-stroked-button class="action-btn action-btn--compact" type="button" (click)="previousPage()" [disabled]="pageNumber === 0 || loading">
              <mat-icon>chevron_left</mat-icon>
              Precedent
            </button>
            <button mat-stroked-button class="action-btn action-btn--compact" type="button" (click)="nextPage()" [disabled]="isLastPage || loading">
              Suivant
              <mat-icon>chevron_right</mat-icon>
            </button>
          </div>
        </div>

        @if (selectedCount > 0) {
          <div class="bulk-toolbar">
            <div class="bulk-toolbar__summary">
              <span class="status-pill status-pill--unread">
                <mat-icon>checklist</mat-icon>
                {{ selectedCount }} selectionnee{{ selectedCount > 1 ? 's' : '' }}
              </span>
              @if (eligibleSelectedManagerReviewCount > 0) {
                <span class="status-pill status-pill--soft">
                  <mat-icon>warning</mat-icon>
                  {{ eligibleSelectedManagerReviewCount }} eligibles revue manager
                </span>
              }
            </div>

            <div class="bulk-toolbar__actions">
              <button mat-stroked-button class="action-btn action-btn--compact" type="button"
                (click)="bulkMarkSelectedRead()" [disabled]="bulkActionRunning">
                <mat-icon>{{ bulkActionRunning === 'read' ? 'hourglass_top' : 'done_all' }}</mat-icon>
                Tout lire
              </button>
              <button mat-stroked-button class="action-btn action-btn--compact" type="button"
                (click)="bulkManagerReviewSelected()"
                [disabled]="bulkActionRunning || eligibleSelectedManagerReviewCount === 0 || !authService.isManager()">
                <mat-icon>{{ bulkActionRunning === 'manager-review' ? 'hourglass_top' : 'supervisor_account' }}</mat-icon>
                Revue manager groupee
              </button>
              <button mat-stroked-button class="action-btn action-btn--compact action-btn--danger" type="button"
                (click)="bulkDeleteSelected()" [disabled]="bulkActionRunning">
                <mat-icon>{{ bulkActionRunning === 'delete' ? 'hourglass_top' : 'delete_sweep' }}</mat-icon>
                Supprimer
              </button>
              <button mat-stroked-button class="action-btn action-btn--compact" type="button"
                (click)="clearSelection()" [disabled]="bulkActionRunning">
                <mat-icon>clear_all</mat-icon>
                Vider
              </button>
            </div>
          </div>
        }

        @if (loading) {
          <div class="loading-shell">
            <mat-spinner diameter="46"></mat-spinner>
            <p>Chargement des notifications...</p>
          </div>
        } @else if (filteredNotifications.length === 0) {
          <div class="empty-shell">
            <mat-icon>notifications_none</mat-icon>
            <strong>Aucune notification pour ce filtre</strong>
            <p>Changez le filtre ou rechargez pour verifier les derniers signaux.</p>
          </div>
        } @else {
          <div class="notification-stream">
            @for (group of groupedNotifications; track group.key) {
              @if (groupMode !== 'flat') {
                <div class="group-block">
                  <div class="group-block__header">
                    <div>
                      <h3>{{ group.label }}</h3>
                      <p>{{ group.notifications.length }} notification{{ group.notifications.length > 1 ? 's' : '' }} dans ce groupe</p>
                    </div>
                    <div class="group-block__actions">
                      <span class="status-pill status-pill--soft">
                        <mat-icon>{{ groupMode === 'ticket' ? 'confirmation_number' : 'label' }}</mat-icon>
                        {{ groupMode === 'ticket' ? 'Regroupe par ticket' : 'Regroupe par type' }}
                      </span>
                      <button mat-stroked-button class="action-btn action-btn--compact" type="button" (click)="toggleGroup(group.key)">
                        <mat-icon>{{ isGroupCollapsed(group.key) ? 'expand_more' : 'expand_less' }}</mat-icon>
                        {{ isGroupCollapsed(group.key) ? 'Ouvrir' : 'Replier' }}
                      </button>
                    </div>
                  </div>
                </div>
              }

              @if (groupMode === 'flat' || !isGroupCollapsed(group.key)) {
              @for (notification of group.notifications; track notification.id) {
                <article class="notification-card" [class.notification-card--unread]="isUnread(notification)" [class.notification-card--selected]="isSelected(notification)">
                  <div class="notification-card__main">
                    <button
                      type="button"
                      class="selection-toggle"
                      [class.selection-toggle--active]="isSelected(notification)"
                      (click)="toggleSelected(notification)"
                      [disabled]="bulkActionRunning">
                      <mat-icon>{{ isSelected(notification) ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                    </button>
                    <div class="notification-card__signal" [class]="getToneClass(notification)">
                      <mat-icon>{{ getIcon(notification) }}</mat-icon>
                    </div>

                    <div class="notification-card__body">
                      <div class="notification-card__meta">
                        <div class="notification-card__heading">
                          <h3>{{ notification.title || getFallbackTitle(notification) }}</h3>
                          <span class="status-pill" [class.status-pill--unread]="isUnread(notification)">
                            {{ isUnread(notification) ? 'Non lue' : 'Lue' }}
                          </span>
                          <span class="status-pill status-pill--soft">{{ getTypeLabel(notification) }}</span>
                          @if (notification.actionRequired) {
                            <span class="status-pill status-pill--danger">Action requise</span>
                          }
                        </div>

                        <div class="notification-card__refs">
                          @if (notification.ticketReference) {
                            <span class="inline-ref">
                              <mat-icon>confirmation_number</mat-icon>
                              {{ notification.ticketReference }}
                            </span>
                          }
                          <span class="inline-ref">
                            <mat-icon>schedule</mat-icon>
                            {{ notification.createdAt | date:'dd/MM/yyyy HH:mm' }}
                          </span>
                          @if (notification.slaPercentage !== undefined && notification.slaPercentage !== null) {
                            <span class="inline-ref inline-ref--warn">
                              <mat-icon>speed</mat-icon>
                              {{ notification.slaPercentage }}% SLA
                            </span>
                          }
                        </div>
                      </div>

                      <p class="notification-card__message">{{ notification.message }}</p>

                      @if (getSuggestedActions(notification).length > 0) {
                        <div class="chips-row">
                          @for (action of getSuggestedActions(notification); track action) {
                            <span class="suggested-chip">{{ action }}</span>
                          }
                        </div>
                      }

                      @if (notification.recommendedAgent) {
                        <div class="assistant-note">
                          <mat-icon>smart_toy</mat-icon>
                          <span>Recommandation manager: {{ notification.recommendedAgent }}</span>
                        </div>
                      }
                    </div>
                  </div>

                  <div class="notification-card__actions">
                    <button
                      mat-stroked-button
                      class="action-btn action-btn--compact"
                      type="button"
                      (click)="openNotification(notification)">
                      <mat-icon>open_in_new</mat-icon>
                      Ouvrir
                    </button>

                    <button
                      mat-stroked-button
                      class="action-btn action-btn--compact"
                      type="button"
                      (click)="markAsRead(notification)"
                      [disabled]="!isUnread(notification)">
                      <mat-icon>done</mat-icon>
                      Lire
                    </button>

                    <button
                      mat-stroked-button
                      class="action-btn action-btn--compact"
                      type="button"
                      (click)="openComments(notification)"
                      [disabled]="!notification.ticketId">
                      <mat-icon>chat</mat-icon>
                      Communications
                    </button>

                    @if (canOfferAction(notification, 'take-charge')) {
                      <button
                        mat-raised-button
                        class="action-btn action-btn--compact action-btn--primary"
                        type="button"
                        (click)="takeChargeFromNotification(notification)"
                        [disabled]="isActionRunning(notification, 'take-charge')">
                        <mat-icon>{{ isActionRunning(notification, 'take-charge') ? 'hourglass_top' : 'bolt' }}</mat-icon>
                        Prendre
                      </button>
                    }

                    @if (canOfferAction(notification, 'resolve')) {
                      <button
                        mat-stroked-button
                        class="action-btn action-btn--compact"
                        type="button"
                        (click)="resolveFromNotification(notification)"
                        [disabled]="isActionRunning(notification, 'resolve')">
                        <mat-icon>{{ isActionRunning(notification, 'resolve') ? 'hourglass_top' : 'task_alt' }}</mat-icon>
                        Resoudre
                      </button>
                    }

                    @if (canOfferAction(notification, 'assign')) {
                      <button
                        mat-stroked-button
                        class="action-btn action-btn--compact"
                        type="button"
                        (click)="assignFromNotification(notification)"
                        [disabled]="isActionRunning(notification, 'assign')">
                        <mat-icon>{{ isActionRunning(notification, 'assign') ? 'hourglass_top' : 'person_add' }}</mat-icon>
                        Assigner
                      </button>
                    }

                    @if (canOfferAction(notification, 'manager-review')) {
                      <button
                        mat-stroked-button
                        class="action-btn action-btn--compact"
                        type="button"
                        (click)="requestManagerReviewFromNotification(notification)"
                        [disabled]="isActionRunning(notification, 'manager-review')">
                        <mat-icon>{{ isActionRunning(notification, 'manager-review') ? 'hourglass_top' : 'supervisor_account' }}</mat-icon>
                        Revue
                      </button>
                    }

                    @if (canOfferAction(notification, 'escalate')) {
                      <button
                        mat-stroked-button
                        class="action-btn action-btn--compact"
                        type="button"
                        (click)="escalateFromNotification(notification)"
                        [disabled]="isActionRunning(notification, 'escalate')">
                        <mat-icon>{{ isActionRunning(notification, 'escalate') ? 'hourglass_top' : 'trending_up' }}</mat-icon>
                        Escalader
                      </button>
                    }

                    <button
                      mat-stroked-button
                      class="action-btn action-btn--compact action-btn--danger"
                      type="button"
                      (click)="deleteNotification(notification)">
                      <mat-icon>delete</mat-icon>
                      Supprimer
                    </button>
                  </div>
                </article>
              }
              }
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .notifications-page {
      --page-bg: #07101f;
      --panel: rgba(10, 18, 34, 0.82);
      --panel-soft: rgba(12, 24, 45, 0.76);
      --line: rgba(96, 165, 250, 0.18);
      --text: #e8eefb;
      --muted: #93a1bb;
      min-height: calc(100vh - 72px);
      padding: 24px;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(84, 212, 255, 0.1), transparent 30%),
        radial-gradient(circle at top right, rgba(139, 124, 255, 0.12), transparent 28%),
        linear-gradient(180deg, #06101f 0%, #071322 100%);
      font-family: 'Manrope', sans-serif;
    }

    .hero-card,
    .panel-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      backdrop-filter: blur(18px);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
    }

    .hero-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      padding: 28px;
      margin-bottom: 22px;
      background:
        radial-gradient(circle at 15% 20%, rgba(84, 212, 255, 0.12), transparent 30%),
        linear-gradient(135deg, rgba(9, 18, 34, 0.96), rgba(7, 16, 31, 0.9));
    }

    .crumb,
    .eyebrow {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.18em;
    }

    .crumb {
      text-decoration: none;
      color: #8fdcff;
      margin-bottom: 8px;
    }

    .eyebrow {
      color: rgba(148, 197, 255, 0.86);
      margin-bottom: 10px;
    }

    .hero-card h1,
    .section-head h2 {
      margin: 0 0 10px;
      letter-spacing: -0.04em;
      font-family: 'Space Grotesk', sans-serif;
    }

    .hero-card h1 {
      font-size: 36px;
      line-height: 1.05;
    }

    .section-head h2 {
      font-size: 22px;
      line-height: 1.1;
    }

    .hero-card p,
    .section-head p,
    .side-card p,
    .empty-shell p,
    .loading-shell p {
      margin: 0;
      color: var(--muted);
      line-height: 1.65;
    }

    .hero-stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }

    .hero-stat {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.06);
      display: grid;
      gap: 4px;
    }

    .hero-stat__label {
      color: #9db0d1;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .hero-stat strong {
      font-size: 28px;
      letter-spacing: -0.04em;
    }

    .hero-actions {
      display: grid;
      gap: 12px;
      align-content: start;
      min-width: 220px;
    }

    .action-btn {
      min-height: 48px;
      border-radius: 14px !important;
      justify-content: flex-start !important;
      padding: 0 16px !important;
      border-color: rgba(255, 255, 255, 0.08) !important;
      color: var(--text) !important;
      background: rgba(255, 255, 255, 0.04) !important;
    }

    .action-btn--primary {
      background: linear-gradient(135deg, rgba(84, 212, 255, 0.92), rgba(59, 130, 246, 0.88)) !important;
      color: #03111d !important;
      font-weight: 800;
    }

    .action-btn--danger {
      color: #fca5a5 !important;
      border-color: rgba(248, 113, 113, 0.18) !important;
    }

    .action-btn--compact {
      min-height: 40px;
      border-radius: 12px !important;
      padding: 0 14px !important;
    }

    .control-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 22px;
      margin-bottom: 22px;
    }

    .panel-card {
      padding: 22px;
    }

    .section-head {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 18px;
    }

    .section-head--space {
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .section-head__copy {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }

    .section-icon {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: rgba(84, 212, 255, 0.1);
      border: 1px solid rgba(84, 212, 255, 0.16);
      color: #54d4ff;
      flex-shrink: 0;
    }

    .section-icon--violet {
      color: #c4b5fd;
      border-color: rgba(139, 124, 255, 0.22);
      background: rgba(139, 124, 255, 0.1);
    }

    .filter-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 16px;
    }

    .filter-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.04);
      color: #dce6fb;
      border-radius: 999px;
      padding: 10px 14px;
      cursor: pointer;
      font: inherit;
      transition: all 0.2s ease;
    }

    .filter-pill.active {
      background: linear-gradient(135deg, rgba(84, 212, 255, 0.16), rgba(59, 130, 246, 0.18));
      border-color: rgba(84, 212, 255, 0.24);
      color: #f8fcff;
      box-shadow: 0 12px 24px rgba(59, 130, 246, 0.12);
    }

    .filter-pill__count {
      min-width: 22px;
      height: 22px;
      border-radius: 999px;
      display: inline-grid;
      place-items: center;
      padding: 0 6px;
      background: rgba(255, 255, 255, 0.08);
      font-size: 12px;
      font-weight: 800;
    }

    .filter-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 220px;
      gap: 16px;
    }

    .group-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    .group-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.04);
      color: #dce6fb;
      border-radius: 999px;
      padding: 10px 14px;
      cursor: pointer;
      font: inherit;
      transition: all 0.2s ease;
    }

    .group-pill.active {
      background: linear-gradient(135deg, rgba(196, 181, 253, 0.16), rgba(139, 124, 255, 0.18));
      border-color: rgba(196, 181, 253, 0.24);
      color: #f8fcff;
      box-shadow: 0 12px 24px rgba(139, 124, 255, 0.12);
    }

    .side-card {
      display: grid;
      gap: 12px;
      align-content: start;
    }

    .side-list {
      display: grid;
      gap: 10px;
    }

    .side-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--panel-soft);
      border: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 13px;
    }

    .side-row span {
      color: var(--muted);
    }

    .stream-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .bulk-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin: 0 0 18px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(84, 212, 255, 0.06);
      border: 1px solid rgba(84, 212, 255, 0.14);
    }

    .bulk-toolbar__summary,
    .bulk-toolbar__actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .loading-shell,
    .empty-shell {
      display: grid;
      justify-items: center;
      gap: 14px;
      padding: 52px 24px;
      text-align: center;
    }

    .empty-shell mat-icon {
      width: 52px;
      height: 52px;
      font-size: 52px;
      color: #7dd3fc;
      opacity: 0.8;
    }

    .notification-stream {
      display: grid;
      gap: 16px;
    }

    .group-block {
      margin-top: 4px;
    }

    .group-block__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 10px 4px 2px;
    }

    .group-block__actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .group-block__header h3 {
      margin: 0;
      font-size: 16px;
      letter-spacing: -0.02em;
    }

    .group-block__header p {
      margin: 2px 0 0;
      color: var(--muted);
      font-size: 12px;
    }

    .notification-card {
      display: grid;
      gap: 16px;
      padding: 18px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.015));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
    }

    .notification-card--unread {
      border-color: rgba(84, 212, 255, 0.22);
      box-shadow: 0 18px 28px rgba(59, 130, 246, 0.08);
    }

    .notification-card--selected {
      border-color: rgba(139, 124, 255, 0.28);
      box-shadow: 0 18px 28px rgba(139, 124, 255, 0.08);
    }

    .notification-card__main {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }

    .selection-toggle {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.03);
      color: #bfd0ee;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .selection-toggle--active {
      background: rgba(139, 124, 255, 0.14);
      border-color: rgba(139, 124, 255, 0.24);
      color: #ddd6fe;
    }

    .notification-card__signal {
      width: 52px;
      height: 52px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      background: rgba(148, 163, 184, 0.12);
      color: #d8e2ff;
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .notification-card__signal.signal--danger {
      background: rgba(248, 113, 113, 0.12);
      color: #fda4af;
      border-color: rgba(248, 113, 113, 0.18);
    }

    .notification-card__signal.signal--warning {
      background: rgba(251, 191, 36, 0.12);
      color: #fde68a;
      border-color: rgba(251, 191, 36, 0.18);
    }

    .notification-card__signal.signal--success {
      background: rgba(74, 222, 128, 0.12);
      color: #bbf7d0;
      border-color: rgba(74, 222, 128, 0.18);
    }

    .notification-card__signal.signal--info {
      background: rgba(84, 212, 255, 0.12);
      color: #a5f3fc;
      border-color: rgba(84, 212, 255, 0.18);
    }

    .notification-card__body {
      display: grid;
      gap: 10px;
    }

    .notification-card__meta {
      display: grid;
      gap: 10px;
    }

    .notification-card__heading {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .notification-card__heading h3 {
      margin: 0;
      font-size: 19px;
      letter-spacing: -0.03em;
    }

    .notification-card__refs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .inline-ref,
    .status-pill,
    .suggested-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.04);
      color: #d4def4;
    }

    .status-pill--unread {
      color: #86efac;
      border-color: rgba(74, 222, 128, 0.24);
    }

    .status-pill--soft {
      color: #93c5fd;
      border-color: rgba(96, 165, 250, 0.2);
    }

    .status-pill--danger {
      color: #fca5a5;
      border-color: rgba(248, 113, 113, 0.24);
    }

    .inline-ref--warn {
      color: #fde68a;
      border-color: rgba(251, 191, 36, 0.22);
    }

    .notification-card__message {
      margin: 0;
      color: #dbe6fa;
      line-height: 1.7;
    }

    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .suggested-chip {
      color: #c4b5fd;
      border-color: rgba(139, 124, 255, 0.2);
    }

    .assistant-note {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(84, 212, 255, 0.08);
      border: 1px solid rgba(84, 212, 255, 0.16);
      color: #c8f8ff;
      font-size: 13px;
      font-weight: 600;
    }

    .notification-card__actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    @media (max-width: 1080px) {
      .hero-card,
      .control-grid {
        grid-template-columns: 1fr;
      }

      .hero-actions {
        min-width: 0;
      }

      .hero-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .notifications-page {
        padding: 12px;
      }

      .hero-stats,
      .filter-row,
      .notification-card__main {
        grid-template-columns: 1fr;
      }

      .bulk-toolbar,
      .notification-card__actions,
      .stream-actions {
        justify-content: stretch;
      }

      .bulk-toolbar {
        align-items: stretch;
        flex-direction: column;
      }
    }
  `]
})
export class NotificationsCenterComponent implements OnInit {
  notifications: Notification[] = [];
  loading = false;
  actionKey: string | null = null;
  bulkActionRunning: 'read' | 'delete' | 'manager-review' | null = null;
  selectedFilter: NotificationFilter = 'all';
  groupMode: NotificationGroupMode = 'flat';
  searchTerm = '';
  readState: 'all' | 'unread' | 'read' = 'all';
  pageNumber = 0;
  totalElements = 0;
  totalPages = 0;
  pageSize = 100;
  lastRefreshedAt = new Date();
  selectedNotificationIds = new Set<number>();
  collapsedGroups = new Set<string>();

  readonly filterOptions: Array<{ value: NotificationFilter; label: string; icon: string }> = [
    { value: 'all', label: 'Toutes', icon: 'notifications' },
    { value: 'unread', label: 'Non lues', icon: 'markunread' },
    { value: 'sla', label: 'SLA', icon: 'warning' },
    { value: 'assignment', label: 'Assignation', icon: 'person_add' },
    { value: 'customer', label: 'Reponse client', icon: 'reply' },
    { value: 'system', label: 'Systeme', icon: 'settings_suggest' }
  ];

  readonly groupModes: Array<{ value: NotificationGroupMode; label: string; icon: string }> = [
    { value: 'flat', label: 'Flux simple', icon: 'view_agenda' },
    { value: 'ticket', label: 'Par ticket', icon: 'confirmation_number' },
    { value: 'type', label: 'Par type', icon: 'label' }
  ];

  constructor(
    private readonly notificationService: NotificationService,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly ticketService: TicketService,
    private readonly authService: AuthService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadPage();
  }

  get filteredNotifications(): Notification[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.notifications.filter(notification => {
      if (this.authService.isClient() && !this.isClientRelevantNotification(notification)) {
        return false;
      }

      if (this.selectedFilter === 'unread' && !this.isUnread(notification)) {
        return false;
      }
      if (this.selectedFilter === 'sla' && !isSlaNotification(notification)) {
        return false;
      }
      if (this.selectedFilter === 'assignment' && !this.isAssignmentNotification(notification)) {
        return false;
      }
      if (this.selectedFilter === 'customer' && !this.isCustomerNotification(notification)) {
        return false;
      }
      if (this.selectedFilter === 'system' && !this.isSystemNotification(notification)) {
        return false;
      }

      if (this.readState === 'read' && this.isUnread(notification)) {
        return false;
      }
      if (this.readState === 'unread' && !this.isUnread(notification)) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        notification.title,
        notification.message,
        notification.ticketReference,
        notification.type,
        notification.recommendedAgent
      ].join(' ').toLowerCase();

      return haystack.includes(search);
    });
  }

  get groupedNotifications(): Array<{ key: string; label: string; notifications: Notification[] }> {
    if (this.groupMode === 'flat') {
      return [{ key: 'flat', label: 'Toutes les notifications', notifications: this.filteredNotifications }];
    }

    const groups = new Map<string, { key: string; label: string; notifications: Notification[] }>();

    for (const notification of this.filteredNotifications) {
      const key = this.groupMode === 'ticket'
        ? `ticket:${notification.ticketId || notification.ticketReference || 'none'}`
        : `type:${notification.type || 'SYSTEM'}`;
      const label = this.groupMode === 'ticket'
        ? (notification.ticketReference || 'Notifications sans ticket')
        : this.getTypeLabel(notification);

      if (!groups.has(key)) {
        groups.set(key, { key, label, notifications: [] });
      }

      groups.get(key)!.notifications.push(notification);
    }

    return Array.from(groups.values()).sort((a, b) => {
      const aUnread = a.notifications.filter(notification => this.isUnread(notification)).length;
      const bUnread = b.notifications.filter(notification => this.isUnread(notification)).length;
      if (bUnread !== aUnread) {
        return bUnread - aUnread;
      }
      return a.label.localeCompare(b.label);
    });
  }

  get unreadCount(): number {
    return this.notifications.filter(notification => this.isUnread(notification)).length;
  }

  get readCount(): number {
    return this.notifications.length - this.unreadCount;
  }

  get slaCount(): number {
    return this.notifications.filter(notification => isSlaNotification(notification)).length;
  }

  get actionRequiredCount(): number {
    return this.notifications.filter(notification => !!notification.actionRequired).length;
  }

  get customerResponseCount(): number {
    return this.notifications.filter(notification => this.isCustomerNotification(notification)).length;
  }

  get isLastPage(): boolean {
    return this.pageNumber >= Math.max(this.totalPages - 1, 0);
  }

  get selectedCount(): number {
    return this.selectedNotificationIds.size;
  }

  get allVisibleSelected(): boolean {
    return this.filteredNotifications.length > 0
      && this.filteredNotifications.every(notification => this.selectedNotificationIds.has(notification.id));
  }

  get eligibleSelectedManagerReviewCount(): number {
    return this.selectedNotifications.filter(notification =>
      !!notification.ticketId && isSlaNotification(notification)
    ).length;
  }

  get selectedNotifications(): Notification[] {
    return this.notifications.filter(notification => this.selectedNotificationIds.has(notification.id));
  }

  loadPage(page = this.pageNumber): void {
    this.loading = true;
    this.notificationService.getNotificationPage(page, this.pageSize).subscribe({
      next: (result: Page<Notification>) => {
        this.notifications = result.content || [];
        this.retainVisibleSelection();
        this.pageNumber = result.number ?? page;
        this.totalElements = result.totalElements ?? this.notifications.length;
        this.totalPages = result.totalPages ?? 1;
        this.lastRefreshedAt = new Date();
        this.loading = false;
        this.notificationService.refresh();
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Impossible de charger les notifications.', 'Fermer', { duration: 3200 });
      }
    });
  }

  refresh(): void {
    this.loadPage(this.pageNumber);
  }

  previousPage(): void {
    if (this.pageNumber > 0) {
      this.loadPage(this.pageNumber - 1);
    }
  }

  nextPage(): void {
    if (!this.isLastPage) {
      this.loadPage(this.pageNumber + 1);
    }
  }

  openNotification(notification: Notification): void {
    if (this.isUnread(notification)) {
      this.markAsRead(notification, false);
    }

    if (notification.link) {
      this.router.navigateByUrl(notification.link);
      return;
    }

    if (notification.ticketId) {
      this.router.navigate(['/tickets', notification.ticketId]);
    }
  }

  openComments(notification: Notification): void {
    if (!notification.ticketId) {
      return;
    }
    if (this.isUnread(notification)) {
      this.markAsRead(notification, false);
    }
    void this.router.navigate(['/tickets', notification.ticketId], { queryParams: { tab: 'comments' } });
  }

  markAsRead(notification: Notification, notify = true): void {
    if (!this.isUnread(notification)) {
      return;
    }

    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.map(item =>
          item.id === notification.id ? { ...item, isRead: true, read: true } : item
        );
        if (notify) {
          this.snackBar.open('Notification marquee comme lue.', 'Fermer', { duration: 2200 });
        }
      },
      error: () => {
        this.snackBar.open('Impossible de marquer la notification.', 'Fermer', { duration: 3200 });
      }
    });
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
    this.notifications = this.notifications.map(notification => ({ ...notification, isRead: true, read: true }));
    this.snackBar.open('Toutes les notifications ont ete marquees comme lues.', 'Fermer', { duration: 2400 });
  }

  deleteNotification(notification: Notification): void {
    this.notificationService.deleteNotification(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(item => item.id !== notification.id);
        this.totalElements = Math.max(0, this.totalElements - 1);
        this.snackBar.open('Notification supprimee.', 'Fermer', { duration: 2200 });
      },
      error: () => {
        this.snackBar.open('Impossible de supprimer la notification.', 'Fermer', { duration: 3200 });
      }
    });
  }

  deleteReadNotifications(): void {
    this.notificationService.deleteReadNotifications().subscribe({
      next: () => {
        this.notifications = this.notifications.filter(notification => this.isUnread(notification));
        this.totalElements = this.notifications.length;
        this.snackBar.open('Notifications lues nettoyees.', 'Fermer', { duration: 2400 });
      },
      error: () => {
        this.snackBar.open('Impossible de nettoyer les notifications lues.', 'Fermer', { duration: 3200 });
      }
    });
  }

  getFilterCount(filter: NotificationFilter): number {
    const source = this.authService.isClient()
      ? this.notifications.filter(notification => this.isClientRelevantNotification(notification))
      : this.notifications;

    switch (filter) {
      case 'unread':
        return source.filter(notification => this.isUnread(notification)).length;
      case 'sla':
        return source.filter(notification => isSlaNotification(notification)).length;
      case 'assignment':
        return source.filter(notification => this.isAssignmentNotification(notification)).length;
      case 'customer':
        return source.filter(notification => this.isCustomerNotification(notification)).length;
      case 'system':
        return source.filter(notification => this.isSystemNotification(notification)).length;
      default:
        return source.length;
    }
  }

  getNarrative(): string {
    if (this.authService.isClient()) {
      return 'Cette vue client met en avant les commentaires publics, les demandes d informations et les resolutions a valider.';
    }
    if (this.selectedFilter === 'sla') {
      return 'Cette vue met en avant les alertes SLA et les notifications qui demandent une reaction rapide.';
    }
    if (this.selectedFilter === 'customer') {
      return 'Cette vue aide les agents et managers a reperer les tickets qui ont recu un retour client.';
    }
    if (this.unreadCount > 0) {
      return 'Vous avez encore des notifications non lues a traiter ou a classer.';
    }
    return 'Le centre est a jour. Utilisez les filtres pour retrouver une notification plus ancienne.';
  }

  getTypeLabel(notification: Notification): string {
    if (isSlaNotification(notification)) {
      return 'SLA';
    }
    if (this.isCustomerNotification(notification)) {
      return 'Client';
    }
    if (this.isAssignmentNotification(notification)) {
      return 'Assignation';
    }
    return 'Systeme';
  }

  getFilterLabel(filter: NotificationFilter): string {
    return this.filterOptions.find(item => item.value === filter)?.label || 'Toutes';
  }

  getIcon(notification: Notification): string {
    if (notification.icon) {
      return notification.icon;
    }
    const iconMap: Record<string, string> = {
      TICKET_CREATED: 'add_circle',
      TICKET_ASSIGNED: 'person_add',
      STATUS_CHANGED: 'swap_horiz',
      TICKET_RESOLVED: 'check_circle',
      NEW_COMMENT: 'comment',
      CUSTOMER_RESPONSE_RECEIVED: 'reply',
      TICKET_ESCALATED: 'trending_up',
      SLA_WARNING_50: 'schedule',
      SLA_WARNING_80: 'warning',
      SLA_ESCALATION: 'priority_high',
      SLA_CRITICAL_EVENT: 'crisis_alert'
    };
    return iconMap[notification.type || ''] || 'notifications';
  }

  getToneClass(notification: Notification): string {
    if (notification.actionRequired || notification.type === 'SLA_ESCALATION' || notification.type === 'SLA_CRITICAL_EVENT') {
      return 'signal--danger';
    }
    if (notification.type === 'SLA_WARNING_80' || notification.type === 'TICKET_ESCALATED') {
      return 'signal--warning';
    }
    if (notification.type === 'CUSTOMER_RESPONSE_RECEIVED' || notification.type === 'TICKET_RESOLVED') {
      return 'signal--success';
    }
    return 'signal--info';
  }

  getSuggestedActions(notification: Notification): string[] {
    return parseSuggestedActions(notification).slice(0, 4);
  }

  toggleGroup(groupKey: string): void {
    if (this.collapsedGroups.has(groupKey)) {
      this.collapsedGroups.delete(groupKey);
    } else {
      this.collapsedGroups.add(groupKey);
    }
    this.collapsedGroups = new Set(this.collapsedGroups);
  }

  isGroupCollapsed(groupKey: string): boolean {
    return this.collapsedGroups.has(groupKey);
  }

  getFallbackTitle(notification: Notification): string {
    if (notification.ticketReference) {
      return `Notification ${notification.ticketReference}`;
    }
    return 'Notification SupportFlow';
  }

  isUnread(notification: Notification): boolean {
    return !(notification.isRead || notification.read);
  }

  isSelected(notification: Notification): boolean {
    return this.selectedNotificationIds.has(notification.id);
  }

  toggleSelected(notification: Notification): void {
    if (this.isSelected(notification)) {
      this.selectedNotificationIds.delete(notification.id);
    } else {
      this.selectedNotificationIds.add(notification.id);
    }
    this.selectedNotificationIds = new Set(this.selectedNotificationIds);
  }

  toggleSelectAllVisible(): void {
    if (this.allVisibleSelected) {
      this.filteredNotifications.forEach(notification => this.selectedNotificationIds.delete(notification.id));
    } else {
      this.filteredNotifications.forEach(notification => this.selectedNotificationIds.add(notification.id));
    }
    this.selectedNotificationIds = new Set(this.selectedNotificationIds);
  }

  clearSelection(): void {
    this.selectedNotificationIds.clear();
    this.selectedNotificationIds = new Set();
  }

  bulkMarkSelectedRead(): void {
    if (this.selectedCount === 0) {
      return;
    }

    this.bulkActionRunning = 'read';
    Promise.all(
      this.selectedNotifications
        .filter(notification => this.isUnread(notification))
        .map(notification => firstValueFrom(this.notificationService.markAsRead(notification.id)))
    ).then(() => {
      this.notifications = this.notifications.map(notification =>
        this.selectedNotificationIds.has(notification.id)
          ? { ...notification, isRead: true, read: true }
          : notification
      );
      this.bulkActionRunning = null;
      this.snackBar.open('Notifications selectionnees marquees comme lues.', 'Fermer', { duration: 2400 });
      this.notificationService.refresh();
    }).catch(() => {
      this.bulkActionRunning = null;
      this.snackBar.open('Impossible de marquer toutes les notifications selectionnees.', 'Fermer', { duration: 3400 });
    });
  }

  bulkDeleteSelected(): void {
    if (this.selectedCount === 0) {
      return;
    }

    this.bulkActionRunning = 'delete';
    Promise.all(
      this.selectedNotifications.map(notification => firstValueFrom(this.notificationService.deleteNotification(notification.id)))
    ).then(() => {
      const selectedIds = new Set(this.selectedNotificationIds);
      this.notifications = this.notifications.filter(notification => !selectedIds.has(notification.id));
      this.totalElements = this.notifications.length;
      this.clearSelection();
      this.bulkActionRunning = null;
      this.snackBar.open('Notifications selectionnees supprimees.', 'Fermer', { duration: 2400 });
      this.notificationService.refresh();
    }).catch(() => {
      this.bulkActionRunning = null;
      this.snackBar.open('Impossible de supprimer toutes les notifications selectionnees.', 'Fermer', { duration: 3400 });
    });
  }

  async bulkManagerReviewSelected(): Promise<void> {
    if (this.selectedCount === 0 || !this.authService.isManager()) {
      return;
    }

    this.bulkActionRunning = 'manager-review';
    let successCount = 0;

    try {
      for (const notification of this.selectedNotifications) {
        if (!notification.ticketId || !isSlaNotification(notification)) {
          continue;
        }

        const ticket = await firstValueFrom(this.ticketService.getTicket(notification.ticketId));
        if (!this.authService.canActOnTicket(ticket, 'manager-review')) {
          continue;
        }

        await firstValueFrom(this.ticketService.requestManagerReview(ticket.id, 'Revue manager demandee depuis le centre de notifications'));
        successCount += 1;
        this.notifications = this.notifications.map(item =>
          item.id === notification.id ? { ...item, isRead: true, read: true } : item
        );
      }

      this.bulkActionRunning = null;
      this.notificationService.refresh();
      this.snackBar.open(
        successCount > 0
          ? `${successCount} revue${successCount > 1 ? 's' : ''} manager declenchee${successCount > 1 ? 's' : ''}.`
          : 'Aucune notification selectionnee n etait eligible a une revue manager.',
        'Fermer',
        { duration: 3200 }
      );
    } catch {
      this.bulkActionRunning = null;
      this.snackBar.open('Impossible de traiter la revue manager groupee.', 'Fermer', { duration: 3600 });
    }
  }

  canOfferAction(notification: Notification, action: 'take-charge' | 'assign' | 'manager-review' | 'escalate' | 'resolve'): boolean {
    if (!notification.ticketId) {
      return false;
    }

    if (this.authService.isClient()) {
      return false;
    }

    if (action === 'assign' || action === 'manager-review') {
      return this.authService.isManager();
    }

    if (action === 'escalate') {
      return this.authService.isStaff();
    }

    if (action === 'resolve') {
      return this.authService.isStaff();
    }

    return this.authService.isStaff();
  }

  isActionRunning(notification: Notification, action: string): boolean {
    return this.actionKey === `${notification.id}:${action}`;
  }

  takeChargeFromNotification(notification: Notification): void {
    this.runTicketAction(notification, 'take-charge', (ticket) => {
      this.ticketService.takeCharge(ticket.id).subscribe({
        next: (updatedTicket) => {
          this.finishAction('Ticket pris en charge avec succes.', notification, updatedTicket);
        },
        error: (error) => this.failAction(error, "Impossible de prendre le ticket.")
      });
    });
  }

  assignFromNotification(notification: Notification): void {
    this.runTicketAction(notification, 'assign', (ticket) => {
      const dialogRef = this.dialog.open(AssignDialogComponent, {
        width: '720px',
        disableClose: false,
        data: {
          currentAgentId: ticket.assignedTo?.id ?? ticket.assignedAgent?.id ?? null,
          ticketId: ticket.id
        } as AssignDialogData
      });

      dialogRef.afterClosed().subscribe((result?: AssignDialogResult) => {
        if (!result?.agentId) {
          this.clearAction();
          return;
        }

        this.ticketService.assignTicket(ticket.id, result.agentId, result.source).subscribe({
          next: (updatedTicket) => {
            this.finishAction(
              result.source === 'AI_RECOMMENDATION'
                ? 'Recommandation IA validee et ticket assigne.'
                : 'Ticket assigne avec succes.',
              notification,
              updatedTicket
            );
          },
          error: (error) => this.failAction(error, "Impossible d'assigner le ticket.")
        });
      });
    });
  }

  resolveFromNotification(notification: Notification): void {
    this.runTicketAction(notification, 'resolve', (ticket) => {
      const dialogRef = this.dialog.open<ResolveDialogComponent, { ticketReference: string; ticketTitle: string }, ResolveDialogResult>(
        ResolveDialogComponent,
        {
          width: '680px',
          maxWidth: '95vw',
          autoFocus: false,
          data: {
            ticketReference: ticket.reference,
            ticketTitle: ticket.title
          }
        }
      );

      dialogRef.afterClosed().subscribe(result => {
        if (!result?.summary) {
          this.clearAction();
          return;
        }

        const payload: TicketResolveRequest = {
          resolutionSummary: result.summary,
          resolutionDetails: {
            diagnostic: result.diagnostic,
            rootCause: result.rootCause,
            actionsTaken: result.actionsTaken,
            nextRecommendation: result.nextRecommendation
          }
        };

        this.ticketService.resolveTicket(ticket.id, payload).subscribe({
          next: (updatedTicket) => {
            this.finishAction('Resolution enregistree avec succes.', notification, updatedTicket);
          },
          error: (error) => this.failAction(error, 'Impossible de resoudre le ticket.')
        });
      });
    });
  }

  requestManagerReviewFromNotification(notification: Notification): void {
    this.runTicketAction(notification, 'manager-review', (ticket) => {
      this.ticketService.requestManagerReview(ticket.id, 'Revue manager demandee depuis le centre de notifications').subscribe({
        next: (updatedTicket) => {
          this.finishAction('Revue manager declenchee avec succes.', notification, updatedTicket);
        },
        error: (error) => this.failAction(error, "Impossible de declencher la revue manager.")
      });
    });
  }

  escalateFromNotification(notification: Notification): void {
    this.runTicketAction(notification, 'escalate', (ticket) => {
      const dialogRef = this.dialog.open(EscalateDialogComponent, {
        width: '680px',
        disableClose: false
      });

      dialogRef.afterClosed().subscribe((result?: EscalateDialogResult) => {
        if (!result?.agentId || !result.motif?.trim()) {
          this.clearAction();
          return;
        }

        this.ticketService.escalateTicket(ticket.id, result.agentId, result.motif.trim()).subscribe({
          next: (updatedTicket) => {
            this.finishAction('Ticket escalade avec succes.', notification, updatedTicket);
          },
          error: (error) => this.failAction(error, "Impossible d'escalader le ticket.")
        });
      });
    });
  }

  private isAssignmentNotification(notification: Notification): boolean {
    return ['TICKET_ASSIGNED', 'TICKET_ESCALATED'].includes(notification.type || '');
  }

  private isCustomerNotification(notification: Notification): boolean {
    return ['CUSTOMER_RESPONSE_RECEIVED', 'NEW_COMMENT'].includes(notification.type || '');
  }

  private isSystemNotification(notification: Notification): boolean {
    return !isSlaNotification(notification) && !this.isAssignmentNotification(notification) && !this.isCustomerNotification(notification);
  }

  private isClientRelevantNotification(notification: Notification): boolean {
    return [
      'NEW_COMMENT',
      'CUSTOMER_RESPONSE_RECEIVED',
      'TICKET_RESOLVED',
      'STATUS_CHANGED',
      'TICKET_CLOSED'
    ].includes(notification.type || '')
      || (!!notification.ticketId && !isSlaNotification(notification));
  }

  private runTicketAction(
    notification: Notification,
    action: 'take-charge' | 'assign' | 'manager-review' | 'escalate' | 'resolve',
    executor: (ticket: Ticket) => void
  ): void {
    if (!notification.ticketId) {
      this.snackBar.open('Aucun ticket associe a cette notification.', 'Fermer', { duration: 2600 });
      return;
    }

    this.actionKey = `${notification.id}:${action}`;

    this.ticketService.getTicket(notification.ticketId).subscribe({
      next: (ticket) => {
        if (!this.authService.canActOnTicket(ticket, action)) {
          this.clearAction();
          this.snackBar.open("Vous n'avez pas la permission d'executer cette action sur ce ticket.", 'Fermer', { duration: 3400 });
          return;
        }
        executor(ticket);
      },
      error: () => {
        this.clearAction();
        this.snackBar.open('Impossible de charger le ticket associe.', 'Fermer', { duration: 3200 });
      }
    });
  }

  private finishAction(message: string, notification: Notification, ticket: Ticket): void {
    this.clearAction();
    this.markAsRead(notification, false);
    this.snackBar.open(message, 'Fermer', { duration: 2800 });
    this.notifications = this.notifications.map(item =>
      item.id === notification.id
        ? {
            ...item,
            isRead: true,
            read: true,
            ticketReference: ticket.reference || item.ticketReference
          }
        : item
    );
    this.notificationService.refresh();
  }

  private failAction(error: any, fallbackMessage: string): void {
    this.clearAction();
    const message = error?.error?.message || fallbackMessage;
    this.snackBar.open(message, 'Fermer', { duration: 3600 });
  }

  private clearAction(): void {
    this.actionKey = null;
  }

  private retainVisibleSelection(): void {
    const currentIds = new Set(this.notifications.map(notification => notification.id));
    this.selectedNotificationIds = new Set(
      Array.from(this.selectedNotificationIds).filter(id => currentIds.has(id))
    );
  }
}
