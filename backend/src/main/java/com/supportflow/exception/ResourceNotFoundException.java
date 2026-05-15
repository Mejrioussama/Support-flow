package com.supportflow.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Exception pour les ressources non trouvées
 */
@ResponseStatus(HttpStatus.NOT_FOUND)
public class ResourceNotFoundException extends RuntimeException {
    
    public ResourceNotFoundException(String message) {
        super(message);
    }
    
    public ResourceNotFoundException(String resourceName, Long id) {
        super(String.format("%s non trouvé avec l'ID: %d", resourceName, id));
    }
    
    public ResourceNotFoundException(String resourceName, String field, String value) {
        super(String.format("%s non trouvé avec %s: %s", resourceName, field, value));
    }
}
