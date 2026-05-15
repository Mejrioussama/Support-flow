import { APP_INITIALIZER, enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { KeycloakAngularModule, KeycloakBearerInterceptor, KeycloakService } from 'keycloak-angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { environment } from './environments/environment';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';

// Some browser-only dependencies still probe for the Node global object.
// Define it before Angular bootstraps to avoid runtime crashes in dev.
(window as typeof window & { global?: Window }).global = window;

const KEYCLOAK_BOOT_RETRIES = 4;
const KEYCLOAK_RETRY_DELAY_MS = 3000;

const keycloakBootstrapOptions = {
  config: {
    url: environment.keycloak.url,
    realm: environment.keycloak.realm,
    clientId: environment.keycloak.clientId
  },
  initOptions: {
    onLoad: 'check-sso' as const,
    silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
    checkLoginIframe: false,
    pkceMethod: 'S256' as const
  },
  enableBearerInterceptor: true,
  bearerPrefix: 'Bearer',
  bearerExcludedUrls: ['/assets'],
  // Avoid /account call during check-sso bootstrap when user is not authenticated yet.
  loadUserProfileAtStartUp: false
};

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logKeycloakWarning(message: string, error?: unknown): void {
  if (!environment.production) {
    if (error !== undefined) {
      console.warn(message, error);
      return;
    }
    console.warn(message);
  }
}

async function isKeycloakReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(
      `${environment.keycloak.url}/realms/${environment.keycloak.realm}/.well-known/openid-configuration`,
      {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      }
    );
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function initializeKeycloak(keycloak: KeycloakService) {
  return async () => {
    for (let attempt = 1; attempt <= KEYCLOAK_BOOT_RETRIES; attempt++) {
      const reachable = await isKeycloakReachable();

      if (!reachable) {
        logKeycloakWarning(`Keycloak not reachable yet (attempt ${attempt}/${KEYCLOAK_BOOT_RETRIES}).`);
        if (attempt < KEYCLOAK_BOOT_RETRIES) {
          await wait(KEYCLOAK_RETRY_DELAY_MS);
          continue;
        }
        break;
      }

      try {
        return await keycloak.init(keycloakBootstrapOptions);
      } catch (err) {
        logKeycloakWarning(`Keycloak init failed (attempt ${attempt}/${KEYCLOAK_BOOT_RETRIES}):`, err);
        if (attempt < KEYCLOAK_BOOT_RETRIES) {
          await wait(KEYCLOAK_RETRY_DELAY_MS);
        }
      }
    }

    logKeycloakWarning('Keycloak init skipped after retries. The app will continue and can authenticate once Keycloak is ready.');
    return false;
  };
}

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([errorInterceptor]), withInterceptorsFromDi()),
    importProvidersFrom(KeycloakAngularModule),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: KeycloakBearerInterceptor,
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeKeycloak,
      multi: true,
      deps: [KeycloakService]
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
}).catch(err => console.error(err));
