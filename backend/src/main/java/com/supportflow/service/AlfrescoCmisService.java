package com.supportflow.service;

import com.supportflow.exception.ArchiveIntegrationException;
import lombok.extern.slf4j.Slf4j;
import org.apache.chemistry.opencmis.client.api.CmisObject;
import org.apache.chemistry.opencmis.client.api.Document;
import org.apache.chemistry.opencmis.client.api.Folder;
import org.apache.chemistry.opencmis.client.api.Repository;
import org.apache.chemistry.opencmis.client.api.Session;
import org.apache.chemistry.opencmis.client.api.SessionFactory;
import org.apache.chemistry.opencmis.client.runtime.SessionFactoryImpl;
import org.apache.chemistry.opencmis.commons.PropertyIds;
import org.apache.chemistry.opencmis.commons.SessionParameter;
import org.apache.chemistry.opencmis.commons.enums.BaseTypeId;
import org.apache.chemistry.opencmis.commons.enums.BindingType;
import org.apache.chemistry.opencmis.commons.enums.UnfileObject;
import org.apache.chemistry.opencmis.commons.enums.VersioningState;
import org.apache.chemistry.opencmis.commons.impl.dataobjects.ContentStreamImpl;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
public class AlfrescoCmisService {

    @Value("${alfresco.url:}")
    private String alfrescoUrl;

    @Value("${alfresco.username:}")
    private String alfrescoUsername;

    @Value("${alfresco.password:}")
    private String alfrescoPassword;

    @Value("${alfresco.repository.root-folder:/SupportFlow/Tickets}")
    private String alfrescoRootFolder;

    public ArchiveUploadResult uploadTicketArchive(String ticketReference, Path localArchiveRoot) {
        return uploadArchive(normalizeFolderPath(alfrescoRootFolder), ticketReference, localArchiveRoot);
    }

    public ArchiveUploadResult uploadArchive(String repositoryRootFolder, String archiveReference, Path localArchiveRoot) {
        if (!isConfigured()) {
            throw new ArchiveIntegrationException("Configuration Alfresco incomplete pour l'archivage GED: "
                + "verify env vars ALFRESCO_URL, ALFRESCO_USERNAME, ALFRESCO_PASSWORD");
        }

        try {
            Session session = openSession();
            Folder rootFolder = ensureFolderPath(session, normalizeFolderPath(repositoryRootFolder));
            String ticketFolderName = sanitizeName(archiveReference);
            Folder ticketFolder = ensureChildFolder(rootFolder, ticketFolderName);

            clearFolderContents(ticketFolder);
            Map<String, String> uploadedDocuments = new LinkedHashMap<>();
            uploadDirectory(session, ticketFolder, localArchiveRoot, localArchiveRoot, uploadedDocuments);

            log.info("Archive {} chargee dans Alfresco sous {}", archiveReference, ticketFolder.getPath());
            return new ArchiveUploadResult(ticketFolder.getId(), ticketFolder.getPath(), uploadedDocuments);
        } catch (ArchiveIntegrationException e) {
            throw e;
        } catch (Exception e) {
            throw new ArchiveIntegrationException("Impossible de charger l'archive dans Alfresco", e);
        }
    }

    public String buildTicketFolderPath(String ticketReference) {
        return normalizeFolderPath(alfrescoRootFolder) + "/" + sanitizeName(ticketReference);
    }

    public List<ArchiveEntryInfo> listArchiveEntries(String folderId) {
        if (!isConfigured()) {
            throw new ArchiveIntegrationException("Configuration Alfresco incomplete pour la lecture GED");
        }
        if (folderId == null || folderId.isBlank()) {
            return List.of();
        }

        try {
            Session session = openSession();
            CmisObject object = session.getObject(folderId);
            if (!(object instanceof Folder rootFolder)) {
                return List.of();
            }

            List<ArchiveEntryInfo> entries = new ArrayList<>();
            entries.add(new ArchiveEntryInfo(
                rootFolder.getId(),
                rootFolder.getName(),
                true,
                "",
                null,
                null
            ));
            collectArchiveEntries(rootFolder, "", entries);
            return entries;
        } catch (ArchiveIntegrationException e) {
            throw e;
        } catch (Exception e) {
            throw new ArchiveIntegrationException("Impossible de lire les documents Alfresco du ticket", e);
        }
    }

    public DocumentContentResult getDocumentContent(String objectId) {
        if (!isConfigured()) {
            throw new ArchiveIntegrationException("Configuration Alfresco incomplete pour la lecture du contenu GED");
        }
        if (objectId == null || objectId.isBlank()) {
            throw new ArchiveIntegrationException("Identifiant document Alfresco manquant");
        }

        try {
            Session session = openSession();
            CmisObject object = session.getObject(objectId);
            if (!(object instanceof Document document)) {
                throw new ArchiveIntegrationException("L'objet Alfresco cible n'est pas un document");
            }

            if (document.getContentStream() == null) {
                throw new ArchiveIntegrationException("Le document Alfresco ne contient aucun flux telechargeable");
            }

            try (InputStream inputStream = document.getContentStream().getStream();
                 ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
                inputStream.transferTo(outputStream);
                return new DocumentContentResult(
                    document.getId(),
                    document.getName(),
                    document.getContentStreamMimeType(),
                    outputStream.toByteArray()
                );
            }
        } catch (ArchiveIntegrationException e) {
            throw e;
        } catch (Exception e) {
            throw new ArchiveIntegrationException("Impossible de lire le contenu du document Alfresco", e);
        }
    }

    private boolean isConfigured() {
        return alfrescoUrl != null && !alfrescoUrl.isBlank()
            && alfrescoUsername != null && !alfrescoUsername.isBlank()
            && alfrescoPassword != null && !alfrescoPassword.isBlank()
            && alfrescoRootFolder != null && !alfrescoRootFolder.isBlank();
    }

    private Session openSession() {
        Map<String, String> parameters = new HashMap<>();
        parameters.put(SessionParameter.USER, alfrescoUsername);
        parameters.put(SessionParameter.PASSWORD, alfrescoPassword);
        parameters.put(SessionParameter.ATOMPUB_URL, alfrescoUrl);
        parameters.put(SessionParameter.BINDING_TYPE, BindingType.ATOMPUB.value());
        parameters.put(SessionParameter.COMPRESSION, "true");
        parameters.put(SessionParameter.CONNECT_TIMEOUT, "10000");
        parameters.put(SessionParameter.READ_TIMEOUT, "30000");

        SessionFactory sessionFactory = SessionFactoryImpl.newInstance();
        List<Repository> repositories = null;
        ArchiveIntegrationException lastError = null;

        try {
            repositories = sessionFactory.getRepositories(parameters);
        } catch (Exception e) {
            lastError = new ArchiveIntegrationException(
                "CMIS connection failed with URL: " + alfrescoUrl 
                + ". Check ALFRESCO_URL env var, Alfresco service health, and credentials.", e);
        }

        if (repositories == null || repositories.isEmpty()) {
            if (lastError == null) {
                lastError = new ArchiveIntegrationException(
                    "Aucun repository CMIS Alfresco disponible at " + alfrescoUrl 
                    + ". Verify Alfresco is running and CMIS endpoint is accessible.");
            }
            throw lastError;
        }

        try {
            return repositories.get(0).createSession();
        } catch (Exception e) {
            throw new ArchiveIntegrationException(
                "CMIS session creation failed for repository at " + alfrescoUrl, e);
        }
    }

    private Folder ensureFolderPath(Session session, String folderPath) {
        Folder currentFolder = session.getRootFolder();
        if ("/".equals(folderPath)) {
            return currentFolder;
        }

        for (String segment : folderPath.substring(1).split("/")) {
            if (segment == null || segment.isBlank()) {
                continue;
            }
            currentFolder = ensureChildFolder(currentFolder, segment);
        }
        return currentFolder;
    }

    private Folder ensureChildFolder(Folder parentFolder, String folderName) {
        Optional<Folder> existingFolder = findChildFolder(parentFolder, folderName);
        if (existingFolder.isPresent()) {
            return existingFolder.get();
        }

        Map<String, Object> properties = new HashMap<>();
        properties.put(PropertyIds.OBJECT_TYPE_ID, BaseTypeId.CMIS_FOLDER.value());
        properties.put(PropertyIds.NAME, folderName);

        return parentFolder.createFolder(properties);
    }

    private Optional<Folder> findChildFolder(Folder parentFolder, String folderName) {
        for (CmisObject child : parentFolder.getChildren()) {
            if (child instanceof Folder folder && folderName.equals(folder.getName())) {
                return Optional.of(folder);
            }
        }
        return Optional.empty();
    }

    private void clearFolderContents(Folder folder) {
        List<CmisObject> children = new ArrayList<>();
        for (CmisObject child : folder.getChildren()) {
            children.add(child);
        }

        for (CmisObject child : children) {
            if (child instanceof Folder childFolder) {
                childFolder.deleteTree(true, UnfileObject.DELETE, true);
                continue;
            }
            if (child instanceof Document document) {
                document.deleteAllVersions();
                continue;
            }
            child.delete();
        }
    }

    private void uploadDirectory(Session session,
                                 Folder alfrescoFolder,
                                 Path currentDirectory,
                                 Path rootDirectory,
                                 Map<String, String> uploadedDocuments) throws IOException {
        try (var paths = Files.list(currentDirectory)) {
            List<Path> children = paths
                .sorted(Comparator.comparing(path -> path.getFileName().toString(), String.CASE_INSENSITIVE_ORDER))
                .toList();

            for (Path child : children) {
                if (Files.isDirectory(child)) {
                    Folder childFolder = ensureChildFolder(alfrescoFolder, sanitizeName(child.getFileName().toString()));
                    uploadDirectory(session, childFolder, child, rootDirectory, uploadedDocuments);
                    continue;
                }

                String relativePath = rootDirectory.relativize(child).toString().replace('\\', '/');
                Document document = uploadDocument(session, alfrescoFolder, child);
                uploadedDocuments.put(relativePath, document.getId());
            }
        }
    }

    private void collectArchiveEntries(Folder folder, String parentPath, List<ArchiveEntryInfo> entries) {
        List<CmisObject> children = new ArrayList<>();
        for (CmisObject child : folder.getChildren()) {
            children.add(child);
        }
        children.sort(Comparator.comparing(CmisObject::getName, String.CASE_INSENSITIVE_ORDER));

        for (CmisObject child : children) {
            String relativePath = parentPath == null || parentPath.isBlank()
                ? child.getName()
                : parentPath + "/" + child.getName();

            if (child instanceof Folder childFolder) {
                entries.add(new ArchiveEntryInfo(
                    childFolder.getId(),
                    childFolder.getName(),
                    true,
                    relativePath,
                    null,
                    null
                ));
                collectArchiveEntries(childFolder, relativePath, entries);
                continue;
            }

            if (child instanceof Document document) {
                entries.add(new ArchiveEntryInfo(
                    document.getId(),
                    document.getName(),
                    false,
                    relativePath,
                    document.getContentStreamMimeType(),
                    document.getContentStreamLength()
                ));
            }
        }
    }

    private Document uploadDocument(Session session, Folder parentFolder, Path filePath) throws IOException {
        Map<String, Object> properties = new HashMap<>();
        properties.put(PropertyIds.OBJECT_TYPE_ID, BaseTypeId.CMIS_DOCUMENT.value());
        properties.put(PropertyIds.NAME, sanitizeName(filePath.getFileName().toString()));

        String mimeType = detectMimeType(filePath);
        try (InputStream inputStream = Files.newInputStream(filePath)) {
            ContentStreamImpl contentStream = new ContentStreamImpl(
                filePath.getFileName().toString(),
                BigInteger.valueOf(Files.size(filePath)),
                mimeType,
                inputStream
            );
            return parentFolder.createDocument(properties, contentStream, VersioningState.NONE);
        }
    }

    private String detectMimeType(Path filePath) throws IOException {
        String mimeType = Files.probeContentType(filePath);
        if (mimeType != null && !mimeType.isBlank()) {
            return mimeType;
        }

        String fileName = filePath.getFileName().toString().toLowerCase(Locale.ROOT);
        if (fileName.endsWith(".pdf")) {
            return "application/pdf";
        }
        if (fileName.endsWith(".xlsx")) {
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        }
        if (fileName.endsWith(".csv")) {
            return "text/csv";
        }
        if (fileName.endsWith(".json")) {
            return "application/json";
        }
        if (fileName.endsWith(".txt") || fileName.endsWith(".log")) {
            return "text/plain";
        }
        return "application/octet-stream";
    }

    private String normalizeFolderPath(String path) {
        if (path == null || path.isBlank()) {
            return "/";
        }

        String normalized = path.trim().replace('\\', '/');
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        while (normalized.contains("//")) {
            normalized = normalized.replace("//", "/");
        }
        if (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private String sanitizeName(String value) {
        if (value == null || value.isBlank()) {
            return "supportflow";
        }
        return value.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    public record ArchiveUploadResult(
        String folderId,
        String folderPath,
        Map<String, String> documentIdsByRelativePath
    ) {}

    public record ArchiveEntryInfo(
        String objectId,
        String name,
        boolean folder,
        String relativePath,
        String mimeType,
        Long fileSize
    ) {}

    public record DocumentContentResult(
        String objectId,
        String fileName,
        String mimeType,
        byte[] content
    ) {}
}
