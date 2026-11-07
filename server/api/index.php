<?php
/**
 * API JSON de la plataforma.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
declare(strict_types=1);
require dirname(__DIR__) . '/app/bootstrap.php';

header('X-Content-Type-Options: nosniff');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
// Quita la carpeta de instalación y "/api" (p. ej. /firmas/api/events/x → /events/x).
$apiPrefix = app_base_path() . '/api';
$path = str_starts_with($uri, $apiPrefix . '/') || $uri === $apiPrefix
    ? substr($uri, strlen($apiPrefix))
    : preg_replace('#^.*?/api(?=/|$)#', '', $uri);
$path = '/' . trim((string)$path, '/');

try {
    if (!app_installed()) {
        $installUrl = app_base_path() . '/install/';
        if ($path === '/status') Http::json(['installed' => false, 'installUrl' => $installUrl]);
        throw new HttpError(503, 'La plataforma aún no está instalada', ['installUrl' => $installUrl]);
    }
    app_boot();

    // Protección CSRF: toda petición que modifica datos debe traer esta cabecera (no se puede enviar entre sitios sin CORS).
    if ($method !== 'GET' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'animalista') {
        throw new HttpError(403, 'Petición no permitida');
    }

    $routes = array_merge(require dirname(__DIR__) . '/app/routes/public.php', require dirname(__DIR__) . '/app/routes/admin.php');
    foreach ($routes as [$m, $pattern, $handler]) {
        if ($m !== $method) continue;
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
        if (preg_match($regex, $path, $mm)) {
            $params = array_filter($mm, 'is_string', ARRAY_FILTER_USE_KEY);
            $result = $handler($params);
            Http::json($result ?? ['ok' => true]);
        }
    }
    throw new HttpError(404, 'Ruta no encontrada');
} catch (HttpError $e) {
    Http::json(['error' => $e->getMessage()] + ($e->extra ?? []), $e->status);
} catch (Throwable $e) {
    error_log('[animalista] ' . $e);
    $debug = app_installed() && !empty(app_config()['debug']);
    Http::json(['error' => $debug ? $e->getMessage() : 'Error interno del servidor'], 500);
}
