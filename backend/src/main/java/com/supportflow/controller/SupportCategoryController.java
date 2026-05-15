package com.supportflow.controller;

import com.supportflow.dto.SupportCategoryDTO;
import com.supportflow.service.SupportCategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/support-categories")
@RequiredArgsConstructor
@Tag(name = "Categories Support", description = "Catalogue des categories support")
public class SupportCategoryController {

    private final SupportCategoryService supportCategoryService;

    @GetMapping
    @Operation(summary = "Lister les categories support")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<SupportCategoryDTO>> getAllCategories() {
        return ResponseEntity.ok(supportCategoryService.getAllCategories());
    }

    @PostMapping
    @Operation(summary = "Creer une categorie support")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<SupportCategoryDTO> createCategory(@Valid @RequestBody SupportCategoryDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(supportCategoryService.createCategory(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Mettre a jour une categorie support")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<SupportCategoryDTO> updateCategory(
            @PathVariable Long id,
            @Valid @RequestBody SupportCategoryDTO dto) {
        return ResponseEntity.ok(supportCategoryService.updateCategory(id, dto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer une categorie support")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        supportCategoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }
}
