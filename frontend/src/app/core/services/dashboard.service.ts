import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { DashboardStats, TrendData, AgentPerformance, AgentAvailability } from '../models';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  getStats(): Observable<DashboardStats> {
    return this.http.get<any>(`${this.apiUrl}/stats`).pipe(
      map(stats => this.normalizeStats(stats)),
      catchError(() => of(this.getDefaultStats()))
    );
  }

  getTicketsTrend(days: number = 30): Observable<TrendData[]> {
    return this.http.get<any[]>(`${this.apiUrl}/trend`, { params: { days: days.toString() } }).pipe(
      map(trend => trend.map(point => ({
        date: point.date,
        created: point.created ?? point.createdCount ?? 0,
        resolved: point.resolved ?? point.resolvedCount ?? 0
      }))),
      catchError(() => of([]))
    );
  }

  getTopAgents(limit: number = 5): Observable<AgentPerformance[]> {
    return this.http.get<AgentPerformance[]>(`${this.apiUrl}/top-agents`, { params: { limit: limit.toString() } }).pipe(
      catchError(() => of([]))
    );
  }

  getSlaStats(): Observable<{ onTime: number; breached: number; atRisk: number }> {
    return this.http.get<{ onTime: number; breached: number; atRisk: number }>(`${this.apiUrl}/sla`).pipe(
      catchError(() => of({ onTime: 0, breached: 0, atRisk: 0 }))
    );
  }

  getRecentActivity(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/activity`).pipe(
      catchError(() => of([]))
    );
  }

  getAgentAvailability(): Observable<AgentAvailability[]> {
    return this.http.get<AgentAvailability[]>(`${environment.apiUrl}/agents/availability`).pipe(
      catchError(() => of([]))
    );
  }

  private getDefaultStats(): DashboardStats {
    return {
      totalTickets: 0,
      openTickets: 0,
      inProgressTickets: 0,
      resolvedToday: 0,
      ticketsCreatedToday: 0,
      ticketsResolvedToday: 0,
      avgResolutionTime: 0,
      formattedAverageResolutionTime: '0h00min',
      slaBreachRate: 0,
      averageSatisfactionRating: null,
      ticketsByPriority: {},
      ticketsByStatus: {},
      dailyTrend: [],
      ticketsTrend: [],
      topAgents: []
    };
  }

  private normalizeStats(stats: any): DashboardStats {
    const ticketsByPriority = stats?.ticketsByPriority || {};
    const averageResolutionMinutes = Number(stats?.averageResolutionTime || 0);
    const urgentTickets =
      Number(ticketsByPriority['HIGH'] || 0) +
      Number(ticketsByPriority['CRITICAL'] || 0) +
      Number(ticketsByPriority['SUPER_CRITICAL'] || 0);
    const dailyTrend: TrendData[] = (stats?.dailyTrend || []).map((point: any) => ({
      date: point.date,
      created: point.created ?? point.createdCount ?? 0,
      resolved: point.resolved ?? point.resolvedCount ?? 0
    }));

    return {
      totalTickets: Number(stats?.totalTickets || 0),
      openTickets: Number(stats?.openTickets || 0),
      inProgressTickets: Number(stats?.inProgressTickets || 0),
      resolvedTickets: Number(stats?.resolvedTickets || 0),
      closedTickets: Number(stats?.closedTickets || 0),
      urgentTickets,
      escalatedManualTickets: Number(stats?.escalatedManualTickets || 0),
      escalatedSlaTickets: Number(stats?.escalatedSlaTickets || 0),
      resolvedToday: Number(stats?.ticketsResolvedToday || stats?.resolvedToday || 0),
      ticketsCreatedToday: Number(stats?.ticketsCreatedToday || 0),
      ticketsResolvedToday: Number(stats?.ticketsResolvedToday || 0),
      avgResolutionTime: averageResolutionMinutes > 0 ? averageResolutionMinutes / 60 : 0,
      formattedAverageResolutionTime: stats?.formattedAverageResolutionTime || '0h00min',
      averageSatisfactionRating: stats?.averageSatisfactionRating ?? null,
      slaBreachRate: Number(stats?.slaBreachRate || 0),
      slaComplianceRate: Number(stats?.slaComplianceRate || 0),
      slaBreachedTickets: Number(stats?.slaBreachedTickets || 0),
      slaAtRiskTickets: Number(stats?.slaAtRiskTickets || 0),
      slaOnTrackTickets: Number(stats?.slaOnTrackTickets || 0),
      ticketsByPriority,
      ticketsByStatus: stats?.ticketsByStatus || {},
      dailyTrend,
      ticketsTrend: dailyTrend,
      topAgents: stats?.topAgents || []
    };
  }
}
