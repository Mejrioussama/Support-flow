package com.supportflow.repository;

import com.supportflow.entity.AgentSkill;
import com.supportflow.entity.enums.AgentSkillType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AgentSkillRepository extends JpaRepository<AgentSkill, Long> {
    List<AgentSkill> findByAgentId(Long agentId);
    Optional<AgentSkill> findByAgentIdAndSkillType(Long agentId, AgentSkillType skillType);
    boolean existsByAgentIdAndSkillType(Long agentId, AgentSkillType skillType);
    void deleteByAgentId(Long agentId);
}
