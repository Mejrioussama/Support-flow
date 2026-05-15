package com.supportflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDateTime;

/**
 * DTO pour les commentaires
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommentDTO {
    
    private Long id;
    
    @NotBlank(message = "Le contenu du commentaire est obligatoire")
    private String content;
    
    private Boolean isInternal;
    
    private Boolean isSolution;
    
    private Long ticketId;
    
    private UserSummaryDTO author;
    
    private Long parentId;
    
    private LocalDateTime createdAt;
}
