import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '@core/services';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatListModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <aside class="sidebar glass-panel" [class.collapsed]="collapsed">
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-icon-wrapper">
             <mat-icon class="logo-icon">support_agent</mat-icon>
          </div>
          <span class="logo-text" *ngIf="!collapsed">SupportFlow</span>
        </div>
        <button class="collapse-btn" (click)="toggleCollapse.emit(!collapsed)" [title]="collapsed ? 'Développer' : 'Réduire'">
          <mat-icon>{{ collapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon>
        </button>
      </div>
      
      <nav class="sidebar-nav">
        <mat-nav-list>
          @for (item of navItems; track item.route) {
            @if (canAccess(item)) {
              <a mat-list-item 
                 [routerLink]="item.route" 
                 routerLinkActive="active"
                 class="nav-item"
                 [matTooltip]="collapsed ? item.label : ''"
                 matTooltipPosition="right">
                <mat-icon matListItemIcon class="nav-icon">{{ item.icon }}</mat-icon>
                <span matListItemTitle *ngIf="!collapsed">{{ item.label }}</span>
                <div class="nav-indicator"></div>
              </a>
            }
          }
        </mat-nav-list>
      </nav>
      
      <div class="sidebar-footer" *ngIf="!collapsed">
        <div class="version-badge glass-panel">
          <span class="version-dot"></span> v1.0.0
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      position: fixed;
      top: 16px;
      left: 16px;
      bottom: 16px;
      width: 260px;
      color: var(--text-main);
      display: flex;
      flex-direction: column;
      transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
      z-index: 200;
      
      &.collapsed {
        width: 80px;
        
        .sidebar-header {
          padding: 32px 8px;
          justify-content: center;
          
          .logo-text { display: none; }
          .collapse-btn { display: none; }
        }
        
        .logo-icon-wrapper { margin: 0; }
        
        .sidebar-nav .nav-item {
          justify-content: center;
          padding: 12px 0;
          margin: 8px auto;
          width: 48px;
          .nav-icon { margin: 0; }
        }
      }
    }
    
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 32px 20px 24px;
      position: relative;
      
      .logo {
        display: flex;
        align-items: center;
        gap: 14px;
        
        .logo-icon-wrapper {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2));
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(6, 182, 212, 0.3);
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.2);
          
          .logo-icon {
            font-size: 26px;
            width: 26px;
            height: 26px;
            color: var(--sf-cyan);
            filter: drop-shadow(0 0 8px var(--sf-cyan));
          }
        }
        
        .logo-text {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, var(--sf-text-1) 0%, var(--sf-blue) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      }
      
      .collapse-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        background: var(--sf-glass-shine);
        border: 1px solid var(--sf-glass-border);
        border-radius: 10px;
        transition: all 0.3s ease;
        
        &:hover {
          background: var(--sf-glass-hover);
          transform: scale(1.05);
          border-color: var(--sf-blue);
        }
        
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: var(--sf-text-2);
        }
      }
    }
    
    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 16px 0;
      
      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-track { background: transparent; }
      &::-webkit-scrollbar-thumb { background: var(--sf-glass-shine); border-radius: 4px; }
      
      .nav-item {
        color: var(--sf-text-3);
        margin: 4px 16px;
        border-radius: var(--sf-radius-lg);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
        
        &:hover {
          color: var(--sf-text-1);
          background: var(--sf-glass-shine);
          transform: translateX(4px);
        }
        
        &.active {
          color: var(--sf-text-1);
          background: linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, transparent 100%);
          
          .nav-icon {
            color: var(--sf-cyan);
            filter: drop-shadow(0 0 5px var(--sf-cyan));
          }
          
          .nav-indicator {
            opacity: 1;
            height: 60%;
          }
        }
        
        .nav-icon {
          color: var(--sf-text-3);
          margin-right: 16px;
          transition: color 0.3s ease;
        }
        
        .nav-indicator {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 0%;
          background: var(--sf-cyan);
          border-radius: 0 4px 4px 0;
          opacity: 0;
          transition: all 0.3s ease;
          box-shadow: 0 0 10px var(--sf-cyan);
        }
      }
    }
    
    .sidebar-footer {
      padding: 24px 16px;
      border-top: 1px solid var(--sf-glass-border);
      display: flex;
      justify-content: center;
      
      .version-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 16px;
        border-radius: var(--sf-radius-full);
        font-size: var(--sf-text-xs);
        font-weight: 600;
        color: var(--sf-text-3);
        background: rgba(0,0,0,0.2) !important;
        border: 1px solid var(--sf-glass-border) !important;
        
        .version-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--sf-green);
          box-shadow: 0 0 8px var(--sf-green);
          animation: pulseGreen 2s infinite;
        }
      }
    }

    @keyframes pulseGreen {
      0% { opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
      70% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
      100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    
    ::ng-deep .mat-mdc-list-item {
      height: 48px !important;
    }
  `]
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Output() toggleCollapse = new EventEmitter<boolean>();

  navItems: NavItem[] = [
    { label: 'Tableau de bord', icon: 'dashboard', route: '/dashboard', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT'] },
    { label: 'Workbench Agent', icon: 'view_kanban', route: '/agent-workbench', roles: ['SUPPORT_AGENT'] },
    { label: 'Mes Tickets', icon: 'confirmation_number', route: '/my-tickets', roles: ['CLIENT'] },
    { label: 'Tickets', icon: 'confirmation_number', route: '/tickets', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT'] },
    { label: 'Notifications', icon: 'notifications_active', route: '/notifications' },
    { label: 'Base de connaissance', icon: 'menu_book', route: '/knowledge-base', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT'] },
    { label: 'Archives & Rapports', icon: 'inventory_2', route: '/archives-reports', roles: ['ADMIN', 'SUPPORT_MANAGER'] },
    { label: 'Clients', icon: 'business', route: '/clients', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT'] },
    { label: 'Utilisateurs', icon: 'people', route: '/users', roles: ['ADMIN', 'SUPPORT_MANAGER'] },
    { label: 'AI Assistant', icon: 'smart_toy', route: '/ai-assistant', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT'] },
    { label: 'Mon Profil', icon: 'person', route: '/profile' }
  ];

  constructor(private authService: AuthService) { }

  canAccess(item: NavItem): boolean {
    if (!item.roles || item.roles.length === 0) {
      return true;
    }

    // Check if user has at least one of the item's roles
    return item.roles.some(role => this.authService.hasRole(role));
  }
}
