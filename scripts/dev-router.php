<?php
/**
 * Router para `php -S`: imita el .htaccess de producción, también en un subdirectorio.
 *
 * Uso:
 *   php -S 127.0.0.1:8000 -t server scripts/dev-router.php                          (desarrollo, en la raíz)
 *   php -S 127.0.0.1:8080 -t release/animalista-firmas scripts/dev-router.php       (paquete, en la raíz)
 *   APP_BASE=/firmas php -S 127.0.0.1:8080 -t release/animalista-firmas scripts/dev-router.php
 *                                                         (paquete servido en http://127.0.0.1:8080/firmas/)
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
$root = $_SERVER['DOCUMENT_ROOT'];
$base = rtrim((string)getenv('APP_BASE'), '/');
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($base !== '') {
    if ($uri !== $base && !str_starts_with($uri, $base . '/')) { http_response_code(404); exit('Fuera de la carpeta de instalación'); }
    $path = substr($uri, strlen($base)) ?: '/';
} else {
    $path = $uri;
}

$run = function (string $script) use ($root, $base) {
    $_SERVER['SCRIPT_NAME'] = $base . '/' . $script;
    $_SERVER['SCRIPT_FILENAME'] = $root . '/' . $script;
    chdir(dirname($root . '/' . $script));
    require $root . '/' . $script;
    return true;
};
$static = function (string $file) {
    $types = ['js' => 'text/javascript', 'css' => 'text/css', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'webp' => 'image/webp', 'woff2' => 'font/woff2', 'json' => 'application/json', 'zip' => 'application/zip'];
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($types[$ext] ?? (mime_content_type($file) ?: 'application/octet-stream')));
    readfile($file);
    return true;
};

// Igual que el .htaccess: carpetas internas, archivos ocultos y scripts dentro de uploads/ quedan bloqueados.
if (preg_match('#^/(app|config)(/|$)#', $path) || preg_match('#/\.#', $path) || preg_match('#^/uploads/.*\.(php\d?|phtml|phar)$#i', $path)) {
    http_response_code(403);
    exit('Forbidden');
}
if (preg_match('#^/api(/|$)#', $path)) return $run('api/index.php');
if ($path === '/install' || str_starts_with($path, '/install/')) {
    $file = $root . $path;
    if (is_file($file) && !str_ends_with($file, '.php')) return $static($file);
    return $run('install/index.php');
}
if ($path !== '/' && is_file($root . $path) && !str_ends_with($path, '.php')) return $base === '' ? false : $static($root . $path);
if (is_file($root . '/index.php') && is_file($root . '/app/spa.html')) return $run('index.php');
$spa = dirname(__DIR__) . '/dist/index.html';
if (is_file($spa)) { readfile($spa); return true; }
http_response_code(404);
echo 'Ejecuta npm run build o usa npm run dev';
return true;
