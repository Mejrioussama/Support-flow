package com.supportflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.AreaBreak;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.UnitValue;
import com.supportflow.dto.MonthlyReportResponseDTO;
import com.supportflow.entity.Attachment;
import com.supportflow.entity.Comment;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.TicketHistory;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.exception.ArchiveIntegrationException;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.repository.AttachmentRepository;
import com.supportflow.repository.CommentRepository;
import com.supportflow.repository.TicketHistoryRepository;
import com.supportflow.repository.TicketRepository;
import net.sf.jasperreports.engine.JRException;
import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReportService {

    private final TicketRepository ticketRepository;
    private final CommentRepository commentRepository;
    private final AttachmentRepository attachmentRepository;
    private final TicketHistoryRepository ticketHistoryRepository;
    private final ObjectMapper objectMapper;
    private final AlfrescoCmisService alfrescoCmisService;

    @Value("${alfresco.repository.root-folder:/SupportFlow/Tickets}")
    private String alfrescoRootFolder;

    @Value("${supportflow.archive.local-path:uploads/archives}")
    private String localArchivePath;

    @Value("${supportflow.reports.alfresco-root-folder:/SupportFlow/Reports}")
    private String alfrescoReportsRootFolder;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter PERIOD_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final String MONTHLY_PDF_FILE = "monthly-report.pdf";
    private static final String MONTHLY_EXCEL_FILE = "monthly-report.xlsx";

    public byte[] generateTicketReport(Long ticketId) throws Exception {
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
        return generateTicketExcel(ticket);
    }

    public byte[] generateTicketExcel(Ticket ticket) throws Exception {
        return generateTicketExcel(loadArchiveSnapshot(ticket));
    }

    public byte[] generateTicketPdf(Ticket ticket) throws Exception {
        return generateTicketPdf(loadArchiveSnapshot(ticket));
    }

    public void archiveToAlfresco(Ticket ticket) {
        log.info("Archivage GED Alfresco du ticket: {}", ticket.getReference());

        ArchiveSnapshot snapshot = loadArchiveSnapshot(ticket);
        ArchivePackage archivePackage = null;
        try {
            archivePackage = buildArchivePackage(snapshot);
            AlfrescoCmisService.ArchiveUploadResult uploadResult = alfrescoCmisService
                .uploadTicketArchive(ticket.getReference(), archivePackage.rootDirectory());

            ticket.setAlfrescoFolderId(uploadResult.folderId());
            for (Attachment attachment : snapshot.attachments()) {
                String relativePath = archivePackage.attachmentRelativePaths().get(attachment.getId());
                if (relativePath == null) {
                    continue;
                }
                String nodeId = uploadResult.documentIdsByRelativePath().get(relativePath);
                if (nodeId != null && !nodeId.isBlank()) {
                    attachment.setAlfrescoNodeId(nodeId);
                }
            }

            attachmentRepository.saveAll(snapshot.attachments());
            ticketRepository.saveAndFlush(ticket);
            log.info("Ticket {} archive dans Alfresco sous {}", ticket.getReference(), uploadResult.folderPath());
        } catch (ArchiveIntegrationException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur lors de l'archivage du ticket {}: {}", ticket.getReference(), e.getMessage(), e);
            throw new ArchiveIntegrationException("Erreur lors de l'archivage du ticket " + ticket.getReference(), e);
        } finally {
            if (archivePackage != null) {
                deleteDirectory(archivePackage.rootDirectory());
            }
        }
    }

    public MonthlyReportResponseDTO generateMonthlyReport(int year, int month) {
        return generateMonthlyReport(YearMonth.of(year, month));
    }

    public MonthlyReportResponseDTO generateMonthlyReport(YearMonth period) {
        try {
            MonthlyReportData reportData = computeMonthlyReport(period);
            Path reportFolder = getMonthlyReportFolder(period);
            Files.createDirectories(reportFolder);

            Path pdfPath = reportFolder.resolve(MONTHLY_PDF_FILE);
            Path excelPath = reportFolder.resolve(MONTHLY_EXCEL_FILE);
            Path summaryPath = reportFolder.resolve("monthly-summary.json");

            Files.write(pdfPath, generateMonthlyReportPdf(reportData));
            Files.write(excelPath, generateMonthlyReportExcel(reportData));
            Files.write(summaryPath, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(buildMonthlySummaryMap(reportData)));

            AlfrescoCmisService.ArchiveUploadResult uploadResult = archiveMonthlyReport(period, reportFolder);

            return MonthlyReportResponseDTO.builder()
                .year(period.getYear())
                .month(period.getMonthValue())
                .periodLabel(period.format(PERIOD_FORMATTER))
                .generatedAt(reportData.generatedAt())
                .resolvedTickets(reportData.completedTickets().size())
                .averageResolutionTimeMinutes(roundTwoDecimals(reportData.averageResolutionTimeMinutes()))
                .formattedAverageResolutionTime(formatMinutes(reportData.averageResolutionTimeMinutes()))
                .slaComplianceRate(roundTwoDecimals(reportData.slaComplianceRate()))
                .topIncidentTypes(reportData.topIncidentTypes())
                .pdfReference(pdfPath.toString().replace('\\', '/'))
                .excelReference(excelPath.toString().replace('\\', '/'))
                .summaryReference(summaryPath.toString().replace('\\', '/'))
                .alfrescoFolderId(uploadResult != null ? uploadResult.folderId() : null)
                .alfrescoFolderPath(uploadResult != null ? uploadResult.folderPath() : null)
                .build();
        } catch (Exception e) {
            log.error("Impossible de generer le rapport mensuel {}: {}", period, e.getMessage(), e);
            throw new IllegalStateException("Erreur de generation du rapport mensuel " + period, e);
        }
    }

    public Resource getMonthlyReportResource(int year, int month, String format) {
        YearMonth period = YearMonth.of(year, month);
        MonthlyReportResponseDTO report = generateMonthlyReport(period);
        Path reportPath = "pdf".equalsIgnoreCase(format)
            ? Paths.get(report.getPdfReference())
            : Paths.get(report.getExcelReference());
        Resource resource = new FileSystemResource(reportPath);
        if (!resource.exists()) {
            throw new ResourceNotFoundException("Rapport mensuel introuvable: " + period + " format=" + format);
        }
        return resource;
    }

    @Scheduled(cron = "${supportflow.reports.monthly.cron:0 0 1 1 * *}")
    public void generatePreviousMonthReport() {
        YearMonth previousMonth = YearMonth.now().minusMonths(1);
        try {
            MonthlyReportResponseDTO report = generateMonthlyReport(previousMonth);
            log.info("Rapport mensuel auto genere pour {} -> PDF={}, Excel={}",
                previousMonth, report.getPdfReference(), report.getExcelReference());
        } catch (Exception e) {
            log.warn("Generation automatique du rapport mensuel {} impossible: {}", previousMonth, e.getMessage());
        }
    }

    private ArchiveSnapshot loadArchiveSnapshot(Ticket ticket) {
        Ticket managedTicket = ticketRepository.findById(ticket.getId())
            .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticket.getId()));

        List<Comment> comments = commentRepository.findByTicketIdOrderByCreatedAtDesc(managedTicket.getId())
            .stream()
            .sorted(Comparator.comparing(Comment::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();

        List<Attachment> attachments = attachmentRepository.findByTicketIdOrderByCreatedAtDesc(managedTicket.getId())
            .stream()
            .sorted(Comparator.comparing(Attachment::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();

        List<TicketHistory> historyEntries = ticketHistoryRepository.findByTicketIdOrderByCreatedAtDesc(managedTicket.getId())
            .stream()
            .sorted(Comparator.comparing(TicketHistory::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();

        return new ArchiveSnapshot(managedTicket, comments, attachments, historyEntries, LocalDateTime.now());
    }

    private byte[] generateTicketExcel(ArchiveSnapshot snapshot) throws Exception {
        Ticket ticket = snapshot.ticket();
        log.info("Generation du rapport Excel pour: {}", ticket.getReference());

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet overview = workbook.createSheet("Synthese");
            Sheet exchanges = workbook.createSheet("Echanges");
            Sheet historySheet = workbook.createSheet("Journal");
            Sheet attachmentSheet = workbook.createSheet("Pieces_jointes");

            CellStyle headerStyle = buildHeaderStyle(workbook);
            CellStyle valueStyle = workbook.createCellStyle();
            valueStyle.setWrapText(true);

            int rowNum = 0;
            Row titleRow = overview.createRow(rowNum++);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Rapport Ticket - " + ticket.getReference());
            titleCell.setCellStyle(headerStyle);

            rowNum++;
            addInfoRow(overview, rowNum++, "Reference", ticket.getReference(), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Titre", ticket.getTitle(), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Type", label(ticket.getType() != null ? ticket.getType().getLabel() : null), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Statut", label(ticket.getStatus() != null ? ticket.getStatus().getLabel() : null), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Priorite", label(ticket.getPriority() != null ? ticket.getPriority().getLabel() : null), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Gravite", label(ticket.getSeverity() != null ? ticket.getSeverity().getLabel() : null), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Impact", label(ticket.getImpact() != null ? ticket.getImpact().getDescription() : null), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Score", stringValue(ticket.getScore()), headerStyle, valueStyle);

            rowNum++;
            addInfoRow(overview, rowNum++, "Client", ticket.getClient() != null ? ticket.getClient().getCompanyName() : null, headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Collaborateur assigne", ticket.getAssignedAgent() != null ? ticket.getAssignedAgent().getFullName() : null, headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Version", stringValue(ticket.getVersion()), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Archive generee le", formatDate(snapshot.archivedAt()), headerStyle, valueStyle);

            rowNum++;
            addInfoRow(overview, rowNum++, "SLA (heures)", stringValue(ticket.getSlaHours()), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Deadline SLA", formatDate(ticket.getSlaDeadline()), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "SLA respecte", Boolean.TRUE.equals(ticket.isSlaBreached()) ? "Non" : "Oui", headerStyle, valueStyle);

            rowNum++;
            addInfoRow(overview, rowNum++, "Date creation", formatDate(ticket.getCreatedAt()), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Date assignation", formatDate(ticket.getAssignedAt()), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Date resolution", formatDate(ticket.getResolvedAt()), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Date fermeture", formatDate(ticket.getClosedAt()), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Temps de resolution", ticket.getFormattedResolutionTime(), headerStyle, valueStyle);

            rowNum++;
            addInfoRow(overview, rowNum++, "Description", ticket.getDescription(), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Resolution", ticket.getResolutionSummary(), headerStyle, valueStyle);
            addInfoRow(overview, rowNum++, "Satisfaction", ticket.getSatisfactionRating() != null ? ticket.getSatisfactionRating() + "/5" : "N/A", headerStyle, valueStyle);

            populateCommentsSheet(exchanges, snapshot.comments(), headerStyle);
            populateHistorySheet(historySheet, snapshot.historyEntries(), headerStyle);
            populateAttachmentSheet(attachmentSheet, snapshot.attachments(), headerStyle);

            autosize(overview, 2);
            autosize(exchanges, 5);
            autosize(historySheet, 6);
            autosize(attachmentSheet, 6);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            log.info("Rapport Excel genere avec succes pour: {}", ticket.getReference());
            return outputStream.toByteArray();
        }
    }

    private byte[] generateTicketPdf(ArchiveSnapshot snapshot) throws Exception {
        Ticket ticket = snapshot.ticket();
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

        try (PdfWriter writer = new PdfWriter(outputStream);
             PdfDocument pdfDocument = new PdfDocument(writer);
             Document document = new Document(pdfDocument)) {

            document.add(new Paragraph("Rapport de resolution - " + ticket.getReference()).setBold().setFontSize(18));
            document.add(new Paragraph("Genere le " + formatDate(snapshot.archivedAt())));
            document.add(new Paragraph(" "));

            Table summaryTable = new Table(UnitValue.createPercentArray(new float[]{30f, 70f})).useAllAvailableWidth();
            addPdfRow(summaryTable, "Ticket", ticket.getReference());
            addPdfRow(summaryTable, "Titre", ticket.getTitle());
            addPdfRow(summaryTable, "Statut", label(ticket.getStatus() != null ? ticket.getStatus().getLabel() : null));
            addPdfRow(summaryTable, "Client", ticket.getClient() != null ? ticket.getClient().getCompanyName() : null);
            addPdfRow(summaryTable, "Collaborateur assigne", ticket.getAssignedAgent() != null ? ticket.getAssignedAgent().getFullName() : null);
            addPdfRow(summaryTable, "Gravite", label(ticket.getSeverity() != null ? ticket.getSeverity().getLabel() : null));
            addPdfRow(summaryTable, "Priorite", label(ticket.getPriority() != null ? ticket.getPriority().getLabel() : null));
            addPdfRow(summaryTable, "Version", stringValue(ticket.getVersion()));
            addPdfRow(summaryTable, "Date fermeture", formatDate(ticket.getClosedAt()));
            addPdfRow(summaryTable, "Temps de resolution", ticket.getFormattedResolutionTime());
            addPdfRow(summaryTable, "SLA respecte", Boolean.TRUE.equals(ticket.isSlaBreached()) ? "Non" : "Oui");
            document.add(summaryTable);

            document.add(new Paragraph(" "));
            document.add(new Paragraph("Description").setBold());
            document.add(new Paragraph(label(ticket.getDescription())));
            document.add(new Paragraph(" "));
            document.add(new Paragraph("Resolution").setBold());
            document.add(new Paragraph(label(ticket.getResolutionSummary())));

            document.add(new Paragraph(" "));
            document.add(new Paragraph("Pieces archivees").setBold());
            document.add(new Paragraph("Commentaires / echanges: " + snapshot.comments().size()));
            document.add(new Paragraph("Entrees d'historique: " + snapshot.historyEntries().size()));
            document.add(new Paragraph("Pieces jointes: " + snapshot.attachments().size()));

            if (!snapshot.comments().isEmpty()) {
                document.add(new AreaBreak());
                document.add(new Paragraph("Echanges").setBold().setFontSize(16));
                Table commentsTable = new Table(UnitValue.createPercentArray(new float[]{18f, 20f, 15f, 47f})).useAllAvailableWidth();
                addPdfHeader(commentsTable, "Date");
                addPdfHeader(commentsTable, "Auteur");
                addPdfHeader(commentsTable, "Type");
                addPdfHeader(commentsTable, "Contenu");
                for (Comment comment : snapshot.comments()) {
                    addPdfCell(commentsTable, formatDate(comment.getCreatedAt()));
                    addPdfCell(commentsTable, comment.getAuthor() != null ? comment.getAuthor().getFullName() : "System");
                    addPdfCell(commentsTable, Boolean.TRUE.equals(comment.getIsInternal()) ? "Interne" : "Public");
                    addPdfCell(commentsTable, label(comment.getContent()));
                }
                document.add(commentsTable);
            }
        }

        return outputStream.toByteArray();
    }

    private ArchivePackage buildArchivePackage(ArchiveSnapshot snapshot) throws Exception {
        Ticket ticket = snapshot.ticket();
        Path archiveRoot = Files.createTempDirectory("supportflow-archive-" + sanitizeFileName(ticket.getReference()) + "-");
        Path attachmentsFolder = archiveRoot.resolve("attachments");

        Files.createDirectories(attachmentsFolder);
        Files.write(archiveRoot.resolve("metadata.json"),
            objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(buildArchiveMetadata(snapshot)));
        Files.write(archiveRoot.resolve("resolution-report.xlsx"), generateTicketExcel(snapshot));
        Files.write(archiveRoot.resolve("resolution-report.pdf"), generateTicketPdf(snapshot));
        Files.writeString(archiveRoot.resolve("comments.csv"), buildCommentsCsv(snapshot.comments()));
        Files.writeString(archiveRoot.resolve("activity-log.csv"), buildHistoryCsv(snapshot.historyEntries()));
        Files.writeString(archiveRoot.resolve("attachments.csv"), buildAttachmentsCsv(snapshot.attachments()));

        Map<Long, String> attachmentRelativePaths = copyAttachments(snapshot.attachments(), attachmentsFolder);
        return new ArchivePackage(archiveRoot, attachmentRelativePaths);
    }

    private Map<Long, String> copyAttachments(List<Attachment> attachments, Path attachmentsFolder) throws IOException {
        Map<Long, String> relativePathsByAttachmentId = new LinkedHashMap<>();
        Set<String> usedNames = new LinkedHashSet<>();
        for (Attachment attachment : attachments) {
            if (attachment.getFilePath() == null || attachment.getFilePath().isBlank()) {
                throw new ArchiveIntegrationException("Piece jointe sans chemin disque pour le ticket "
                    + attachment.getTicket().getReference());
            }

            Path source = Paths.get(attachment.getFilePath());
            if (!Files.exists(source)) {
                throw new ArchiveIntegrationException("Piece jointe introuvable sur disque: " + attachment.getFilePath());
            }

            String candidateName = sanitizeFileName(
                attachment.getOriginalName() != null && !attachment.getOriginalName().isBlank()
                    ? attachment.getOriginalName()
                    : source.getFileName().toString()
            );
            String targetName = deduplicateFileName(candidateName, usedNames);
            Files.copy(source, attachmentsFolder.resolve(targetName), StandardCopyOption.REPLACE_EXISTING);
            relativePathsByAttachmentId.put(attachment.getId(), "attachments/" + targetName);
        }
        return relativePathsByAttachmentId;
    }

    private Map<String, Object> buildArchiveMetadata(ArchiveSnapshot snapshot) {
        Ticket ticket = snapshot.ticket();
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("ticketId", ticket.getId());
        metadata.put("ticketReference", ticket.getReference());
        metadata.put("archiveGeneratedAt", formatDate(snapshot.archivedAt()));
        metadata.put("status", ticket.getStatus() != null ? ticket.getStatus().name() : null);
        metadata.put("statusLabel", ticket.getStatus() != null ? ticket.getStatus().getLabel() : null);
        metadata.put("version", ticket.getVersion());
        metadata.put("severity", ticket.getSeverity() != null ? ticket.getSeverity().name() : null);
        metadata.put("priority", ticket.getPriority() != null ? ticket.getPriority().name() : null);
        metadata.put("createdAt", formatDate(ticket.getCreatedAt()));
        metadata.put("closedAt", formatDate(ticket.getClosedAt()));
        metadata.put("client", ticket.getClient() != null ? ticket.getClient().getCompanyName() : null);
        metadata.put("collaborator", ticket.getAssignedAgent() != null ? ticket.getAssignedAgent().getFullName() : null);
        metadata.put("attachmentsCount", snapshot.attachments().size());
        metadata.put("commentsCount", snapshot.comments().size());
        metadata.put("historyEntriesCount", snapshot.historyEntries().size());
        metadata.put("repositoryRootFolder", normalizeArchiveTargetPath(alfrescoRootFolder));
        metadata.put("alfrescoTargetPath", alfrescoCmisService.buildTicketFolderPath(ticket.getReference()));
        metadata.put("storageMode", "ALFRESCO");
        metadata.put("attachments", snapshot.attachments().stream().map(attachment -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", attachment.getId());
            item.put("originalName", attachment.getOriginalName());
            item.put("fileName", attachment.getFileName());
            item.put("contentType", attachment.getContentType());
            item.put("fileSize", attachment.getFileSize());
            item.put("checksum", attachment.getChecksum());
            item.put("uploadedBy", attachment.getUploadedBy() != null ? attachment.getUploadedBy().getFullName() : null);
            item.put("createdAt", formatDate(attachment.getCreatedAt()));
            return item;
        }).toList());
        return metadata;
    }

    private MonthlyReportData computeMonthlyReport(YearMonth period) {
        List<Ticket> createdTickets = ticketRepository.findAll((root, query, cb) -> cb.and(
            cb.greaterThanOrEqualTo(root.get("createdAt"), period.atDay(1).atStartOfDay()),
            cb.lessThan(root.get("createdAt"), period.plusMonths(1).atDay(1).atStartOfDay())
        ));

        List<Ticket> completedTickets = ticketRepository.findAll((root, query, cb) -> cb.and(
            root.get("status").in(TicketStatus.RESOLVED, TicketStatus.CLOSED),
            cb.or(
                cb.and(
                    cb.isNotNull(root.get("resolvedAt")),
                    cb.greaterThanOrEqualTo(root.get("resolvedAt"), period.atDay(1).atStartOfDay()),
                    cb.lessThan(root.get("resolvedAt"), period.plusMonths(1).atDay(1).atStartOfDay())
                ),
                cb.and(
                    cb.isNotNull(root.get("closedAt")),
                    cb.greaterThanOrEqualTo(root.get("closedAt"), period.atDay(1).atStartOfDay()),
                    cb.lessThan(root.get("closedAt"), period.plusMonths(1).atDay(1).atStartOfDay())
                )
            )
        ));

        double averageResolution = completedTickets.stream()
            .map(Ticket::getResolutionTimeMinutes)
            .filter(Objects::nonNull)
            .mapToLong(Long::longValue)
            .average()
            .orElse(0d);

        long slaRespectedCount = completedTickets.stream()
            .filter(ticket -> !Boolean.TRUE.equals(ticket.getSlaBreached()))
            .count();
        double slaComplianceRate = completedTickets.isEmpty()
            ? 100d
            : (slaRespectedCount * 100d) / completedTickets.size();

        LinkedHashMap<String, Long> topIncidentTypes = createdTickets.stream()
            .collect(Collectors.groupingBy(
                ticket -> ticket.getType() != null ? ticket.getType().getLabel() : "Non renseigne",
                LinkedHashMap::new,
                Collectors.counting()
            ))
            .entrySet()
            .stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .limit(5)
            .collect(Collectors.toMap(
                Map.Entry::getKey,
                Map.Entry::getValue,
                (left, right) -> left,
                LinkedHashMap::new
            ));

        return new MonthlyReportData(
            period,
            LocalDateTime.now(),
            createdTickets,
            completedTickets,
            averageResolution,
            slaComplianceRate,
            topIncidentTypes
        );
    }

    private byte[] generateMonthlyReportPdf(MonthlyReportData reportData) throws Exception {
        try {
            return generateMonthlyReportPdfWithJasper(reportData);
        } catch (Exception jasperError) {
            log.warn("Generation Jasper du rapport mensuel {} impossible, fallback iText: {}",
                reportData.period(), jasperError.getMessage());
            return generateMonthlyReportPdfFallback(reportData);
        }
    }

    private byte[] generateMonthlyReportPdfWithJasper(MonthlyReportData reportData) throws IOException, JRException {
        try (InputStream templateStream = new ClassPathResource("reports/monthly-supportflow.jrxml").getInputStream()) {
            var report = JasperCompileManager.compileReport(templateStream);

            Map<String, Object> parameters = new LinkedHashMap<>();
            parameters.put("periodLabel", reportData.period().format(PERIOD_FORMATTER));
            parameters.put("generatedAt", formatDate(reportData.generatedAt()));
            parameters.put("ticketsCreated", String.valueOf(reportData.createdTickets().size()));
            parameters.put("ticketsCompleted", String.valueOf(reportData.completedTickets().size()));
            parameters.put("averageResolutionTime", formatMinutes(reportData.averageResolutionTimeMinutes()));
            parameters.put("slaComplianceRate", roundTwoDecimals(reportData.slaComplianceRate()) + "%");

            List<Map<String, ?>> incidentRows = new ArrayList<>();
            if (reportData.topIncidentTypes().isEmpty()) {
                incidentRows.add(Map.of("type", "Aucune donnee", "count", "0"));
            } else {
                reportData.topIncidentTypes().forEach((type, count) ->
                    incidentRows.add(Map.of("type", type, "count", String.valueOf(count)))
                );
            }

            JasperPrint jasperPrint = JasperFillManager.fillReport(
                report,
                parameters,
                new JRMapCollectionDataSource(incidentRows)
            );
            return JasperExportManager.exportReportToPdf(jasperPrint);
        }
    }

    private byte[] generateMonthlyReportPdfFallback(MonthlyReportData reportData) throws Exception {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

        try (PdfWriter writer = new PdfWriter(outputStream);
             PdfDocument pdfDocument = new PdfDocument(writer);
             Document document = new Document(pdfDocument)) {

            document.add(new Paragraph("Rapport mensuel SupportFlow - " + reportData.period().format(PERIOD_FORMATTER))
                .setBold().setFontSize(18));
            document.add(new Paragraph("Genere le " + formatDate(reportData.generatedAt())));
            document.add(new Paragraph(" "));

            Table kpiTable = new Table(UnitValue.createPercentArray(new float[]{40f, 60f})).useAllAvailableWidth();
            addPdfRow(kpiTable, "Tickets crees", stringValue(reportData.createdTickets().size()));
            addPdfRow(kpiTable, "Tickets resolus / fermes", stringValue(reportData.completedTickets().size()));
            addPdfRow(kpiTable, "Temps moyen de resolution", formatMinutes(reportData.averageResolutionTimeMinutes()));
            addPdfRow(kpiTable, "Taux respect SLA", roundTwoDecimals(reportData.slaComplianceRate()) + "%");
            document.add(kpiTable);

            document.add(new Paragraph(" "));
            document.add(new Paragraph("Top types d'incidents").setBold());
            Table incidentTable = new Table(UnitValue.createPercentArray(new float[]{75f, 25f})).useAllAvailableWidth();
            addPdfHeader(incidentTable, "Type");
            addPdfHeader(incidentTable, "Volume");
            if (reportData.topIncidentTypes().isEmpty()) {
                addPdfCell(incidentTable, "Aucune donnee");
                addPdfCell(incidentTable, "0");
            } else {
                reportData.topIncidentTypes().forEach((type, count) -> {
                    addPdfCell(incidentTable, type);
                    addPdfCell(incidentTable, String.valueOf(count));
                });
            }
            document.add(incidentTable);
        }

        return outputStream.toByteArray();
    }

    private AlfrescoCmisService.ArchiveUploadResult archiveMonthlyReport(YearMonth period, Path reportFolder) {
        try {
            return alfrescoCmisService.uploadArchive(
                normalizeArchiveTargetPath(alfrescoReportsRootFolder),
                "supportflow-" + period.format(PERIOD_FORMATTER),
                reportFolder
            );
        } catch (ArchiveIntegrationException archiveError) {
            log.warn("Archivage Alfresco du rapport mensuel {} ignore: {}", period, archiveError.getMessage());
            return null;
        }
    }

    private byte[] generateMonthlyReportExcel(MonthlyReportData reportData) throws Exception {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet summarySheet = workbook.createSheet("Synthese");
            Sheet incidentsSheet = workbook.createSheet("Top_incidents");

            CellStyle headerStyle = buildHeaderStyle(workbook);
            CellStyle valueStyle = workbook.createCellStyle();

            int rowNum = 0;
            addInfoRow(summarySheet, rowNum++, "Periode", reportData.period().format(PERIOD_FORMATTER), headerStyle, valueStyle);
            addInfoRow(summarySheet, rowNum++, "Genere le", formatDate(reportData.generatedAt()), headerStyle, valueStyle);
            addInfoRow(summarySheet, rowNum++, "Tickets crees", stringValue(reportData.createdTickets().size()), headerStyle, valueStyle);
            addInfoRow(summarySheet, rowNum++, "Tickets resolus / fermes", stringValue(reportData.completedTickets().size()), headerStyle, valueStyle);
            addInfoRow(summarySheet, rowNum++, "Temps moyen de resolution", formatMinutes(reportData.averageResolutionTimeMinutes()), headerStyle, valueStyle);
            addInfoRow(summarySheet, rowNum++, "Taux respect SLA", roundTwoDecimals(reportData.slaComplianceRate()) + "%", headerStyle, valueStyle);

            Row headerRow = incidentsSheet.createRow(0);
            headerRow.createCell(0).setCellValue("Type");
            headerRow.createCell(1).setCellValue("Volume");
            headerRow.getCell(0).setCellStyle(headerStyle);
            headerRow.getCell(1).setCellStyle(headerStyle);

            int incidentRow = 1;
            for (Map.Entry<String, Long> entry : reportData.topIncidentTypes().entrySet()) {
                Row row = incidentsSheet.createRow(incidentRow++);
                row.createCell(0).setCellValue(entry.getKey());
                row.createCell(1).setCellValue(entry.getValue());
            }

            autosize(summarySheet, 2);
            autosize(incidentsSheet, 2);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    private Map<String, Object> buildMonthlySummaryMap(MonthlyReportData reportData) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("period", reportData.period().format(PERIOD_FORMATTER));
        summary.put("generatedAt", formatDate(reportData.generatedAt()));
        summary.put("ticketsCreated", reportData.createdTickets().size());
        summary.put("ticketsCompleted", reportData.completedTickets().size());
        summary.put("averageResolutionTimeMinutes", roundTwoDecimals(reportData.averageResolutionTimeMinutes()));
        summary.put("slaComplianceRate", roundTwoDecimals(reportData.slaComplianceRate()));
        summary.put("topIncidentTypes", reportData.topIncidentTypes());
        return summary;
    }

    private Path getMonthlyReportFolder(YearMonth period) {
        return Paths.get(localArchivePath).toAbsolutePath().normalize()
            .resolve("monthly")
            .resolve(period.format(PERIOD_FORMATTER));
    }

    private void populateCommentsSheet(Sheet sheet, List<Comment> comments, CellStyle headerStyle) {
        Row header = sheet.createRow(0);
        String[] headers = {"Date", "Auteur", "Visibilite", "Solution", "Contenu"};
        for (int i = 0; i < headers.length; i++) {
            Cell cell = header.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        int rowNum = 1;
        for (Comment comment : comments) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(formatDate(comment.getCreatedAt()));
            row.createCell(1).setCellValue(comment.getAuthor() != null ? comment.getAuthor().getFullName() : "System");
            row.createCell(2).setCellValue(Boolean.TRUE.equals(comment.getIsInternal()) ? "Interne" : "Public");
            row.createCell(3).setCellValue(Boolean.TRUE.equals(comment.getIsSolution()) ? "Oui" : "Non");
            row.createCell(4).setCellValue(label(comment.getContent()));
        }
    }

    private void populateHistorySheet(Sheet sheet, List<TicketHistory> historyEntries, CellStyle headerStyle) {
        Row header = sheet.createRow(0);
        String[] headers = {"Date", "Action", "Champ", "Ancienne valeur", "Nouvelle valeur", "Auteur"};
        for (int i = 0; i < headers.length; i++) {
            Cell cell = header.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        int rowNum = 1;
        for (TicketHistory historyEntry : historyEntries) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(formatDate(historyEntry.getCreatedAt()));
            row.createCell(1).setCellValue(label(historyEntry.getAction()));
            row.createCell(2).setCellValue(label(historyEntry.getFieldName()));
            row.createCell(3).setCellValue(label(historyEntry.getOldValue()));
            row.createCell(4).setCellValue(label(historyEntry.getNewValue()));
            row.createCell(5).setCellValue(label(historyEntry.getPerformedBy()));
        }
    }

    private void populateAttachmentSheet(Sheet sheet, List<Attachment> attachments, CellStyle headerStyle) {
        Row header = sheet.createRow(0);
        String[] headers = {"Date", "Nom original", "Nom stocke", "Type", "Taille", "Auteur"};
        for (int i = 0; i < headers.length; i++) {
            Cell cell = header.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        int rowNum = 1;
        for (Attachment attachment : attachments) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(formatDate(attachment.getCreatedAt()));
            row.createCell(1).setCellValue(label(attachment.getOriginalName()));
            row.createCell(2).setCellValue(label(attachment.getFileName()));
            row.createCell(3).setCellValue(label(attachment.getContentType()));
            row.createCell(4).setCellValue(attachment.getFormattedFileSize());
            row.createCell(5).setCellValue(attachment.getUploadedBy() != null ? attachment.getUploadedBy().getFullName() : "System");
        }
    }

    private String buildCommentsCsv(List<Comment> comments) {
        List<String> rows = new ArrayList<>();
        rows.add("date,author,visibility,isSolution,content");
        for (Comment comment : comments) {
            rows.add(String.join(",",
                csv(formatDate(comment.getCreatedAt())),
                csv(comment.getAuthor() != null ? comment.getAuthor().getFullName() : "System"),
                csv(Boolean.TRUE.equals(comment.getIsInternal()) ? "INTERNAL" : "PUBLIC"),
                csv(Boolean.TRUE.equals(comment.getIsSolution()) ? "YES" : "NO"),
                csv(comment.getContent())
            ));
        }
        return String.join(System.lineSeparator(), rows);
    }

    private String buildHistoryCsv(List<TicketHistory> historyEntries) {
        List<String> rows = new ArrayList<>();
        rows.add("date,action,field,oldValue,newValue,performedBy,description");
        for (TicketHistory historyEntry : historyEntries) {
            rows.add(String.join(",",
                csv(formatDate(historyEntry.getCreatedAt())),
                csv(historyEntry.getAction()),
                csv(historyEntry.getFieldName()),
                csv(historyEntry.getOldValue()),
                csv(historyEntry.getNewValue()),
                csv(historyEntry.getPerformedBy()),
                csv(historyEntry.getDescription())
            ));
        }
        return String.join(System.lineSeparator(), rows);
    }

    private String buildAttachmentsCsv(List<Attachment> attachments) {
        List<String> rows = new ArrayList<>();
        rows.add("date,originalName,fileName,contentType,fileSize,uploadedBy,filePath");
        for (Attachment attachment : attachments) {
            rows.add(String.join(",",
                csv(formatDate(attachment.getCreatedAt())),
                csv(attachment.getOriginalName()),
                csv(attachment.getFileName()),
                csv(attachment.getContentType()),
                csv(stringValue(attachment.getFileSize())),
                csv(attachment.getUploadedBy() != null ? attachment.getUploadedBy().getFullName() : "System"),
                csv(attachment.getFilePath())
            ));
        }
        return String.join(System.lineSeparator(), rows);
    }

    private void addInfoRow(Sheet sheet, int rowNum, String label, String value,
                            CellStyle headerStyle, CellStyle valueStyle) {
        Row row = sheet.createRow(rowNum);

        Cell labelCell = row.createCell(0);
        labelCell.setCellValue(label);
        labelCell.setCellStyle(headerStyle);

        Cell valueCell = row.createCell(1);
        valueCell.setCellValue(value != null ? value : "N/A");
        valueCell.setCellStyle(valueStyle);
    }

    private CellStyle buildHeaderStyle(Workbook workbook) {
        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.LIGHT_BLUE.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return headerStyle;
    }

    private void autosize(Sheet sheet, int columns) {
        for (int i = 0; i < columns; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void addPdfRow(Table table, String label, String value) {
        addPdfHeader(table, label);
        addPdfCell(table, value);
    }

    private void addPdfHeader(Table table, String value) {
        table.addCell(new com.itextpdf.layout.element.Cell()
            .add(new Paragraph(label(value)).setBold())
            .setBackgroundColor(ColorConstants.LIGHT_GRAY));
    }

    private void addPdfCell(Table table, String value) {
        table.addCell(new com.itextpdf.layout.element.Cell()
            .add(new Paragraph(label(value))));
    }

    private String deduplicateFileName(String candidateName, Set<String> usedNames) {
        String sanitized = candidateName == null || candidateName.isBlank() ? "attachment.bin" : candidateName;
        String base = sanitized;
        String extension = "";
        int extensionIndex = sanitized.lastIndexOf('.');
        if (extensionIndex > 0) {
            base = sanitized.substring(0, extensionIndex);
            extension = sanitized.substring(extensionIndex);
        }

        String current = sanitized;
        int counter = 1;
        while (!usedNames.add(current)) {
            current = base + "-" + counter + extension;
            counter++;
        }
        return current;
    }

    private String csv(String value) {
        String safe = value == null ? "" : value.replace("\"", "\"\"");
        return "\"" + safe + "\"";
    }

    private String label(String value) {
        return value == null || value.isBlank() ? "N/A" : value;
    }

    private String stringValue(Object value) {
        return value == null ? "N/A" : String.valueOf(value);
    }

    private String formatDate(LocalDateTime dateTime) {
        return dateTime == null ? "N/A" : dateTime.format(DATE_FORMATTER);
    }

    private String sanitizeFileName(String value) {
        if (value == null || value.isBlank()) {
            return "supportflow";
        }
        return value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String formatMinutes(double minutes) {
        long totalMinutes = Math.round(minutes);
        long hours = totalMinutes / 60;
        long remainingMinutes = totalMinutes % 60;
        return String.format(Locale.ROOT, "%dh%02dmin", hours, remainingMinutes);
    }

    private double roundTwoDecimals(double value) {
        return Math.round(value * 100d) / 100d;
    }

    private void deleteDirectory(Path rootDirectory) {
        if (rootDirectory == null || !Files.exists(rootDirectory)) {
            return;
        }

        try (var paths = Files.walk(rootDirectory)) {
            paths.sorted(Comparator.reverseOrder())
                .forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException e) {
                        log.warn("Impossible de supprimer le dossier temporaire {}: {}", path, e.getMessage());
                    }
                });
        } catch (IOException e) {
            log.warn("Impossible de nettoyer le staging d'archive {}: {}", rootDirectory, e.getMessage());
        }
    }

    private String normalizeArchiveTargetPath(String path) {
        if (path == null || path.isBlank()) {
            return "/";
        }

        String normalized = path.trim().replace('\\', '/');
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        while (normalized.contains("//")) {
            normalized = normalized.replace("//", "/");
        }
        if (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private record ArchivePackage(
        Path rootDirectory,
        Map<Long, String> attachmentRelativePaths
    ) {}

    private record ArchiveSnapshot(
        Ticket ticket,
        List<Comment> comments,
        List<Attachment> attachments,
        List<TicketHistory> historyEntries,
        LocalDateTime archivedAt
    ) {}

    private record MonthlyReportData(
        YearMonth period,
        LocalDateTime generatedAt,
        List<Ticket> createdTickets,
        List<Ticket> completedTickets,
        double averageResolutionTimeMinutes,
        double slaComplianceRate,
        LinkedHashMap<String, Long> topIncidentTypes
    ) {}
}
