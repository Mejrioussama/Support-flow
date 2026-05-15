import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { KnowledgeArticle, KnowledgeArticleAssistRequest, KnowledgeArticleCreate, Page } from '../models';

@Injectable({
  providedIn: 'root'
})
export class KnowledgeBaseService {
  private apiUrl = `${environment.apiUrl}/kb`;

  constructor(private http: HttpClient) {}

  listArticles(page = 0, size = 20): Observable<Page<KnowledgeArticle>> {
    return this.http.get<Page<KnowledgeArticle>>(this.apiUrl, {
      params: { page: `${page}`, size: `${size}` }
    });
  }

  searchArticles(query: string, page = 0, size = 20): Observable<Page<KnowledgeArticle>> {
    return this.http.get<Page<KnowledgeArticle>>(`${this.apiUrl}/search`, {
      params: { query, page: `${page}`, size: `${size}` }
    });
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/categories`);
  }

  getRelatedArticlesForTicket(ticketId: number): Observable<KnowledgeArticle[]> {
    return this.http.get<KnowledgeArticle[]>(`${this.apiUrl}/ticket/${ticketId}/related`);
  }

  suggestForTicket(ticketId: number): Observable<KnowledgeArticle[]> {
    return this.http.get<KnowledgeArticle[]>(`${this.apiUrl}/suggest`, {
      params: { ticketId: `${ticketId}` }
    });
  }

  suggestForDraft(payload: KnowledgeArticleAssistRequest): Observable<KnowledgeArticle[]> {
    return this.http.post<KnowledgeArticle[]>(`${this.apiUrl}/assist`, payload);
  }

  createFromTicket(ticketId: number, payload?: KnowledgeArticleCreate): Observable<KnowledgeArticle> {
    return this.http.post<KnowledgeArticle>(`${this.apiUrl}/ticket/${ticketId}/create-from-ticket`, payload || {});
  }

  createArticle(payload: KnowledgeArticleCreate): Observable<KnowledgeArticle> {
    return this.http.post<KnowledgeArticle>(this.apiUrl, payload);
  }

  getArticle(id: number): Observable<KnowledgeArticle> {
    return this.http.get<KnowledgeArticle>(`${this.apiUrl}/${id}`);
  }

  markHelpful(id: number, helpful = true): Observable<KnowledgeArticle> {
    return this.http.post<KnowledgeArticle>(`${this.apiUrl}/${id}/helpful`, { helpful });
  }

  listByCategory(category: string, page = 0, size = 20): Observable<Page<KnowledgeArticle>> {
    return this.http.get<Page<KnowledgeArticle>>(`${this.apiUrl}/category/${encodeURIComponent(category)}`, {
      params: { page: `${page}`, size: `${size}` }
    });
  }
}
