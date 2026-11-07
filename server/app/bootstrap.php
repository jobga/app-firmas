<?php
/**
 * Arranque común de la API.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
declare(strict_types=1);

require __DIR__ . '/version.php';
foreach (['Db', 'Http', 'Totp', 'Mailer', 'Auth', 'Util'] as $lib) require __DIR__ . "/lib/{$lib}.php";
require __DIR__ . '/events.php';

define('ROOT_DIR', dirname(__DIR__));
define('CONFIG_FILE', ROOT_DIR . '/config/config.php');
define('UPLOADS_DIR', ROOT_DIR . '/uploads');

function app_installed(): bool
{
    return is_file(CONFIG_FILE);
}

function app_config(): array
{
    static $cfg = null;
    return $cfg ??= require CONFIG_FILE;
}

function app_boot(): void
{
    $cfg = app_config();
    date_default_timezone_set($cfg['timezone'] ?? 'America/Bogota');
    if (!empty($cfg['debug'])) { ini_set('display_errors', '1'); error_reporting(E_ALL); }
    else { ini_set('display_errors', '0'); }
    Db::init($cfg['db']);
}
