import { MyTicketsComponent } from './my-tickets.component';
import { Ticket } from '@core/models';

describe('MyTicketsComponent', () => {
  let component: MyTicketsComponent;

  beforeEach(() => {
    component = new MyTicketsComponent({} as any, {} as any);
  });

  it('flags pending client tickets as awaiting customer', () => {
    const ticket = { status: 'PENDING', waitingOn: 'CLIENT' } as Ticket;
    expect(component.isAwaitingCustomer(ticket)).toBeTrue();
  });

  it('returns a client-oriented action when a ticket is resolved', () => {
    const ticket = { status: 'RESOLVED' } as Ticket;
    expect(component.getFallbackAction(ticket)).toContain('validation');
    expect(component.getStatusNarrative(ticket)).toContain('solution');
  });

  it('describes unsynced attachments in the follow-up preview', () => {
    expect(component.getDocumentMeta({
      id: '1',
      label: 'capture.png',
      kind: 'attachment',
      synced: false
    })).toContain('synchronisation');
  });
});
