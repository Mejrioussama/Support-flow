package com.supportflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * SupportFlow - Application principale
 * Système de Gestion Automatisée des Tickets Clients
 * 
 * @author SupportFlow Team
 * @version 1.0.0
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
@EnableCaching
public class SupportFlowApplication {

    public static void main(String[] args) {
        SpringApplication.run(SupportFlowApplication.class, args);
    }
}
