import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

export interface WebSocketEvent {
  type: string;
  ticketId?: number;
  ticketReference?: string;
  oldStatus?: string;
  newStatus?: string;
  authorName?: string;
  content?: string;
  taskName?: string;
  taskAction?: string;
  timestamp?: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {

  private client: Client | null = null;
  private subscriptions: StompSubscription[] = [];

  private connected$ = new BehaviorSubject<boolean>(false);
  private events$ = new Subject<WebSocketEvent>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(private authService: AuthService) {}

  /**
   * Connecte au WebSocket STOMP du backend
   */
  connect(): void {
    try {
      if (this.client?.active) {
        return;
      }

      const configuredUrl = environment.websocket?.url || 'http://127.0.0.1:8080/api/ws';
      const sockJsUrl = configuredUrl
        .replace(/^ws:\/\//i, 'http://')
        .replace(/^wss:\/\//i, 'https://')
        .replace(/\/ws-native$/i, '/ws');

      this.client = new Client({
        webSocketFactory: () => new SockJS(sockJsUrl),
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: (_msg: string) => {
          // Uncomment for debugging: console.log('STOMP:', _msg);
        },
        onConnect: () => {
          this.connected$.next(true);
          this.reconnectAttempts = 0;
          this.subscribeToTopics();
        },
        onDisconnect: () => {
          this.connected$.next(false);
        },
        onStompError: (frame) => {
          console.error('Erreur STOMP:', frame.headers['message']);
          this.reconnectAttempts++;
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnect attempts reached, stopping');
            this.client?.deactivate();
          }
        }
      });

      this.client.activate();
    } catch (error) {
      console.warn('WebSocket connection failed:', error);
    }
  }

  /**
   * S'abonne aux topics WebSocket
   */
  private subscribeToTopics(): void {
    if (!this.client?.connected) return;

    this.unsubscribeAll();

    const ticketSub = this.client.subscribe('/topic/tickets', (message: IMessage) => {
      try {
        const event: WebSocketEvent = JSON.parse(message.body);
        this.events$.next(event);
      } catch (e) {
        console.warn('Erreur parsing WebSocket message:', e);
      }
    });
    this.subscriptions.push(ticketSub);

    const taskSub = this.client.subscribe('/topic/tasks', (message: IMessage) => {
      try {
        const event: WebSocketEvent = JSON.parse(message.body);
        this.events$.next(event);
      } catch (e) {
        console.warn('Erreur parsing WebSocket task message:', e);
      }
    });
    this.subscriptions.push(taskSub);

    const slaSub = this.client.subscribe('/topic/sla-alerts', (message: IMessage) => {
      try {
        const event: WebSocketEvent = JSON.parse(message.body);
        this.events$.next(event);
      } catch (e) {
        console.warn('Erreur parsing WebSocket SLA alert message:', e);
      }
    });
    this.subscriptions.push(slaSub);
  }

  /**
   * S'abonne aux evenements d'un ticket specifique
   */
  subscribeToTicket(ticketId: number): Observable<WebSocketEvent> {
    if (this.client?.connected) {
      const sub = this.client.subscribe(`/topic/tickets/${ticketId}`, (message: IMessage) => {
        try {
          const event: WebSocketEvent = JSON.parse(message.body);
          this.events$.next(event);
        } catch (e) {
          console.warn('Erreur parsing ticket WebSocket message:', e);
        }
      });
      this.subscriptions.push(sub);
    }

    return this.events$.asObservable().pipe(
      filter(event => event.ticketId === ticketId)
    );
  }

  /**
   * S'abonne aux commentaires d'un ticket
   */
  subscribeToTicketComments(ticketId: number): Observable<WebSocketEvent> {
    if (this.client?.connected) {
      const sub = this.client.subscribe(`/topic/tickets/${ticketId}/comments`, (message: IMessage) => {
        try {
          const event: WebSocketEvent = JSON.parse(message.body);
          this.events$.next(event);
        } catch (e) {
          console.warn('Erreur parsing comment WebSocket message:', e);
        }
      });
      this.subscriptions.push(sub);
    }

    return this.events$.asObservable().pipe(
      filter(event => event.type === 'NEW_COMMENT' && event.ticketId === ticketId)
    );
  }

  /**
   * Observable de tous les evenements
   */
  getEvents(): Observable<WebSocketEvent> {
    return this.events$.asObservable();
  }

  /**
   * Observable des evenements de statut
   */
  getStatusChanges(): Observable<WebSocketEvent> {
    return this.events$.asObservable().pipe(
      filter(event => event.type === 'STATUS_CHANGE')
    );
  }

  /**
   * Observable des taches Camunda
   */
  getCamundaTasks(): Observable<WebSocketEvent> {
    return this.events$.asObservable().pipe(
      filter(event => event.type === 'CAMUNDA_TASK')
    );
  }

  /**
   * Observable de l'etat de connexion
   */
  isConnected(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  /**
   * Deconnecte proprement
   */
  disconnect(): void {
    this.unsubscribeAll();
    if (this.client?.active) {
      this.client.deactivate();
    }
    this.connected$.next(false);
  }

  private unsubscribeAll(): void {
    this.subscriptions.forEach(sub => {
      try {
        sub.unsubscribe();
      } catch (e) {
        // ignore
      }
    });
    this.subscriptions = [];
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}

