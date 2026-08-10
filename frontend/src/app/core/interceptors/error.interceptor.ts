import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { KeycloakService } from 'keycloak-angular';

const TRANSIENT_HTTP_STATUSES = new Set([0, 502, 503, 504]);
const MAX_TRANSIENT_RETRIES = 12;
// AI endpoints (/api/ai/**) are backed by a local LLM and can legitimately take a long time to
// respond (ai.service.ts uses up to a 5-minute timeout for some of them). Blindly retrying those
// up to 12 times on a transient status would pile additional slow requests onto an already
// struggling AI backend instead of backing off - exclude them from this retry policy entirely.
const AI_ENDPOINT_PATTERN = /\/api\/ai(\/|$)/i;
let loginRedirectInFlight = false;

function isTransientReadRequest(method: string, status: number, url: string): boolean {
  if (AI_ENDPOINT_PATTERN.test(url)) {
    return false;
  }
  return (method === 'GET' || method === 'HEAD') && TRANSIENT_HTTP_STATUSES.has(status);
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);
  const keycloak = inject(KeycloakService);

  return next(req).pipe(
    retry({
      count: MAX_TRANSIENT_RETRIES,
      delay: (error: HttpErrorResponse, retryCount) => {
        if (!isTransientReadRequest(req.method, error.status, req.url)) {
          return throwError(() => error);
        }

        const delayMs = Math.min(1000 * retryCount, 4000);
        return timer(delayMs);
      }
    }),
    catchError((error: HttpErrorResponse) => {
      console.error('HTTP Error:', error.status, error.statusText, error.error);
      let message = 'Une erreur est survenue';

      if (error.error instanceof ErrorEvent) {
        message = error.error.message;
      } else {
        switch (error.status) {
          case 400:
            message = error.error?.message || 'Requete invalide';
            break;
          case 401:
            message = 'Session expiree. Veuillez vous reconnecter.';
            if (!loginRedirectInFlight) {
              loginRedirectInFlight = true;
              void keycloak.login({ redirectUri: window.location.href })
                .catch(() => router.navigateByUrl('/'))
                .finally(() => {
                  loginRedirectInFlight = false;
                });
            }
            break;
          case 403:
            message = 'Acces refuse';
            break;
          case 404:
            message = 'Ressource non trouvee';
            break;
          case 409:
            message = error.error?.message || 'Conflit de donnees';
            break;
          case 422:
            message = error.error?.message || 'Donnees invalides';
            break;
          case 500:
            message = 'Erreur serveur. Veuillez reessayer plus tard.';
            break;
          case 502:
          case 503:
          case 504:
            message = 'Le backend SupportFlow demarre encore. Reessayez dans quelques secondes.';
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
