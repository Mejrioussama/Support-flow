package com.supportflow.service;

import com.supportflow.dto.KnowledgeArticleDTO;
import com.supportflow.entity.KnowledgeArticle;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.User;
import com.supportflow.exception.BusinessException;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.repository.KnowledgeArticleRepository;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class KnowledgeBaseService {

    private final KnowledgeArticleRepository articleRepository;
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;

    public Page<KnowledgeArticleDTO> listArticles(Pageable pageable) {
        return articleRepository.findByIsPublishedTrue(pageable).map(this::toDTO);
    }

    public Page<KnowledgeArticleDTO> searchArticles(String query, Pageable pageable) {
        return articleRepository.searchArticles(query, pageable).map(this::toDTO);
    }

    public Page<KnowledgeArticleDTO> listByCategory(String category, Pageable pageable) {
        return articleRepository.findByCategoryAndIsPublishedTrue(category, pageable).map(this::toDTO);
    }

    public KnowledgeArticleDTO getArticle(Long id) {
        KnowledgeArticle article = articleRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Article non trouve: " + id));
        article.incrementViews();
        articleRepository.save(article);
        return toDTO(article);
    }

    public KnowledgeArticleDTO createArticle(KnowledgeArticleDTO dto, Long authorId) {
        User author = userRepository.findById(authorId)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouve: " + authorId));

        KnowledgeArticle article = KnowledgeArticle.builder()
            .title(dto.getTitle())
            .content(dto.getContent())
            .summary(dto.getSummary())
            .category(dto.getCategory())
            .tags(dto.getTags() != null ? dto.getTags() : new LinkedHashSet<>())
            .author(author)
            .isPublished(dto.getIsPublished() != null ? dto.getIsPublished() : true)
            .build();

        if (dto.getSourceTicketId() != null) {
            ticketRepository.findById(dto.getSourceTicketId()).ifPresent(article::setSourceTicket);
        }

        return toDTO(articleRepository.save(article));
    }

    public KnowledgeArticleDTO createArticleFromTicket(Long ticketId, Long authorId, KnowledgeArticleDTO overrides) {
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
        User author = userRepository.findById(authorId)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouve: " + authorId));

        if (ticket.getStatus() == null || (!"RESOLVED".equals(ticket.getStatus().name()) && !"CLOSED".equals(ticket.getStatus().name()))) {
            throw new BusinessException("Le ticket doit etre resolu ou clos avant de creer un article KB");
        }

        if ((ticket.getResolutionSummary() == null || ticket.getResolutionSummary().isBlank())
            && (ticket.getResolutionDiagnostic() == null || ticket.getResolutionDiagnostic().isBlank())) {
            throw new BusinessException("Le ticket ne contient pas encore assez d'elements de resolution pour creer un article KB");
        }

        List<KnowledgeArticle> existingArticles = articleRepository.findBySourceTicketIdOrderByCreatedAtDesc(ticketId);
        if (!existingArticles.isEmpty()) {
            return toDTO(existingArticles.get(0));
        }

        Set<String> tags = new LinkedHashSet<>();
        if (ticket.getTags() != null) {
            tags.addAll(ticket.getTags());
        }
        if (ticket.getPriority() != null) {
            tags.add(ticket.getPriority().name());
        }
        if (ticket.getCategory() != null && !ticket.getCategory().isBlank()) {
            tags.add(ticket.getCategory());
        }
        if (ticket.getNormalizedCategory() != null && ticket.getNormalizedCategory().getCode() != null) {
            tags.add(ticket.getNormalizedCategory().getCode());
        }
        if (overrides != null && overrides.getTags() != null) {
            tags.addAll(overrides.getTags());
        }

        KnowledgeArticle article = KnowledgeArticle.builder()
            .title(resolveArticleTitle(ticket, overrides))
            .content(resolveArticleContent(ticket, overrides))
            .summary(resolveArticleSummary(ticket, overrides))
            .category(resolveArticleCategory(ticket, overrides))
            .tags(tags)
            .author(author)
            .sourceTicket(ticket)
            .isPublished(overrides == null || overrides.getIsPublished() == null ? true : overrides.getIsPublished())
            .build();

        return toDTO(articleRepository.save(article));
    }

    public KnowledgeArticleDTO updateArticle(Long id, KnowledgeArticleDTO dto) {
        KnowledgeArticle article = articleRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Article non trouve: " + id));

        if (dto.getTitle() != null) article.setTitle(dto.getTitle());
        if (dto.getContent() != null) article.setContent(dto.getContent());
        if (dto.getSummary() != null) article.setSummary(dto.getSummary());
        if (dto.getCategory() != null) article.setCategory(dto.getCategory());
        if (dto.getTags() != null) article.setTags(dto.getTags());
        if (dto.getIsPublished() != null) article.setIsPublished(dto.getIsPublished());

        return toDTO(articleRepository.save(article));
    }

    public void deleteArticle(Long id) {
        articleRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<KnowledgeArticleDTO> suggestForTicket(Long ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
        return suggestForDraft(ticket.getTitle(), ticket.getDescription(), ticket.getCategory());
    }

    @Transactional(readOnly = true)
    public List<KnowledgeArticleDTO> suggestForDraft(String title, String description, String category) {
        LinkedHashMap<Long, KnowledgeArticleDTO> suggestions = new LinkedHashMap<>();

        if (category != null && !category.isBlank()) {
            articleRepository.findTop5ByCategoryAndIsPublishedTrueOrderByHelpfulCountDesc(category.trim()).stream()
                .map(this::toDTO)
                .forEach(article -> suggestions.put(article.getId(), article));
        }

        String fullText = String.join(" ",
            title != null ? title.trim() : "",
            description != null ? description.trim() : ""
        ).trim();

        if (!fullText.isBlank()) {
            String normalizedText = truncate(fullText, 120);
            articleRepository.searchArticles(normalizedText, PageRequest.of(0, 4, Sort.by(Sort.Direction.DESC, "helpfulCount"))).stream()
                .map(this::toDTO)
                .forEach(article -> suggestions.putIfAbsent(article.getId(), article));
        }

        for (String keyword : extractSuggestionKeywords(title, description)) {
            articleRepository.searchArticles(keyword, PageRequest.of(0, 3, Sort.by(Sort.Direction.DESC, "helpfulCount"))).stream()
                .map(this::toDTO)
                .forEach(article -> suggestions.putIfAbsent(article.getId(), article));
        }

        if (suggestions.size() < 4) {
            articleRepository.findTopArticles(PageRequest.of(0, 6)).stream()
                .map(this::toDTO)
                .forEach(article -> suggestions.putIfAbsent(article.getId(), article));
        }

        return suggestions.values().stream()
            .limit(6)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<KnowledgeArticleDTO> getRelatedArticlesForTicket(Long ticketId) {
        ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));

        LinkedHashMap<Long, KnowledgeArticleDTO> related = new LinkedHashMap<>();
        articleRepository.findBySourceTicketIdOrderByCreatedAtDesc(ticketId).stream()
            .map(this::toDTO)
            .forEach(article -> related.put(article.getId(), article));
        suggestForTicket(ticketId).forEach(article -> related.putIfAbsent(article.getId(), article));

        return new ArrayList<>(related.values());
    }

    public KnowledgeArticleDTO markHelpful(Long id, boolean helpful) {
        KnowledgeArticle article = articleRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Article non trouve: " + id));
        if (helpful) {
            article.setHelpfulCount(article.getHelpfulCount() + 1);
        } else {
            article.setNotHelpfulCount(article.getNotHelpfulCount() + 1);
        }
        return toDTO(articleRepository.save(article));
    }

    @Transactional(readOnly = true)
    public List<String> getCategories() {
        return articleRepository.findAllCategories();
    }

    private KnowledgeArticleDTO toDTO(KnowledgeArticle article) {
        return KnowledgeArticleDTO.builder()
            .id(article.getId())
            .title(article.getTitle())
            .content(article.getContent())
            .summary(article.getSummary())
            .category(article.getCategory())
            .tags(article.getTags())
            .views(article.getViews())
            .helpfulCount(article.getHelpfulCount())
            .notHelpfulCount(article.getNotHelpfulCount())
            .isPublished(article.getIsPublished())
            .authorName(article.getAuthor() != null ? article.getAuthor().getFullName() : null)
            .sourceTicketId(article.getSourceTicket() != null ? article.getSourceTicket().getId() : null)
            .sourceTicketReference(article.getSourceTicket() != null ? article.getSourceTicket().getReference() : null)
            .createdAt(article.getCreatedAt())
            .updatedAt(article.getUpdatedAt())
            .build();
    }

    private String resolveArticleTitle(Ticket ticket, KnowledgeArticleDTO overrides) {
        if (overrides != null && overrides.getTitle() != null && !overrides.getTitle().isBlank()) {
            return overrides.getTitle().trim();
        }
        return "Resolution - " + ticket.getTitle();
    }

    private String resolveArticleSummary(Ticket ticket, KnowledgeArticleDTO overrides) {
        if (overrides != null && overrides.getSummary() != null && !overrides.getSummary().isBlank()) {
            return overrides.getSummary().trim();
        }
        if (ticket.getResolutionSummary() != null && !ticket.getResolutionSummary().isBlank()) {
            return truncate(ticket.getResolutionSummary().trim(), 500);
        }
        return truncate(ticket.getTitle(), 500);
    }

    private String resolveArticleCategory(Ticket ticket, KnowledgeArticleDTO overrides) {
        if (overrides != null && overrides.getCategory() != null && !overrides.getCategory().isBlank()) {
            return overrides.getCategory().trim();
        }
        if (ticket.getCategory() != null && !ticket.getCategory().isBlank()) {
            return ticket.getCategory();
        }
        return ticket.getNormalizedCategory() != null ? ticket.getNormalizedCategory().getLabel() : "Support";
    }

    private String resolveArticleContent(Ticket ticket, KnowledgeArticleDTO overrides) {
        if (overrides != null && overrides.getContent() != null && !overrides.getContent().isBlank()) {
            return overrides.getContent().trim();
        }

        StringBuilder builder = new StringBuilder();
        builder.append("Titre ticket: ").append(ticket.getReference()).append(" - ").append(ticket.getTitle()).append("\n\n");
        if (ticket.getDescription() != null && !ticket.getDescription().isBlank()) {
            builder.append("Probleme observe:\n").append(ticket.getDescription().trim()).append("\n\n");
        }
        if (ticket.getResolutionSummary() != null && !ticket.getResolutionSummary().isBlank()) {
            builder.append("Resume de resolution:\n").append(ticket.getResolutionSummary().trim()).append("\n\n");
        }
        if (ticket.getResolutionDiagnostic() != null && !ticket.getResolutionDiagnostic().isBlank()) {
            builder.append("Diagnostic:\n").append(ticket.getResolutionDiagnostic().trim()).append("\n\n");
        }
        if (ticket.getResolutionRootCause() != null && !ticket.getResolutionRootCause().isBlank()) {
            builder.append("Cause racine:\n").append(ticket.getResolutionRootCause().trim()).append("\n\n");
        }
        if (ticket.getResolutionActionsTaken() != null && !ticket.getResolutionActionsTaken().isBlank()) {
            builder.append("Actions realisees:\n").append(ticket.getResolutionActionsTaken().trim()).append("\n\n");
        }
        if (ticket.getResolutionNextRecommendation() != null && !ticket.getResolutionNextRecommendation().isBlank()) {
            builder.append("Recommandation:\n").append(ticket.getResolutionNextRecommendation().trim()).append("\n\n");
        }
        builder.append("Source: ticket ").append(ticket.getReference());
        return builder.toString().trim();
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength - 1);
    }

    private List<String> extractSuggestionKeywords(String title, String description) {
        String combined = String.join(" ",
            title != null ? title : "",
            description != null ? description : ""
        );

        LinkedHashSet<String> keywords = new LinkedHashSet<>();
        for (String rawWord : combined.split("[^\\p{L}\\p{N}]+")) {
            String word = rawWord == null ? "" : rawWord.trim().toLowerCase();
            if (word.length() >= 4) {
                keywords.add(word);
            }
            if (keywords.size() >= 8) {
                break;
            }
        }

        return new ArrayList<>(keywords);
    }
}
