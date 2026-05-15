package com.supportflow.camunda;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.camunda.bpm.engine.RepositoryService;
import org.camunda.bpm.engine.repository.ProcessDefinition;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Ensure Camunda process definitions are active on startup.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "camunda.bpm.enabled", havingValue = "true", matchIfMissing = true)
public class CamundaBootstrap implements ApplicationRunner {

    private static final String PROCESS_KEY = "ticket-workflow";

    private final RepositoryService repositoryService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            ProcessDefinition def = repositoryService.createProcessDefinitionQuery()
                .processDefinitionKey(PROCESS_KEY)
                .latestVersion()
                .singleResult();

            if (def == null) {
                log.warn("Camunda process definition not found: {}", PROCESS_KEY);
                return;
            }

            if (def.isSuspended()) {
                repositoryService.activateProcessDefinitionById(def.getId(), true, null);
                log.info("Camunda process definition re-activated: {}", def.getKey());
            }
        } catch (Exception e) {
            log.warn("Camunda bootstrap failed: {}", e.getMessage());
        }
    }
}
