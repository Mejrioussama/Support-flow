package com.supportflow.repository;

import com.supportflow.entity.AgentShift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.DayOfWeek;
import java.util.List;

@Repository
public interface AgentShiftRepository extends JpaRepository<AgentShift, Long> {

    List<AgentShift> findByAgentId(Long agentId);

    List<AgentShift> findByAgentIdAndDayOfWeek(Long agentId, DayOfWeek dayOfWeek);

    List<AgentShift> findByDayOfWeekAndIsOnCallTrue(DayOfWeek dayOfWeek);
}
