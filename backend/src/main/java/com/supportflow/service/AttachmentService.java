package com.supportflow.service;

import com.supportflow.dto.AttachmentDTO;
import com.supportflow.entity.Attachment;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.TicketHistory;
import com.supportflow.entity.User;
import com.supportflow.exception.BusinessException;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.mapper.EntityMapper;
import com.supportflow.repository.AttachmentRepository;
import com.supportflow.repository.TicketHistoryRepository;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AttachmentService {

    private final AttachmentRepository attachmentRepository;
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final TicketHistoryRepository ticketHistoryRepository;
    private final EntityMapper mapper;

    @Value("${supportflow.storage.upload-dir:uploads}")
    private String uploadDir;

    @Transactional(readOnly = true)
    public List<AttachmentDTO> listByTicket(Long ticketId) {
        if (!ticketRepository.existsById(ticketId)) {
            throw new ResourceNotFoundException("Ticket non trouve: " + ticketId);
        }
        return mapper.toAttachmentDTOList(attachmentRepository.findByTicketIdOrderByCreatedAtDesc(ticketId));
    }

    public AttachmentDTO uploadToTicket(Long ticketId, MultipartFile file, String description, Long userId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Fichier vide");
        }

        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
        User user = userId != null ? userRepository.findById(userId).orElse(null) : null;

        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(uploadPath);

            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
            String safeOriginal = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
            String storedName = UUID.randomUUID() + "_" + safeOriginal;

            Path destination = uploadPath.resolve(storedName);
            Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);

            Attachment attachment = Attachment.builder()
                .ticket(ticket)
                .uploadedBy(user)
                .fileName(storedName)
                .originalName(originalName)
                .filePath(destination.toString())
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .description(description)
                .build();

            attachment = attachmentRepository.save(attachment);

            TicketHistory history = TicketHistory.createAttachment(ticket, user, originalName);
            history.setCreatedAt(LocalDateTime.now());
            ticketHistoryRepository.save(history);

            return mapper.toAttachmentDTO(attachment);
        } catch (IOException e) {
            throw new BusinessException("Impossible d'enregistrer le fichier: " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public Resource getAttachmentResource(Long attachmentId) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Piece jointe non trouvee: " + attachmentId));

        if (attachment.getFilePath() == null) {
            throw new ResourceNotFoundException("Fichier introuvable pour la piece jointe: " + attachmentId);
        }
        Resource resource = new FileSystemResource(attachment.getFilePath());
        if (!resource.exists()) {
            throw new ResourceNotFoundException("Fichier physique introuvable: " + attachment.getFilePath());
        }
        return resource;
    }

    @Transactional(readOnly = true)
    public AttachmentDTO getAttachment(Long attachmentId) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Piece jointe non trouvee: " + attachmentId));
        return mapper.toAttachmentDTO(attachment);
    }

    public void deleteAttachment(Long attachmentId) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Piece jointe non trouvee: " + attachmentId));

        if (attachment.getFilePath() != null) {
            try {
                Files.deleteIfExists(Path.of(attachment.getFilePath()));
            } catch (IOException e) {
                log.warn("Impossible de supprimer le fichier physique {}: {}", attachment.getFilePath(), e.getMessage());
            }
        }

        attachmentRepository.delete(attachment);
    }
}
