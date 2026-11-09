<?php
/**
 * Esquema de base de datos (MySQL 5.7+ / MariaDB 10.3+).
 * `#__` se reemplaza por el prefijo de tablas elegido en el instalador.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
return [
<<<SQL
CREATE TABLE IF NOT EXISTS `#__settings` (
  `name` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` MEDIUMTEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
<<<SQL
CREATE TABLE IF NOT EXISTS `#__admins` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(190) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `totp_secret` VARCHAR(64) NULL,
  `totp_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `totp_last_counter` BIGINT NULL,
  `recovery_codes` TEXT NULL,
  `reset_token_hash` CHAR(64) NULL,
  `reset_expires_at` DATETIME NULL,
  `failed_attempts` INT NOT NULL DEFAULT 0,
  `locked_until` DATETIME NULL,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
<<<SQL
CREATE TABLE IF NOT EXISTS `#__events` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(120) NOT NULL UNIQUE,
  `status` ENUM('draft','published') NOT NULL DEFAULT 'draft',
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `organization` VARCHAR(255) NULL,
  `policy_url` VARCHAR(500) NULL,
  `opens_at` DATETIME NULL,
  `closes_at` DATETIME NULL,
  `goal` INT UNSIGNED NULL,
  `colors` TEXT NULL,
  `logo_path` VARCHAR(255) NULL,
  `background_path` VARCHAR(255) NULL,
  `fields` TEXT NULL,
  `municipalities` TEXT NULL,
  -- animation e intensity: sin uso desde 1.3.1 (se quitó la animación de fondo); se conservan por compatibilidad.
  `animation` VARCHAR(30) NOT NULL DEFAULT 'both',
  `intensity` VARCHAR(20) NOT NULL DEFAULT 'subtle',
  `code_ttl_minutes` INT NOT NULL DEFAULT 10,
  `max_attempts` INT NOT NULL DEFAULT 3,
  `require_email_code` TINYINT(1) NOT NULL DEFAULT 1,
  `email_subject` VARCHAR(255) NOT NULL DEFAULT 'Tu código para confirmar la firma',
  `send_receipt` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
<<<SQL
CREATE TABLE IF NOT EXISTS `#__signatures` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `event_id` INT UNSIGNED NOT NULL,
  `token` CHAR(48) NOT NULL UNIQUE,
  `folio` VARCHAR(20) NULL UNIQUE,
  `status` ENUM('started','signed','pending_code','verified','expired') NOT NULL DEFAULT 'started',
  `full_name` VARCHAR(200) NOT NULL,
  `doc_type` VARCHAR(40) NOT NULL,
  `doc_number` VARCHAR(40) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `phone` VARCHAR(40) NULL,
  `birth_date` DATE NULL,
  `gender` VARCHAR(40) NULL,
  `municipality` VARCHAR(120) NULL,
  `zone` VARCHAR(20) NULL,
  `ethnic_group` VARCHAR(60) NULL,
  `pets` VARCHAR(120) NULL,
  `extra` TEXT NULL,
  `consent_data` TINYINT(1) NOT NULL DEFAULT 0,
  `consent_news` TINYINT(1) NOT NULL DEFAULT 0,
  `signature_png` MEDIUMTEXT NULL,
  `code_hash` VARCHAR(255) NULL,
  `code_expires_at` DATETIME NULL,
  `code_attempts` INT NOT NULL DEFAULT 0,
  `codes_sent` INT NOT NULL DEFAULT 0,
  `last_code_at` DATETIME NULL,
  `hash` CHAR(64) NULL,
  `verification` VARCHAR(10) NULL,
  `device` VARCHAR(10) NULL,
  `ip` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL,
  `signed_at` DATETIME NULL,
  `verified_at` DATETIME NULL,
  KEY `idx_event_status` (`event_id`, `status`),
  KEY `idx_doc` (`event_id`, `doc_type`, `doc_number`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `#__fk_sig_event` FOREIGN KEY (`event_id`) REFERENCES `#__events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
<<<SQL
CREATE TABLE IF NOT EXISTS `#__event_visits` (
  `event_id` INT UNSIGNED NOT NULL,
  `day` DATE NOT NULL,
  `visits` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`event_id`, `day`),
  CONSTRAINT `#__fk_visit_event` FOREIGN KEY (`event_id`) REFERENCES `#__events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
<<<SQL
CREATE TABLE IF NOT EXISTS `#__rate_limits` (
  `bucket` VARCHAR(120) NOT NULL PRIMARY KEY,
  `hits` INT UNSIGNED NOT NULL DEFAULT 0,
  `reset_at` DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
];
