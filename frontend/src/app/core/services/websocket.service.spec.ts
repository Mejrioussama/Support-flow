import { fakeAsync, tick } from '@angular/core/testing';
import { firstValueFrom, filter } from 'rxjs';
import { environment } from '@env/environment';
import { WebSocketService } from './websocket.service';

describe('WebSocketService readiness', () => {
  let service: WebSocketService;

  beforeEach(() => {
    service = new WebSocketService({} as any);
    (service as any).reconnectEnabled = true;
  });

  afterEach(() => service.disconnect());

  it('checks the configured API health URL', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').and.resolveTo({
      ok: true,
      json: async () => ({ status: 'UP' })
    } as Response);

    await expectAsync(service.waitForBackendReady(100, 5)).toBeResolvedTo(true);

    expect(fetchSpy).toHaveBeenCalledWith(
      `${environment.apiUrl.replace(/\/+$/, '')}/actuator/health`,
      jasmine.objectContaining({ method: 'GET', cache: 'no-store' })
    );
  });

  it('publishes a non-blocking unavailable state after bounded retries', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo({
      ok: false,
      json: async () => ({ status: 'DOWN' })
    } as Response);
    const unavailable = firstValueFrom(service.isBackendReady().pipe(filter(value => value === false)));

    await expectAsync(service.waitForBackendReady(10, 1)).toBeResolvedTo(false);

    await expectAsync(unavailable).toBeResolvedTo(false);
  });

  it('cancels an in-flight readiness request on disconnect', async () => {
    spyOn(globalThis, 'fetch').and.callFake((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));

    const pending = service.waitForBackendReady(1000, 100);
    service.disconnect();

    await expectAsync(pending).toBeResolvedTo(false);
  });

  it('does not reconnect after logout', fakeAsync(() => {
    const connectSpy = spyOn(service, 'connect');
    (service as any).scheduleReconnect();

    service.disconnect();
    tick(1500);

    expect(connectSpy).not.toHaveBeenCalled();
  }));
});
