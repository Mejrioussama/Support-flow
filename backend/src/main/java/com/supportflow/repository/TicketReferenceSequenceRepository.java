package com.supportflow.repository;

import com.supportflow.entity.TicketReferenceSequence;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TicketReferenceSequenceRepository extends JpaRepository<TicketReferenceSequence, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM TicketReferenceSequence s WHERE s.id = 1")
    Optional<TicketReferenceSequence> lockForUpdate();
}
