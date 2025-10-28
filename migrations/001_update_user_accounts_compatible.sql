-- ================================================
-- SCRIPT DE MIGRACIÓN: UserAccount Model Update (VERSIÓN COMPATIBLE)
-- Base de datos: MySQL 5.7+ / MariaDB 10.2+
-- Fecha: 2025-10-27
-- Descripción: Agregar campos para soportar Moodle y otros proveedores
-- ================================================

-- IMPORTANTE: Ejecutar línea por línea o en bloques pequeños

-- Paso 1: Agregar campo email
ALTER TABLE user_accounts
ADD COLUMN email VARCHAR(255) NULL;

-- Paso 2: Agregar campo name
ALTER TABLE user_accounts
ADD COLUMN name VARCHAR(255) NULL;

-- Paso 3: Agregar campo firstname
ALTER TABLE user_accounts
ADD COLUMN firstname VARCHAR(255) NULL;

-- Paso 4: Agregar campo lastname
ALTER TABLE user_accounts
ADD COLUMN lastname VARCHAR(255) NULL;

-- Paso 5: Agregar campo provider_url (URL de Moodle)
ALTER TABLE user_accounts
ADD COLUMN provider_url VARCHAR(500) NULL;

-- Paso 6: Agregar campo provider_account_id
ALTER TABLE user_accounts
ADD COLUMN provider_account_id VARCHAR(255) NULL;

-- Paso 7: Modificar refresh_token para permitir NULL
ALTER TABLE user_accounts
MODIFY COLUMN refresh_token TEXT NULL;

-- Paso 8: Agregar índices para mejorar rendimiento
ALTER TABLE user_accounts
ADD INDEX idx_user_platform (user_id, platform);

ALTER TABLE user_accounts
ADD INDEX idx_provider_account (provider_account_id);

ALTER TABLE user_accounts
ADD INDEX idx_email (email);

-- ================================================
-- VERIFICACIÓN
-- ================================================

-- Ver estructura de la tabla
SHOW COLUMNS FROM user_accounts;

-- Ver índices
SHOW INDEX FROM user_accounts;

-- Consulta de prueba
SELECT * FROM user_accounts LIMIT 1;
