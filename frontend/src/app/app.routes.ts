import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { Component } from '@angular/core';

@Component({
  selector: 'app-blank',
  standalone: true,
  template: ''
})
export class BlankComponent {}

export const routes: Routes = [
  {
    path: '',
    component: BlankComponent,
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT'] }
  },
  {
    path: 'my-tickets',
    loadComponent: () => import('./features/tickets/my-tickets/my-tickets.component').then(m => m.MyTicketsComponent),
    canActivate: [AuthGuard],
    data: { roles: ['CLIENT'] }
  },
  {
    path: 'agent-workbench',
    loadComponent: () => import('./features/tickets/agent-workbench/agent-workbench.component').then(m => m.AgentWorkbenchComponent),
    canActivate: [AuthGuard],
    data: { roles: ['SUPPORT_AGENT'] }
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'notifications',
    loadComponent: () => import('./features/notifications/notifications-center.component').then(m => m.NotificationsCenterComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'knowledge-base',
    loadComponent: () => import('./features/knowledge-base/knowledge-base.component').then(m => m.KnowledgeBaseComponent),
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT'] }
  },
  {
    path: 'tickets',
    loadChildren: () => import('./features/tickets/tickets.routes').then(m => m.ticketsRoutes),
    canActivate: [AuthGuard]
  },
  {
    path: 'clients',
    loadChildren: () => import('./features/clients/clients.routes').then(m => m.clientsRoutes),
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT'] }
  },
  {
    path: 'users',
    loadChildren: () => import('./features/users/users.routes').then(m => m.usersRoutes),
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN', 'SUPPORT_MANAGER'] }
  },
  {
    path: 'archives-reports',
    loadComponent: () => import('./features/archives-reports/archives-reports.component').then(m => m.ArchivesReportsComponent),
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN', 'SUPPORT_MANAGER'] }
  },
  {
    path: 'ai-assistant',
    loadComponent: () => import('./features/ai-assistant/ai-assistant.component').then(m => m.AIAssistantComponent),
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT'] }
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
