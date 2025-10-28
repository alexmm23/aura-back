-- ================================================
-- SCRIPT DE MIGRACIÓN: UserAccount Model Update
-- Fecha: 2025-10-27
-- Descripción: Agregar campos adicionales para soportar Moodle y otros proveedores
-- ================================================

-- Paso 1: Agregar nuevos campos a la tabla user_accounts
ALTER TABLE user_accounts
ADD COLUMN email VARCHAR(255) NULL COMMENT 'Email del usuario en el proveedor externo',
ADD COLUMN name VARCHAR(255) NULL COMMENT 'Nombre completo del usuario',
ADD COLUMN firstname VARCHAR(255) NULL COMMENT 'Nombre del usuario',
ADD COLUMN lastname VARCHAR(255) NULL COMMENT 'Apellido del usuario',
ADD COLUMN provider_url VARCHAR(500) NULL COMMENT 'URL base del proveedor (ej: URL de instancia Moodle)',
ADD COLUMN provider_account_id VARCHAR(255) NULL COMMENT 'ID del usuario en el sistema del proveedor externo';

-- Paso 2: Modificar refresh_token para permitir NULL (Moodle puede no tener privatetoken)
ALTER TABLE user_accounts
MODIFY COLUMN refresh_token TEXT NULL;

-- Paso 3: Renombrar columna platform a provider para mayor claridad (OPCIONAL)
-- Si deseas mantener 'platform' como está, comenta las siguientes líneas
-- ALTER TABLE user_accounts
-- CHANGE COLUMN platform provider VARCHAR(255) NOT NULL;

-- Paso 4: Agregar índices para mejorar el rendimiento
ALTER TABLE user_accounts
ADD INDEX idx_user_platform (user_id, platform),
ADD INDEX idx_provider_account (provider_account_id),
ADD INDEX idx_email (email);

-- ================================================
-- SCRIPT DE ROLLBACK (En caso de necesitar revertir cambios)
-- ================================================
/*
-- Eliminar índices
ALTER TABLE user_accounts
DROP INDEX idx_user_platform,
DROP INDEX idx_provider_account,
DROP INDEX idx_email;

-- Revertir refresh_token a NOT NULL
ALTER TABLE user_accounts
MODIFY COLUMN refresh_token TEXT NOT NULL;

-- Eliminar columnas agregadas
ALTER TABLE user_accounts
DROP COLUMN email,
DROP COLUMN name,
DROP COLUMN firstname,
DROP COLUMN lastname,
DROP COLUMN provider_url,
DROP COLUMN provider_account_id;

-- Si renombraste platform a provider, revertir:
-- ALTER TABLE user_accounts
-- CHANGE COLUMN provider platform VARCHAR(255) NOT NULL;
*/

-- ================================================
-- VERIFICACIÓN
-- ================================================
-- Ver estructura actualizada de la tabla
DESCRIBE user_accounts;

-- Ver datos de ejemplo (si hay registros de Moodle)
SELECT 
    id,
    user_id,
    platform,
    username,
    email,
    name,
    provider_url,
    provider_account_id,
    created_at
FROM user_accounts
WHERE platform = 'moodle'
LIMIT 5;
