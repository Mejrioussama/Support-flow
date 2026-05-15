package com.supportflow.repository;

import com.supportflow.entity.Client;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour l'entité Client
 */
@Repository
public interface ClientRepository extends JpaRepository<Client, Long> {
    
    Optional<Client> findByCode(String code);
    
    Optional<Client> findByCompanyName(String companyName);
    
    boolean existsByCode(String code);
    
    boolean existsByCompanyName(String companyName);
    
    List<Client> findByIsActiveTrue();
    
    Page<Client> findByIsActiveTrue(Pageable pageable);
    
    @Query("SELECT c FROM Client c WHERE " +
           "LOWER(c.companyName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.code) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Client> searchClients(@Param("search") String search, Pageable pageable);
    
    @Query("SELECT c FROM Client c WHERE c.slaLevel = :slaLevel")
    List<Client> findBySlaLevel(@Param("slaLevel") String slaLevel);
    
    @Query("SELECT c FROM Client c WHERE c.industry = :industry AND c.isActive = true")
    List<Client> findByIndustry(@Param("industry") String industry);
    
    @Query("SELECT c, COUNT(t) as ticketCount FROM Client c " +
           "LEFT JOIN c.tickets t " +
           "WHERE c.isActive = true " +
           "GROUP BY c " +
           "ORDER BY ticketCount DESC")
    List<Object[]> findClientsWithTicketCount();
    
    @Query("SELECT DISTINCT c.industry FROM Client c WHERE c.industry IS NOT NULL")
    List<String> findAllIndustries();
    
    @Query("SELECT COUNT(c) FROM Client c WHERE c.isActive = true")
    long countActiveClients();
    
    Optional<Client> findByEmail(String email);
}
