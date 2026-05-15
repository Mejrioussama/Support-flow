package com.supportflow.controller;

import com.supportflow.dto.MonthlyReportResponseDTO;
import com.supportflow.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
@Tag(name = "Reports", description = "API de generation et telechargement des rapports")
public class ReportController {

    private final ReportService reportService;

    @PostMapping("/monthly/{year}/{month}")
    @Operation(summary = "Generer un rapport mensuel PDF + Excel")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<MonthlyReportResponseDTO> generateMonthlyReport(
            @PathVariable int year,
            @PathVariable int month) {
        return ResponseEntity.ok(reportService.generateMonthlyReport(year, month));
    }

    @GetMapping("/monthly/{year}/{month}/download")
    @Operation(summary = "Telecharger un rapport mensuel")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Resource> downloadMonthlyReport(
            @PathVariable int year,
            @PathVariable int month,
            @RequestParam(defaultValue = "pdf") String format) {

        String normalizedFormat = "excel".equalsIgnoreCase(format) || "xlsx".equalsIgnoreCase(format)
            ? "xlsx"
            : "pdf";

        Resource resource = reportService.getMonthlyReportResource(year, month, normalizedFormat);
        String fileName = "supportflow-monthly-" + year + "-" + String.format("%02d", month) + "." + normalizedFormat;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename(fileName).build());
        headers.setContentType("pdf".equals(normalizedFormat)
            ? MediaType.APPLICATION_PDF
            : MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));

        return ResponseEntity.ok().headers(headers).body(resource);
    }
}
