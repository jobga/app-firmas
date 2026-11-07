<?php
/**
 * Asistente de instalación (estilo WordPress) para Plesk u otro hosting con PHP + MySQL/MariaDB.
 *
 * Pasos: 1. Requisitos · 2. Base de datos · 3. Sitio y administrador · 4. Correo · 5. Instalar
 *
 * Animalista · Plataforma de firmas
 * Autor: Jonnathan Bucheli Galindo — © Jonnathan Bucheli Galindo. Todos los derechos reservados.
 */
declare(strict_types=1);

$root = dirname(__DIR__);
require $root . '/app/version.php';
require $root . '/app/lib/Db.php';
require $root . '/app/lib/Mailer.php';

$configFile = $root . '/config/config.php';

// Carpeta web de la instalación: "" en la raíz o un subdominio, "/firmas" en un subdirectorio.
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/install/index.php', 2)), '/');
define('APP_BASE', $base);

session_name($base === '' ? 'animalista_install' : 'animalista_install_' . substr(md5($base), 0, 8));
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'path' => $base . '/']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(16));
$S = &$_SESSION;
$S['data'] ??= [];
$D = &$S['data'];

function h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function post(string $k, string $d = ''): string { return isset($_POST[$k]) && is_string($_POST[$k]) ? trim($_POST[$k]) : $d; }

$steps = [1 => 'Requisitos', 2 => 'Base de datos', 3 => 'Sitio y administrador', 4 => 'Correo', 5 => 'Instalar'];
$step = max(1, min(5, (int)($_GET['step'] ?? 1)));
$errors = [];
$notice = null;

// ---------- Ya instalado ----------
$showingDone = $step === 5 && !empty($_GET['done']) && !empty($S['finished']) && $_SERVER['REQUEST_METHOD'] === 'GET';
if (is_file($configFile) && !$showingDone) {
    render_page('Ya instalado', function () {
        ?>
        <h2>La plataforma ya está instalada</h2>
        <p>Por seguridad el asistente se desactivó. Si necesitas reinstalar, elimina <code>config/config.php</code> desde el Administrador de archivos de Plesk y vuelve a abrir esta página.</p>
        <p>Te recomendamos eliminar la carpeta <code>install/</code> del servidor.</p>
        <div class="actions"><a class="btn" href="<?= h(APP_BASE) ?>/admin/acceso">Ir al panel de administración</a></div>
        <?php
    }, 0);
    exit;
}

// ---------- Requisitos ----------
function requirements(string $root): array
{
    $writable = fn(string $p) => is_dir($p) ? is_writable($p) : is_writable(dirname($p));
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    return [
        ['PHP ' . APP_MIN_PHP . ' o superior', version_compare(PHP_VERSION, APP_MIN_PHP, '>='), 'Versión actual: ' . PHP_VERSION . '. En Plesk: Sitios web y dominios → Configuración de PHP.', true],
        ['Extensión PDO MySQL', extension_loaded('pdo_mysql'), 'Actívala en la configuración de PHP del dominio.', true],
        ['Extensión OpenSSL', extension_loaded('openssl'), 'Necesaria para correo seguro y códigos.', true],
        ['Extensión mbstring', extension_loaded('mbstring'), 'Necesaria para textos con tildes y ñ.', true],
        ['Extensión fileinfo', extension_loaded('fileinfo'), 'Necesaria para validar logos e imágenes subidas.', true],
        ['Extensión JSON', function_exists('json_encode'), '', true],
        ['Carpeta config/ con permisos de escritura', $writable($root . '/config'), 'Da permisos de escritura al usuario del sitio (Administrador de archivos → Cambiar permisos).', true],
        ['Carpeta uploads/ con permisos de escritura', $writable($root . '/uploads'), 'Necesaria para logos e imágenes de fondo.', true],
        ['Conexión segura (HTTPS)', $https, 'Recomendado. En Plesk: SSL/TLS Certificates → Let\'s Encrypt.', false],
        ['Extensión GD', extension_loaded('gd'), 'Opcional.', false],
    ];
}

// ---------- Procesamiento de formularios ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($S['csrf'], post('csrf'))) {
        $errors[] = 'La sesión del asistente expiró. Recarga la página.';
    } elseif ($step === 1) {
        $blocking = array_filter(requirements($root), fn($r) => $r[3] && !$r[1]);
        if ($blocking) $errors[] = 'Corrige los requisitos marcados antes de continuar.';
        else { header('Location: ?step=2'); exit; }
    } elseif ($step === 2) {
        $D['db'] = [
            'host' => post('db_host', 'localhost'), 'port' => (int)post('db_port', '3306'),
            'name' => post('db_name'), 'user' => post('db_user'), 'pass' => $_POST['db_pass'] ?? '',
            'prefix' => post('db_prefix', 'an_'),
        ];
        if (!$D['db']['name'] || !$D['db']['user']) $errors[] = 'Escribe el nombre de la base de datos y el usuario.';
        if (!preg_match('/^[a-zA-Z][a-zA-Z0-9_]{0,15}$/', $D['db']['prefix'])) $errors[] = 'El prefijo solo puede tener letras, números y guion bajo (máx. 16).';
        if (!$errors) {
            try {
                $pdo = Db::connect($D['db']);
                $ver = $pdo->query('SELECT VERSION()')->fetchColumn();
                $exists = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($D['db']['prefix'] . 'admins'))->fetchColumn();
                if ($exists) $errors[] = "Ya existe una instalación con el prefijo «{$D['db']['prefix']}» en esa base de datos. Usa otro prefijo o una base de datos vacía.";
                else { $S['db_ok'] = (string)$ver; header('Location: ?step=3'); exit; }
            } catch (PDOException $e) {
                $errors[] = 'No se pudo conectar: ' . $e->getMessage();
            }
        }
    } elseif ($step === 3) {
        $D['site'] = [
            'name' => post('site_name', 'Animalista'), 'url' => rtrim(post('site_url'), '/'), 'timezone' => post('timezone', 'America/Bogota'),
            'admin_name' => post('admin_name'), 'admin_email' => strtolower(post('admin_email')),
            'sample' => isset($_POST['sample']),
        ];
        $pass = $_POST['admin_pass'] ?? '';
        if (!$D['site']['admin_name']) $errors[] = 'Escribe el nombre del administrador.';
        if (!filter_var($D['site']['admin_email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'El correo del administrador no es válido.';
        if (strlen($pass) < 10) $errors[] = 'La contraseña debe tener al menos 10 caracteres.';
        if ($pass !== ($_POST['admin_pass2'] ?? '')) $errors[] = 'Las contraseñas no coinciden.';
        if ($D['site']['url'] && !filter_var($D['site']['url'], FILTER_VALIDATE_URL)) $errors[] = 'La URL del sitio no es válida.';
        if (!in_array($D['site']['timezone'], timezone_identifiers_list(), true)) $errors[] = 'Zona horaria no válida.';
        if (!$errors) { $D['admin_hash'] = password_hash($pass, PASSWORD_DEFAULT); header('Location: ?step=4'); exit; }
    } elseif ($step === 4) {
        $D['mail'] = [
            'host' => post('smtp_host'), 'port' => (int)post('smtp_port', '587'), 'secure' => in_array(post('smtp_secure'), ['ssl', 'tls', 'none'], true) ? post('smtp_secure') : 'tls',
            'user' => post('smtp_user'), 'pass' => ($_POST['smtp_pass'] ?? '') !== '' ? (string)$_POST['smtp_pass'] : ($D['mail']['pass'] ?? ''),
            'from_email' => post('from_email'), 'from_name' => post('from_name', $D['site']['name'] ?? 'Animalista'),
        ];
        if ($D['mail']['from_email'] && !filter_var($D['mail']['from_email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'El correo remitente no es válido.';
        if (!$errors && isset($_POST['test'])) {
            try {
                (new Mailer($D['mail']))->send($D['site']['admin_email'], 'Prueba de correo · Instalación', '<p>¡El correo funciona!</p>', '¡El correo funciona!');
                $notice = 'Correo de prueba enviado a ' . $D['site']['admin_email'] . '. Revisa también la carpeta de spam.';
            } catch (Throwable $e) {
                $errors[] = 'La prueba falló: ' . $e->getMessage();
            }
        } elseif (!$errors) { header('Location: ?step=5'); exit; }
    } elseif ($step === 5) {
        if (empty($D['db']) || empty($D['site']) || empty($D['admin_hash'])) {
            $errors[] = 'Faltan datos de pasos anteriores.';
        } else {
            try {
                install($root, $configFile, $D);
                $S['finished'] = true;
                header('Location: ?step=5&done=1'); exit;
            } catch (Throwable $e) {
                $errors[] = 'La instalación falló: ' . $e->getMessage();
            }
        }
    }
}

function install(string $root, string $configFile, array $D): void
{
    $db = $D['db'];
    Db::init($db);
    $pdo = Db::pdo();
    foreach (require $root . '/app/schema.php' as $sql) $pdo->exec(Db::sql($sql));

    $now = gmdate('Y-m-d H:i:s');
    $pdo->beginTransaction();
    Db::setSetting('site_name', $D['site']['name']);
    Db::setSetting('site_url', $D['site']['url'] ?: null);
    Db::setSetting('mail', json_encode($D['mail'] ?? []));
    Db::setSetting('installed_version', APP_VERSION);
    Db::setSetting('db_version', (string)DB_VERSION);
    Db::setSetting('author', APP_AUTHOR);
    Db::insert('admins', ['name' => $D['site']['admin_name'], 'email' => $D['site']['admin_email'], 'password_hash' => $D['admin_hash'], 'created_at' => $now]);
    if ($D['site']['sample']) {
        $opt = ['phone' => true, 'birth_date' => true, 'gender' => true, 'municipality' => true, 'zone' => true, 'ethnic_group' => true, 'pets' => true, 'education' => false, 'disability' => false];
        Db::insert('events', [
            'slug' => 'pacto-bienestar', 'status' => 'draft', 'name' => 'Pacto por el bienestar de perros y gatos',
            'description' => 'Descripción del evento configurable desde el panel. Explica en dos o tres líneas para qué se recogen las firmas, quién las recibe y hasta cuándo está abierta la convocatoria.',
            'organization' => $D['site']['name'],
            'colors' => json_encode(['bg' => '#F7F6F2', 'title' => '#161616', 'text' => '#3D3B36', 'button' => '#2C4BFF']),
            'fields' => json_encode(['optional' => $opt, 'custom' => []]),
            'municipalities' => json_encode(['Pasto', 'Ipiales', 'Tumaco', 'Túquerres', 'Otro'], JSON_UNESCAPED_UNICODE),
            'created_at' => $now, 'updated_at' => $now,
        ]);
    }
    $pdo->commit();

    $config = [
        'db' => $db,
        'timezone' => $D['site']['timezone'],
        'debug' => false,
        'app_key' => bin2hex(random_bytes(32)),
        'installed_at' => gmdate('c'),
        'version' => APP_VERSION,
    ];
    $php = "<?php\n/**\n * Configuración generada por el asistente de instalación el " . gmdate('Y-m-d H:i') . " UTC.\n"
        . " * Animalista · Plataforma de firmas — © " . APP_AUTHOR . "\n * NO compartas este archivo: contiene credenciales.\n */\nreturn " . var_export($config, true) . ";\n";
    if (file_put_contents($configFile, $php, LOCK_EX) === false) throw new RuntimeException('No se pudo escribir config/config.php');
    @chmod($configFile, 0640);
}

// ---------- Vista ----------
function render_page(string $title, callable $body, int $current, array $steps = [], array $errors = [], ?string $notice = null): void
{
    ?><!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="author" content="<?= h(APP_AUTHOR) ?>">
<meta name="robots" content="noindex">
<title><?= h($title) ?> · Instalación</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@300;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="install.css">
</head>
<body>
<div class="wrap">
  <aside class="side">
    <span class="brand">Animalista</span>
    <svg class="art" viewBox="0 0 220 200" aria-hidden="true"><path d="M190 186 L110 186 C100 186 98 178 104 176 C112 156 116 130 112 112 C120 106 134 104 146 104 C158 104 164 96 160 88 C150 82 140 80 134 72 C128 60 112 56 100 62 C90 68 86 84 90 100 C94 106 100 100 98 90 C86 96 74 112 70 136 C66 160 74 182 96 186 C70 188 40 178 36 156 C34 146 42 140 46 148" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <div>
      <h1>Asistente de instalación</h1>
      <?php if ($steps): ?>
      <ol class="steps">
        <?php foreach ($steps as $n => $label): ?>
          <li class="<?= $n < $current ? 'done' : ($n === $current ? 'current' : '') ?>"<?= $n === $current ? ' aria-current="step"' : '' ?>><span><?= $n ?></span><?= h($label) ?></li>
        <?php endforeach; ?>
      </ol>
      <?php endif; ?>
      <p class="credit">Versión <?= h(APP_VERSION) ?> · Desarrollado por <?= h(APP_AUTHOR) ?></p>
    </div>
  </aside>
  <main class="main">
    <div class="box">
      <?php foreach ($errors as $e): ?><div class="alert alert--error" role="alert"><?= h($e) ?></div><?php endforeach; ?>
      <?php if ($notice): ?><div class="alert alert--ok" role="status"><?= h($notice) ?></div><?php endif; ?>
      <?php $body(); ?>
    </div>
  </main>
</div>
</body>
</html><?php
}

$csrf = '<input type="hidden" name="csrf" value="' . h($S['csrf']) . '">';
$v = fn(array $src, string $k, string $d = '') => h((string)($src[$k] ?? $d));

render_page($steps[$step], function () use ($step, $root, $csrf, $D, $S, $v) {
    if ($step === 1): $reqs = requirements($root); ?>
        <h2>Bienvenido</h2>
        <p>Este asistente instalará la plataforma de recolección de firmas en tu hosting en unos minutos, como la instalación de WordPress. Antes de empezar ten a mano:</p>
        <ul class="list">
          <li>Una <strong>base de datos MySQL o MariaDB</strong> vacía con su usuario y contraseña. En Plesk: <em>Sitios web y dominios → Bases de datos → Añadir base de datos</em>.</li>
          <li>Los datos de un <strong>buzón de correo</strong> para enviar los códigos de verificación (opcional, se puede configurar después). En Plesk: <em>Correo → Crear dirección de correo</em>.</li>
        </ul>
        <h3>Requisitos del servidor</h3>
        <ul class="reqs">
          <?php foreach ($reqs as [$label, $ok, $hint, $required]): ?>
            <li class="<?= $ok ? 'ok' : ($required ? 'bad' : 'warn') ?>">
              <span class="dot" aria-hidden="true"></span>
              <div><strong><?= h($label) ?></strong> <span class="sr"><?= $ok ? 'correcto' : ($required ? 'falta' : 'recomendado') ?></span>
              <?php if (!$ok && $hint): ?><small><?= h($hint) ?></small><?php endif; ?></div>
            </li>
          <?php endforeach; ?>
        </ul>
        <form method="post" class="actions"><?= $csrf ?><button class="btn" type="submit">Comenzar</button></form>
    <?php elseif ($step === 2): $db = $D['db'] ?? []; ?>
        <h2>Base de datos</h2>
        <p>Escribe los datos de conexión. Si no los conoces, búscalos en Plesk en <em>Bases de datos → Información de conexión</em>.</p>
        <form method="post" class="form"><?= $csrf ?>
          <div class="grid">
            <label>Servidor<input name="db_host" required value="<?= $v($db, 'host', 'localhost') ?>"><small>Casi siempre <code>localhost</code>.</small></label>
            <label>Puerto<input name="db_port" type="number" required value="<?= $v($db, 'port', '3306') ?>"></label>
          </div>
          <label>Nombre de la base de datos<input name="db_name" required value="<?= $v($db, 'name') ?>"></label>
          <div class="grid">
            <label>Usuario<input name="db_user" required autocomplete="off" value="<?= $v($db, 'user') ?>"></label>
            <label>Contraseña<input name="db_pass" type="password" autocomplete="new-password"></label>
          </div>
          <label>Prefijo de tablas<input name="db_prefix" required value="<?= $v($db, 'prefix', 'an_') ?>"><small>Permite tener varias instalaciones en la misma base de datos.</small></label>
          <div class="actions"><a class="btn btn--ghost" href="?step=1">Atrás</a><button class="btn" type="submit">Probar conexión y continuar</button></div>
        </form>
    <?php elseif ($step === 3):
        $site = $D['site'] ?? [];
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        $guess = ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . APP_BASE; ?>
        <?php if (!empty($S['db_ok'])): ?><div class="alert alert--ok">Conexión correcta (<?= h($S['db_ok']) ?>).</div><?php endif; ?>
        <h2>Sitio y administrador</h2>
        <form method="post" class="form"><?= $csrf ?>
          <label>Nombre de la plataforma<input name="site_name" required value="<?= $v($site, 'name', 'Animalista') ?>"><small>Aparece en la app autenticadora y en los correos.</small></label>
          <div class="grid">
            <label>URL del sitio<input name="site_url" type="url" value="<?= $v($site, 'url', $guess) ?>"></label>
            <label>Zona horaria<select name="timezone">
              <?php foreach (['America/Bogota', 'America/Lima', 'America/Mexico_City', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Caracas', 'America/Guayaquil', 'Europe/Madrid', 'UTC'] as $tz): ?>
                <option<?= ($site['timezone'] ?? 'America/Bogota') === $tz ? ' selected' : '' ?>><?= h($tz) ?></option>
              <?php endforeach; ?>
            </select></label>
          </div>
          <h3>Cuenta de administrador</h3>
          <label>Nombre<input name="admin_name" required autocomplete="name" value="<?= $v($site, 'admin_name') ?>"></label>
          <label>Correo<input name="admin_email" type="email" required autocomplete="email" value="<?= $v($site, 'admin_email') ?>"></label>
          <div class="grid">
            <label>Contraseña<input name="admin_pass" type="password" required minlength="10" autocomplete="new-password"><small>Mínimo 10 caracteres.</small></label>
            <label>Repite la contraseña<input name="admin_pass2" type="password" required minlength="10" autocomplete="new-password"></label>
          </div>
          <p class="hint">En el primer ingreso se pedirá activar la verificación en dos pasos con Google Authenticator, Microsoft Authenticator o Authy.</p>
          <label class="check"><input type="checkbox" name="sample"<?= ($site['sample'] ?? true) ? ' checked' : '' ?>> Crear un evento de ejemplo como borrador</label>
          <div class="actions"><a class="btn btn--ghost" href="?step=2">Atrás</a><button class="btn" type="submit">Continuar</button></div>
        </form>
    <?php elseif ($step === 4): $m = $D['mail'] ?? []; ?>
        <h2>Correo saliente</h2>
        <p>Los firmantes reciben por correo el código de verificación y el comprobante. Con Plesk usa el buzón que creaste: servidor <code><?= h('mail.' . preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? 'tudominio.com')) ?></code>, puerto 465 (SSL) o 587 (STARTTLS).</p>
        <p class="hint">Si dejas el servidor vacío se usará la función <code>mail()</code> de PHP. Puedes cambiarlo después en <em>Ajustes</em>.</p>
        <form method="post" class="form"><?= $csrf ?>
          <div class="grid">
            <label>Servidor SMTP<input name="smtp_host" value="<?= $v($m, 'host') ?>" placeholder="mail.tudominio.com"></label>
            <label>Puerto<input name="smtp_port" type="number" value="<?= $v($m, 'port', '587') ?>"></label>
          </div>
          <label>Seguridad<select name="smtp_secure">
            <?php foreach (['tls' => 'STARTTLS (587)', 'ssl' => 'SSL/TLS (465)', 'none' => 'Ninguna'] as $k => $l): ?>
              <option value="<?= $k ?>"<?= ($m['secure'] ?? 'tls') === $k ? ' selected' : '' ?>><?= h($l) ?></option>
            <?php endforeach; ?>
          </select></label>
          <div class="grid">
            <label>Usuario<input name="smtp_user" autocomplete="off" value="<?= $v($m, 'user') ?>"></label>
            <label>Contraseña<input name="smtp_pass" type="password" autocomplete="new-password" placeholder="<?= !empty($m['pass']) ? '•••••• (guardada)' : '' ?>"></label>
          </div>
          <div class="grid">
            <label>Correo remitente<input name="from_email" type="email" value="<?= $v($m, 'from_email') ?>" placeholder="firmas@tudominio.com"></label>
            <label>Nombre remitente<input name="from_name" value="<?= $v($m, 'from_name', $D['site']['name'] ?? 'Animalista') ?>"></label>
          </div>
          <div class="actions">
            <a class="btn btn--ghost" href="?step=3">Atrás</a>
            <span class="spacer"></span>
            <button class="btn btn--outline" type="submit" name="test" value="1">Enviar correo de prueba</button>
            <button class="btn" type="submit">Continuar</button>
          </div>
        </form>
    <?php elseif ($step === 5 && !empty($_GET['done']) && !empty($S['finished'])): ?>
        <h2>¡Instalación completada!</h2>
        <p>La plataforma quedó lista. Ingresa con el correo <strong><?= h($D['site']['admin_email'] ?? '') ?></strong> y activa la verificación en dos pasos.</p>
        <div class="alert alert--warn"><strong>Importante:</strong> por seguridad elimina la carpeta <code>install/</code> del servidor desde el Administrador de archivos de Plesk. El asistente ya quedó bloqueado.</div>
        <div class="actions"><a class="btn" href="<?= h(APP_BASE) ?>/admin/acceso">Ir al panel de administración</a></div>
        <?php $_SESSION = []; ?>
    <?php else: $db = $D['db'] ?? []; $site = $D['site'] ?? []; $m = $D['mail'] ?? []; ?>
        <h2>Todo listo para instalar</h2>
        <dl class="summary">
          <dt>Base de datos</dt><dd><?= h(($db['user'] ?? '') . '@' . ($db['host'] ?? '') . ':' . ($db['port'] ?? '') . ' / ' . ($db['name'] ?? '')) ?> (prefijo <?= h($db['prefix'] ?? '') ?>)</dd>
          <dt>Plataforma</dt><dd><?= h($site['name'] ?? '') ?> · <?= h($site['url'] ?? '') ?></dd>
          <dt>Administrador</dt><dd><?= h(($site['admin_name'] ?? '') . ' · ' . ($site['admin_email'] ?? '')) ?></dd>
          <dt>Correo</dt><dd><?= h(!empty($m['host']) ? $m['host'] . ':' . $m['port'] : 'mail() de PHP') ?></dd>
        </dl>
        <form method="post" class="actions"><?= $csrf ?><a class="btn btn--ghost" href="?step=4">Atrás</a><button class="btn" type="submit">Instalar ahora</button></form>
    <?php endif;
}, $step, $steps, $errors, $notice);
