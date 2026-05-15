package com.supportflow.repository;

import com.supportflow.entity.EscalationPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EscalationPolicyRepository extends JpaRepository<EscalationPolicy, Long> {

    Optional<EscalationPolicy> findByClientIdAndIsActiveTrue(Long clientId);

    @Query("SELECT p FROM EscalationPolicy p WHERE p.client IS NULL AND p.isActive = true")
    Optional<EscalationPolicy> findDefaultPolicy();

    default EscalationPolicy findPolicyForClient(Long clientId) {
        if (clientId != null) {
            Optional<EscalationPolicy> clientPolicy = findByClientIdAndIsActiveTrue(clientId);
            if (clientPolicy.isPresent()) return clientPolicy.get();
        }
        return findDefaultPolicy().orElse(null);
    }
}
