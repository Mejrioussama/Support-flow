import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '@env/environment';
import { UserSummary } from '../models';

export interface AIStatus {
  status: string;
  ollama_available: boolean;
  model: string;
  available_models: string[];
  checked_at: string;
}

export interface AIAnalysis {
  ticket_id: number;
  ticket_reference: string;
  analysis: Record<string, string>;
  raw: string;
  model: string;
  duration_s: number;
  analyzed_at: string;
}

export interface AISuggestion {
  ticket_id: number;
  ticket_reference: string;
  suggestions: string;
  kb_articles_used: number;
  model: string;
  duration_s: number;
  generated_at: string;
}

export interface AIDiagnosis {
  ticket_id: number;
  ticket_reference: string;
  diagnosis: string;
  model: string;
  duration_s: number;
  generated_at: string;
}

export interface AICopilot {
  ticket_id: number;
  ticket_reference: string;
  copilot: {
    SUMMARY?: string;
    LIKELY_CAUSE?: string;
    NEXT_ACTIONS?: string;
    CUSTOMER_REPLY?: string;
    RISKS?: string;
    KB_HINTS?: string;
  };
  raw: string;
  model: string;
  duration_s: number;
  generated_at: string;
}

export interface AIEscalationSummary {
  ticket_id: number;
  ticket_reference: string;
  escalation_level: number;
  escalation_count: number;
  events_count: number;
  summary: string;
  model: string;
  duration_s: number;
  generated_at: string;
}

export interface AITrends {
  period_days: number;
  metrics_summary: {
    total: number;
    resolved: number;
    breach_rate: number;
    escalation_rate: number;
  };
  insights: string;
  model: string;
  duration_s: number;
  generated_at: string;
}

export interface AIChatResponse {
  question: string;
  answer: string;
  ticket_context: number | null;
  model: string;
  duration_s: number;
  responded_at: string;
}

export interface AIKnowledgeDraft {
  title?: string;
  category?: string;
  tags?: string[];
  article?: string;
  content?: string;
  summary?: string;
  [key: string]: any;
}

export interface AIAssignmentRecommendation {
  ticket_id: number;
  ticket_reference: string;
  recommended_agent_id: number | null;
  recommended_agent_name: string;
  confidence: string;
  skill_match: string;
  rationale: string;
  manager_validation_note: string;
  fallback_used: boolean;
  manager_validation_required: boolean;
  raw?: string;
  model: string;
  duration_s: number;
  generated_at: string;
  candidates: UserSummary[];
}

export interface AIAssignmentRecommendationPreviewRequest {
  ticketId?: number;
  reference?: string;
  title?: string;
  description?: string;
  type?: string;
  severity?: string;
  impact?: string;
  category?: string;
  assignedAgentId?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class AIService {
  private apiUrl = `${environment.apiUrl}/ai`;
  private readonly AI_TIMEOUT = 300_000; // 5 min (CPU-only Ollama is slow)
  private readonly ASSIGNMENT_TIMEOUT = 15_000; // assignment must degrade fast to fallback UX

  constructor(private http: HttpClient) {}

  getStatus(): Observable<AIStatus> {
    return this.http.get<AIStatus>(`${this.apiUrl}/status`).pipe(timeout(10_000));
  }

  analyzeTicket(ticketId: number): Observable<AIAnalysis> {
    return this.http.get<AIAnalysis>(`${this.apiUrl}/analyze/${ticketId}`).pipe(timeout(this.AI_TIMEOUT));
  }

  suggestResponse(ticketId: number): Observable<AISuggestion> {
    return this.http.get<AISuggestion>(`${this.apiUrl}/suggest-response/${ticketId}`).pipe(timeout(this.AI_TIMEOUT));
  }

  copilot(ticketId: number): Observable<AICopilot> {
    return this.http.get<AICopilot>(`${this.apiUrl}/copilot/${ticketId}`).pipe(timeout(this.AI_TIMEOUT));
  }

  diagnoseTicket(ticketId: number): Observable<AIDiagnosis> {
    return this.http.get<AIDiagnosis>(`${this.apiUrl}/diagnose/${ticketId}`).pipe(timeout(this.AI_TIMEOUT));
  }

  escalationSummary(ticketId: number): Observable<AIEscalationSummary> {
    return this.http.get<AIEscalationSummary>(`${this.apiUrl}/escalation-summary/${ticketId}`).pipe(timeout(this.AI_TIMEOUT));
  }

  getAssignmentRecommendation(ticketId: number): Observable<AIAssignmentRecommendation> {
    return this.http.get<AIAssignmentRecommendation>(`${this.apiUrl}/assignment-recommendation/${ticketId}`).pipe(timeout(this.ASSIGNMENT_TIMEOUT));
  }

  getAssignmentRecommendationPreview(payload: AIAssignmentRecommendationPreviewRequest): Observable<AIAssignmentRecommendation> {
    return this.http.post<AIAssignmentRecommendation>(`${this.apiUrl}/assignment-recommendation-preview`, payload).pipe(timeout(this.ASSIGNMENT_TIMEOUT));
  }

  analyzeTrends(days: number = 30): Observable<AITrends> {
    return this.http.get<AITrends>(`${this.apiUrl}/trends`, { params: { days: days.toString() } }).pipe(timeout(this.AI_TIMEOUT));
  }

  chat(message: string, ticketId?: number, history?: { role: string; content: string }[]): Observable<AIChatResponse> {
    return this.http.post<AIChatResponse>(`${this.apiUrl}/chat`, {
      message,
      ticketId: ticketId || null,
      history: history || []
    }).pipe(timeout(this.AI_TIMEOUT));
  }

  generateKbArticle(ticketId: number): Observable<AIKnowledgeDraft> {
    return this.http.get<AIKnowledgeDraft>(`${this.apiUrl}/generate-kb/${ticketId}`).pipe(timeout(this.AI_TIMEOUT));
  }
}
