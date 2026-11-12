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
$html = (string)file_get_contents($template);
$meta = social_meta($base);
if ($meta['title'] !== null) $html = preg_replace('#<title>.*?</title>#is', '<title>' . htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8') . '</title>', $html, 1);
$html = preg_replace('/<head>/i', '<head>' . $inject . $meta['tags'], $html, 1);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
echo $html;

/**
 * Etiquetas para la vista previa del enlace en X, Instagram, WhatsApp, etc. (Open Graph y Twitter Card)
 * en la página pública de un evento publicado. El panel y los comprobantes no se indexan.
 * @return array{title: ?string, tags: string}
 */
function social_meta(string $base): array
{
    $none = ['title' => null, 'tags' => ''];
    $path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    if ($base !== '' && str_starts_with($path, $base)) $path = substr($path, strlen($base));
    $path = '/' . trim($path, '/');
    if (preg_match('#^/(admin|comprobante)(/|$)#', $path)) {
        return ['title' => null, 'tags' => '<meta name="robots" content="noindex, nofollow">'];
    }
    $slug = preg_match('#^/firma/([a-z0-9-]{1,120})$#', $path, $m) ? $m[1] : null;
    if ($slug === null && $path !== '/') return $none;
    try {
        require_once __DIR__ . '/app/lib/Db.php';
        $cfg = require __DIR__ . '/config/config.php';
        Db::init($cfg['db']);
        if ($slug !== null) {
            $e = Db::one("SELECT * FROM `#__events` WHERE slug = ? AND status = 'published'", [$slug]);
        } else {
            $id = Db::setting('default_event');
            $e = $id ? Db::one("SELECT * FROM `#__events` WHERE id = ? AND status = 'published'", [$id]) : null;
            $e ??= Db::one("SELECT * FROM `#__events` WHERE status = 'published' ORDER BY created_at DESC LIMIT 1");
        }
        if (!$e) return $none;
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        $origin = rtrim((string)(Db::setting('site_url') ?: (($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $base)), '/');
        $desc = trim(preg_replace('/\s+/', ' ', (string)$e['description']));
        if (mb_strlen($desc) > 200) $desc = rtrim(mb_substr($desc, 0, 197)) . '…';
        $image = !empty($e['banner_path']) && !empty($e['banner_enabled']) ? $origin . '/' . $e['banner_path'] : null;
        $h = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
        $tags = [
            ['property', 'og:type', 'website'],
            ['property', 'og:site_name', Db::setting('site_name', 'Animalista')],
            ['property', 'og:title', $e['name']],
            ['property', 'og:description', $desc ?: 'Firma y apoya esta convocatoria.'],
            ['property', 'og:url', $origin . '/firma/' . $e['slug']],
            ['name', 'description', $desc ?: 'Firma y apoya esta convocatoria.'],
            ['name', 'twitter:card', $image ? 'summary_large_image' : 'summary'],
            ['name', 'twitter:title', $e['name']],
            ['name', 'twitter:description', $desc ?: 'Firma y apoya esta convocatoria.'],
        ];
        if ($image) {
            $tags[] = ['property', 'og:image', $image];
            $tags[] = ['name', 'twitter:image', $image];
            if (!empty($e['banner_alt'])) $tags[] = ['property', 'og:image:alt', $e['banner_alt']];
        }
        $out = '';
        foreach ($tags as [$attr, $key, $value]) $out .= '<meta ' . $attr . '="' . $h($key) . '" content="' . $h($value) . '">';
        return ['title' => $e['name'], 'tags' => $out];
    } catch (Throwable $err) {
        error_log('[animalista] vista previa social: ' . $err->getMessage());
        return $none;
    }
}
