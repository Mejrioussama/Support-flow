import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { KeycloakService } from 'keycloak-angular';

import { environment } from '../../../environments/environment';

function isSupportFlowApiRequest(url: string): boolean {
  if (url.startsWith('/api')) {
    return true;
  }

  if (url.startsWith(environment.apiUrl)) {
    return true;
  }

  try {
    const requestUrl = new URL(url, window.location.origin);
    const apiUrl = new URL(environment.apiUrl, window.location.origin);
    return requestUrl.origin === apiUrl.origin && requestUrl.pathname.startsWith(apiUrl.pathname);
  } catch {
    return false;
  }
}

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isSupportFlowApiRequest(req.url) || req.headers.has('Authorization')) {
    return next(req);
  }

  const keycloak = inject(KeycloakService);

  return from(Promise.resolve(keycloak.isLoggedIn())).pipe(
    switchMap((isLoggedIn) => {
      if (!isLoggedIn) {
        return next(req);
      }

      return from(keycloak.getToken()).pipe(
        switchMap((token) => {
          if (!token) {
            return next(req);
          }

          return next(
            req.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`
              }
            })
          );
        })
      );
    })
  );
};
