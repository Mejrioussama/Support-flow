import { Router, UrlTree } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let keycloakSpy: jasmine.SpyObj<KeycloakService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    keycloakSpy = jasmine.createSpyObj<KeycloakService>('KeycloakService', [
      'isLoggedIn',
      'getUserRoles',
      'login'
    ]);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['parseUrl']);
    guard = new AuthGuard(routerSpy, keycloakSpy);
  });

  // Regression test for the "skips straight to Keycloak" bug: opening the app at '/' used to
  // redirect to the guarded '/dashboard' route, and the guard auto-called keycloak.login() the
  // instant it saw an unauthenticated visitor - a full browser redirect off the SPA that never
  // gave AppComponent's own login screen (with its "Authentification"/"Creer un compte" buttons)
  // a chance to render. The guard must now just deny the route and let the app render its own
  // login screen; only that screen's own button click is allowed to trigger keycloak.login().
  it('denies an unauthenticated visitor without ever calling keycloak.login()', async () => {
    keycloakSpy.isLoggedIn.and.returnValue(false);
    keycloakSpy.getUserRoles.and.returnValue([]);

    const result = await guard.canActivate(
      { data: {} } as any,
      { url: '/dashboard' } as any
    );

    expect(result).toBe(false);
    expect(keycloakSpy.login).not.toHaveBeenCalled();
  });

  it('allows an authenticated user through to a route matching their role', async () => {
    keycloakSpy.isLoggedIn.and.returnValue(true);
    keycloakSpy.getUserRoles.and.returnValue(['SUPPORT_AGENT']);

    const result = await guard.canActivate(
      { data: { roles: ['SUPPORT_AGENT'] } } as any,
      { url: '/agent-workbench' } as any
    );

    expect(result).toBe(true);
    expect(keycloakSpy.login).not.toHaveBeenCalled();
  });

  it('redirects an authenticated user without the required role instead of denying silently', async () => {
    keycloakSpy.isLoggedIn.and.returnValue(true);
    keycloakSpy.getUserRoles.and.returnValue(['CLIENT']);
    const redirectTree = {} as UrlTree;
    routerSpy.parseUrl.and.returnValue(redirectTree);

    const result = await guard.canActivate(
      { data: { roles: ['ADMIN', 'SUPPORT_MANAGER'] } } as any,
      { url: '/clients' } as any
    );

    expect(result).toBe(redirectTree);
    expect(routerSpy.parseUrl).toHaveBeenCalledWith('/my-tickets');
  });
});
