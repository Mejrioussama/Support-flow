package com.supportflow.dto;

import lombok.*;

import java.time.LocalDateTime;

/**
 * DTO pour les pièces jointes
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttachmentDTO {
    
    private Long id;
    
    private String fileName;
    
    private String originalName;
    
    private String filePath;
    
    private Long fileSize;
    
    private String formattedFileSize;
    
    private String contentType;
    
    private String alfrescoNodeId;
    
    private String description;
    
    private Long ticketId;
    
    private UserSummaryDTO uploadedBy;
    
    private LocalDateTime createdAt;
    
    private String downloadUrl;
}
