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
        // Cada evento decide si pide el código de verificación por correo; cada firma guarda cómo se verificó.
        'ALTER TABLE `#__events` ADD COLUMN `require_email_code` TINYINT(1) NOT NULL DEFAULT 1 AFTER `max_attempts`',
        "ALTER TABLE `#__signatures` ADD COLUMN `verification` VARCHAR(10) NULL AFTER `hash`",
        "UPDATE `#__signatures` SET `verification` = 'email' WHERE `status` = 'verified' AND `verification` IS NULL",
    ],
    5 => [
        // Personalización del evento: fechas visibles, banner, textos de autorización y mensaje de agradecimiento.
        'ALTER TABLE `#__events`'
            . ' ADD COLUMN `show_dates` TINYINT(1) NOT NULL DEFAULT 1 AFTER `closes_at`,'
            . ' ADD COLUMN `banner_path` VARCHAR(255) NULL AFTER `background_path`,'
            . ' ADD COLUMN `banner_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `banner_path`,'
            . " ADD COLUMN `banner_position` VARCHAR(10) NOT NULL DEFAULT 'below' AFTER `banner_enabled`,"
            . ' ADD COLUMN `banner_alt` VARCHAR(255) NULL AFTER `banner_position`,'
            . ' ADD COLUMN `consent_data_text` TEXT NULL AFTER `send_receipt`,'
            . ' ADD COLUMN `consent_news_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `consent_data_text`,'
            . ' ADD COLUMN `consent_news_text` TEXT NULL AFTER `consent_news_enabled`,'
            . ' ADD COLUMN `thanks_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `consent_news_text`,'
            . ' ADD COLUMN `thanks_title` VARCHAR(255) NULL AFTER `thanks_enabled`,'
            . ' ADD COLUMN `thanks_message` TEXT NULL AFTER `thanks_title`',
        // Texto de autorización que aceptó cada firmante (para auditoría).
        'ALTER TABLE `#__signatures` ADD COLUMN `consent_text` TEXT NULL AFTER `consent_news`',
    ],
    6 => [
        // Mostrar u ocultar el número de firmas verificadas; dibujos de líneas animados, fijos u ocultos.
        'ALTER TABLE `#__events`'
            . ' ADD COLUMN `show_count` TINYINT(1) NOT NULL DEFAULT 1 AFTER `goal`,'
            . " ADD COLUMN `line_drawings` VARCHAR(10) NOT NULL DEFAULT 'animated' AFTER `show_count`",
    ],
    7 => [
        // Compartir en redes (Instagram y X) al terminar la firma.
        'ALTER TABLE `#__events`'
            . ' ADD COLUMN `share_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `thanks_message`,'
            . ' ADD COLUMN `share_text` VARCHAR(280) NULL AFTER `share_enabled`',
    ],
    8 => [
        // Redes habilitadas y textos/diseño de la imagen para compartir (JSON).
        'ALTER TABLE `#__events` ADD COLUMN `share_options` TEXT NULL AFTER `share_text`',
    ],
];
