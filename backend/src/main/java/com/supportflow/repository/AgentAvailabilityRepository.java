package com.supportflow.repository;

import com.supportflow.entity.AgentAvailability;
import com.supportflow.entity.enums.AgentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgentAvailabilityRepository extends JpaRepository<AgentAvailability, Long> {

    Optional<AgentAvailability> findByAgentId(Long agentId);

    List<AgentAvailability> findByStatus(AgentStatus status);

    List<AgentAvailability> findByStatusNot(AgentStatus status);
}
