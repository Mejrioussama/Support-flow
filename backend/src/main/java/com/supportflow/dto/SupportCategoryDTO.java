package com.supportflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportCategoryDTO {
    private Long id;

    @NotBlank(message = "Le code de categorie est obligatoire")
    @Size(max = 50)
    private String code;

    @NotBlank(message = "Le libelle de categorie est obligatoire")
    @Size(max = 100)
    private String label;

    @Size(max = 255)
    private String description;

    private Boolean isActive;
    private Integer sortOrder;
}
