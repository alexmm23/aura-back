-- ================================================
-- SCRIPT DE ROLLBACK: UserAccount Model Update
-- Base de datos: MySQL 5.7+ / MariaDB 10.2+
-- Fecha: 2025-10-27
-- Descripción: Revertir cambios de la migración 001
-- ================================================

-- ADVERTENCIA: Este script eliminará los campos agregados
-- Asegúrate de tener un backup antes de ejecutar

-- Paso 1: Eliminar índices
DROP INDEX idx_user_platform ON user_accounts;
DROP INDEX idx_provider_account ON user_accounts;
DROP INDEX idx_email ON user_accounts;

-- Paso 2: Revertir refresh_token a NOT NULL (si es necesario)
-- ALTER TABLE user_accounts
-- MODIFY COLUMN refresh_token TEXT NOT NULL;

-- Paso 3: Eliminar columnas agregadas
ALTER TABLE user_accounts
DROP COLUMN provider_account_id;

ALTER TABLE user_accounts
DROP COLUMN provider_url;

ALTER TABLE user_accounts
DROP COLUMN lastname;

ALTER TABLE user_accounts
DROP COLUMN firstname;

ALTER TABLE user_accounts
DROP COLUMN name;

ALTER TABLE user_accounts
DROP COLUMN email;

-- Verificación
SHOW COLUMNS FROM user_accounts;
