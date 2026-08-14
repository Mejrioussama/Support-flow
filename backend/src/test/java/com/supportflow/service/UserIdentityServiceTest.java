package com.supportflow.service;

import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * UserIdentityService resolves the local User behind an incoming JWT, and every authenticated
 * request goes through it. Two behaviours here are security- or availability-critical and were
 * previously untested:
 *
 * <ul>
 *   <li>Account linking is gated on a verified email claim. Without that gate, anyone able to
 *       self-register in Keycloak with a staff member's address would inherit that staff
 *       member's local account and role.</li>
 *   <li>Linking must tolerate two concurrent requests racing to attach the same keycloakId.
 *       A parallel page load fires several API calls at once, and before the fix the loser of
 *       that race surfaced as an HTTP 500 to the user.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserIdentityServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private KeycloakAdminService keycloakAdminService;

    @InjectMocks
    private UserIdentityService userIdentityService;

    private static final String KC_ID = "kc-uuid-1234";

    private Jwt jwt(Map<String, Object> claims) {
        return new Jwt("token-value", Instant.now(), Instant.now().plusSeconds(300),
            Map.of("alg", "none"), claims);
    }

    private Jwt staffJwt(boolean emailVerified) {
        return jwt(Map.of(
            "sub", KC_ID,
            "email", "karim@supportflow.com",
            "preferred_username", "karim",
            "email_verified", emailVerified,
            "realm_access", Map.of("roles", List.of("SUPPORT_AGENT"))
        ));
    }

    private User existingUser(Long id, String keycloakId) {
        User u = new User();
        u.setId(id);
        u.setUsername("karim");
        u.setEmail("karim@supportflow.com");
        u.setKeycloakId(keycloakId);
        u.setRole(Role.SUPPORT_AGENT);
        return u;
    }

    @Nested
    @DisplayName("Resolution par keycloakId")
    class ByKeycloakId {

        @Test
        @DisplayName("retourne l'utilisateur deja lie sans re-ecriture")
        void returnsLinkedUserWithoutSaving() {
            User linked = existingUser(7L, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(linked));

            User result = userIdentityService.resolveUserFromJwt(staffJwt(true));

            assertNotNull(result);
            assertEquals(7L, result.getId());
            // An already-linked account must not trigger a write on every single request.
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("resolveUserIdFromJwt renvoie null pour un JWT null")
        void nullJwtYieldsNullId() {
            assertNull(userIdentityService.resolveUserIdFromJwt(null));
        }
    }

    @Nested
    @DisplayName("Liaison de compte par email")
    class EmailLinking {

        @Test
        @DisplayName("lie le compte local quand l'email est verifie")
        void linksWhenEmailVerified() {
            User unlinked = existingUser(7L, null);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.empty());
            when(userRepository.findByEmail("karim@supportflow.com")).thenReturn(Optional.of(unlinked));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            User result = userIdentityService.resolveUserFromJwt(staffJwt(true));

            assertEquals(KC_ID, result.getKeycloakId());
            verify(userRepository).save(unlinked);
        }

        @Test
        @DisplayName("refuse de lier un compte existant quand l'email n'est pas verifie")
        void doesNotLinkWhenEmailUnverified() {
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.empty());
            when(keycloakAdminService.getKeycloakUserById(KC_ID)).thenReturn(null);
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            User result = userIdentityService.resolveUserFromJwt(staffJwt(false));

            // The existing local account must never be looked up by an unverified claim:
            // that lookup is the account-takeover path this gate exists to close.
            verify(userRepository, never()).findByEmail(anyString());
            verify(userRepository, never()).findByUsername(anyString());
            // Instead a brand new account is provisioned, carrying the unverified identity.
            assertNotNull(result);
            assertEquals(KC_ID, result.getKeycloakId());
        }
    }

    @Nested
    @DisplayName("Concurrence sur la liaison du keycloakId")
    class ConcurrentLinking {

        @Test
        @DisplayName("absorbe le conflit de verrouillage optimiste et renvoie la ligne rechargee")
        void recoversFromOptimisticLockFailure() {
            User unlinked = existingUser(7L, null);
            User winner = existingUser(7L, KC_ID);

            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.empty());
            when(userRepository.findByEmail("karim@supportflow.com")).thenReturn(Optional.of(unlinked));
            // Simulates the concurrent request that already attached the keycloakId and bumped
            // the row version, making this save fail.
            when(userRepository.save(any(User.class)))
                .thenThrow(new ObjectOptimisticLockingFailureException(User.class, 7L));
            when(userRepository.findById(7L)).thenReturn(Optional.of(winner));

            User result = userIdentityService.resolveUserFromJwt(staffJwt(true));

            // The request must succeed rather than surfacing a 500: the concurrent write
            // already achieved what this one wanted.
            assertNotNull(result);
            assertEquals(7L, result.getId());
            assertEquals(KC_ID, result.getKeycloakId());
            verify(userRepository).findById(7L);
        }

        @Test
        @DisplayName("retombe sur l'entite courante si le rechargement ne trouve rien")
        void fallsBackToInMemoryUserWhenReloadFails() {
            User unlinked = existingUser(7L, null);

            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.empty());
            when(userRepository.findByEmail("karim@supportflow.com")).thenReturn(Optional.of(unlinked));
            when(userRepository.save(any(User.class)))
                .thenThrow(new ObjectOptimisticLockingFailureException(User.class, 7L));
            when(userRepository.findById(7L)).thenReturn(Optional.empty());

            User result = userIdentityService.resolveUserFromJwt(staffJwt(true));

            assertNotNull(result);
            assertEquals(7L, result.getId());
        }
    }

    @Nested
    @DisplayName("Auto-creation et mapping de role")
    class AutoCreation {

        @Test
        @DisplayName("cree un utilisateur avec le role le plus eleve porte par le JWT")
        void mapsHighestRoleFromJwt() {
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.empty());
            when(keycloakAdminService.getKeycloakUserById(KC_ID)).thenReturn(null);
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            Jwt adminJwt = jwt(Map.of(
                "sub", KC_ID,
                "email", "boss@supportflow.com",
                "preferred_username", "boss",
                "email_verified", false,
                "realm_access", Map.of("roles", List.of("SUPPORT_AGENT", "ADMIN"))
            ));

            User created = userIdentityService.resolveUserFromJwt(adminJwt);

            assertEquals(Role.ADMIN, created.getRole());
            assertTrue(created.getIsActive());
        }

        @Test
        @DisplayName("retombe sur CLIENT quand le JWT ne porte aucun role connu")
        void defaultsToClientRole() {
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.empty());
            when(keycloakAdminService.getKeycloakUserById(KC_ID)).thenReturn(null);
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            Jwt anonJwt = jwt(Map.of(
                "sub", KC_ID,
                "preferred_username", "inconnu",
                "email_verified", false
            ));

            assertEquals(Role.CLIENT, userIdentityService.resolveUserFromJwt(anonJwt).getRole());
        }

        @Test
        @DisplayName("fabrique un email de repli quand le JWT n'en fournit aucun")
        void synthesisesFallbackEmail() {
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.empty());
            when(keycloakAdminService.getKeycloakUserById(KC_ID)).thenReturn(null);
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            Jwt noEmail = jwt(Map.of(
                "sub", KC_ID,
                "preferred_username", "sansmail",
                "email_verified", false
            ));

            User created = userIdentityService.resolveUserFromJwt(noEmail);

            // email is NOT NULL in the schema, so a deterministic placeholder is required
            // for the insert to succeed at all.
            assertEquals(KC_ID + "@supportflow.local", created.getEmail());
        }

        @Test
        @DisplayName("renvoie null quand le JWT ne porte aucune identite exploitable")
        void returnsNullWhenNoIdentityClaims() {
            assertNull(userIdentityService.resolveUserFromJwt(jwt(Map.of("scope", "openid"))));
        }
    }
}
