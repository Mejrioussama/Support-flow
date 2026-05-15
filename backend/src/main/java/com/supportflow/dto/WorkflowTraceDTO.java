package com.supportflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkflowTraceDTO {
    private String ticketReference;
    private String processInstanceId;
    private String processStatus;
    private String currentActivity;
    private List<WorkflowTraceStepDTO> steps;
}
