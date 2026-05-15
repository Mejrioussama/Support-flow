package com.supportflow.repository;

import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour l'entité User
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    Optional<User> findByUsername(String username);
    
    Optional<User> findByEmail(String email);
    
    Optional<User> findByKeycloakId(String keycloakId);
    
    boolean existsByUsername(String username);
    
    boolean existsByEmail(String email);
    
    List<User> findByRole(Role role);
    
    List<User> findByRoleAndIsActiveTrue(Role role);
    
    Page<User> findByIsActiveTrue(Pageable pageable);
    
    @Query("SELECT u FROM User u WHERE u.client.id = :clientId")
    List<User> findByClientId(@Param("clientId") Long clientId);
    
    @Query("SELECT u FROM User u WHERE u.role IN :roles AND u.isActive = true")
    List<User> findActiveUsersByRoles(@Param("roles") List<Role> roles);

    @Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.agentSkills s LEFT JOIN FETCH s.category " +
           "WHERE u.role IN ('SUPPORT_AGENT', 'SUPPORT_MANAGER') AND u.isActive = true")
    List<User> findAssignableSupportUsers();
    
    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(u.lastName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<User> searchUsers(@Param("search") String search, Pageable pageable);

    @Query("""
        SELECT u FROM User u
        WHERE (:role IS NULL OR u.role = :role)
          AND (:isActive IS NULL OR u.isActive = :isActive)
          AND (
            :search IS NULL OR :search = '' OR
            LOWER(u.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(u.lastName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%'))
          )
        """)
    Page<User> findUsersWithFilters(
        @Param("role") Role role,
        @Param("isActive") Boolean isActive,
        @Param("search") String search,
        Pageable pageable
    );
    
    @Query("SELECT COUNT(u) FROM User u WHERE u.role = :role")
    long countByRole(@Param("role") Role role);
    
    // Agents support disponibles (avec le moins de tickets assignés)
    @Query("SELECT u FROM User u LEFT JOIN u.assignedTickets t " +
           "WHERE u.role = 'SUPPORT_AGENT' AND u.isActive = true " +
           "GROUP BY u ORDER BY COUNT(t) ASC")
    List<User> findAvailableSupportAgents();
}
