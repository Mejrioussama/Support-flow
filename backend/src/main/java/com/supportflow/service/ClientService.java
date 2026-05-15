package com.supportflow.service;

import com.supportflow.dto.ClientDTO;
import com.supportflow.dto.ClientSummaryDTO;
import com.supportflow.entity.Client;
import com.supportflow.entity.User;
import com.supportflow.exception.BusinessException;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.mapper.EntityMapper;
import com.supportflow.repository.ClientRepository;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service de gestion des clients
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ClientService {
    
    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final EntityMapper mapper;
    
    /**
     * Crée un nouveau client
     */
    public ClientDTO createClient(ClientDTO dto) {
        log.info("Création d'un nouveau client: {}", dto.getCompanyName());
        
        // Vérifier l'unicité
        if (clientRepository.existsByCode(dto.getCode())) {
            throw new BusinessException("Ce code client existe déjà");
        }
        if (clientRepository.existsByCompanyName(dto.getCompanyName())) {
            throw new BusinessException("Ce nom de société existe déjà");
        }
        
        Client client = mapper.toClient(dto);
        client.setIsActive(true);
        if (client.getSlaLevel() == null) {
            client.setSlaLevel("STANDARD");
        }
        
        client = clientRepository.save(client);
        log.info("Client créé: {} - {}", client.getId(), client.getCode());
        
        return mapper.toClientDTO(client);
    }
    
    /**
     * Met à jour un client
     */
    public ClientDTO updateClient(Long id, ClientDTO dto) {
        Client client = clientRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Client non trouvé: " + id));
        
        // Vérifier l'unicité si changement de code
        if (dto.getCode() != null && !dto.getCode().equals(client.getCode())) {
            if (clientRepository.existsByCode(dto.getCode())) {
                throw new BusinessException("Ce code client existe déjà");
            }
            client.setCode(dto.getCode());
        }
        
        if (dto.getCompanyName() != null) client.setCompanyName(dto.getCompanyName());
        if (dto.getEmail() != null) client.setEmail(dto.getEmail());
        if (dto.getPhone() != null) client.setPhone(dto.getPhone());
        if (dto.getAddress() != null) client.setAddress(dto.getAddress());
        if (dto.getCity() != null) client.setCity(dto.getCity());
        if (dto.getCountry() != null) client.setCountry(dto.getCountry());
        if (dto.getPostalCode() != null) client.setPostalCode(dto.getPostalCode());
        if (dto.getIndustry() != null) client.setIndustry(dto.getIndustry());
        if (dto.getContractType() != null) client.setContractType(dto.getContractType());
        if (dto.getSlaLevel() != null) client.setSlaLevel(dto.getSlaLevel());
        if (dto.getLogoUrl() != null) client.setLogoUrl(dto.getLogoUrl());
        if (dto.getNotes() != null) client.setNotes(dto.getNotes());
        if (dto.getIsActive() != null) client.setIsActive(dto.getIsActive());
        
        client = clientRepository.save(client);
        log.info("Client mis à jour: {}", client.getId());
        
        return mapper.toClientDTO(client);
    }
    
    /**
     * Récupère un client par ID
     */
    @Transactional(readOnly = true)
    public ClientDTO getClientById(Long id) {
        Client client = clientRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Client non trouvé: " + id));
        return mapper.toClientDTO(client);
    }
    
    /**
     * Récupère un client par code
     */
    @Transactional(readOnly = true)
    public ClientDTO getClientByCode(String code) {
        Client client = clientRepository.findByCode(code)
            .orElseThrow(() -> new ResourceNotFoundException("Client non trouvé: " + code));
        return mapper.toClientDTO(client);
    }
    
    /**
     * Liste tous les clients actifs
     */
    @Transactional(readOnly = true)
    public Page<ClientDTO> getAllActiveClients(Pageable pageable) {
        return clientRepository.findByIsActiveTrue(pageable)
            .map(mapper::toClientDTO);
    }
    
    /**
     * Liste tous les clients (résumé)
     */
    @Transactional(readOnly = true)
    public List<ClientSummaryDTO> getAllClientsSummary() {
        return clientRepository.findByIsActiveTrue()
            .stream()
            .map(mapper::toClientSummaryDTO)
            .toList();
    }
    
    /**
     * Recherche de clients
     */
    @Transactional(readOnly = true)
    public Page<ClientDTO> searchClients(String query, Pageable pageable) {
        return clientRepository.searchClients(query, pageable)
            .map(mapper::toClientDTO);
    }
    
    /**
     * Liste les industries distinctes
     */
    @Transactional(readOnly = true)
    public List<String> getAllIndustries() {
        return clientRepository.findAllIndustries();
    }
    
    /**
     * Désactive un client
     */
    public void deactivateClient(Long id) {
        Client client = clientRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Client non trouvé: " + id));
        client.setIsActive(false);
        clientRepository.save(client);
        log.info("Client désactivé: {}", id);
    }

    /**
     * Active un client
     */
    public ClientDTO activateClient(Long id) {
        Client client = clientRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Client non trouvé: " + id));
        client.setIsActive(true);
        client = clientRepository.save(client);
        log.info("Client activé: {}", id);
        return mapper.toClientDTO(client);
    }
    
    /**
     * Récupère un client par email
     */
    @Transactional(readOnly = true)
    public ClientDTO getClientByEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }

        Client directClient = clientRepository.findByEmail(email).orElse(null);
        if (directClient != null) {
            return mapper.toClientDTO(directClient);
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user != null && user.getClient() != null) {
            return mapper.toClientDTO(user.getClient());
        }

        return null;
    }
    
    /**
     * Compte les clients actifs
     */
    @Transactional(readOnly = true)
    public long countActiveClients() {
        return clientRepository.countActiveClients();
    }
}
