package com.supportflow.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Configuration WebSocket pour les notifications temps réel
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Préfixe pour les messages côté serveur vers le client
        config.enableSimpleBroker("/topic", "/queue", "/user");
        
        // Préfixe pour les messages côté client vers le serveur
        config.setApplicationDestinationPrefixes("/app");
        
        // Préfixe pour les messages destinés à un utilisateur spécifique
        config.setUserDestinationPrefix("/user");
    }
    
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Point de terminaison WebSocket avec SockJS fallback
        registry.addEndpoint("/ws")
            .setAllowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*")
            .withSockJS();
        
        // Point de terminaison sans SockJS fallback (WebSocket natif)
        registry.addEndpoint("/ws-native")
            .setAllowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*");
    }
}
