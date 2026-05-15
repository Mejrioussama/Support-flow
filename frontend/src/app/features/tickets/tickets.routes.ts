import { Routes } from '@angular/router';

export const ticketsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./ticket-list/ticket-list.component').then(m => m.TicketListComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./ticket-form/ticket-form.component').then(m => m.TicketFormComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./ticket-detail/ticket-detail.component').then(m => m.TicketDetailComponent)
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./ticket-form/ticket-form.component').then(m => m.TicketFormComponent)
  }
];
