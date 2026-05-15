package com.supportflow.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class TicketSlaDueDateUpdateDTO {

    @NotNull(message = "dueDate est obligatoire")
    private LocalDateTime dueDate;
}
