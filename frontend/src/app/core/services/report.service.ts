import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { MonthlyReport } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  generateMonthlyReport(year: number, month: number): Observable<MonthlyReport> {
    return this.http.post<MonthlyReport>(`${this.apiUrl}/monthly/${year}/${month}`, {});
  }

  downloadMonthlyReport(year: number, month: number, format: 'pdf' | 'xlsx'): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/monthly/${year}/${month}/download`, {
      params: { format },
      responseType: 'blob'
    });
  }
}
