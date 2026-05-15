-- SupportFlow - Donnees d'initialisation pour le profil docker
-- Jeu de donnees de demonstration plus proche d'un environnement de support reel.

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE ticket_tags;
TRUNCATE TABLE attachments;
TRUNCATE TABLE satisfaction_surveys;
TRUNCATE TABLE escalation_events;
TRUNCATE TABLE ticket_history;
TRUNCATE TABLE comments;
TRUNCATE TABLE notifications;
TRUNCATE TABLE agent_availability;
TRUNCATE TABLE agent_skills;
TRUNCATE TABLE escalation_policies;
TRUNCATE TABLE tickets;
TRUNCATE TABLE users;
TRUNCATE TABLE support_categories;
TRUNCATE TABLE clients;
SET FOREIGN_KEY_CHECKS = 1;

-- Clients
INSERT INTO clients (
  id, code, company_name, email, phone, address, city, country, postal_code,
  industry, contract_type, sla_level, is_active, created_at, updated_at, version
)
VALUES
  (1, 'CLI001', 'Societe ABC', 'contact@abc.com', '+216 71 200 100', '12 Rue du Lac', 'Tunis', 'Tunisie', '1053',
   'Industrie', 'PREMIUM', 'PREMIUM', true, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0),
  (2, 'CLI002', 'Atlas Sante', 'it@atlassante.tn', '+216 71 200 200', '8 Avenue Habib Bourguiba', 'Tunis', 'Tunisie', '1001',
   'Sante', 'PREMIUM', 'PREMIUM', true, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 140 DAY), CURRENT_TIMESTAMP(), 0),
  (3, 'CLI003', 'RetailNova', 'support@retailnova.com', '+216 73 410 300', 'Zone Industrielle', 'Sousse', 'Tunisie', '4000',
   'Retail', 'STANDARD', 'STANDARD', true, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 120 DAY), CURRENT_TIMESTAMP(), 0),
  (4, 'CLI004', 'Financia Group', 'ops@financia-group.com', '+216 70 880 440', '14 Rue de la Bourse', 'Sfax', 'Tunisie', '3000',
   'Finance', 'ENTERPRISE', 'PREMIUM', true, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY), CURRENT_TIMESTAMP(), 0);

-- Categories support
INSERT INTO support_categories (
  id, code, label, description, is_active, sort_order, created_at, updated_at, version
)
VALUES
  (1, 'AUTHENTICATION', 'Authentification', 'Connexion, SSO, comptes et mots de passe', true, 10, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0),
  (2, 'UI', 'Interface', 'Affichage, ergonomie, mobile et dashboard', true, 20, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0),
  (3, 'REPORTING', 'Reporting', 'Exports, rapports et tableaux de bord', true, 30, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0),
  (4, 'NETWORK', 'Reseau', 'VPN, connectivite, DNS et latence', true, 40, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0),
  (5, 'EMAIL', 'Email', 'Messagerie, SMTP, IMAP et boites mail', true, 50, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0),
  (6, 'DATABASE', 'Base de donnees', 'SQL, MySQL, PostgreSQL et performances', true, 60, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0),
  (7, 'SECURITY', 'Securite', 'Acces, MFA, permissions et certificats', true, 70, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0),
  (8, 'HARDWARE', 'Materiel', 'PC, imprimantes, scanners et equipements', true, 80, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0),
  (9, 'SOFTWARE', 'Logiciel', 'Applications, bugs et services metier', true, 90, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0),
  (10, 'GENERAL', 'General', 'Categorie de secours', true, 100, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0);

-- Utilisateurs
-- Comptes Keycloak deja disponibles: admin/admin123, manager/manager123, agent1/agent123, client1/client123
INSERT INTO users (
  id, username, email, password, first_name, last_name, phone, role, keycloak_id,
  is_active, client_id, created_at, updated_at, version
)
VALUES
  (1, 'admin', 'admin@supportflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O',
   'Admin', 'System', '+21600000001', 'ADMIN', NULL, true, NULL, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY), CURRENT_TIMESTAMP(), 0),
  (2, 'manager', 'manager@supportflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O',
   'Pierre', 'Manager', '+21600000002', 'SUPPORT_MANAGER', NULL, true, NULL, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 170 DAY), CURRENT_TIMESTAMP(), 0),
  (3, 'agent1', 'karim@supportflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O',
   'Karim', 'Ben Salem', '+21600000003', 'SUPPORT_AGENT', NULL, true, NULL, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 165 DAY), CURRENT_TIMESTAMP(), 0),
  (4, 'agent2', 'marie@supportflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O',
   'Marie', 'Trabelsi', '+21600000004', 'SUPPORT_AGENT', NULL, true, NULL, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 160 DAY), CURRENT_TIMESTAMP(), 0),
  (5, 'agent3', 'sami@supportflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O',
   'Sami', 'Gharbi', '+21600000005', 'SUPPORT_AGENT', NULL, true, NULL, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 150 DAY), CURRENT_TIMESTAMP(), 0),
  (6, 'client1', 'client@abc.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O',
   'Jean', 'Client', '+21600000006', 'CLIENT', NULL, true, 1, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 120 DAY), CURRENT_TIMESTAMP(), 0),
  (7, 'client2', 'it@atlassante.tn', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O',
   'Leila', 'Mansour', '+21600000007', 'CLIENT', NULL, true, 2, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 115 DAY), CURRENT_TIMESTAMP(), 0),
  (8, 'client3', 'support@retailnova.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O',
   'Mehdi', 'Jlassi', '+21600000008', 'CLIENT', NULL, true, 3, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 110 DAY), CURRENT_TIMESTAMP(), 0),
  (9, 'client4', 'ops@financia-group.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O',
   'Rania', 'Kacem', '+21600000009', 'CLIENT', NULL, true, 4, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 105 DAY), CURRENT_TIMESTAMP(), 0);

-- Competences agents
INSERT INTO agent_skills (
  id, agent_id, category_id, skill_type, created_at, updated_at, version
)
VALUES
  (1, 3, 1, 'PRIMARY', DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 120 DAY), CURRENT_TIMESTAMP(), 0),
  (2, 3, 7, 'SECONDARY', DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 120 DAY), CURRENT_TIMESTAMP(), 0),
  (3, 4, 3, 'PRIMARY', DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 118 DAY), CURRENT_TIMESTAMP(), 0),
  (4, 4, 2, 'SECONDARY', DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 118 DAY), CURRENT_TIMESTAMP(), 0),
  (5, 5, 6, 'PRIMARY', DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 116 DAY), CURRENT_TIMESTAMP(), 0),
  (6, 5, 4, 'SECONDARY', DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 116 DAY), CURRENT_TIMESTAMP(), 0),
  (7, 2, 9, 'PRIMARY', DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 100 DAY), CURRENT_TIMESTAMP(), 0),
  (8, 2, 4, 'SECONDARY', DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 100 DAY), CURRENT_TIMESTAMP(), 0);

-- Disponibilite des agents
INSERT INTO agent_availability (
  id, agent_id, status, status_since, status_reason, max_concurrent_tickets,
  created_at, updated_at, version
)
VALUES
  (1, 3, 'BUSY', DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR), 'Traitement incident SSO prioritaire', 4,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 40 DAY), CURRENT_TIMESTAMP(), 0),
  (2, 4, 'AVAILABLE', DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 35 MINUTE), 'Disponible pour reprise backlog reporting', 5,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 40 DAY), CURRENT_TIMESTAMP(), 0),
  (3, 5, 'ON_BREAK', DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE), 'Pause planifiee avant astreinte base de donnees', 3,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 40 DAY), CURRENT_TIMESTAMP(), 0);

-- Politiques d'escalade
INSERT INTO escalation_policies (
  id, client_id, policy_name, level1_threshold, level2_threshold, level3_delay_minutes,
  stuck_assigned_minutes, max_escalations, cooldown_minutes, auto_reassign_enabled,
  notify_client_on_escalation, is_active, created_at, updated_at, version
)
VALUES
  (1, 1, 'ABC Premium', 85, 100, 20, 10, 8, 5, true, true, true,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY), CURRENT_TIMESTAMP(), 0),
  (2, 2, 'Atlas Sante Critique', 80, 95, 15, 8, 10, 3, true, true, true,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY), CURRENT_TIMESTAMP(), 0),
  (3, 3, 'Retail Standard', 90, 100, 30, 20, 6, 10, true, false, true,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY), CURRENT_TIMESTAMP(), 0),
  (4, 4, 'Financia Gouvernance', 85, 100, 10, 12, 12, 5, false, true, true,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY), CURRENT_TIMESTAMP(), 0);

-- Tickets
INSERT INTO tickets (
  id, reference, title, description, type, status, severity, impact, priority, score,
  sla_hours, sla_deadline, sla_breached, sla_warning_sent, category, normalized_category_id,
  client_id, created_by_user_id, assigned_agent_id, waiting_on, pending_reason, alfresco_folder_id,
  created_at, updated_at, assigned_at, resolved_at, closed_at, version
)
VALUES
  (1, 'SF-1001', 'SSO indisponible pour tout le personnel clinique',
   'Depuis 07h15, les medecins et secretaires ne peuvent plus se connecter via SSO. Le service OAuth renvoie 502 sur la federation.',
   'INCIDENT', 'ESCALATED_SLA', 'SUPER_CRITICAL', 'CRITICAL', 'SUPER_CRITICAL', 27,
   4, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE), true, true, 'Authentification', 1,
   2, 7, 3, NULL, NULL, NULL,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 20 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 270 MINUTE), NULL, NULL, 0),

  (2, 'SF-1002', 'Dashboard ventes mobile bloque au chargement',
   'Les responsables magasin RetailNova voient un ecran vide sur iPhone quand ils ouvrent le dashboard journalier.',
   'BUG', 'IN_PROGRESS', 'HIGH', 'HIGH', 'CRITICAL', 11,
   12, DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 90 MINUTE), false, true, 'Interface', 2,
   3, 8, 4, NULL, NULL, NULL,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 570 MINUTE), NULL, NULL, 0),

  (3, 'SF-1003', 'Preparation export comptable mensuel',
   'Le service finance demande un export CSV consolide avant la cloture de fin de mois.',
   'TASK', 'ASSIGNED', 'MEDIUM', 'MEDIUM', 'MEDIUM', 6,
   24, DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR), false, false, 'Reporting', 3,
   4, 9, 4, NULL, NULL, NULL,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 18 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR), NULL, NULL, 0),

  (4, 'SF-1004', 'Lenteur severe sur replication base clients',
   'Le job de replication MySQL prend plus de 40 minutes et les rapports clients sont en decalage.',
   'INCIDENT', 'PENDING', 'CRITICAL', 'HIGH', 'CRITICAL', 13,
   8, DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 45 MINUTE), false, true, 'Base de donnees', 6,
   1, 6, 5, 'CLIENT', 'En attente d accord client pour lancer le failover de replication hors heures de bureau.', NULL,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 820 MINUTE), NULL, NULL, 0),

  (5, 'SF-1005', 'Demande MFA pour nouveaux cadres',
   'Financia souhaite activer MFA pour 24 nouveaux comptes direction avant lundi matin.',
   'TASK', 'OPEN', 'MEDIUM', 'LOW', 'LOW', 4,
   48, DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 18 HOUR), false, false, 'Securite', 7,
   4, 9, NULL, NULL, NULL, NULL,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 40 MINUTE), NULL, NULL, NULL, 0),

  (6, 'SF-1006', 'Coupures VPN intermittentes site Sousse',
   'Trois magasins remontent des deconnexions VPN de 2 a 3 minutes en pleine synchronisation stock.',
   'INCIDENT', 'ESCALATED_MANUAL', 'HIGH', 'HIGH', 'CRITICAL', 12,
   8, DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 20 MINUTE), false, true, 'Reseau', 4,
   3, 8, 5, NULL, NULL, NULL,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 390 MINUTE), NULL, NULL, 0),

  (7, 'SF-1007', 'Question SLA sur traitement priorite haute',
   'Le client veut confirmer les delais de prise en charge le week-end pour les tickets haute priorite.',
   'QUESTION', 'RESOLVED', 'LOW', 'LOW', 'LOW', 2,
   72, DATE_ADD(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY), INTERVAL 72 HOUR), false, false, 'General', 10,
   1, 6, 2, NULL, NULL, NULL,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 18 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 46 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 18 HOUR), NULL, 0),

  (8, 'SF-1008', 'Erreur SMTP sur factures sortantes',
   'Le serveur de messagerie refuse une partie des emails sortants avec un timeout TLS intermittent.',
   'INCIDENT', 'CLOSED', 'MEDIUM', 'MEDIUM', 'MEDIUM', 5,
   24, DATE_ADD(DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 DAY), INTERVAL 24 HOUR), false, false, 'Email', 5,
   4, 9, 3, NULL, NULL, 'seed-folder-sf-1008',
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 DAY), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 50 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 70 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 56 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 50 HOUR), 0),

  (9, 'SF-1009', 'Nouvelle demande export inventaire Excel',
   'RetailNova souhaite ajouter un export Excel avec filtre par region et famille produit.',
   'FEATURE_REQUEST', 'NEW', 'LOW', 'LOW', 'LOW', 3,
   96, DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 4 DAY), false, false, 'Reporting', 3,
   3, 8, NULL, NULL, NULL, NULL,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 HOUR), NULL, NULL, NULL, 0),

  (10, 'SF-1010', 'Suspicion acces non autorise compte VIP',
   'Le client signale une alerte inhabituelle sur un compte VIP avec tentatives multiples depuis IP etrangere.',
   'INCIDENT', 'ASSIGNED', 'CRITICAL', 'HIGH', 'CRITICAL', 15,
   6, DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR), false, true, 'Securite', 7,
   4, 9, 3, NULL, NULL, NULL,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 20 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 70 MINUTE), NULL, NULL, 0),

  (11, 'SF-1011', 'Ralentissement sur generation rapport RH',
   'Le rapport RH prend plus de 9 minutes au lieu de 45 secondes en heure de pointe.',
   'BUG', 'OPEN', 'MEDIUM', 'MEDIUM', 'MEDIUM', 6,
   16, DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 10 HOUR), false, false, 'Reporting', 3,
   2, 7, NULL, NULL, NULL, NULL,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 4 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 50 MINUTE), NULL, NULL, NULL, 0),

  (12, 'SF-1012', 'Serveur impression etiquettes depot KO',
   'Le depot principal ne peut plus imprimer les etiquettes colis depuis 30 minutes.',
   'INCIDENT', 'IN_PROGRESS', 'HIGH', 'MEDIUM', 'HIGH', 8,
   8, DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 3 HOUR), false, false, 'Materiel', 8,
   3, 8, 5, NULL, NULL, NULL,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 50 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 40 MINUTE), NULL, NULL, 0);

-- Commentaires
INSERT INTO comments (
  id, content, is_internal, is_solution, ticket_id, author_id,
  created_at, updated_at, version
)
VALUES
  (1, 'Incident confirme cote federation. J ouvre une cellule de crise avec l equipe IAM.', true, false, 1, 2,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 285 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 285 MINUTE), 0),
  (2, 'Nous avons redemarre le connecteur SSO sans effet. Les logs montrent une erreur upstream.', false, false, 1, 3,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 200 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 200 MINUTE), 0),
  (3, 'Le bug est reproductible uniquement sur iOS 17.4 avec cache Safari actif.', true, false, 2, 4,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR), 0),
  (4, 'Nous avons demande au client une capture reseau et une video de reproduction.', false, false, 2, 4,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR), 0),
  (5, 'En attente du feu vert client pour lancer le failover de replication hors heures de bureau.', false, false, 4, 5,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE), 0),
  (6, 'Le client a confirme que la replication peut etre basculee a 22h00.', false, false, 4, 6,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 20 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 20 MINUTE), 0),
  (7, 'Escalade manuelle demandee par le directeur retail apres impact sur trois magasins.', true, false, 6, 2,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 4 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 4 HOUR), 0),
  (8, 'Le plan de reroutage VPN a stabilise les sites. Surveillance maintenue 2 heures.', false, false, 6, 5,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE), 0),
  (9, 'La procedure SLA week-end a ete envoyee au client avec les niveaux de priorite et les contacts astreinte.', false, true, 7, 2,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 18 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 18 HOUR), 0),
  (10, 'Cause racine: certificat SMTP intermediaire expire. Correctif applique et supervision ajoutee.', false, true, 8, 3,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 56 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 56 HOUR), 0),
  (11, 'Investigation securite ouverte, journalisation renforcee sur le compte concerne.', true, false, 10, 3,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 55 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 55 MINUTE), 0),
  (12, 'Le spooler etiquettes a ete relance. Nous suivons encore la file impression en temps reel.', false, false, 12, 5,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 12 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 12 MINUTE), 0);

-- Pieces jointes
INSERT INTO attachments (
  id, file_name, original_name, file_path, file_size, content_type, alfresco_node_id, checksum, description,
  ticket_id, uploaded_by_id, created_at, updated_at, version
)
VALUES
  (1, 'resolution-report.pdf', 'resolution-report.pdf', 'archives/SF-1008/resolution-report.pdf', 245760,
   'application/pdf', NULL, NULL, 'Rapport de resolution archive pour le ticket SF-1008',
   8, 3, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 55 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 55 HOUR), 0);

-- Historique
INSERT INTO ticket_history (
  id, action, field_name, old_value, new_value, description, performed_by,
  ticket_id, user_id, created_at, updated_at, version
)
VALUES
  (1, 'CREATED', NULL, NULL, NULL, 'Ticket cree par le client Atlas Sante', 'Leila Mansour',
   1, 7, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 HOUR), 0),
  (2, 'ASSIGNMENT', 'assignedAgent', NULL, 'Karim Ben Salem', 'Ticket assigne a Karim Ben Salem', 'Pierre Manager',
   1, 2, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 270 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 270 MINUTE), 0),
  (3, 'STATUS_CHANGE', 'status', 'ASSIGNED', 'ESCALATED_SLA', 'Escalade SLA automatique suite depassement seuil critique', 'System',
   1, 1, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 35 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 35 MINUTE), 0),
  (4, 'CREATED', NULL, NULL, NULL, 'Ticket cree par RetailNova', 'Mehdi Jlassi',
   2, 8, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 HOUR), 0),
  (5, 'ASSIGNMENT', 'assignedAgent', NULL, 'Marie Trabelsi', 'Ticket assigne a Marie Trabelsi', 'Pierre Manager',
   2, 2, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 570 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 570 MINUTE), 0),
  (6, 'STATUS_CHANGE', 'status', 'ASSIGNED', 'IN_PROGRESS', 'Prise en charge par l agent', 'Marie Trabelsi',
   2, 4, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 9 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 9 HOUR), 0),
  (7, 'CREATED', NULL, NULL, NULL, 'Ticket cree pour la replication base clients', 'Jean Client',
   4, 6, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 HOUR), 0),
  (8, 'STATUS_CHANGE', 'status', 'IN_PROGRESS', 'PENDING', 'En attente accord client pour failover', 'Sami Gharbi',
   4, 5, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 MINUTE), 0),
  (9, 'CREATED', NULL, NULL, NULL, 'Incident VPN cree depuis le portail client', 'Mehdi Jlassi',
   6, 8, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 HOUR), 0),
  (10, 'ASSIGNMENT', 'assignedAgent', NULL, 'Sami Gharbi', 'Ticket assigne a Sami Gharbi', 'Pierre Manager',
   6, 2, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 390 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 390 MINUTE), 0),
  (11, 'STATUS_CHANGE', 'status', 'IN_PROGRESS', 'ESCALATED_MANUAL', 'Escalade manuelle demandee par le management retail', 'Pierre Manager',
   6, 2, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 35 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 35 MINUTE), 0),
  (12, 'CREATED', NULL, NULL, NULL, 'Question SLA creee par le client ABC', 'Jean Client',
   7, 6, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY), 0),
  (13, 'STATUS_CHANGE', 'status', 'IN_PROGRESS', 'RESOLVED', 'Reponse SLA envoyee et validee', 'Pierre Manager',
   7, 2, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 18 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 18 HOUR), 0),
  (14, 'STATUS_CHANGE', 'status', 'RESOLVED', 'CLOSED', 'Ticket cloture apres validation client', 'Admin System',
   8, 1, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 50 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 50 HOUR), 0),
  (15, 'ASSIGNMENT', 'assignedAgent', NULL, 'Karim Ben Salem', 'Ticket assigne a Karim Ben Salem', 'Pierre Manager',
   10, 2, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 70 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 70 MINUTE), 0),
  (16, 'CREATED', NULL, NULL, NULL, 'Ticket impression depot cree via portail client', 'Mehdi Jlassi',
   12, 8, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 50 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 50 MINUTE), 0),
  (17, 'STATUS_CHANGE', 'status', 'ASSIGNED', 'IN_PROGRESS', 'L agent confirme la panne sur le spooler etiquettes', 'Sami Gharbi',
   12, 5, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 38 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 38 MINUTE), 0);

-- Notifications
INSERT INTO notifications (
  id, title, message, type, icon, link, sla_percentage, action_required,
  suggested_actions, recommended_agent, recommended_agent_id, is_read, read_at,
  ticket_reference, user_id, ticket_id, created_at, updated_at, version
)
VALUES
  (1, 'SLA depasse sur SF-1001', 'Le ticket SF-1001 a depasse son SLA et demande une action manager immediate.',
   'SLA_BREACHED', 'pi-times-circle', '/tickets/1', 112, true,
   '["Reassigner un agent de renfort","Contacter le client","Declencher cellule de crise"]', 'Marie Trabelsi', 4, false, NULL,
   'SF-1001', 2, 1, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 MINUTE), 0),
  (2, 'Alerte SLA sur SF-1002', 'Le ticket SF-1002 approche de sa deadline SLA.',
   'SLA_WARNING', 'pi-exclamation-triangle', '/tickets/2', 88, false,
   '["Verifier progression","Informer le client"]', 'Marie Trabelsi', 4, false, NULL,
   'SF-1002', 2, 2, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE), 0),
  (3, 'Ticket SF-1002 assigne', 'Le ticket dashboard mobile vous a ete assigne.',
   'TICKET_ASSIGNED', 'pi-user', '/tickets/2', 65, false,
   NULL, NULL, NULL, false, NULL,
   'SF-1002', 4, 2, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 570 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 570 MINUTE), 0),
  (4, 'Attente validation client sur SF-1004', 'Le ticket SF-1004 est en attente d accord client pour le failover.',
   'STATUS_CHANGED', 'pi-clock', '/tickets/4', 94, false,
   '["Relancer client","Planifier fenetre de maintenance"]', 'Sami Gharbi', 5, false, NULL,
   'SF-1004', 2, 4, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE), 0),
  (5, 'Escalade manuelle sur SF-1006', 'Le management a demande une escalation manuelle du ticket SF-1006.',
   'ESCALATION', 'pi-flag', '/tickets/6', 97, true,
   '["Prioriser en astreinte","Informer direction retail"]', 'Sami Gharbi', 5, false, NULL,
   'SF-1006', 2, 6, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE), 0),
  (6, 'Nouveau commentaire sur SF-1006', 'Sami Gharbi a ajoute un commentaire sur le ticket SF-1006.',
   'NEW_COMMENT', 'pi-comment', '/tickets/6', 96, false,
   NULL, NULL, NULL, false, NULL,
   'SF-1006', 8, 6, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 MINUTE), 0),
  (7, 'Ticket SF-1007 resolu', 'Le ticket SF-1007 a ete resolu avec une reponse SLA detaillee.',
   'TICKET_RESOLVED', 'pi-check-circle', '/tickets/7', 22, false,
   NULL, NULL, NULL, true, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 16 HOUR),
   'SF-1007', 6, 7, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 18 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 18 HOUR), 0),
  (8, 'Ticket SF-1008 cloture', 'Le ticket SF-1008 est cloture apres validation client.',
   'STATUS_CHANGED', 'pi-verified', '/tickets/8', 51, false,
   NULL, NULL, NULL, true, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 49 HOUR),
   'SF-1008', 9, 8, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 50 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 50 HOUR), 0),
  (9, 'Ticket SF-1010 assigne', 'Le ticket securite SF-1010 vous a ete assigne en urgence.',
   'TICKET_ASSIGNED', 'pi-shield', '/tickets/10', 41, false,
   '["Verifier journaux","Bloquer IP suspecte"]', NULL, NULL, false, NULL,
   'SF-1010', 3, 10, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 70 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 70 MINUTE), 0),
  (10, 'Action requise sur SF-1010', 'Une validation manager est demandee pour durcir temporairement la politique de connexion.',
   'MANAGER_ACTION', 'pi-lock', '/tickets/10', 41, true,
   '["Valider blocage geographique","Informer RSSI client"]', 'Karim Ben Salem', 3, false, NULL,
   'SF-1010', 2, 10, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 20 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 20 MINUTE), 0),
  (11, 'Nouveau ticket SF-1011', 'Le ticket SF-1011 a ete cree pour lenteur reporting RH.',
   'TICKET_CREATED', 'pi-plus-circle', '/tickets/11', 12, false,
   NULL, NULL, NULL, false, NULL,
   'SF-1011', 2, 11, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 4 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 4 HOUR), 0),
  (12, 'Ticket SF-1012 pris en charge', 'Sami Gharbi a commence le diagnostic sur SF-1012.',
   'STATUS_CHANGED', 'pi-play', '/tickets/12', 9, false,
   NULL, NULL, NULL, false, NULL,
   'SF-1012', 8, 12, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 38 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 38 MINUTE), 0),
  (13, 'Alerte SLA sur SF-1004', 'Le ticket replication base approche de sa deadline et necessite un suivi renforce.',
   'SLA_WARNING', 'pi-exclamation-triangle', '/tickets/4', 94, false,
   '["Confirmer fenetre de failover","Preparer rollback"]', 'Sami Gharbi', 5, false, NULL,
   'SF-1004', 6, 4, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 18 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 18 MINUTE), 0),
  (14, 'Mise a jour ticket SF-1001', 'Le manager suit personnellement la resolution du ticket SF-1001.',
   'STATUS_CHANGED', 'pi-briefcase', '/tickets/1', 112, false,
   NULL, NULL, NULL, false, NULL,
   'SF-1001', 7, 1, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 22 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 22 MINUTE), 0);

-- Evenements d'escalade
INSERT INTO escalation_events (
  id, ticket_id, from_level, to_level, reason, triggered_by, from_agent_id, to_agent_id,
  description, sla_percent_at_escalation, was_blocked, created_at, updated_at, version
)
VALUES
  (1, 1, 1, 2, 'SLA_BREACH', 'SYSTEM', 3, 4,
   'Escalade automatique vers renfort reporting pour gestion de crise SSO.', 112.00, false,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 MINUTE), 0),
  (2, 6, 1, 2, 'MANUAL', 'USER', 5, 5,
   'Escalade manuelle maintenue sur le meme agent avec supervision manager.', 97.00, false,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 35 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 35 MINUTE), 0),
  (3, 4, 1, 1, 'HOLD_ACTIVE', 'SYSTEM', 5, 5,
   'Escalade non declenchee car attente validation client encore active.', 94.00, true,
   DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE), 0);

-- Sondages satisfaction
INSERT INTO satisfaction_surveys (
  id, ticket_id, respondent_id, rating, comment, response_time_minutes,
  was_escalated, escalation_level_reached, survey_sent, survey_completed,
  created_at, updated_at, version
)
VALUES
  (1, 7, 6, 5, 'Reponse claire et rapide. Nous avons maintenant une vision nette du SLA week-end.', 120,
   false, 0, true, true, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 17 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 16 HOUR), 0),
  (2, 8, 9, 4, 'Bonne resolution. Nous aurions aime un point de situation plus tot pendant l incident.', 240,
   false, 0, true, true, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 55 HOUR), DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 52 HOUR), 0);
