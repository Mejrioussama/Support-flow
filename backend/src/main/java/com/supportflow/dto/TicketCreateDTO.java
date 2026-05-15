package com.supportflow.dto;

import com.supportflow.entity.enums.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDateTime;
import java.util.Set;

/**
 * DTO pour les requêtes de création de ticket
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketCreateDTO {
    
    @NotBlank(message = "Le titre est obligatoire")
    @Size(min = 5, max = 200, message = "Le titre doit faire entre 5 et 200 caractères")
    private String title;
    
    private String description;
    
    @NotNull(message = "Le type de ticket est obligatoire")
    private TicketType type;
    
    @NotNull(message = "La gravité est obligatoire")
    private Severity severity;
    
    @NotNull(message = "L'impact est obligatoire")
    private Impact impact;
    
    // Optionnel pour les clients - auto-détecté par email
    private Long clientId;
    
    private String category;
    
    private Set<String> tags;
}
