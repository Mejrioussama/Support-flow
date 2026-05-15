package com.supportflow.controller;

import com.supportflow.dto.EscalationPolicyDTO;
import com.supportflow.entity.EscalationPolicy;
import com.supportflow.entity.Client;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.repository.ClientRepository;
import com.supportflow.repository.EscalationPolicyRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/escalation-policies")
@RequiredArgsConstructor
@Tag(name = "Escalation Policies", description = "Gestion des politiques d'escalade par client")
public class EscalationPolicyController {

    private final EscalationPolicyRepository policyRepository;
    private final ClientRepository clientRepository;

    @GetMapping
    @Operation(summary = "Lister toutes les politiques")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<EscalationPolicyDTO>> list() {
        return ResponseEntity.ok(policyRepository.findAll().stream()
            .map(this::toDTO).collect(Collectors.toList()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Détail d'une politique")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<EscalationPolicyDTO> get(@PathVariable Long id) {
        return ResponseEntity.ok(toDTO(policyRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Policy non trouvée: " + id))));
    }

    @GetMapping("/client/{clientId}")
    @Operation(summary = "Politique d'escalade d'un client")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<EscalationPolicyDTO> getForClient(@PathVariable Long clientId) {
        EscalationPolicy policy = policyRepository.findPolicyForClient(clientId);
        if (policy == null) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(toDTO(policy));
    }

    @PostMapping
    @Operation(summary = "Créer une politique d'escalade")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<EscalationPolicyDTO> create(@RequestBody EscalationPolicyDTO dto) {
        EscalationPolicy policy = new EscalationPolicy();
        applyDTO(policy, dto);
        return ResponseEntity.ok(toDTO(policyRepository.save(policy)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Modifier une politique")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<EscalationPolicyDTO> update(@PathVariable Long id, @RequestBody EscalationPolicyDTO dto) {
        EscalationPolicy policy = policyRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Policy non trouvée: " + id));
        applyDTO(policy, dto);
        return ResponseEntity.ok(toDTO(policyRepository.save(policy)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer une politique")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        policyRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void applyDTO(EscalationPolicy p, EscalationPolicyDTO dto) {
        if (dto.getClientId() != null) {
            Client client = clientRepository.findById(dto.getClientId())
                .orElseThrow(() -> new ResourceNotFoundException("Client non trouvé: " + dto.getClientId()));
            p.setClient(client);
        }
        if (dto.getPolicyName() != null) p.setPolicyName(dto.getPolicyName());
        if (dto.getLevel1Threshold() != null) p.setLevel1Threshold(dto.getLevel1Threshold());
        if (dto.getLevel2Threshold() != null) p.setLevel2Threshold(dto.getLevel2Threshold());
        if (dto.getLevel3DelayMinutes() != null) p.setLevel3DelayMinutes(dto.getLevel3DelayMinutes());
        if (dto.getStuckAssignedMinutes() != null) p.setStuckAssignedMinutes(dto.getStuckAssignedMinutes());
        if (dto.getMaxEscalations() != null) p.setMaxEscalations(dto.getMaxEscalations());
        if (dto.getCooldownMinutes() != null) p.setCooldownMinutes(dto.getCooldownMinutes());
        if (dto.getAutoReassignEnabled() != null) p.setAutoReassignEnabled(dto.getAutoReassignEnabled());
        if (dto.getNotifyClientOnEscalation() != null) p.setNotifyClientOnEscalation(dto.getNotifyClientOnEscalation());
        if (dto.getIsActive() != null) p.setIsActive(dto.getIsActive());
    }

    private EscalationPolicyDTO toDTO(EscalationPolicy p) {
        return EscalationPolicyDTO.builder()
            .id(p.getId())
            .clientId(p.getClient() != null ? p.getClient().getId() : null)
            .clientName(p.getClient() != null ? p.getClient().getCompanyName() : "Défaut (tous clients)")
            .policyName(p.getPolicyName())
            .level1Threshold(p.getLevel1Threshold())
            .level2Threshold(p.getLevel2Threshold())
            .level3DelayMinutes(p.getLevel3DelayMinutes())
            .stuckAssignedMinutes(p.getStuckAssignedMinutes())
            .maxEscalations(p.getMaxEscalations())
            .cooldownMinutes(p.getCooldownMinutes())
            .autoReassignEnabled(p.getAutoReassignEnabled())
            .notifyClientOnEscalation(p.getNotifyClientOnEscalation())
            .isActive(p.getIsActive())
            .build();
    }
}
