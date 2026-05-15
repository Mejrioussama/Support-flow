import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { Ticket, TicketCreate, TicketUpdate, Page, PageRequest, Comment, Attachment, TicketArchiveDocument, TicketHistoryEntry, ArchivedTicketSearchParams, WorkflowStatus, WorkflowTrace, TicketResolveRequest, WaitingOn, AgentWorkbench } from '../models';

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private apiUrl = `${environment.apiUrl}/tickets`;

  constructor(private http: HttpClient) {}

  getTickets(params?: PageRequest & {
    status?: string;
    priority?: string;
    clientId?: number;
    waitingOn?: WaitingOn;
    actionBucket?: string;
    hasCustomerReply?: boolean;
    resolutionRejected?: boolean;
    unassigned?: boolean;
    slaState?: string;
  }): Observable<Page<Ticket>> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
      if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
      if (params.sort) httpParams = httpParams.set('sort', params.sort);
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.priority) httpParams = httpParams.set('priority', params.priority);
      if (params.clientId) httpParams = httpParams.set('clientId', params.clientId.toString());
      if (params.waitingOn) httpParams = httpParams.set('waitingOn', params.waitingOn);
      if (params.actionBucket) httpParams = httpParams.set('actionBucket', params.actionBucket);
      if (params.hasCustomerReply !== undefined) httpParams = httpParams.set('hasCustomerReply', `${params.hasCustomerReply}`);
      if (params.resolutionRejected !== undefined) httpParams = httpParams.set('resolutionRejected', `${params.resolutionRejected}`);
      if (params.unassigned !== undefined) httpParams = httpParams.set('unassigned', `${params.unassigned}`);
      if (params.slaState) httpParams = httpParams.set('slaState', params.slaState);
      const search = (params as any).search as string | undefined;
      if (search) httpParams = httpParams.set('q', search);
    }

    const hasSearch = !!(params as any)?.search;
    const url = hasSearch ? `${this.apiUrl}/search` : this.apiUrl;
    return this.http.get<Page<Ticket>>(url, { params: httpParams }).pipe(
      map(page => this.normalizePage(page))
    );
  }

  getMyTickets(params?: PageRequest & {
    status?: string;
    priority?: string;
    waitingOn?: WaitingOn;
    hasCustomerReply?: boolean;
    resolutionRejected?: boolean;
    slaState?: string;
    search?: string;
  }): Observable<Page<Ticket>> {
    let httpParams = new HttpParams();

    if (params) {
      if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
      if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
      if (params.sort) httpParams = httpParams.set('sort', params.sort);
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.priority) httpParams = httpParams.set('priority', params.priority);
      if (params.waitingOn) httpParams = httpParams.set('waitingOn', params.waitingOn);
      if (params.hasCustomerReply !== undefined) httpParams = httpParams.set('hasCustomerReply', `${params.hasCustomerReply}`);
      if (params.resolutionRejected !== undefined) httpParams = httpParams.set('resolutionRejected', `${params.resolutionRejected}`);
      if (params.slaState) httpParams = httpParams.set('slaState', params.slaState);
      if (params.search) httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<Page<Ticket>>(`${this.apiUrl}/my-tickets`, { params: httpParams }).pipe(
      map(page => this.normalizePage(page))
    );
  }

  getAgentWorkbench(limit = 8): Observable<AgentWorkbench> {
    return this.http.get<AgentWorkbench>(`${this.apiUrl}/agent-workbench`, {
      params: { limit: `${limit}` }
    }).pipe(
      map(workbench => ({
        availableToTake: (workbench.availableToTake || []).map(ticket => this.normalizeTicket(ticket)),
        assignedOpen: (workbench.assignedOpen || []).map(ticket => this.normalizeTicket(ticket)),
        waitingCustomer: (workbench.waitingCustomer || []).map(ticket => this.normalizeTicket(ticket)),
        customerReplied: (workbench.customerReplied || []).map(ticket => this.normalizeTicket(ticket)),
        resolutionRejected: (workbench.resolutionRejected || []).map(ticket => this.normalizeTicket(ticket))
      }))
    );
  }

  getTicketById(id: number): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.apiUrl}/${id}`).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  getTicket(id: number): Observable<Ticket> {
    return this.getTicketById(id);
  }

  getTicketByReference(reference: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.apiUrl}/reference/${reference}`).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  createTicket(ticket: any): Observable<Ticket> {
    return this.http.post<Ticket>(this.apiUrl, ticket).pipe(
      map(created => this.normalizeTicket(created))
    );
  }

  updateTicket(id: number, ticket: TicketUpdate): Observable<Ticket> {
    return this.http.put<Ticket>(`${this.apiUrl}/${id}`, ticket).pipe(
      map(updated => this.normalizeTicket(updated))
    );
  }

  updateTicketStatus(id: number, status: string): Observable<Ticket> {
    return this.changeStatus(id, status);
  }

  deleteTicket(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  assignTicket(ticketId: number, agentId: number, source?: 'MANUAL' | 'AI_RECOMMENDATION'): Observable<Ticket> {
    const body = source ? { source } : {};
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/assign/${agentId}`, body).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  changeStatus(ticketId: number, status: string): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.apiUrl}/${ticketId}/status`, { status }).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  resolveTicket(ticketId: number, payload: TicketResolveRequest): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/resolve`, payload).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  closeTicket(ticketId: number): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/close`, {}).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  archiveTicket(ticketId: number): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/archive`, {}).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  // Workflow actions
  takeCharge(ticketId: number): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/take-charge`, {}).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  escalateTicket(ticketId: number, newAgentId: number, motif: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/escalate`, { newAgentId, motif }).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  escalateSLA(ticketId: number): Observable<Ticket> {
    return this.requestManagerReview(ticketId, 'Revue manager declenchee depuis escalade SLA');
  }

  requestManagerReview(ticketId: number, reason: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/manager-review`, { reason }).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  legacyEscalateSLA(ticketId: number): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/escalate-sla`, {}).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  getEscalationHistory(ticketId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${ticketId}/escalation-history`);
  }

  updateSlaDueDate(ticketId: number, dueDate: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/sla-due-date`, { dueDate }).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  pauseSla(ticketId: number, reason: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/sla-pause`, { reason }).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  resumeSla(ticketId: number): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/sla-resume`, {}).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  waitForCustomer(ticketId: number, waitingOn: WaitingOn, pendingReason: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/wait-for-customer`, { waitingOn, pendingReason }).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  extendSla(ticketId: number, minutes: number, reason: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/sla-extend`, { minutes, reason }).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  closeTicketWithSatisfaction(ticketId: number, satisfactionRating: number, satisfactionComment: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/close`, { satisfactionRating, satisfactionComment }).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  rejectResolution(ticketId: number, reason: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/${ticketId}/reject-resolution`, { reason }).pipe(
      map(ticket => this.normalizeTicket(ticket))
    );
  }

  // Comments
  getComments(ticketId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.apiUrl}/${ticketId}/comments`);
  }

  getPublicComments(ticketId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.apiUrl}/${ticketId}/comments/public`);
  }

  addComment(ticketId: number, content: string, isInternal: boolean = false): Observable<Comment> {
    return this.http.post<Comment>(`${this.apiUrl}/${ticketId}/comments`, { content, isInternal });
  }

  getAttachments(ticketId: number): Observable<Attachment[]> {
    return this.http.get<Attachment[]>(`${this.apiUrl}/${ticketId}/attachments`);
  }

  getAlfrescoDocuments(ticketId: number): Observable<TicketArchiveDocument[]> {
    return this.http.get<TicketArchiveDocument[]>(`${this.apiUrl}/${ticketId}/alfresco-documents`);
  }

  downloadAlfrescoDocumentBinary(ticketId: number, objectId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${ticketId}/alfresco-documents/content`, {
      params: { objectId },
      responseType: 'blob'
    });
  }

  uploadAttachment(ticketId: number, file: File, description?: string): Observable<Attachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }
    return this.http.post<Attachment>(`${this.apiUrl}/${ticketId}/attachments`, formData);
  }

  deleteAttachment(attachmentId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/attachments/${attachmentId}`);
  }

  downloadAttachmentBinary(attachmentId: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/attachments/${attachmentId}/download`, {
      responseType: 'blob'
    });
  }

  getTicketHistory(ticketId: number, page = 0, size = 50): Observable<Page<TicketHistoryEntry>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', 'createdAt,desc');
    return this.http.get<Page<TicketHistoryEntry>>(`${this.apiUrl}/${ticketId}/history`, { params });
  }

  getWorkflowStatus(ticketId: number): Observable<WorkflowStatus> {
    return this.http.get<WorkflowStatus>(`${this.apiUrl}/${ticketId}/workflow-status`);
  }

  getWorkflowTrace(ticketId: number): Observable<WorkflowTrace> {
    return this.http.get<WorkflowTrace>(`${this.apiUrl}/${ticketId}/workflow-trace`);
  }

  // Statistics
  searchTickets(query: string): Observable<Ticket[]> {
    return this.http.get<Page<Ticket>>(`${this.apiUrl}/search`, { params: { q: query } }).pipe(
      map(page => (page.content || []).map(ticket => this.normalizeTicket(ticket)))
    );
  }

  searchArchivedTickets(params?: ArchivedTicketSearchParams): Observable<Page<Ticket>> {
    let httpParams = new HttpParams();

    if (params) {
      if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
      if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
      if (params.sort) httpParams = httpParams.set('sort', params.sort);
      if (params.clientId) httpParams = httpParams.set('clientId', params.clientId.toString());
      if (params.collaboratorId) httpParams = httpParams.set('collaboratorId', params.collaboratorId.toString());
      if (params.severity) httpParams = httpParams.set('severity', params.severity);
      if (params.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
      if (params.toDate) httpParams = httpParams.set('toDate', params.toDate);
    }

    return this.http.get<Page<Ticket>>(`${this.apiUrl}/archived/search`, { params: httpParams }).pipe(
      map(page => this.normalizePage(page))
    );
  }

  private normalizePage(page: Page<Ticket>): Page<Ticket> {
    return {
      ...page,
      content: (page.content || []).map(ticket => this.normalizeTicket(ticket))
    };
  }

  private normalizeTicket(ticket: Ticket): Ticket {
    if (!ticket) {
      return ticket;
    }

    const normalizedClient = ticket.client
      ? {
          ...ticket.client,
          name: ticket.client.name || ticket.client.companyName
        }
      : ticket.client;

    const assigned = ticket.assignedTo || ticket.assignedAgent || ticket.assignee;

    return {
      ...ticket,
      client: normalizedClient,
      assignedTo: assigned,
      assignedAgent: assigned,
      assignee: assigned
    };
  }
}
