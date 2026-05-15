-- SupportFlow - Script d'initialisation de la base de données
-- Ce script s'exécute automatiquement au premier démarrage de MySQL

-- Création de la base Keycloak
CREATE DATABASE IF NOT EXISTS keycloak CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Création de la base SupportFlow
CREATE DATABASE IF NOT EXISTS supportflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Attribution des privilèges
GRANT ALL PRIVILEGES ON keycloak.* TO 'supportflow'@'%';
GRANT ALL PRIVILEGES ON supportflow_db.* TO 'supportflow'@'%';
FLUSH PRIVILEGES;

-- Utiliser la base SupportFlow
USE supportflow_db;
