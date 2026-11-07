<?php
/**
 * Router para `php -S` en desarrollo: imita el .htaccess de producción.
 * Uso: php -S 127.0.0.1:8000 -t server scripts/dev-router.php
 * También sirve el paquete generado: php -S 127.0.0.1:8080 -t release/animalista-firmas scripts/dev-router.php
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
$root = $_SERVER['DOCUMENT_ROOT'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Igual que el .htaccess: carpetas internas, archivos ocultos y scripts dentro de uploads/ quedan bloqueados.
if (preg_match('#^/(app|config)(/|$)#', $path) || preg_match('#/\.#', $path) || preg_match('#^/uploads/.*\.(php\d?|phtml|phar)$#i', $path)) {
    http_response_code(403);
    exit('Forbidden');
}
if (preg_match('#^/api(/|$)#', $path)) { $_SERVER['SCRIPT_NAME'] = '/api/index.php'; require $root . '/api/index.php'; return true; }
if ($path === '/install' || str_starts_with($path, '/install/')) {
    $file = $root . $path;
    if (is_file($file) && !str_ends_with($file, '.php')) return false;
    $_SERVER['SCRIPT_NAME'] = '/install/index.php';
    require $root . '/install/index.php';
    return true;
}
if (is_file($root . $path)) return false;
$spa = is_file($root . "/index.html") ? $root . "/index.html" : dirname(__DIR__) . "/dist/index.html";
if (is_file($spa)) { readfile($spa); return true; }
http_response_code(404); echo 'Ejecuta npm run build o usa npm run dev';
return true;
