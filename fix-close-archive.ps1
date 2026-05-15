$path = 'backend/src/main/java/com/supportflow/service/TicketService.java'
$content = Get-Content $path -Raw
$pattern = '// 1\) Archive to Alfresco \(may throw ArchiveIntegrationException -> 502\)\s*archiveTicketInternal\(ticket, null, true\);\s*ticket = ticketRepository\.saveAndFlush\(ticket\);'
$replacement = @"
// 1) Archive to Alfresco, but do not fail ticket closure if GED is unavailable.
        try {
            archiveTicketInternal(ticket, null, true);
            ticket = ticketRepository.saveAndFlush(ticket);
        } catch (ArchiveIntegrationException e) {
            log.warn("Archivage Alfresco indisponible pour {}: {}", ticket.getReference(), e.getMessage());
            recordArchiveSyncIssue(ticket, "CLOSE", e.getMessage());
        }
"@
$content = [regex]::Replace($content, $pattern, $replacement)
Set-Content $path $content
