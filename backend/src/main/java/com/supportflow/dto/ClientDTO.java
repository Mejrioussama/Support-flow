package com.supportflow.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDateTime;

/**
 * DTO complet pour les clients
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClientDTO {
    
    private Long id;
    
    @NotBlank(message = "Le code client est obligatoire")
    @Size(max = 20)
    private String code;
    
    @NotBlank(message = "Le nom de la société est obligatoire")
    @Size(max = 100)
    private String companyName;
    
    @Email(message = "Format d'email invalide")
    private String email;
    
    private String phone;
    
    private String address;
    
    private String city;
    
    private String country;
    
    private String postalCode;
    
    private String industry;
    
    private String contractType;
    
    private String slaLevel;
    
    private Boolean isActive;
    
    private String logoUrl;
    
    private String notes;
    
    private LocalDateTime createdAt;
    
    // Stats
    private int usersCount;
    private int activeTicketsCount;
    private int totalTicketsCount;
}
