package com.supportflow.repository;

import com.supportflow.entity.KnowledgeArticle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KnowledgeArticleRepository extends JpaRepository<KnowledgeArticle, Long> {

    @EntityGraph(attributePaths = {"author", "sourceTicket"})
    Page<KnowledgeArticle> findByIsPublishedTrue(Pageable pageable);

    @EntityGraph(attributePaths = {"author", "sourceTicket"})
    Page<KnowledgeArticle> findByCategoryAndIsPublishedTrue(String category, Pageable pageable);

    @EntityGraph(attributePaths = {"author", "sourceTicket"})
    @Query("SELECT a FROM KnowledgeArticle a WHERE a.isPublished = true AND " +
           "(LOWER(a.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(a.content) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(a.summary) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<KnowledgeArticle> searchArticles(@Param("query") String query, Pageable pageable);

    @Query("SELECT DISTINCT a.category FROM KnowledgeArticle a WHERE a.category IS NOT NULL AND a.isPublished = true")
    List<String> findAllCategories();

    @EntityGraph(attributePaths = {"author", "sourceTicket"})
    List<KnowledgeArticle> findTop5ByCategoryAndIsPublishedTrueOrderByHelpfulCountDesc(String category);

    @EntityGraph(attributePaths = {"author", "sourceTicket"})
    List<KnowledgeArticle> findBySourceTicketIdOrderByCreatedAtDesc(Long sourceTicketId);

    @EntityGraph(attributePaths = {"author", "sourceTicket"})
    @Query("SELECT a FROM KnowledgeArticle a WHERE a.isPublished = true ORDER BY a.helpfulCount DESC")
    List<KnowledgeArticle> findTopArticles(Pageable pageable);
}
