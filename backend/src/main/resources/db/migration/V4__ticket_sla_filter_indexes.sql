-- sla_phase / waiting_on / sla_breached / sla_paused are filtered directly by the manager
-- dashboard, agent workbench, and SLA automation queries (findByStatusAndSlaPaused,
-- findTicketsWithBreachedSla, findActiveTicketsForSlaWarning, action-bucket specifications)
-- but previously had no index, forcing a full table scan on every dashboard refresh / automation
-- tick as the tickets table grows.
CREATE INDEX idx_ticket_sla_phase ON tickets (sla_phase);
CREATE INDEX idx_ticket_waiting_on ON tickets (waiting_on);
CREATE INDEX idx_ticket_sla_breached_paused ON tickets (sla_breached, sla_paused);
