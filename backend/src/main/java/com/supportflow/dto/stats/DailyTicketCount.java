package com.supportflow.dto.stats;

import lombok.*;

import java.time.LocalDate;

/**
 * DTO pour le compte journalier de tickets
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyTicketCount {
    private LocalDate date;
    private long createdCount;
    private long resolvedCount;
}
