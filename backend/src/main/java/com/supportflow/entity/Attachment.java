package com.supportflow.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Entité Pièce jointe
 */
@Entity
@Table(name = "attachments", indexes = {
    @Index(name = "idx_attachment_ticket", columnList = "ticket_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Attachment extends BaseEntity {
    
    @NotBlank(message = "Le nom du fichier est obligatoire")
    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;
    
    @Column(name = "original_name", length = 255)
    private String originalName;
    
    @Column(name = "file_path", length = 500)
    private String filePath;
    
    @Column(name = "file_size")
    private Long fileSize;
    
    @Column(name = "content_type", length = 100)
    private String contentType;
    
    @Column(name = "alfresco_node_id")
    private String alfrescoNodeId;
    
    @Column(name = "checksum", length = 64)
    private String checksum;
    
    @Column(name = "description", length = 500)
    private String description;
    
    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_id")
    private User uploadedBy;
    
    // Méthodes utilitaires
    public String getFormattedFileSize() {
        if (fileSize == null) return "0 B";
        
        String[] units = {"B", "KB", "MB", "GB"};
        int unitIndex = 0;
        double size = fileSize;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return String.format("%.2f %s", size, units[unitIndex]);
    }
    
    public boolean isImage() {
        return contentType != null && contentType.startsWith("image/");
    }
    
    public boolean isPdf() {
        return contentType != null && contentType.equals("application/pdf");
    }
}
