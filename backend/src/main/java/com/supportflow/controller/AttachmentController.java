package com.supportflow.controller;

import com.supportflow.dto.AttachmentDTO;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.repository.UserRepository;
import com.supportflow.service.UserIdentityService;
import com.supportflow.service.AttachmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "Attachments", description = "API de gestion des pieces jointes")
public class AttachmentController {

    private final AttachmentService attachmentService;
    private final UserRepository userRepository;
    private final UserIdentityService userIdentityService;

    @GetMapping("/tickets/{ticketId}/attachments")
    @Operation(summary = "Lister les pieces jointes d'un ticket")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AttachmentDTO>> listByTicket(@PathVariable Long ticketId) {
        return ResponseEntity.ok(attachmentService.listByTicket(ticketId));
    }

    @PostMapping(value = "/tickets/{ticketId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Uploader une piece jointe")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AttachmentDTO> uploadAttachment(
        @PathVariable Long ticketId,
        @RequestPart("file") MultipartFile file,
        @RequestPart(value = "description", required = false) String description,
        @AuthenticationPrincipal Jwt jwt) {
        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(attachmentService.uploadToTicket(ticketId, file, description, userId));
    }

    @GetMapping("/attachments/{id}/download")
    @Operation(summary = "Telecharger une piece jointe")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Resource> downloadAttachment(@PathVariable Long id) {
        AttachmentDTO dto = attachmentService.getAttachment(id);
        Resource resource = attachmentService.getAttachmentResource(id);
        String filename = dto.getOriginalName() != null ? dto.getOriginalName() : dto.getFileName();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setContentType(MediaType.parseMediaType(dto.getContentType() != null ? dto.getContentType() : "application/octet-stream"));
        return ResponseEntity.ok().headers(headers).body(resource);
    }

    @DeleteMapping("/attachments/{id}")
    @Operation(summary = "Supprimer une piece jointe")
    @PreAuthorize("hasAnyRole('ADMIN','SUPPORT_MANAGER','SUPPORT_AGENT')")
    public ResponseEntity<Map<String, String>> deleteAttachment(@PathVariable Long id) {
        attachmentService.deleteAttachment(id);
        return ResponseEntity.ok(Map.of("message", "Attachment supprime"));
    }

    private Long getUserIdFromJwt(Jwt jwt) {
        return userIdentityService.resolveUserIdFromJwt(jwt);
    }

    @SuppressWarnings("unchecked")
    private Role getRoleFromJwt(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) {
            List<String> roles = (List<String>) realmAccess.get("roles");
            if (roles != null) {
                if (roles.contains("ADMIN")) return Role.ADMIN;
                if (roles.contains("SUPPORT_MANAGER")) return Role.SUPPORT_MANAGER;
                if (roles.contains("SUPPORT_AGENT")) return Role.SUPPORT_AGENT;
                if (roles.contains("CLIENT")) return Role.CLIENT;
            }
        }
        return Role.CLIENT;
    }
}


