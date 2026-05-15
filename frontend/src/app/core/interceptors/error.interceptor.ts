import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('HTTP Error:', error.status, error.statusText, error.error);
      let message = 'Une erreur est survenue';
      
      if (error.error instanceof ErrorEvent) {
        // Client-side error
        message = error.error.message;
      } else {
        // Server-side error
        switch (error.status) {
          case 400:
            message = error.error?.message || 'Requête invalide';
            break;
          case 401:
            message = 'Session expirée. Veuillez vous reconnecter.';
            // Redirect to login
            break;
          case 403:
            message = 'Accès refusé';
            break;
          case 404:
            message = 'Ressource non trouvée';
            break;
          case 409:
            message = error.error?.message || 'Conflit de données';
            break;
          case 422:
            message = error.error?.message || 'Données invalides';
            break;
          case 500:
            message = 'Erreur serveur. Veuillez réessayer plus tard.';
            break;
          default:
            message = error.error?.message || `Erreur ${error.status}`;
        }
      }
      
      snackBar.open(message, 'Fermer', {
        duration: 5000,
        panelClass: error.status >= 500 ? 'error-snackbar' : 'warning-snackbar'
      });
      
      return throwError(() => error);
    })
  );
};

