package com.supportflow.dto;

import lombok.*;

/**
 * DTO résumé pour les clients (utilisé dans les relations)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClientSummaryDTO {
    private Long id;
    private String code;
    private String companyName;
    private String email;
    private String slaLevel;
    private String logoUrl;
}
