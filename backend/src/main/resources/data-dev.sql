-- SupportFlow - Donnees d'initialisation pour le mode DEV
-- Ce fichier est charge automatiquement au demarrage avec le profil dev

-- Clients
INSERT INTO clients (id, code, company_name, email, phone, address, city, country, postal_code, industry, contract_type, sla_level, is_active, created_at, updated_at, version)
VALUES
(1, 'CLI001', 'Societe ABC', 'contact@abc.com', '+33 1 23 45 67 89', '123 Rue de Paris', 'Paris', 'France', '75001', 'Technologie', 'PREMIUM', 'PREMIUM', true, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(2, 'CLI002', 'DataSoft', 'support@datasoft.fr', '+33 1 98 76 54 32', '45 Avenue des Champs', 'Lyon', 'France', '69001', 'Logiciel', 'STANDARD', 'STANDARD', true, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(3, 'CLI003', 'CloudInc', 'help@cloudinc.io', '+33 1 11 22 33 44', '78 Boulevard Cloud', 'Marseille', 'France', '13001', 'Cloud', 'BASIC', 'BASIC', true, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0);

-- Catalogue des categories support
INSERT INTO support_categories (id, code, label, description, is_active, sort_order, created_at, updated_at, version)
VALUES
(1, 'AUTHENTICATION', 'Authentification', 'Connexion, SSO, comptes et mots de passe', true, 10, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(2, 'UI', 'Interface', 'Affichage, ergonomie, mobile et dashboard', true, 20, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(3, 'REPORTING', 'Reporting', 'Exports, rapports et tableaux de bord', true, 30, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(4, 'NETWORK', 'Reseau', 'VPN, connectivite, DNS et latence', true, 40, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(5, 'EMAIL', 'Email', 'Messagerie, SMTP, IMAP et boites mail', true, 50, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(6, 'DATABASE', 'Base de donnees', 'SQL, MySQL, PostgreSQL et donnees', true, 60, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(7, 'SECURITY', 'Securite', 'Acces, MFA, permissions et certificats', true, 70, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(8, 'HARDWARE', 'Materiel', 'PC, imprimantes, scanners et equipements', true, 80, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(9, 'SOFTWARE', 'Logiciel', 'Applications, bugs et services metier', true, 90, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(10, 'GENERAL', 'General', 'Categorie de secours', true, 100, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0);

-- Utilisateurs (password = password123 encode en BCrypt)
INSERT INTO users (id, username, email, password, first_name, last_name, phone, role, is_active, client_id, created_at, updated_at, version)
VALUES
(1, 'admin', 'admin@supportflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O', 'Admin', 'System', '+33 6 00 00 00 01', 'ADMIN', true, NULL, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(2, 'manager', 'manager@supportflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O', 'Pierre', 'Manager', '+33 6 00 00 00 02', 'SUPPORT_MANAGER', true, NULL, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(3, 'karim', 'karim@supportflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O', 'Karim', 'Agent', '+33 6 00 00 00 03', 'SUPPORT_AGENT', true, NULL, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(4, 'marie', 'marie@supportflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O', 'Marie', 'Agent', '+33 6 00 00 00 04', 'SUPPORT_AGENT', true, NULL, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(5, 'client_abc', 'client@abc.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/gNvavKtqXJl8TJGdz/K.O', 'Jean', 'Client', '+33 6 00 00 00 05', 'CLIENT', true, 1, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0);

-- Competences explicites
INSERT INTO agent_skills (id, agent_id, category_id, skill_type, created_at, updated_at, version)
VALUES
(1, 2, 9, 'PRIMARY', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(2, 2, 4, 'SECONDARY', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(3, 3, 1, 'PRIMARY', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(4, 3, 7, 'SECONDARY', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(5, 4, 3, 'PRIMARY', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(6, 4, 2, 'SECONDARY', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0);

-- Tickets de test
INSERT INTO tickets (id, reference, title, description, type, status, severity, impact, priority, score, sla_hours, sla_deadline, sla_breached, sla_warning_sent, client_id, created_by_user_id, assigned_agent_id, category, normalized_category_id, created_at, updated_at, version)
VALUES
(1, 'SF-0001', 'Impossible d''acceder au portail client', 'Le portail client affiche une erreur 500 lors de la connexion. Le probleme semble lie au service OAuth.', 'INCIDENT', 'OPEN', 'HIGH', 'HIGH', 'HIGH', 8, 8, DATEADD('HOUR', 8, CURRENT_TIMESTAMP()), false, false, 1, 5, NULL, 'Authentification', 1, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(2, 'SF-0002', 'Bug affichage tableau de bord', 'Les graphiques du tableau de bord ne s''affichent pas correctement sur mobile.', 'BUG', 'ASSIGNED', 'MEDIUM', 'MEDIUM', 'MEDIUM', 6, 24, DATEADD('HOUR', 24, CURRENT_TIMESTAMP()), false, false, 2, 5, 4, 'Interface', 2, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(3, 'SF-0003', 'Demande d''export Excel', 'Nous souhaiterions pouvoir exporter les rapports mensuels au format Excel.', 'FEATURE_REQUEST', 'IN_PROGRESS', 'LOW', 'LOW', 'LOW', 3, 72, DATEADD('HOUR', 72, CURRENT_TIMESTAMP()), false, false, 1, 5, 4, 'Reporting', 3, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(4, 'SF-0004', 'Question sur le SLA', 'Quel est le delai de reponse garanti pour les tickets de priorite haute ?', 'QUESTION', 'RESOLVED', 'LOW', 'LOW', 'LOW', 3, 72, DATEADD('HOUR', 72, CURRENT_TIMESTAMP()), false, false, 3, 5, 3, 'Support', 10, DATEADD('DAY', -2, CURRENT_TIMESTAMP()), CURRENT_TIMESTAMP(), 0);

-- Commentaires
INSERT INTO comments (id, content, is_internal, is_solution, ticket_id, author_id, created_at, updated_at, version)
VALUES
(1, 'Ticket bien recu, je prends en charge immediatement.', false, false, 1, 2, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(2, 'Note interne: probleme similaire au ticket SF-0198 du mois dernier.', true, false, 1, 2, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(3, 'Le probleme a ete resolu en redemarrant le service OAuth.', false, true, 4, 3, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0);

-- Historique
INSERT INTO ticket_history (id, action, field_name, old_value, new_value, description, performed_by, ticket_id, user_id, created_at, updated_at, version)
VALUES
(1, 'CREATED', NULL, NULL, NULL, 'Ticket cree', 'Jean Client', 1, 5, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(2, 'STATUS_CHANGE', 'status', 'OPEN', 'ASSIGNED', 'Changement de statut: OPEN -> ASSIGNED', 'Pierre Manager', 2, 2, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(3, 'ASSIGNMENT', 'assignedAgent', NULL, 'Marie Agent', 'Ticket assigne a : Marie Agent', 'Pierre Manager', 2, 2, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0);

-- Notifications
INSERT INTO notifications (id, title, message, type, icon, link, is_read, ticket_reference, user_id, ticket_id, created_at, updated_at, version)
VALUES
(1, 'Nouveau ticket cree', 'Le ticket SF-0001 a ete cree: Impossible d''acceder au portail client', 'TICKET_CREATED', 'pi-plus-circle', '/tickets/1', false, 'SF-0001', 2, 1, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0),
(2, 'Ticket assigne', 'Le ticket SF-0002 vous a ete assigne', 'TICKET_ASSIGNED', 'pi-user', '/tickets/2', false, 'SF-0002', 4, 2, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 0);
