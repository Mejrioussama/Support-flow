import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '@env/environment';
import { Notification, Page } from '../models';
import { WebSocketService, WebSocketEvent } from './websocket.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {

  private apiUrl = `${environment.apiUrl}/notifications`;

  private notifications$ = new BehaviorSubject<Notification[]>([]);
  private unreadCount$ = new BehaviorSubject<number>(0);
  private toastMessage$ = new Subject<{ title: string; message: string; type: string }>();

  private wsSub: Subscription | null = null;

  private logDevWarning(message: string, error: unknown): void {
    if (!environment.production) {
      console.warn(message, error);
    }
  }

  constructor(
    private http: HttpClient,
    private wsService: WebSocketService
  ) {}

  /**
   * Initialise le service: charge les notifications et ecoute le WebSocket
   */
  init(): void {
    this.loadUnreadCount();
    this.loadUnreadNotifications();
    this.listenToWebSocket();
  }

  /**
   * Ecoute les evenements WebSocket pour les notifications temps reel
   */
  private listenToWebSocket(): void {
    this.wsSub = this.wsService.getEvents().subscribe((event: WebSocketEvent) => {
      switch (event.type) {
        case 'STATUS_CHANGE':
          this.showToast(
            'Statut mis a jour',
            `Ticket ${event.ticketReference}: ${event.oldStatus} -> ${event.newStatus}`,
            'info'
          );
          break;
        case 'NEW_COMMENT':
          this.showToast(
            'Nouveau commentaire',
            `${event.authorName} a commente ${event.ticketReference}`,
            'info'
          );
          break;
        case 'CUSTOMER_RESPONSE_RECEIVED':
          this.showToast(
            'Reponse client recue',
            `${event.authorName} a repondu sur ${event.ticketReference}. Le ticket repart en traitement.`,
            'success'
          );
          this.loadUnreadNotifications();
          break;
        case 'CAMUNDA_TASK':
          this.showToast(
            'Tache workflow',
            `${event.taskName} - ${event.taskAction} (${event.ticketReference})`,
            'info'
          );
          break;

        // Smart SLA notification events
        case 'SLA_WARNING_50':
          this.showToast(
            'Suivi SLA',
            `Ticket ${event.ticketReference} : point de controle SLA enregistre.`,
            'info'
          );
          this.loadUnreadNotifications();
          break;
        case 'SLA_WARNING_80':
          this.showToast(
            'SLA a risque',
            `Ticket ${event.ticketReference} : proche du depassement SLA. Reaffectation ou action rapide recommandee.`,
            'warning'
          );
          this.loadUnreadNotifications();
          break;
        case 'SLA_ESCALATION':
          this.showToast(
            'SLA depasse',
            `Ticket ${event.ticketReference} : SLA depasse. Intervention manager requise.`,
            'error'
          );
          this.loadUnreadNotifications();
          break;
        case 'SLA_CRITICAL_EVENT':
          this.showToast(
            'Escalade prolongee',
            `Ticket ${event.ticketReference} reste en escalade depuis plus de 24h.`,
            'error'
          );
          this.loadUnreadNotifications();
          break;
      }
      this.loadUnreadCount();
    });
  }

  /**
   * Charge les notifications non lues depuis l'API
   */
  loadUnreadNotifications(): void {
    this.http.get<Notification[]>(`${this.apiUrl}/unread`).subscribe({
      next: (notifications) => this.notifications$.next(notifications),
      error: (err) => this.logDevWarning('Erreur chargement notifications:', err)
    });
  }

  /**
   * Charge le compteur de notifications non lues
   */
  loadUnreadCount(): void {
    this.http.get<{ count: number }>(`${this.apiUrl}/unread/count`).subscribe({
      next: (result) => this.unreadCount$.next(result.count),
      error: (err) => this.logDevWarning('Erreur compteur notifications:', err)
    });
  }

  /**
   * Observable des notifications
   */
  getNotifications(): Observable<Notification[]> {
    return this.notifications$.asObservable();
  }

  getNotificationPage(page = 0, size = 50, sort = 'createdAt,desc'): Observable<Page<Notification>> {
    return this.http.get<Page<Notification>>(`${this.apiUrl}?page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`);
  }

  /**
   * Observable du compteur de notifications non lues
   */
  getUnreadCount(): Observable<number> {
    return this.unreadCount$.asObservable();
  }

  /**
   * Observable des messages toast
   */
  getToastMessages(): Observable<{ title: string; message: string; type: string }> {
    return this.toastMessage$.asObservable();
  }

  /**
   * Marque une notification comme lue
   */
  markAsRead(notificationId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${notificationId}/read`, {}).pipe(
      tap(() => {
        const updated = this.notifications$.value.map(n =>
          n.id === notificationId ? { ...n, isRead: true, read: true } : n
        );
        this.notifications$.next(updated);
        this.unreadCount$.next(Math.max(0, this.unreadCount$.value - 1));
      })
    );
  }

  /**
   * Marque toutes comme lues
   */
  markAllAsRead(): void {
    this.http.post<{ markedAsRead: number }>(`${this.apiUrl}/read-all`, {}).subscribe({
      next: () => {
        this.unreadCount$.next(0);
        const all = this.notifications$.value.map(n => ({ ...n, isRead: true }));
        this.notifications$.next(all);
      },
      error: (err) => this.logDevWarning('Erreur mark all read:', err)
    });
  }

  deleteNotification(notificationId: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/${notificationId}`).pipe(
      tap((result) => {
        if (!result.deleted) return;
        const removed = this.notifications$.value.find(n => n.id === notificationId);
        const updated = this.notifications$.value.filter(n => n.id !== notificationId);
        this.notifications$.next(updated);
        if (removed && !(removed.isRead || removed.read)) {
          this.unreadCount$.next(Math.max(0, this.unreadCount$.value - 1));
        }
      })
    );
  }

  deleteReadNotifications(): Observable<{ deleted: number }> {
    return this.http.delete<{ deleted: number }>(`${this.apiUrl}/read`).pipe(
      tap(() => {
        const unread = this.notifications$.value.filter(n => !(n.isRead || n.read));
        this.notifications$.next(unread);
      })
    );
  }

  private showToast(title: string, message: string, type: string): void {
    this.toastMessage$.next({ title, message, type });
  }

  refresh(): void {
    this.loadUnreadCount();
    this.loadUnreadNotifications();
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
  }
}
