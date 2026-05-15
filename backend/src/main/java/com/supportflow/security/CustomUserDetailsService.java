package com.supportflow.security;

import com.supportflow.entity.User;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;

/**
 * Service de chargement des utilisateurs pour Spring Security
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {
    
    private final UserRepository userRepository;
    
    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé: " + username));
        
        if (!user.getIsActive()) {
            throw new UsernameNotFoundException("Compte désactivé: " + username);
        }
        
        return new org.springframework.security.core.userdetails.User(
            user.getUsername(),
            user.getPassword(),
            user.getIsActive(),
            true, // accountNonExpired
            true, // credentialsNonExpired
            true, // accountNonLocked
            Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }
    
    @Transactional(readOnly = true)
    public UserDetails loadUserById(Long id) throws UsernameNotFoundException {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé avec ID: " + id));
        
        return loadUserByUsername(user.getUsername());
    }
}
