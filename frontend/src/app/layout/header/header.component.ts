import { Component, EventEmitter, Input, OnInit, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';

import { AuthService, NotificationService } from '@core/services';
import { Notification, isSlaNotification } from '@core/models';
import { SlaNotificationItemComponent } from '@shared/components/sla-notification-item/sla-notification-item.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    SlaNotificationItemComponent
  ],
  template: `
    <mat-toolbar class="header glass-panel" [class.collapsed]="collapsed">
      <button mat-icon-button (click)="toggleSidebar.emit()" class="menu-btn">
        <mat-icon>menu</mat-icon>
      </button>
      
      <span class="header-title" *ngIf="collapsed">Support<span class="neon-text">Flow</span></span>
      
      <span class="spacer"></span>
      
      <!-- Search -->
      <button mat-icon-button class="header-action-btn glass-btn">
        <mat-icon>search</mat-icon>
      </button>
      
      <!-- Theme Toggle -->
      <button mat-icon-button class="header-action-btn glass-btn" (click)="toggleTheme()" title="Changer le thème">
        <mat-icon>{{ isLightTheme ? 'light_mode' : 'dark_mode' }}</mat-icon>
      </button>
      
      <!-- Notifications -->
      <button mat-icon-button class="header-action-btn glass-btn" [matMenuTriggerFor]="notifMenu">
        <div class="icon-wrapper">
          <mat-icon>notifications</mat-icon>
          <span class="notification-badge" *ngIf="notificationCount > 0" [class.pulse]="notificationCount > 0">
            {{ notificationCount > 9 ? '9+' : notificationCount }}
          </span>
        </div>
      </button>
      
      <mat-menu #notifMenu="matMenu" class="notification-menu glass-menu">
        <div class="notification-header">
          <div class="notif-header-left">
            <span class="neon-text">Notifications</span>
            <span class="sla-alert-count" *ngIf="slaAlertCount > 0">
              {{ slaAlertCount }} SLA
            </span>
          </div>
          <div class="notif-header-actions">
            <button mat-button class="glass-btn small-btn" (click)="openNotificationCenter($event)">
              Centre
            </button>
            <button mat-button class="glass-btn small-btn" *ngIf="notificationCount > 0" (click)="markAllRead($event)">
              Tout lire
            </button>
          </div>
        </div>
        <mat-divider class="glass-divider"></mat-divider>
        <div class="notification-empty" *ngIf="allNotifications.length === 0">
          <mat-icon class="pulse-icon opacity-50">notifications_none</mat-icon>
          <p>Aucune notification</p>
        </div>
        <div class="notifications-container">
          <ng-container *ngFor="let notif of allNotifications">
            <!-- SLA Smart Notification -->
            <div *ngIf="isSlaNotif(notif)" class="sla-notif-wrapper">
              <app-sla-notification-item
                [notif]="notif"
                (read)="onNotifRead($event)"
                (actionSelected)="onSlaAction($event)">
              </app-sla-notification-item>
            </div>
            <!-- Regular Notification -->
            <button mat-menu-item *ngIf="!isSlaNotif(notif)" class="notif-item" (click)="onNotifRead(notif)">
              <div class="notif-icon-wrapper" [class.unread]="!(notif.isRead || notif.read)">
                <mat-icon>{{ getNotifIcon(notif) }}</mat-icon>
              </div>
              <div class="notif-content">
                <span class="notif-title" *ngIf="notif.title">{{ notif.title }}</span>
                <span class="notif-text">{{ notif.message }}</span>
              </div>
            </button>
          </ng-container>
        </div>
      </mat-menu>
      
      <!-- User Menu -->
      <button mat-button [matMenuTriggerFor]="userMenu" class="user-btn glass-btn">
        <div class="user-avatar-wrapper">
          <div class="user-avatar">
            {{ userInitials || '?' }}
          </div>
          <div class="status-dot"></div>
        </div>
        <span class="user-name">{{ userName || 'Utilisateur' }}</span>
        <mat-icon>expand_more</mat-icon>
      </button>
      
      <mat-menu #userMenu="matMenu" class="user-menu glass-menu">
        <div class="user-menu-header">
          <div class="user-avatar-wrapper large">
            <div class="user-avatar large">{{ userInitials || '?' }}</div>
            <div class="status-dot large"></div>
          </div>
          <div class="user-info">
            <strong class="neon-text">{{ userName || 'Utilisateur' }}</strong>
            <span class="role">{{ userRole || 'Chargement...' }}</span>
          </div>
        </div>
        <mat-divider class="glass-divider"></mat-divider>
        <button mat-menu-item routerLink="/profile" class="menu-item-hover">
          <mat-icon class="text-blue">person</mat-icon>
          <span>Mon profil</span>
        </button>
        <button mat-menu-item routerLink="/settings" class="menu-item-hover">
          <mat-icon class="text-purple">settings</mat-icon>
          <span>Paramètres</span>
        </button>
        <mat-divider class="glass-divider"></mat-divider>
        <button mat-menu-item (click)="logout()" class="menu-item-hover text-red">
          <mat-icon class="text-red">logout</mat-icon>
          <span>Déconnexion</span>
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: [`
    .header {
      position: fixed;
      top: 16px;
      right: 16px;
      /* Account for sidebar width + margins */
      left: calc(var(--sidebar-width) + 32px);
      z-index: 100;
      height: var(--header-height);
      border-radius: 16px !important;
      transition: left 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
      display: flex;
      align-items: center;
      padding: 0 16px;
      
      &.collapsed {
        left: calc(var(--sidebar-collapsed) + 32px);
      }
    }
    
    .menu-btn {
      color: var(--text-main) !important;
      margin-right: 8px;
    }

    .header-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, var(--text-main) 0%, var(--accent-blue) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .neon-text {
      color: var(--neon-cyan);
      background: none;
      -webkit-text-fill-color: var(--neon-cyan);
      filter: drop-shadow(0 0 5px rgba(6, 182, 212, 0.4));
    }

    .spacer {
      flex: 1 1 auto;
    }
    
    .header-action-btn {
      margin-right: 12px;
      width: 44px; height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px !important;
      
      .icon-wrapper {
        position: relative;
        display: flex;
      }

      .notification-badge {
        position: absolute;
        top: -6px;
        right: -6px;
        background: var(--neon-red);
        color: white;
        font-size: 10px;
        font-weight: 800;
        width: 18px; height: 18px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
        border: 2px solid var(--glass-bg);
      }
      
      .pulse {
        animation: pulseAlert 2s infinite;
      }
    }
    
    .user-btn {
      height: 48px !important;
      padding: 0 16px 0 8px !important;
      display: flex;
      align-items: center;
      gap: 12px;
      
      .user-avatar-wrapper {
        position: relative;
      }

      .status-dot {
        position: absolute;
        bottom: 0px;
        right: 0px;
        width: 10px; height: 10px;
        background: var(--neon-green);
        border: 2px solid var(--bg-surface);
        border-radius: 50%;
        box-shadow: 0 0 8px var(--neon-green);
        
        &.large {
          width: 14px; height: 14px;
          bottom: 2px; right: 2px;
          border-width: 3px;
        }
      }

      .user-avatar {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 1px;
        box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
        
        &.large {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          font-size: 20px;
        }
      }
      
      .user-name {
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
        letter-spacing: 0.2px;
        font-size: 14px;
      }
    }
    
    // --- Menus ---
    .user-menu-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      
      .user-info {
        display: flex;
        flex-direction: column;
        
        strong {
          font-size: 16px;
          margin-bottom: 4px;
        }
        
        .role {
          font-size: 13px;
          color: var(--text-muted);
          background: var(--glass-highlight);
          padding: 2px 8px;
          border-radius: 10px;
          display: inline-block;
          width: fit-content;
        }
      }
    }
    
    .notification-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;

      .notif-header-left {
        display: flex; align-items: center; gap: 10px;
      }

      .notif-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .sla-alert-count {
        font-size: 11px; font-weight: 700; padding: 2px 8px;
        background: rgba(239,68,68,0.2); color: #f87171;
        border: 1px solid rgba(239,68,68,0.4); border-radius: 10px;
        animation: pulse-sla-badge 2s infinite;
      }

      @keyframes pulse-sla-badge {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
        50% { box-shadow: 0 0 8px 2px rgba(239,68,68,0.15); }
      }
      
      span {
        font-size: 16px;
        font-weight: 700;
      }
      
      .small-btn {
        height: 32px !important;
        font-size: 12px;
        padding: 0 12px !important;
      }
    }
    
    .notification-empty {
      padding: 40px 24px;
      text-align: center;
      color: var(--text-muted);
      
      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
        color: var(--accent-blue);
      }
      
      p {
        margin: 0;
        font-size: 15px;
        font-weight: 500;
      }
    }

    .notifications-container {
      max-height: 400px;
      overflow-y: auto;
      
      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-track { background: transparent; }
      &::-webkit-scrollbar-thumb { background: var(--glass-highlight); border-radius: 4px; }
    }

    /* Override Material Menu Items for Glassmorphism */
    ::ng-deep .mat-mdc-menu-panel {
      --mat-menu-item-hover-state-layer-color: var(--glass-highlight);
    }
    
    .sla-notif-wrapper {
      padding: 4px 12px;
    }

    .notif-item {
      display: flex;
      align-items: center;
      padding: 12px 20px !important;
      height: auto !important;
      min-height: 64px;
      gap: 16px;
      
      .notif-icon-wrapper {
        width: 40px; height: 40px;
        border-radius: 50%;
        background: var(--glass-highlight);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        flex-shrink: 0;
        
        &.unread {
          background: rgba(59, 130, 246, 0.15);
          color: var(--neon-cyan);
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.2);
        }
      }
      
      .notif-content {
        display: flex; flex-direction: column; gap: 2px; overflow: hidden;
        .notif-title { font-size: 12px; font-weight: 600; color: var(--text-main); }
        .notif-text { white-space: normal; line-height: 1.4; font-size: 12px; color: var(--text-main); }
      }

      .notif-text {
        white-space: normal;
        line-height: 1.4;
        font-size: 14px;
        color: var(--text-main);
      }
    }

    .menu-item-hover {
      margin: 4px 8px;
      border-radius: 8px !important;
      width: calc(100% - 16px) !important;
      
      mat-icon {
        margin-right: 12px;
      }
    }

    .text-blue { color: var(--accent-blue) !important; }
    .text-purple { color: var(--accent-purple) !important; }
    .text-red { color: var(--neon-red) !important; filter: drop-shadow(0 0 5px rgba(239, 68, 68, 0.4)); }
    .glass-divider { border-top-color: var(--glass-border) !important; }

    ::ng-deep .notification-menu {
      min-width: 360px !important;
    }
  `]
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input() collapsed = false;
  @Output() toggleSidebar = new EventEmitter<void>();

  userName = '';
  userInitials = '';
  userRole = '';
  notificationCount = 0;
  /** Rich notifications loaded from API */
  allNotifications: Notification[] = [];
  isLightTheme = false;
  private subs: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) { }

  ngOnInit() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      this.isLightTheme = true;
      document.body.classList.add('light-theme');
    } else if (savedTheme === 'dark') {
      this.isLightTheme = false;
      document.body.classList.remove('light-theme');
    } else {
      this.isLightTheme = document.body.classList.contains('light-theme');
    }

    this.userName = this.authService.getUsername();
    this.userInitials = this.getInitials(this.userName);
    this.userRole = this.getRoleLabel(this.authService.getPrimaryRole());

    this.subs.push(
      this.authService.getFullName().subscribe(name => {
        this.userName = name;
        this.userInitials = this.getInitials(name);
      })
    );

    // Live notification count
    this.subs.push(
      this.notificationService.getUnreadCount().subscribe(count => {
        this.notificationCount = count;
      })
    );

    // Rich notifications from API
    this.subs.push(
      this.notificationService.getNotifications().subscribe(notifs => {
        this.allNotifications = notifs;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  get slaAlertCount(): number {
    return this.allNotifications.filter(n => isSlaNotification(n) && !(n.isRead || n.read)).length;
  }

  isSlaNotif(notif: Notification): boolean {
    return isSlaNotification(notif);
  }

  getNotifIcon(notif: Notification): string {
    if (notif.icon) return notif.icon;
    const iconMap: Record<string, string> = {
      'TICKET_CREATED': 'add_circle',
      'TICKET_ASSIGNED': 'person_add',
      'STATUS_CHANGED': 'swap_horiz',
      'TICKET_RESOLVED': 'check_circle',
      'NEW_COMMENT': 'comment',
      'CUSTOMER_RESPONSE_RECEIVED': 'reply',
      'TICKET_ESCALATED': 'trending_up',
    };
    return iconMap[notif.type || ''] || 'notifications';
  }

  onNotifRead(notif: Notification): void {
    if (!(notif.isRead || notif.read)) {
      this.notificationService.markAsRead(notif.id).subscribe();
    }
    if (notif.link) {
      this.router.navigateByUrl(notif.link);
    }
  }

  onSlaAction(event: { notification: Notification; action: string }): void {
    // Navigate to ticket page for any action
    if (event.notification.link) {
      this.router.navigateByUrl(event.notification.link);
    }
    if (!(event.notification.isRead || event.notification.read)) {
      this.notificationService.markAsRead(event.notification.id).subscribe();
    }
  }

  markAllRead(event: Event): void {
    event.stopPropagation();
    this.notificationService.markAllAsRead();
    this.allNotifications = this.allNotifications.map(n => ({ ...n, isRead: true, read: true }));
  }

  openNotificationCenter(event: Event): void {
    event.stopPropagation();
    this.router.navigateByUrl('/notifications');
  }

  logout() {
    this.authService.logout();
  }

  private getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  private getRoleLabel(role: string): string {
    const labels: { [key: string]: string } = {
      'ADMIN': 'Administrateur',
      'SUPPORT_MANAGER': 'Manager Support',
      'SUPPORT_AGENT': 'Agent Support',
      'CLIENT': 'Client'
    };
    return labels[role] || role;
  }

  toggleTheme() {
    this.isLightTheme = !this.isLightTheme;
    if (this.isLightTheme) {
      document.body.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
    }
  }
}
