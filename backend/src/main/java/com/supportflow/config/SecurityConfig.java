package com.supportflow.config;

import com.supportflow.security.KeycloakRoleExtractor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/** Production security: stateless Keycloak JWT authentication. */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@Profile("!dev")
@RequiredArgsConstructor
public class SecurityConfig {

    private final KeycloakRoleExtractor roleExtractor;

    @Value("#{'${supportflow.security.allowed-origins:http://localhost:4200,http://127.0.0.1:4200}'.split(',')}")
    private List<String> allowedOrigins;

    /**
     * Only the Camunda webapp's own UI/asset/session-proxy paths are exempted here — those are
     * already gated by Camunda's built-in webapp login (camunda.bpm.admin-user, cookie session).
     * The raw process-engine REST API (/engine-rest/**) is deliberately NOT exempted: that starter
     * ships with no authentication of its own, so leaving it in this bypass list made it a fully
     * open, unauthenticated process-engine API (capable of deploying BPMN with script tasks) on
     * any deployment where the backend port is reachable. It is instead locked down to ADMIN-role
     * JWT auth below, in the normal filter chain.
     */
    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return web -> web.ignoring().requestMatchers(request -> {
            String uri = request.getRequestURI();
            String contextPath = request.getContextPath();
            String path = uri.substring(contextPath.length());
            return path.startsWith("/camunda/app/")
                || path.startsWith("/camunda/api/")
                || path.startsWith("/camunda/lib/")
                || path.startsWith("/camunda/assets/");
        });
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/ws/**", "/error").permitAll()
                .requestMatchers("/engine-rest/**", "/engine-rest").hasRole("ADMIN")
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())));
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> configuredOrigins = allowedOrigins.stream().map(String::trim).filter(origin -> !origin.isBlank()).toList();
        if (configuredOrigins.isEmpty() || configuredOrigins.contains("*")) {
            throw new IllegalStateException("Production CORS requires explicit allowed origins");
        }
        configuration.setAllowedOrigins(configuredOrigins);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With", "Accept", "X-Request-ID"));
        configuration.setExposedHeaders(Arrays.asList("Authorization", "Content-Disposition", "X-Request-ID"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public Converter<Jwt, AbstractAuthenticationToken> jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(roleExtractor::extractAuthorities);
        return converter;
    }
}
