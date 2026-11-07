<?php
/**
 * Arranque común de la API.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
declare(strict_types=1);

require __DIR__ . '/version.php';
foreach (['Db', 'Http', 'Totp', 'Mailer', 'Auth', 'Util', 'Pdf'] as $lib) require __DIR__ . "/lib/{$lib}.php";
require __DIR__ . '/events.php';

define('ROOT_DIR', dirname(__DIR__));
define('CONFIG_FILE', ROOT_DIR . '/config/config.php');
define('UPLOADS_DIR', ROOT_DIR . '/uploads');

/**
 * Carpeta web donde está instalada la plataforma: "" en la raíz o un subdominio, "/firmas" en un subdirectorio.
 * Se deduce del script en ejecución (api/index.php o install/index.php, un nivel por debajo de la raíz).
 */
function app_base_path(): string
{
    static $base = null;
    return $base ??= rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php', 2)), '/');
}

/** Nombre de cookie propio de cada instalación, para que dos instalaciones en el mismo dominio no se mezclen. */
function app_cookie_name(string $prefix): string
{
    $base = app_base_path();
    return $base === '' ? $prefix : $prefix . '_' . substr(md5($base), 0, 8);
}

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
    app_migrate();
}

/**
 * Actualiza la base de datos de instalaciones anteriores (como el actualizador de WordPress).
 * Cada migración corre una sola vez; un bloqueo evita que dos peticiones la ejecuten a la vez.
 */
function app_migrate(): void
{
    $current = (int)(Db::setting('db_version') ?? 1);
    if ($current >= DB_VERSION) return;
    $pdo = Db::pdo();
    $lock = 'animalista_migrate_' . md5(Db::sql('#__'));
    if (!(int)$pdo->query('SELECT GET_LOCK(' . $pdo->quote($lock) . ', 10)')->fetchColumn()) return;
    try {
        $current = (int)(Db::setting('db_version') ?? 1);
        foreach (require __DIR__ . '/migrations.php' as $version => $statements) {
            if ($version <= $current || $version > DB_VERSION) continue;
            foreach ($statements as $sql) $pdo->exec(Db::sql($sql));
            Db::setSetting('db_version', (string)$version);
            error_log("[animalista] base de datos actualizada a la versión {$version}");
        }
        Db::setSetting('installed_version', APP_VERSION);
    } finally {
        $pdo->query('SELECT RELEASE_LOCK(' . $pdo->quote($lock) . ')');
    }
}
