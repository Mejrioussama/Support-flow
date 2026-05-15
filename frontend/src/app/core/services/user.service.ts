import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AgentSkill, Page, PageRequest, SupportCategory, User, UserCreate, UserRole, UserSummary } from '../models';

export interface KeycloakMigrationResult {
  userId: number;
  username: string;
  email: string;
  role: string;
  action: string;
  keycloakId: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getUsers(params?: PageRequest & { role?: UserRole; isActive?: boolean; search?: string }): Observable<Page<User>> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
      if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
      if (params.sort) httpParams = httpParams.set('sort', params.sort);
      if (params.role) httpParams = httpParams.set('role', params.role);
      if (params.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive.toString());
      if (params.search) httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<Page<User>>(this.apiUrl, { params: httpParams });
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  getUser(id: number): Observable<User> {
    return this.getUserById(id);
  }

  getUserByUsername(username: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/username/${username}`);
  }

  createUser(user: UserCreate): Observable<User> {
    return this.http.post<User>(this.apiUrl, user);
  }

  updateUser(id: number, user: Partial<UserCreate>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, user);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  activateUser(id: number): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}/activate`, {});
  }

  deactivateUser(id: number): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}/deactivate`, {});
  }

  changePassword(id: number, newPassword: string, temporary = false): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/password`, { newPassword, temporary });
  }

  sendPasswordResetEmail(id: number): Observable<{ message: string; email: string }> {
    return this.http.post<{ message: string; email: string }>(`${this.apiUrl}/${id}/password-reset-email`, {});
  }

  getAgents(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/agents`);
  }

  getAvailableAgents(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/agents/available`);
  }

  getRecommendedAgents(ticketId: number): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(`${environment.apiUrl}/tickets/${ticketId}/recommended-agents`);
  }

  getAssignmentCandidates(ticketId: number): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(`${environment.apiUrl}/tickets/${ticketId}/assignment-candidates`);
  }

  getAgentSkills(userId: number): Observable<AgentSkill[]> {
    return this.http.get<AgentSkill[]>(`${this.apiUrl}/${userId}/skills`);
  }

  updateAgentSkills(userId: number, payload: { primaryCategoryCode?: string | null; secondaryCategoryCode?: string | null }): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${userId}/skills`, payload);
  }

  getSupportCategories(): Observable<SupportCategory[]> {
    return this.http.get<SupportCategory[]>(`${environment.apiUrl}/support-categories`);
  }

  createSupportCategory(category: Partial<SupportCategory>): Observable<SupportCategory> {
    return this.http.post<SupportCategory>(`${environment.apiUrl}/support-categories`, category);
  }

  updateSupportCategory(id: number, category: Partial<SupportCategory>): Observable<SupportCategory> {
    return this.http.put<SupportCategory>(`${environment.apiUrl}/support-categories/${id}`, category);
  }

  deleteSupportCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/support-categories/${id}`);
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`);
  }

  updateProfile(data: { firstName?: string; lastName?: string; phone?: string; avatarUrl?: string }): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/me`, data);
  }

  migrateExistingUsersToKeycloak(): Observable<KeycloakMigrationResult[]> {
    return this.http.post<KeycloakMigrationResult[]>(`${this.apiUrl}/migrate-keycloak`, {});
  }
}
