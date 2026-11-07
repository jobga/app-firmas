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
];
