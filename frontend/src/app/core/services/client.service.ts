import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { Client, ClientCreate, Page, PageRequest } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private apiUrl = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  getClients(params?: PageRequest & { search?: string; isActive?: boolean }): Observable<Page<Client>> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
      if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
      if (params.sort) httpParams = httpParams.set('sort', params.sort);
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive.toString());
    }

    return this.http.get<Page<Client>>(this.apiUrl, { params: httpParams });
  }

  getClientById(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/${id}`);
  }

  getClient(id: number): Observable<Client> {
    return this.getClientById(id);
  }

  getClientByCode(code: string): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/code/${code}`);
  }

  createClient(client: ClientCreate): Observable<Client> {
    return this.http.post<Client>(this.apiUrl, client);
  }

  updateClient(id: number, client: Partial<ClientCreate>): Observable<Client> {
    return this.http.put<Client>(`${this.apiUrl}/${id}`, client);
  }

  deleteClient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  activateClient(id: number): Observable<Client> {
    return this.http.patch<Client>(`${this.apiUrl}/${id}/activate`, {});
  }

  deactivateClient(id: number): Observable<Client> {
    return this.http.patch<Client>(`${this.apiUrl}/${id}/deactivate`, {});
  }

  searchClients(query: string): Observable<Client[]> {
    return this.http.get<Client[]>(`${this.apiUrl}/search`, { params: { q: query } });
  }

  getAllActiveClients(): Observable<Client[]> {
    return this.getClients({ page: 0, size: 200, sort: 'companyName,asc' }).pipe(
      map(page => page.content || [])
    );
  }
}
