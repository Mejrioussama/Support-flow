import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';
import { Observable, of } from 'rxjs';
import { UserRole } from '../models';

export interface UserInfo {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private keycloak: KeycloakService) { }

  isLoggedIn(): Observable<boolean> {
    try {
      return of(this.keycloak.isLoggedIn());
    } catch (e) {
      return of(false);
    }
  }

  login(): Promise<void> { return this.keycloak.login(); }
  logout(): Promise<void> { return this.keycloak.logout(window.location.origin); }
  getUsername(): string {
    try {
      return this.keycloak.getUsername() || '';
    } catch {
      const tokenParsed = this.keycloak.getKeycloakInstance()?.tokenParsed as any;
      return tokenParsed?.preferred_username || '';
    }
  }
  getToken(): Promise<string> { return this.keycloak.getToken(); }
  getUserProfile(): Promise<KeycloakProfile> { return this.keycloak.loadUserProfile(); }

  getUserInfo(): UserInfo {
    const tokenParsed = this.keycloak.getKeycloakInstance()?.tokenParsed as any;
    return {
      username: tokenParsed?.preferred_username || this.getUsername() || '',
      email: tokenParsed?.email || '',
      firstName: tokenParsed?.given_name || tokenParsed?.name?.split(' ')[0] || '',
      lastName: tokenParsed?.family_name || tokenParsed?.name?.split(' ').slice(1).join(' ') || '',
      emailVerified: tokenParsed?.email_verified || false
    };
  }

  getUserRoles(): string[] {
    let roles = this.keycloak.getUserRoles();
    if (!roles || roles.length === 0) {
      const tokenParsed = this.keycloak.getKeycloakInstance()?.tokenParsed as any;
      if (tokenParsed?.realm_access?.roles) roles = tokenParsed.realm_access.roles;
      if (tokenParsed?.resource_access) {
        Object.values(tokenParsed.resource_access).forEach((access: any) => {
          if (access?.roles) roles = [...roles, ...access.roles];
        });
      }
    }
    return roles || [];
  }

  hasRole(role: string): boolean {
    const roles = this.getUserRoles();
    return roles.includes(role) || roles.includes('ROLE_' + role);
  }

  isAdmin(): boolean { return this.hasRole('ADMIN'); }

  isManager(): boolean { return this.hasRole('SUPPORT_MANAGER') || this.isAdmin(); }

  isAgent(): boolean { return this.hasRole('SUPPORT_AGENT') || this.isManager(); }

  isClient(): boolean {
    return this.hasRole('CLIENT')
      && !this.hasRole('ADMIN')
      && !this.hasRole('SUPPORT_MANAGER')
      && !this.hasRole('SUPPORT_AGENT');
  }

  isStaff(): boolean {
    return this.hasRole('ADMIN')
      || this.hasRole('SUPPORT_MANAGER')
      || this.hasRole('SUPPORT_AGENT');
  }

  getPrimaryRole(): UserRole {
    if (this.isAdmin()) return 'ADMIN';
    if (this.hasRole('SUPPORT_MANAGER')) return 'SUPPORT_MANAGER';
    if (this.hasRole('SUPPORT_AGENT')) return 'SUPPORT_AGENT';
    return 'CLIENT';
  }

  getFullName(): Observable<string> {
    const info = this.getUserInfo();
    const name = `${info.firstName} ${info.lastName}`.trim();
    return of(name || info.username);
  }

  /**
   * Ownership-based ticket permission check.
   *
   * Rules:
   *  ADMIN          → full access (always true)
   *  SUPPORT_MANAGER → can view/supervise all; can act on assigned or self-assigned
   *  SUPPORT_AGENT  → can only act on tickets assigned to them
   *  CLIENT         → can only act on their own tickets
   *
   * @param ticket  Ticket object (needs assignedTo.email and client.email / contactEmail)
   * @param action  'view' | 'edit' | 'assign' | 'take-charge' | 'escalate' |
   *                'escalate-sla' | 'manager-review' | 'resolve' | 'close' | 'delete' | 'comment-internal'
   */
  canActOnTicket(ticket: any, action: string): boolean {
    const role = this.getPrimaryRole();
    const myUsername = this.getUserInfo()?.username?.toLowerCase();

    // Use username for ownership check (more reliable than email)
    const agentUsername = (
      ticket?.assignedTo?.username ||
      ticket?.assignedAgent?.username ||
      ticket?.assignee?.username ||
      ''
    )?.toLowerCase();
    const clientUsername = (ticket?.createdByUser?.username || ticket?.client?.code || '')?.toLowerCase(); // code often matches username for systemic users

    const isSelfAssigned = !!agentUsername && agentUsername === myUsername;
    const isOwnTicket = (!!clientUsername && clientUsername === myUsername) ||
      (ticket?.createdByUser?.username?.toLowerCase() === myUsername);

    const status = ticket?.status as string;
    const isManagerLike = role === 'ADMIN' || role === 'SUPPORT_MANAGER';
    const isAgentLike = role === 'SUPPORT_AGENT';
    const isFinalized = status === 'RESOLVED' || status === 'CLOSED' || status === 'CANCELLED';

    switch (action) {
      case 'view':
        if (isManagerLike) return true;
        if (!myUsername) return false;
        if (isAgentLike) return isSelfAssigned;
        if (role === 'CLIENT') return isOwnTicket;
        return false;

      case 'edit':
        if (isFinalized) return false;
        if (isManagerLike) return true;
        if (!myUsername) return false;
        if (isAgentLike) return isSelfAssigned;
        return false;

      case 'take-charge':
        if (isFinalized || status === 'IN_PROGRESS') return false;
        if (isManagerLike) return !agentUsername || (!!myUsername && isSelfAssigned);
        if (!myUsername) return false;
        if (isAgentLike) return !agentUsername || isSelfAssigned;
        return false;

      case 'resolve':
        if (status !== 'ASSIGNED' && status !== 'IN_PROGRESS' && status !== 'PENDING' && !status.startsWith('ESCALATED')) return false;
        if (!myUsername) return false;
        if (isManagerLike || isAgentLike) return isSelfAssigned;
        return false;

      case 'escalate':
        if (isFinalized) return false;
        if (isManagerLike) return true;
        if (isAgentLike) return isSelfAssigned;
        return false;

      case 'assign':
      case 'escalate-sla':
      case 'manager-review':
        if (isFinalized) return false;
        return isManagerLike;

      case 'sla-pause':
      case 'sla-resume':
        if (isFinalized) return false;
        if (isManagerLike) return true;
        if (!myUsername) return false;
        if (isAgentLike) return isSelfAssigned;
        return false;

      case 'sla-extend':
        if (isFinalized) return false;
        return isManagerLike;

      case 'change-status':
        if (status === 'CLOSED' || status === 'CANCELLED') return false;
        if (isManagerLike) return true;
        if (!myUsername) return false;
        if (isAgentLike) return isSelfAssigned;
        return false;

      case 'close':
        if (status !== 'RESOLVED') return false;
        if (isManagerLike) return true;
        if (!myUsername) return false;
        if (role === 'CLIENT') return isOwnTicket && status === 'RESOLVED';
        return false;

      case 'reopen':
        if (status !== 'RESOLVED' && status !== 'CLOSED') return false;
        return isManagerLike;

      case 'delete':
        return false;

      case 'archive':
        return isManagerLike && status === 'CLOSED' && !ticket?.archived;

      case 'comment-internal':
        if (isManagerLike) return true;
        return isAgentLike && !!myUsername;

      default:
        return false;
    }
  }
}
