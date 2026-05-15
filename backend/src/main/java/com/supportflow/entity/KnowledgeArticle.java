package com.supportflow.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.HashSet;
import java.util.Set;

/**
 * Article de la base de connaissances.
 * Permet aux agents de trouver des solutions sans escalader.
 */
@Entity
@Table(name = "knowledge_articles", indexes = {
    @Index(name = "idx_kb_category", columnList = "category"),
    @Index(name = "idx_kb_created", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class KnowledgeArticle extends BaseEntity {

    @NotBlank(message = "Le titre est obligatoire")
    @Size(max = 200)
    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "summary", length = 500)
    private String summary;

    @Column(name = "category", length = 50)
    private String category;

    @ElementCollection
    @CollectionTable(name = "kb_article_tags", joinColumns = @JoinColumn(name = "article_id"))
    @Column(name = "tag", length = 50)
    @Builder.Default
    private Set<String> tags = new HashSet<>();

    @Column(name = "views")
    @Builder.Default
    private Integer views = 0;

    @Column(name = "helpful_count")
    @Builder.Default
    private Integer helpfulCount = 0;

    @Column(name = "not_helpful_count")
    @Builder.Default
    private Integer notHelpfulCount = 0;

    @Column(name = "is_published")
    @Builder.Default
    private Boolean isPublished = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private User author;

    /** Ticket source ayant generé cet article (optionnel) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_ticket_id")
    private Ticket sourceTicket;

    public void incrementViews() {
        this.views = (this.views != null ? this.views : 0) + 1;
    }
}
