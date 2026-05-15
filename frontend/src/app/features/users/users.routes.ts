import { Routes } from '@angular/router';

export const usersRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./user-list/user-list.component').then(m => m.UserListComponent)
  },
  {
    path: 'support-categories',
    loadComponent: () => import('./support-categories/support-categories.component').then(m => m.SupportCategoriesComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./user-form/user-form.component').then(m => m.UserFormComponent)
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./user-form/user-form.component').then(m => m.UserFormComponent)
  }
];
