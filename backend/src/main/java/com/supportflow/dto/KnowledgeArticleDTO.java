package com.supportflow.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KnowledgeArticleDTO {
    private Long id;
    private String title;
    private String content;
    private String summary;
    private String category;
    private Set<String> tags;
    private Integer views;
    private Integer helpfulCount;
    private Integer notHelpfulCount;
    private Boolean isPublished;
    private String authorName;
    private Long sourceTicketId;
    private String sourceTicketReference;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
