import { AgentWorkbenchComponent } from './agent-workbench.component';
import { Ticket } from '@core/models';

describe('AgentWorkbenchComponent', () => {
  let component: AgentWorkbenchComponent;

  beforeEach(() => {
    component = new AgentWorkbenchComponent({} as any, {} as any, {} as any, {} as any, {} as any);
  });

  it('counts SLA risk and breach tickets in its KPI', () => {
    component.workbench = {
      availableToTake: [{ slaPhase: 'AT_RISK', priority: 'MEDIUM' } as Ticket],
      assignedOpen: [{ slaBreached: true, priority: 'HIGH' } as Ticket],
      waitingCustomer: [],
      customerReplied: [],
      resolutionRejected: []
    };

    expect(component.slaAtRiskCount).toBe(2);
  });

  it('keeps reply-focused tickets visible in reply mode', () => {
    component.quickFilter = 'reply';
    component.workbench = {
      availableToTake: [],
      assignedOpen: [],
      waitingCustomer: [],
      customerReplied: [{ id: 1, reference: 'SF-1', title: 'Reply', lastCustomerResponseAt: '2026-05-12T10:00:00Z' } as Ticket],
      resolutionRejected: [{ id: 2, reference: 'SF-2', title: 'Rejected', resolutionRejectedReason: 'Toujours bloque' } as Ticket]
    };

    const replySegment = component.segments.find(segment => segment.key === 'reply');
    const rejectedSegment = component.segments.find(segment => segment.key === 'rejected');

    expect(replySegment?.tickets.length).toBe(1);
    expect(rejectedSegment?.tickets.length).toBe(1);
  });
});
