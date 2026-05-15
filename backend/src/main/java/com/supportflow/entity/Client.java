package com.supportflow.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.HashSet;
import java.util.Set;

/**
 * Entité Client (Société cliente)
 */
@Entity
@Table(name = "clients", indexes = {
    @Index(name = "idx_client_code", columnList = "code"),
    @Index(name = "idx_client_name", columnList = "company_name")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Client extends BaseEntity {
    
    @NotBlank(message = "Le code client est obligatoire")
    @Size(max = 20)
    @Column(name = "code", unique = true, nullable = false, length = 20)
    private String code;
    
    @NotBlank(message = "Le nom de la société est obligatoire")
    @Size(max = 100)
    @Column(name = "company_name", nullable = false, length = 100)
    private String companyName;
    
    @Email(message = "Format d'email invalide")
    @Column(name = "email", length = 100)
    private String email;
    
    @Column(name = "phone", length = 20)
    private String phone;
    
    @Column(name = "address", length = 255)
    private String address;
    
    @Column(name = "city", length = 50)
    private String city;
    
    @Column(name = "country", length = 50)
    private String country;
    
    @Column(name = "postal_code", length = 10)
    private String postalCode;
    
    @Column(name = "industry", length = 50)
    private String industry;
    
    @Column(name = "contract_type", length = 50)
    private String contractType;
    
    @Column(name = "sla_level", length = 20)
    @Builder.Default
    private String slaLevel = "STANDARD";
    
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
    
    @Column(name = "logo_url")
    private String logoUrl;
    
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    
    // Relations
    @OneToMany(mappedBy = "client", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @Builder.Default
    private Set<User> users = new HashSet<>();
    
    @OneToMany(mappedBy = "client", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @Builder.Default
    private Set<Ticket> tickets = new HashSet<>();
    
    // Méthodes utilitaires
    public void addUser(User user) {
        users.add(user);
        user.setClient(this);
    }
    
    public void removeUser(User user) {
        users.remove(user);
        user.setClient(null);
    }
    
    public int getActiveTicketsCount() {
        return (int) tickets.stream()
            .filter(t -> !t.getStatus().name().equals("CLOSED") && !t.getStatus().name().equals("CANCELLED"))
            .count();
    }
}
