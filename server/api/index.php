<?php
/**
 * API JSON de la plataforma.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
declare(strict_types=1);
require dirname(__DIR__) . '/app/bootstrap.php';

header('X-Content-Type-Options: nosniff');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = '/' . trim(preg_replace('#^.*?/api(?=/|$)#', '', $uri), '/');

try {
    if (!app_installed()) {
        if ($path === '/status') Http::json(['installed' => false, 'installUrl' => '/install/']);
        throw new HttpError(503, 'La plataforma aún no está instalada', ['installUrl' => '/install/']);
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
