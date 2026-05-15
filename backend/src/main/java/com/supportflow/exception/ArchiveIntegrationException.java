package com.supportflow.exception;

/**
 * Exception fonctionnelle levee quand l'archivage GED vers Alfresco echoue.
 */
public class ArchiveIntegrationException extends RuntimeException {

    public ArchiveIntegrationException(String message) {
        super(message);
    }

    public ArchiveIntegrationException(String message, Throwable cause) {
        super(message, cause);
    }
}
