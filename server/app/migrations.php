<?php
/**
 * Migraciones de base de datos, indexadas por versión de esquema (ver DB_VERSION en version.php).
 * La versión 1 es el esquema original (1.0.0). `#__` = prefijo de tablas.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
return [
    2 => [
        // Recuperación de contraseña por correo.
        'ALTER TABLE `#__admins` ADD COLUMN `reset_token_hash` CHAR(64) NULL AFTER `recovery_codes`, ADD COLUMN `reset_expires_at` DATETIME NULL AFTER `reset_token_hash`',
    ],
    3 => [
        // Impide reutilizar un código TOTP ya aceptado (RFC 6238, sección 5.2).
        'ALTER TABLE `#__admins` ADD COLUMN `totp_last_counter` BIGINT NULL AFTER `totp_enabled`',
    ],
    4 => [
        // Departamento (DIVIPOLA) y listas de caracterización configurables por evento.
        'ALTER TABLE `#__signatures` ADD COLUMN `department` VARCHAR(80) NULL AFTER `gender`, MODIFY `gender` VARCHAR(60) NULL, MODIFY `zone` VARCHAR(60) NULL, MODIFY `ethnic_group` VARCHAR(80) NULL, MODIFY `pets` VARCHAR(255) NULL, ADD KEY `idx_department` (`event_id`, `department`)',
        // Las versiones anteriores solo ofrecían municipios de Nariño.
        "UPDATE `#__signatures` SET `department` = 'Nariño' WHERE `department` IS NULL AND `municipality` IN ('Pasto', 'Ipiales', 'Tumaco', 'Túquerres')",
    ],
];
