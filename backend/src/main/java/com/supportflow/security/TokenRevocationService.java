package com.supportflow.security;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * In-memory revocation list for dev-mode JWTs, keyed by the token's "jti" claim.
 *
 * <p>Dev-profile access/refresh tokens are otherwise valid for their full lifetime (24h/7d)
 * regardless of logout, since the stateless filter chain has nothing else remembering that a
 * given token was explicitly invalidated. A single-instance in-memory store is sufficient here:
 * this profile is not used in the multi-replica prod/k8s deployment (which authenticates via
 * Keycloak instead), so there is no cross-instance consistency concern to solve.
 */
@Component
@Profile("dev")
public class TokenRevocationService {

    private final Map<String, Instant> revokedJtis = new ConcurrentHashMap<>();

    public void revoke(String jti, Instant expiresAt) {
        if (jti == null || jti.isBlank()) {
            return;
        }
        revokedJtis.put(jti, expiresAt != null ? expiresAt : Instant.now().plusSeconds(3600));
        cleanupExpired();
    }

    public boolean isRevoked(String jti) {
        if (jti == null || jti.isBlank()) {
            return false;
        }
        return revokedJtis.containsKey(jti);
    }

    private void cleanupExpired() {
        Instant now = Instant.now();
        revokedJtis.entrySet().removeIf(entry -> entry.getValue().isBefore(now));
    }
}
