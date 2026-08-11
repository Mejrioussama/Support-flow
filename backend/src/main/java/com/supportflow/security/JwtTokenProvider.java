package com.supportflow.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Provider et validateur de tokens JWT
 */
@Component
@Profile("dev")
@Slf4j
@RequiredArgsConstructor
public class JwtTokenProvider {

    private final TokenRevocationService revocationService;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration}")
    private long jwtExpiration;

    @Value("${jwt.refresh-expiration}")
    private long refreshExpiration;

    /**
     * Génère un access token JWT
     */
    public String generateAccessToken(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();

        String authorities = authentication.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .collect(Collectors.joining(","));

        return Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(userDetails.getUsername())
            .claim("roles", authorities)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + jwtExpiration))
            .signWith(getSigningKey())
            .compact();
    }

    /**
     * Génère un access token pour un utilisateur
     */
    public String generateAccessToken(String username, String roles) {
        return Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(username)
            .claim("roles", roles)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + jwtExpiration))
            .signWith(getSigningKey())
            .compact();
    }

    /**
     * Génère un refresh token
     */
    public String generateRefreshToken(String username) {
        return Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(username)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + refreshExpiration))
            .signWith(getSigningKey())
            .compact();
    }
    
    /**
     * Extrait le username du token
     */
    public String getUsernameFromToken(String token) {
        return Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(token)
            .getPayload()
            .getSubject();
    }
    
    /**
     * Extrait les rôles du token
     */
    public String getRolesFromToken(String token) {
        return Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(token)
            .getPayload()
            .get("roles", String.class);
    }

    public Claims getClaimsFromToken(String token) {
        return Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
    
    /**
     * Valide un token JWT
     */
    public boolean validateToken(String token) {
        try {
            Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
            if (revocationService.isRevoked(claims.getId())) {
                log.debug("Token JWT revoque (jti={})", claims.getId());
                return false;
            }
            return true;
        } catch (MalformedJwtException ex) {
            log.error("Token JWT invalide: {}", ex.getMessage());
        } catch (ExpiredJwtException ex) {
            log.error("Token JWT expiré: {}", ex.getMessage());
        } catch (UnsupportedJwtException ex) {
            log.error("Token JWT non supporté: {}", ex.getMessage());
        } catch (IllegalArgumentException ex) {
            log.error("Claims JWT vides: {}", ex.getMessage());
        }
        return false;
    }

    /**
     * Revoque un token JWT (ex: deconnexion) - il sera rejete par validateToken() des
     * la prochaine requete, meme s'il n'a pas encore expire naturellement.
     */
    public void revokeToken(String token) {
        try {
            Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
            Instant expiresAt = claims.getExpiration() != null ? claims.getExpiration().toInstant() : null;
            revocationService.revoke(claims.getId(), expiresAt);
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("Impossible de revoquer un token invalide: {}", ex.getMessage());
        }
    }

    /**
     * Récupère la durée d'expiration
     */
    public long getExpirationDuration() {
        return jwtExpiration;
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
