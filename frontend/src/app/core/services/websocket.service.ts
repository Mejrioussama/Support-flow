import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, finalize } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

/** Reference-counted broker subscription: torn down once its last caller unsubscribes. */
interface RefCountedSubscription {
  sub: StompSubscription;
  refCount: number;
}

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
  private connecting = false;
  // Per-ticket broker subscriptions, keyed by ticketId, reference-counted so that navigating
  // between tickets (or having multiple components watch the same ticket) doesn't leak an
  // ever-growing set of live STOMP subscriptions - the previous implementation pushed a new
  // subscription onto `subscriptions` on every call to subscribeToTicket()/subscribeToTicketComments()
  // and never removed it until a full disconnect.
  private ticketSubscriptions = new Map<number, RefCountedSubscription>();
  private ticketCommentSubscriptions = new Map<number, RefCountedSubscription>();

  private connected$ = new BehaviorSubject<boolean>(false);
  private backendReady$ = new BehaviorSubject<boolean | null>(null);
  private events$ = new Subject<WebSocketEvent>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectEnabled = false;
  private resettingConnection = false;
  private readinessGeneration = 0;
  private readinessAbortController: AbortController | null = null;

  constructor(private authService: AuthService) {}

  /**
   * Connecte au WebSocket STOMP du backend
   */
  connect(): void {
    if (this.client?.active || this.connecting) {
      return;
    }

    this.reconnectEnabled = true;
    this.connecting = true;
    void this.connectWhenBackendReady();
  }

  private async connectWhenBackendReady(): Promise<void> {
    try {
      const backendReady = await this.waitForBackendReady();
      if (!backendReady) {
        this.connecting = false;
        this.scheduleReconnect();
        return;
      }

      const configuredUrl = environment.websocket?.url || 'http://127.0.0.1:8080/api/ws';
      const sockJsUrl = configuredUrl
        .replace(/^ws:\/\//i, 'http://')
        .replace(/^wss:\/\//i, 'https://')
        .replace(/\/ws-native$/i, '/ws');

      this.client = new Client({
        webSocketFactory: () => new SockJS(sockJsUrl),
        reconnectDelay: 0,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: (_msg: string) => {
          // Uncomment for debugging: console.log('STOMP:', _msg);
        },
        onConnect: () => {
          this.connected$.next(true);
          this.reconnectAttempts = 0;
          this.connecting = false;
          this.subscribeToTopics();
        },
        onDisconnect: () => {
          this.connected$.next(false);
          this.connecting = false;
        },
        onWebSocketClose: () => {
          this.connected$.next(false);
          this.connecting = false;
          if (!this.resettingConnection) {
            this.scheduleReconnect();
          }
        },
        onStompError: (frame) => {
          this.connecting = false;
          this.scheduleReconnect();
        }
      });

      this.client.activate();
    } catch (error) {
      this.connecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.reconnectEnabled || this.reconnectTimer || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.resetAndReconnect();
    }, 1000);
  }

  private async resetAndReconnect(): Promise<void> {
    this.resettingConnection = true;
    const client = this.client;
    this.client = null;

    try {
      if (client?.active) {
        await client.deactivate();
      }
    } finally {
      this.resettingConnection = false;
    }

    if (this.reconnectEnabled) {
      this.connect();
    }
  }

  async waitForBackendReady(maxWaitMs = 60000, pollIntervalMs = 2000): Promise<boolean> {
    const startedAt = Date.now();
    const generation = this.readinessGeneration;

    while (this.reconnectEnabled && generation === this.readinessGeneration && Date.now() - startedAt < maxWaitMs) {
      try {
        const apiBaseUrl = environment.apiUrl.replace(/\/+$/, '');
        const controller = new AbortController();
        this.readinessAbortController = controller;
        const timeout = setTimeout(() => controller.abort(), Math.min(pollIntervalMs, 3000));
        const response = await fetch(`${apiBaseUrl}/actuator/health`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (this.readinessAbortController === controller) {
          this.readinessAbortController = null;
        }

        const health = await response.json().catch(() => null);
        if (response.ok && health?.status === 'UP') {
          this.backendReady$.next(true);
          return true;
        }
      } catch {
        // Backend still warming up; retry quietly.
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    if (this.reconnectEnabled && generation === this.readinessGeneration) {
      this.backendReady$.next(false);
      console.warn('WebSocket backend readiness timeout reached.');
    }
    return false;
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
   * S'abonne aux evenements d'un ticket specifique.
   * The underlying broker subscription is reference-counted and torn down automatically once
   * the last caller unsubscribes from the returned Observable (e.g. component ngOnDestroy),
   * so repeated navigation between tickets no longer accumulates live STOMP subscriptions.
   */
  subscribeToTicket(ticketId: number): Observable<WebSocketEvent> {
    this.acquireTopicSubscription(
      this.ticketSubscriptions,
      ticketId,
      `/topic/tickets/${ticketId}`,
      'ticket'
    );

    return this.events$.asObservable().pipe(
      filter(event => event.ticketId === ticketId),
      finalize(() => this.releaseTopicSubscription(this.ticketSubscriptions, ticketId))
    );
  }

  /**
   * S'abonne aux commentaires d'un ticket. Same reference-counted lifecycle as subscribeToTicket().
   */
  subscribeToTicketComments(ticketId: number): Observable<WebSocketEvent> {
    this.acquireTopicSubscription(
      this.ticketCommentSubscriptions,
      ticketId,
      `/topic/tickets/${ticketId}/comments`,
      'comment'
    );

    return this.events$.asObservable().pipe(
      filter(event => event.type === 'NEW_COMMENT' && event.ticketId === ticketId),
      finalize(() => this.releaseTopicSubscription(this.ticketCommentSubscriptions, ticketId))
    );
  }

  private acquireTopicSubscription(
    registry: Map<number, RefCountedSubscription>,
    ticketId: number,
    topic: string,
    kind: 'ticket' | 'comment'
  ): void {
    const existing = registry.get(ticketId);
    if (existing) {
      existing.refCount++;
      return;
    }

    if (!this.client?.connected) {
      return;
    }

    const sub = this.client.subscribe(topic, (message: IMessage) => {
      try {
        const event: WebSocketEvent = JSON.parse(message.body);
        this.events$.next(event);
      } catch (e) {
        console.warn(`Erreur parsing ${kind} WebSocket message:`, e);
      }
    });
    registry.set(ticketId, { sub, refCount: 1 });
  }

  private releaseTopicSubscription(registry: Map<number, RefCountedSubscription>, ticketId: number): void {
    const entry = registry.get(ticketId);
    if (!entry) {
      return;
    }

    entry.refCount--;
    if (entry.refCount <= 0) {
      try {
        entry.sub.unsubscribe();
      } catch (e) {
        // ignore
      }
      registry.delete(ticketId);
    }
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

  isBackendReady(): Observable<boolean | null> {
    return this.backendReady$.asObservable();
  }

  /**
   * Deconnecte proprement
   */
  disconnect(): void {
    this.unsubscribeAll();
    this.connecting = false;
    this.reconnectEnabled = false;
    this.readinessGeneration++;
    this.readinessAbortController?.abort();
    this.readinessAbortController = null;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client?.active) {
      void this.client.deactivate();
    }
    this.client = null;
    this.connected$.next(false);
    this.backendReady$.next(null);
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

    // Broker subscriptions tied to the client being torn down are no longer valid; clear the
    // registries so a subsequent reconnect doesn't mistake a stale entry for a live one (which
    // would make acquireTopicSubscription() skip re-subscribing on the new client connection).
    this.clearTopicRegistry(this.ticketSubscriptions);
    this.clearTopicRegistry(this.ticketCommentSubscriptions);
  }

  private clearTopicRegistry(registry: Map<number, RefCountedSubscription>): void {
    registry.forEach(entry => {
      try {
        entry.sub.unsubscribe();
      } catch (e) {
        // ignore
      }
    });
    registry.clear();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
