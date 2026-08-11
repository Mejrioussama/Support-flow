package com.supportflow.service;

import com.supportflow.entity.Ticket;
import com.supportflow.entity.WorkflowSyncJob;
import com.supportflow.entity.enums.WorkflowSyncAction;

public interface WorkflowSynchronization {
    WorkflowSyncJob enqueue(Ticket ticket, WorkflowSyncAction action, String payload, String eventKey);
}
