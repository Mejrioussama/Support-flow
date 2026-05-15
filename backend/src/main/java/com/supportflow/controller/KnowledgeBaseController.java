package com.supportflow.controller;

import com.supportflow.dto.KnowledgeArticleAssistRequestDTO;
import com.supportflow.dto.KnowledgeArticleDTO;
import com.supportflow.service.KnowledgeBaseService;
import com.supportflow.service.UserIdentityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/kb")
@RequiredArgsConstructor
@Tag(name = "Knowledge Base", description = "Base de connaissances pour les agents")
public class KnowledgeBaseController {

    private final KnowledgeBaseService kbService;
    private final UserIdentityService userIdentityService;

    @GetMapping
    @Operation(summary = "Lister les articles publies")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Page<KnowledgeArticleDTO>> listArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(
            kbService.listArticles(PageRequest.of(page, size, Sort.by("createdAt").descending()))
        );
    }

    @GetMapping("/search")
    @Operation(summary = "Rechercher des articles")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Page<KnowledgeArticleDTO>> searchArticles(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(
            kbService.searchArticles(query, PageRequest.of(page, size, Sort.by("helpfulCount").descending()))
        );
    }

    @GetMapping("/category/{category}")
    @Operation(summary = "Articles par categorie")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Page<KnowledgeArticleDTO>> listByCategory(
            @PathVariable String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(kbService.listByCategory(category, PageRequest.of(page, size)));
    }

    @GetMapping("/categories")
    @Operation(summary = "Lister les categories")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<List<String>> getCategories() {
        return ResponseEntity.ok(kbService.getCategories());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Detail d'un article")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<KnowledgeArticleDTO> getArticle(@PathVariable Long id) {
        return ResponseEntity.ok(kbService.getArticle(id));
    }

    @GetMapping("/suggest")
    @Operation(summary = "Suggerer des articles pour un ticket")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<List<KnowledgeArticleDTO>> suggestForTicket(@RequestParam Long ticketId) {
        return ResponseEntity.ok(kbService.suggestForTicket(ticketId));
    }

    @PostMapping("/assist")
    @Operation(summary = "Suggerer des articles a partir d'un brouillon ticket")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
    public ResponseEntity<List<KnowledgeArticleDTO>> suggestForDraft(
            @RequestBody KnowledgeArticleAssistRequestDTO request) {
        return ResponseEntity.ok(kbService.suggestForDraft(
            request.getTitle(),
            request.getDescription(),
            request.getCategory()
        ));
    }

    @GetMapping("/ticket/{ticketId}/related")
    @Operation(summary = "Obtenir les articles lies ou suggeres pour un ticket")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<List<KnowledgeArticleDTO>> getRelatedArticlesForTicket(@PathVariable Long ticketId) {
        return ResponseEntity.ok(kbService.getRelatedArticlesForTicket(ticketId));
    }

    @PostMapping
    @Operation(summary = "Creer un article")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<KnowledgeArticleDTO> createArticle(
            @RequestBody KnowledgeArticleDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        Long userId = userIdentityService.resolveUserIdFromJwt(jwt);
        return ResponseEntity.ok(kbService.createArticle(dto, userId));
    }

    @PostMapping("/ticket/{ticketId}/create-from-ticket")
    @Operation(summary = "Creer un article KB a partir d'un ticket resolu")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<KnowledgeArticleDTO> createFromTicket(
            @PathVariable Long ticketId,
            @RequestBody(required = false) KnowledgeArticleDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        Long userId = userIdentityService.resolveUserIdFromJwt(jwt);
        return ResponseEntity.ok(kbService.createArticleFromTicket(ticketId, userId, dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Modifier un article")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<KnowledgeArticleDTO> updateArticle(
            @PathVariable Long id,
            @RequestBody KnowledgeArticleDTO dto) {
        return ResponseEntity.ok(kbService.updateArticle(id, dto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un article")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<Void> deleteArticle(@PathVariable Long id) {
        kbService.deleteArticle(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/helpful")
    @Operation(summary = "Marquer un article comme utile ou non")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
    public ResponseEntity<KnowledgeArticleDTO> markHelpful(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        boolean helpful = body.getOrDefault("helpful", true);
        return ResponseEntity.ok(kbService.markHelpful(id, helpful));
    }
}
