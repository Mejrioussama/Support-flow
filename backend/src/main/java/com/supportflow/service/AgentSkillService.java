package com.supportflow.service;

import com.supportflow.dto.AgentSkillDTO;
import com.supportflow.dto.AgentSkillUpdateDTO;
import com.supportflow.dto.UserDTO;
import com.supportflow.entity.AgentSkill;
import com.supportflow.entity.SupportCategory;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.AgentSkillType;
import com.supportflow.exception.BusinessException;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.mapper.EntityMapper;
import com.supportflow.repository.AgentSkillRepository;
import com.supportflow.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class AgentSkillService {

    private final AgentSkillRepository agentSkillRepository;
    private final UserRepository userRepository;
    private final SupportCategoryService supportCategoryService;
    private final EntityMapper mapper;

    @PostConstruct
    public void backfillSupportUsers() {
        userRepository.findAssignableSupportUsers().forEach(this::ensureDefaultSkillsForSupportUser);
    }

    @Transactional(readOnly = true)
    public List<AgentSkillDTO> getAgentSkills(Long userId) {
        ensureUserExists(userId);
        return agentSkillRepository.findByAgentId(userId).stream()
            .map(this::toDto)
            .toList();
    }

    public UserDTO updateAgentSkills(Long userId, AgentSkillUpdateDTO dto) {
        User user = ensureUserExists(userId);

        if (!user.isSupportAgent() && !user.isSupportManager()) {
            if (dto != null && (hasText(dto.getPrimaryCategoryCode()) || hasText(dto.getSecondaryCategoryCode()))) {
                throw new BusinessException("Seuls les agents support et managers peuvent avoir des competences");
            }
            agentSkillRepository.deleteByAgentId(userId);
            return mapper.toUserDTO(user);
        }

        String primaryCode = normalizeSkillCode(dto != null ? dto.getPrimaryCategoryCode() : null, user);
        String secondaryCode = dto != null ? emptyToNull(dto.getSecondaryCategoryCode()) : null;

        if (secondaryCode != null && primaryCode.equalsIgnoreCase(secondaryCode)) {
            throw new BusinessException("La competence secondaire doit etre differente de la principale");
        }

        SupportCategory primaryCategory = supportCategoryService.getRequiredByCode(primaryCode);
        SupportCategory secondaryCategory = secondaryCode != null
            ? supportCategoryService.getRequiredByCode(secondaryCode)
            : null;

        agentSkillRepository.deleteByAgentId(userId);

        agentSkillRepository.save(AgentSkill.builder()
            .agent(user)
            .category(primaryCategory)
            .skillType(AgentSkillType.PRIMARY)
            .build());

        if (secondaryCategory != null) {
            agentSkillRepository.save(AgentSkill.builder()
                .agent(user)
                .category(secondaryCategory)
                .skillType(AgentSkillType.SECONDARY)
                .build());
        }

        user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouve: " + userId));
        return mapper.toUserDTO(user);
    }

    public void ensureDefaultSkillsForSupportUser(User user) {
        if (user == null || (!user.isSupportAgent() && !user.isSupportManager()) || !Boolean.TRUE.equals(user.getIsActive())) {
            return;
        }
        if (agentSkillRepository.existsByAgentIdAndSkillType(user.getId(), AgentSkillType.PRIMARY)) {
            return;
        }
        updateAgentSkills(user.getId(), AgentSkillUpdateDTO.builder()
            .primaryCategoryCode("GENERAL")
            .build());
    }

    private User ensureUserExists(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouve: " + userId));
    }

    private AgentSkillDTO toDto(AgentSkill skill) {
        return AgentSkillDTO.builder()
            .id(skill.getId())
            .agentId(skill.getAgent().getId())
            .categoryCode(skill.getCategory().getCode())
            .categoryLabel(skill.getCategory().getLabel())
            .skillType(skill.getSkillType())
            .build();
    }

    private String normalizeSkillCode(String primaryCode, User user) {
        if (hasText(primaryCode)) {
            return primaryCode.trim();
        }
        if (Boolean.TRUE.equals(user.getIsActive())) {
            return "GENERAL";
        }
        return primaryCode;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String emptyToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }
}
