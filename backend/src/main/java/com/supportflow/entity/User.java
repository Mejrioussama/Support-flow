package com.supportflow.entity;

import com.supportflow.entity.enums.Role;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.HashSet;
import java.util.Set;

/**
 * Entité Utilisateur du système
 */
@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_user_email", columnList = "email"),
    @Index(name = "idx_user_keycloak", columnList = "keycloak_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class User extends BaseEntity {
    
    @NotBlank(message = "Le nom d'utilisateur est obligatoire")
    @Size(min = 3, max = 50)
    @Column(name = "username", unique = true, nullable = false, length = 50)
    private String username;
    
    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Format d'email invalide")
    @Column(name = "email", unique = true, nullable = false, length = 100)
    private String email;
    
    @Column(name = "password", length = 255)
    private String password;
    
    @NotBlank(message = "Le prénom est obligatoire")
    @Size(max = 50)
    @Column(name = "first_name", nullable = false, length = 50)
    private String firstName;
    
    @NotBlank(message = "Le nom est obligatoire")
    @Size(max = 50)
    @Column(name = "last_name", nullable = false, length = 50)
    private String lastName;
    
    @Column(name = "phone", length = 20)
    private String phone;
    
    @Column(name = "avatar_url")
    private String avatarUrl;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private Role role;
    
    @Column(name = "keycloak_id", unique = true)
    private String keycloakId;
    
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
    
    @Column(name = "last_login")
    private java.time.LocalDateTime lastLogin;
    
    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;
    
    @OneToMany(mappedBy = "assignedAgent", fetch = FetchType.LAZY)
    @Builder.Default
    private Set<Ticket> assignedTickets = new HashSet<>();
    
    @OneToMany(mappedBy = "author", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @Builder.Default
    private Set<Comment> comments = new HashSet<>();

    @OneToMany(mappedBy = "agent", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<AgentSkill> agentSkills = new HashSet<>();
    
    // Méthodes utilitaires
    public String getFullName() {
        return firstName + " " + lastName;
    }
    
    public boolean isAdmin() {
        return Role.ADMIN.equals(this.role);
    }
    
    public boolean isSupportManager() {
        return Role.SUPPORT_MANAGER.equals(this.role);
    }
    
    public boolean isSupportAgent() {
        return Role.SUPPORT_AGENT.equals(this.role);
    }
    
    public boolean isClient() {
        return Role.CLIENT.equals(this.role);
    }

    public AgentSkill getPrimarySkill() {
        return agentSkills.stream()
            .filter(skill -> skill.getSkillType() == com.supportflow.entity.enums.AgentSkillType.PRIMARY)
            .findFirst()
            .orElse(null);
    }

    public AgentSkill getSecondarySkill() {
        return agentSkills.stream()
            .filter(skill -> skill.getSkillType() == com.supportflow.entity.enums.AgentSkillType.SECONDARY)
            .findFirst()
            .orElse(null);
    }
}
