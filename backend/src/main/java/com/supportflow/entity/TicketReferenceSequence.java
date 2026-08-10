package com.supportflow.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Single-row counter backing ticket reference generation (SF-0001, SF-0002, ...).
 * Reading/incrementing this row always happens under a PESSIMISTIC_WRITE lock
 * (see TicketReferenceSequenceRepository) so concurrent ticket creations serialize
 * on this row instead of racing on an unlocked SELECT MAX(...) and colliding on
 * the tickets.reference unique constraint.
 */
@Entity
@Table(name = "ticket_reference_sequence")
@Getter
@Setter
@NoArgsConstructor
public class TicketReferenceSequence {

    @Id
    private Long id;

    @Column(name = "last_value", nullable = false)
    private Integer lastValue;
}
