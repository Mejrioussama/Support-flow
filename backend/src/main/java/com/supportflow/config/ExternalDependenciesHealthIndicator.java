package com.supportflow.config;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component("externalDependencies")
public class ExternalDependenciesHealthIndicator implements HealthIndicator {
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    private final Map<String, AtomicInteger> states = new ConcurrentHashMap<>();
    private final MeterRegistry meterRegistry;

    @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}")
    private String keycloakJwkSetUri;
    @Value("${alfresco.url}")
    private String alfrescoUrl;
    @Value("${AI_AGENT_URL:http://localhost:8000}")
    private String aiAgentUrl;

    public ExternalDependenciesHealthIndicator(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        states.put("keycloak", new AtomicInteger());
        states.put("alfresco", new AtomicInteger());
        states.put("ai", new AtomicInteger());
    }

    @PostConstruct
    void registerMetrics() {
        states.forEach((name, state) -> Gauge.builder("supportflow.integration.available", state, AtomicInteger::get)
            .tag("integration", name).register(meterRegistry));
    }

    @Scheduled(initialDelay = 5000, fixedDelayString = "${supportflow.health.integration-probe-ms:30000}")
    public void probe() {
        check("keycloak", keycloakJwkSetUri);
        check("alfresco", alfrescoUrl);
        check("ai", aiAgentUrl + "/health");
    }

    private void check(String name, String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(3)).GET().build();
            int code = client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            states.get(name).set(code >= 200 && code < 500 ? 1 : 0);
        } catch (Exception exception) {
            states.get(name).set(0);
        }
    }

    @Override
    public Health health() {
        Map<String, String> details = new LinkedHashMap<>();
        states.forEach((name, state) -> details.put(name, state.get() == 1 ? "UP" : "DOWN"));
        boolean degraded = states.values().stream().anyMatch(state -> state.get() == 0);
        return Health.up().withDetail("state", degraded ? "DEGRADED" : "READY")
            .withDetails(new LinkedHashMap<>(details)).build();
    }
}
