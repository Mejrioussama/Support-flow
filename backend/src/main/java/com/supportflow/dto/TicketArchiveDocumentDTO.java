package com.supportflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketArchiveDocumentDTO {

    private String id;
    private String label;
    private String kind;
    private boolean synced;
    private String ref;
    private String relativePath;
    private Long fileSize;
    private String mimeType;
    private Long attachmentId;
}
