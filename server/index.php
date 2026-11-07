<?php
/**
 * Punto de entrada de la aplicación web. Detecta la carpeta donde está instalada (raíz, subdominio
 * o subdirectorio) y se la indica al navegador con <base> y window.__APP_BASE__.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
declare(strict_types=1);

$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php')), '/');

if (!is_file(__DIR__ . '/config/config.php')) {
    header('Location: ' . $base . '/install/', true, 302);
    exit;
}

// Las versiones 1.0 y 1.1 servían un index.html en la raíz; tras actualizar ya no se usa.
if (is_file(__DIR__ . '/index.html')) @unlink(__DIR__ . '/index.html');

$template = __DIR__ . '/app/spa.html';
if (!is_file($template)) {
    http_response_code(500);
    exit('Falta app/spa.html. Genera el paquete con «npm run package».');
}

$inject = '<base href="' . htmlspecialchars($base . '/', ENT_QUOTES, 'UTF-8') . '">'
    . '<script>window.__APP_BASE__=' . json_encode($base, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . ';</script>';
$html = preg_replace('/<head>/i', '<head>' . $inject, (string)file_get_contents($template), 1);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
echo $html;
