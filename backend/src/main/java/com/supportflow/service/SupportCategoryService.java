package com.supportflow.service;

import com.supportflow.dto.SupportCategoryDTO;
import com.supportflow.entity.SupportCategory;
import com.supportflow.entity.Ticket;
import com.supportflow.exception.BusinessException;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.repository.SupportCategoryRepository;
import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class SupportCategoryService {

    private static final List<SupportCategoryDTO> DEFAULT_CATEGORIES = List.of(
        SupportCategoryDTO.builder().code("AUTHENTICATION").label("Authentification").description("Connexion, SSO, comptes et mots de passe").sortOrder(10).isActive(true).build(),
        SupportCategoryDTO.builder().code("UI").label("Interface").description("Affichage, ergonomie, mobile et dashboard").sortOrder(20).isActive(true).build(),
        SupportCategoryDTO.builder().code("REPORTING").label("Reporting").description("Exports, rapports et tableaux de bord").sortOrder(30).isActive(true).build(),
        SupportCategoryDTO.builder().code("NETWORK").label("Reseau").description("VPN, connectivite, DNS et latence").sortOrder(40).isActive(true).build(),
        SupportCategoryDTO.builder().code("EMAIL").label("Email").description("Messagerie, SMTP, IMAP et boites mail").sortOrder(50).isActive(true).build(),
        SupportCategoryDTO.builder().code("DATABASE").label("Base de donnees").description("SQL, MySQL, PostgreSQL et donnees").sortOrder(60).isActive(true).build(),
        SupportCategoryDTO.builder().code("SECURITY").label("Securite").description("Acces, MFA, permissions et certificats").sortOrder(70).isActive(true).build(),
        SupportCategoryDTO.builder().code("HARDWARE").label("Materiel").description("PC, imprimantes, scanners et equipements").sortOrder(80).isActive(true).build(),
        SupportCategoryDTO.builder().code("SOFTWARE").label("Logiciel").description("Applications, bugs et services metier").sortOrder(90).isActive(true).build(),
        SupportCategoryDTO.builder().code("GENERAL").label("General").description("Categorie de secours").sortOrder(100).isActive(true).build()
    );

    private final SupportCategoryRepository categoryRepository;

    @PostConstruct
    public void ensureDefaultCatalog() {
        DEFAULT_CATEGORIES.forEach(seed -> categoryRepository.findByCode(seed.getCode())
            .orElseGet(() -> {
                SupportCategory created = toEntity(seed);
                log.info("Creation categorie support {}", created.getCode());
                return categoryRepository.save(created);
            }));
    }

    @Transactional(readOnly = true)
    public List<SupportCategoryDTO> getAllCategories() {
        return categoryRepository.findAllByOrderBySortOrderAscLabelAsc().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<SupportCategoryDTO> getActiveCategories() {
        return categoryRepository.findByIsActiveTrueOrderBySortOrderAscLabelAsc().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public SupportCategory getRequiredByCode(String code) {
        return categoryRepository.findByCode(normalizeCode(code))
            .orElseThrow(() -> new ResourceNotFoundException("Categorie support non trouvee: " + code));
    }

    public SupportCategoryDTO createCategory(SupportCategoryDTO dto) {
        String code = normalizeCode(dto.getCode());
        if (categoryRepository.existsByCode(code)) {
            throw new BusinessException("Cette categorie existe deja: " + code);
        }

        SupportCategory category = toEntity(dto);
        category.setCode(code);
        return toDto(categoryRepository.save(category));
    }

    public SupportCategoryDTO updateCategory(Long id, SupportCategoryDTO dto) {
        SupportCategory category = categoryRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Categorie support non trouvee: " + id));

        String newCode = normalizeCode(dto.getCode());
        if (!category.getCode().equals(newCode) && categoryRepository.existsByCode(newCode)) {
            throw new BusinessException("Cette categorie existe deja: " + newCode);
        }

        category.setCode(newCode);
        category.setLabel(dto.getLabel().trim());
        category.setDescription(dto.getDescription());
        category.setIsActive(dto.getIsActive() != null ? dto.getIsActive() : Boolean.TRUE);
        category.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        return toDto(categoryRepository.save(category));
    }

    public void deleteCategory(Long id) {
        if (!categoryRepository.existsById(id)) {
            throw new ResourceNotFoundException("Categorie support non trouvee: " + id);
        }
        categoryRepository.deleteById(id);
    }

    public SupportCategory resolveNormalizedCategory(String rawCategory, String type, String title, String description) {
        String code = inferCategoryCode(rawCategory, type, title, description);
        return categoryRepository.findByCode(code)
            .orElseGet(() -> categoryRepository.save(toEntity(DEFAULT_CATEGORIES.stream()
                .filter(category -> category.getCode().equals(code))
                .findFirst()
                .orElse(DEFAULT_CATEGORIES.get(DEFAULT_CATEGORIES.size() - 1)))));
    }

    public void normalizeTicketCategory(Ticket ticket) {
        if (ticket == null) {
            return;
        }
        SupportCategory category = resolveNormalizedCategory(
            ticket.getCategory(),
            ticket.getType() != null ? ticket.getType().name() : null,
            ticket.getTitle(),
            ticket.getDescription());
        ticket.setNormalizedCategory(category);
    }

    public String inferCategoryCode(String rawCategory, String type, String title, String description) {
        if (rawCategory != null && !rawCategory.isBlank()) {
            String directCode = normalizeKnownCategory(rawCategory);
            if (directCode != null) {
                return directCode;
            }
        }

        String text = String.join(" ",
                safe(rawCategory),
                safe(type),
                safe(title),
                safe(description))
            .toLowerCase(Locale.ROOT);

        if (containsAny(text, "auth", "oauth", "sso", "mot de passe", "password", "login", "connexion", "compte", "access")) {
            return "AUTHENTICATION";
        }
        if (containsAny(text, "interface", "ui", "affichage", "ecran", "dashboard", "tableau de bord", "mobile", "page", "front")) {
            return "UI";
        }
        if (containsAny(text, "report", "rapport", "reporting", "excel", "export", "csv", "pdf", "bi")) {
            return "REPORTING";
        }
        if (containsAny(text, "vpn", "reseau", "wifi", "dns", "latence", "internet", "connectiv", "network")) {
            return "NETWORK";
        }
        if (containsAny(text, "mail", "email", "smtp", "imap", "outlook", "boite")) {
            return "EMAIL";
        }
        if (containsAny(text, "sql", "database", "base de donnees", "mysql", "postgres", "oracle", "db")) {
            return "DATABASE";
        }
        if (containsAny(text, "securite", "security", "permission", "mfa", "2fa", "certificat", "access")) {
            return "SECURITY";
        }
        if (containsAny(text, "materiel", "imprimante", "pc", "ordinateur", "scanner", "disque", "hardware")) {
            return "HARDWARE";
        }
        if (containsAny(text, "logiciel", "application", "bug", "api", "service", "erp", "crm", "backend")) {
            return "SOFTWARE";
        }
        return "GENERAL";
    }

    private String normalizeKnownCategory(String rawCategory) {
        String normalized = normalizeCode(rawCategory);
        return switch (normalized) {
            case "AUTHENTIFICATION", "AUTHENTICATION" -> "AUTHENTICATION";
            case "INTERFACE", "UI" -> "UI";
            case "REPORTING", "REPORT", "RAPPORT" -> "REPORTING";
            case "RESEAU", "NETWORK" -> "NETWORK";
            case "EMAIL", "MAIL", "MESSAGING" -> "EMAIL";
            case "BASE_DE_DONNEES", "DATABASE", "DATA" -> "DATABASE";
            case "SECURITE", "SECURITY" -> "SECURITY";
            case "MATERIEL", "HARDWARE" -> "HARDWARE";
            case "LOGICIEL", "SOFTWARE", "APPLICATION" -> "SOFTWARE";
            case "GENERAL", "SUPPORT" -> "GENERAL";
            default -> categoryRepository.findByCode(normalized).map(SupportCategory::getCode).orElse(null);
        };
    }

    private SupportCategoryDTO toDto(SupportCategory category) {
        return SupportCategoryDTO.builder()
            .id(category.getId())
            .code(category.getCode())
            .label(category.getLabel())
            .description(category.getDescription())
            .isActive(category.getIsActive())
            .sortOrder(category.getSortOrder())
            .build();
    }

    private SupportCategory toEntity(SupportCategoryDTO dto) {
        return SupportCategory.builder()
            .code(normalizeCode(dto.getCode()))
            .label(dto.getLabel() != null ? dto.getLabel().trim() : "")
            .description(dto.getDescription())
            .isActive(dto.getIsActive() != null ? dto.getIsActive() : Boolean.TRUE)
            .sortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0)
            .build();
    }

    private String normalizeCode(String value) {
        if (value == null || value.isBlank()) {
            throw new BusinessException("Le code de categorie est obligatoire");
        }
        return value.trim()
            .replace('é', 'e')
            .replace('è', 'e')
            .replace('ê', 'e')
            .replace('à', 'a')
            .replace('ù', 'u')
            .replace('ô', 'o')
            .replace('î', 'i')
            .replace('ï', 'i')
            .replace('ç', 'c')
            .replaceAll("[^A-Za-z0-9]+", "_")
            .replaceAll("^_+|_+$", "")
            .toUpperCase(Locale.ROOT);
    }

    private boolean containsAny(String value, String... needles) {
        for (String needle : needles) {
            if (value.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private String safe(String value) {
        return value != null ? value : "";
    }
}
