package com.supportflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkflowTraceStepDTO {
    private String activityId;
    private String activityName;
    private String activityType;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private boolean finished;
}
