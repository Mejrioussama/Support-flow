import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { KeycloakAuthGuard, KeycloakService } from 'keycloak-angular';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard extends KeycloakAuthGuard {
  constructor(
    protected override readonly router: Router,
    protected readonly keycloak: KeycloakService
  ) {
    super(router, keycloak);
  }

  async isAccessAllowed(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> {
    if (!this.authenticated) {
      if (state.url !== '/') {
        return this.router.parseUrl('/');
      }
      return false;
    }

    const userRoles = this.keycloak.getUserRoles();
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('ROLE_ADMIN');
    const isManager = userRoles.includes('SUPPORT_MANAGER') || userRoles.includes('ROLE_SUPPORT_MANAGER');
    const isAgent = userRoles.includes('SUPPORT_AGENT') || userRoles.includes('ROLE_SUPPORT_AGENT');
    const isStaff = isAdmin || isManager || isAgent;
    const isClient = userRoles.includes('CLIENT') || userRoles.includes('ROLE_CLIENT');

    // Handle root redirection logic
    if (state.url === '/' || state.url === '/dashboard') {
      if (isClient && !isStaff) {
        return this.router.parseUrl('/my-tickets');
      }
    }

    if (state.url === '/my-tickets') {
      if (isStaff && !isClient) {
        return this.router.parseUrl('/dashboard');
      }
    }

    // Check required roles for the route
    const requiredRoles = route.data['roles'] as string[];
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const hasRole = requiredRoles.some((role: string) =>
      userRoles.includes(role) || userRoles.includes('ROLE_' + role)
    );

    if (!hasRole) {
      // Redirect to appropriate home page based on role
      const target = (isClient && !isStaff) ? '/my-tickets' : '/dashboard';
      return this.router.parseUrl(target);
    }

    return true;
  }
}
