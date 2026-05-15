package com.supportflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyReportResponseDTO {

    private Integer year;
    private Integer month;
    private String periodLabel;
    private LocalDateTime generatedAt;
    private Integer resolvedTickets;
    private Double averageResolutionTimeMinutes;
    private String formattedAverageResolutionTime;
    private Double slaComplianceRate;
    private LinkedHashMap<String, Long> topIncidentTypes;
    private String pdfReference;
    private String excelReference;
    private String summaryReference;
    private String alfrescoFolderId;
    private String alfrescoFolderPath;
}
