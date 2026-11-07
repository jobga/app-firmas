<?php
/**
 * Rutas del panel de administración.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */

function admin_event(string $id): array
{
    $e = Db::one('SELECT * FROM `#__events` WHERE id = ?', [(int)$id]);
    if (!$e) throw new HttpError(404, 'Evento no encontrado');
    return $e;
}

/** Filtro común (evento + periodo) para analítica, listado y exportación. */
function signature_filter(string $alias = ''): array
{
    $a = $alias ? "$alias." : '';
    $where = ['1=1'];
    $params = [];
    $event = $_GET['event'] ?? 'all';
    if ($event !== 'all' && $event !== '') { $where[] = "{$a}event_id = ?"; $params[] = (int)$event; }
    $days = $_GET['period'] ?? '30';
    if ($days !== 'all') { $where[] = "{$a}created_at >= ?"; $params[] = gmdate('Y-m-d H:i:s', time() - (int)$days * 86400); }
    return [implode(' AND ', $where), $params];
}

function age_bucket(?string $birth): ?string
{
    if (!$birth) return null;
    $age = (int)date_diff(date_create($birth), date_create('today'))->y;
    return match (true) { $age < 25 => '18–24', $age < 35 => '25–34', $age < 45 => '35–44', $age < 60 => '45–59', default => '60+' };
}

function top_with_others(array $counts, int $n = 4): array
{
    arsort($counts);
    $top = array_slice($counts, 0, $n, true);
    $rest = array_sum(array_slice($counts, $n, null, true));
    if ($rest) $top['Otros'] = ($top['Otros'] ?? 0) + $rest;
    return array_map(fn($k, $v) => ['label' => (string)$k, 'value' => $v], array_keys($top), $top);
}

function mail_settings_public(): array
{
    $m = json_decode((string)Db::setting('mail'), true) ?: [];
    return [
        'host' => $m['host'] ?? '', 'port' => (int)($m['port'] ?? 587), 'secure' => $m['secure'] ?? 'tls',
        'user' => $m['user'] ?? '', 'hasPassword' => !empty($m['pass']),
        'fromEmail' => $m['from_email'] ?? '', 'fromName' => $m['from_name'] ?? '',
    ];
}

return [
    // ---------- Autenticación ----------
    ['POST', '/admin/login', function () {
        Auth::start();
        Http::rateLimit('login:' . Http::ip(), 20, 900);
        $b = Http::body();
        $email = strtolower((string)Http::str($b, 'email', 190, true));
        $pass = (string)($b['password'] ?? '');
        $a = Db::one('SELECT * FROM `#__admins` WHERE email = ?', [$email]);
        if ($a && $a['locked_until'] && strtotime($a['locked_until'] . ' UTC') > time()) {
            throw new HttpError(423, 'La cuenta está bloqueada temporalmente por intentos fallidos. Inténtalo en ' . Auth::LOCK_MINUTES . ' minutos.');
        }
        if (!$a || !password_verify($pass, $a['password_hash'])) {
            if ($a) {
                $fails = (int)$a['failed_attempts'] + 1;
                $lock = $fails >= Auth::MAX_FAILED ? gmdate('Y-m-d H:i:s', time() + Auth::LOCK_MINUTES * 60) : null;
                Db::update('admins', ['failed_attempts' => $lock ? 0 : $fails, 'locked_until' => $lock], 'id = ?', [$a['id']]);
            }
            throw new HttpError(401, 'Correo o contraseña incorrectos');
        }
        if (password_needs_rehash($a['password_hash'], PASSWORD_DEFAULT)) {
            Db::update('admins', ['password_hash' => password_hash($pass, PASSWORD_DEFAULT)], 'id = ?', [$a['id']]);
        }
        session_regenerate_id(true);
        $_SESSION = ['pending_admin_id' => (int)$a['id'], 'pending_at' => time()];
        if ($a['totp_enabled']) return ['next' => 'verify'];

        $secret = $a['totp_secret'] ?: Totp::secret();
        if (!$a['totp_secret']) Db::update('admins', ['totp_secret' => $secret], 'id = ?', [$a['id']]);
        $issuer = Db::setting('site_name', 'Animalista');
        return ['next' => 'enroll', 'secret' => $secret, 'otpauth' => Totp::uri($secret, $a['email'], $issuer)];
    }],

    ['POST', '/admin/2fa/enroll', function () {
        $a = Auth::pending();
        if ($a['totp_enabled']) throw new HttpError(409, 'La verificación en dos pasos ya está activa');
        Http::rateLimit('mfa:' . $a['id'], 10, 600);
        $counter = Totp::verify((string)$a['totp_secret'], (string)(Http::body()['code'] ?? ''));
        if ($counter === null) throw new HttpError(422, 'Código incorrecto. Revisa la hora de tu teléfono e inténtalo de nuevo.');
        $codes = Auth::recoveryCodes();
        Db::update('admins', ['totp_enabled' => 1, 'totp_last_counter' => $counter, 'recovery_codes' => json_encode($codes['hashed'])], 'id = ?', [$a['id']]);
        Auth::complete((int)$a['id']);
        return ['ok' => true, 'recoveryCodes' => $codes['plain']];
    }],

    ['POST', '/admin/2fa/verify', function () {
        $a = Auth::pending();
        if (!$a['totp_enabled']) throw new HttpError(409, 'Primero activa la verificación en dos pasos');
        Http::rateLimit('mfa:' . $a['id'], 10, 600);
        $b = Http::body();
        if (!empty($b['recoveryCode'])) {
            $given = strtoupper(trim((string)$b['recoveryCode']));
            $hashes = json_decode((string)$a['recovery_codes'], true) ?: [];
            foreach ($hashes as $i => $h) {
                if (password_verify($given, $h)) {
                    unset($hashes[$i]);
                    Db::update('admins', ['recovery_codes' => json_encode(array_values($hashes))], 'id = ?', [$a['id']]);
                    Auth::complete((int)$a['id']);
                    return ['ok' => true, 'recoveryCodesLeft' => count($hashes)];
                }
            }
            throw new HttpError(422, 'Código de recuperación no válido');
        }
        $last = $a['totp_last_counter'] !== null ? (int)$a['totp_last_counter'] : null;
        $counter = Totp::verify((string)$a['totp_secret'], (string)($b['code'] ?? ''), $last);
        if ($counter === null) throw new HttpError(422, 'Código incorrecto o ya usado. Espera el siguiente código de la app.');
        Db::update('admins', ['totp_last_counter' => $counter], 'id = ?', [$a['id']]);
        Auth::complete((int)$a['id']);
        return ['ok' => true];
    }],

    // ---------- Recuperación de contraseña ----------
    // Responde igual exista o no la cuenta, para no revelar qué correos son administradores.
    ['POST', '/admin/password/forgot', function () {
        Http::rateLimit('forgot:' . Http::ip(), 5, 3600);
        $email = strtolower((string)Http::str(Http::body(), 'email', 190, true));
        $a = Db::one('SELECT id, name, email, reset_expires_at FROM `#__admins` WHERE email = ?', [$email]);
        $recent = $a && $a['reset_expires_at'] && strtotime($a['reset_expires_at'] . ' UTC') > time() + 55 * 60;
        if ($a && !$recent) {
            $token = bin2hex(random_bytes(32));
            Db::update('admins', ['reset_token_hash' => hash('sha256', $token), 'reset_expires_at' => gmdate('Y-m-d H:i:s', time() + 3600)], 'id = ?', [$a['id']]);
            $url = Util::baseUrl() . '/admin/restablecer/' . $token;
            $site = Db::setting('site_name', 'Animalista');
            $html = '<div style="font-family:Arial,sans-serif;color:#3D3B36;max-width:480px"><p>Hola ' . Util::e($a['name']) . ',</p>'
                . '<p>Recibimos una solicitud para restablecer tu contraseña en <strong>' . Util::e($site) . '</strong>.</p>'
                . '<p><a href="' . Util::e($url) . '" style="display:inline-block;background:#2C4BFF;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">Crear una contraseña nueva</a></p>'
                . '<p>El enlace vence en 1 hora y sirve una sola vez. Después seguirás necesitando tu app autenticadora para entrar. Si no lo solicitaste, ignora este correo.</p></div>';
            try {
                Mailer::fromSettings()->send($a['email'], 'Restablecer contraseña · ' . $site, $html, "Para crear una contraseña nueva abre: {$url}\nEl enlace vence en 1 hora.");
            } catch (RuntimeException $e) {
                error_log('[animalista] recuperación: ' . $e->getMessage());
            }
        }
        return ['ok' => true];
    }],

    ['POST', '/admin/password/reset', function () {
        Http::rateLimit('reset:' . Http::ip(), 10, 3600);
        $b = Http::body();
        $token = (string)($b['token'] ?? '');
        $a = preg_match('/^[a-f0-9]{64}$/', $token) ? Db::one('SELECT id, reset_expires_at FROM `#__admins` WHERE reset_token_hash = ?', [hash('sha256', $token)]) : null;
        if (!$a || strtotime($a['reset_expires_at'] . ' UTC') < time()) throw new HttpError(410, 'El enlace no es válido o ya venció. Solicita uno nuevo.');
        $new = (string)($b['password'] ?? '');
        if (strlen($new) < 10) throw new HttpError(422, 'La nueva contraseña debe tener al menos 10 caracteres', ['field' => 'password']);
        Db::update('admins', [
            'password_hash' => password_hash($new, PASSWORD_DEFAULT), 'reset_token_hash' => null, 'reset_expires_at' => null,
            'failed_attempts' => 0, 'locked_until' => null,
        ], 'id = ?', [$a['id']]);
        return ['ok' => true];
    }],

    ['POST', '/admin/logout', function () {
        Auth::start();
        $_SESSION = [];
        session_destroy();
        return ['ok' => true];
    }],

    ['GET', '/admin/me', function () {
        $a = Auth::admin();
        return ['id' => (int)$a['id'], 'name' => $a['name'], 'email' => $a['email'], 'totpEnabled' => (bool)$a['totp_enabled'], 'siteName' => Db::setting('site_name', 'Animalista')];
    }],

    // ---------- Eventos ----------
    ['GET', '/admin/events', function () {
        Auth::admin();
        $rows = Db::all('SELECT * FROM `#__events` ORDER BY created_at DESC');
        $default = Db::setting('default_event');
        return array_map(fn($e) => event_admin($e) + ['isDefault' => (string)$e['id'] === $default], $rows);
    }],

    ['POST', '/admin/events', function () {
        Auth::admin();
        $data = event_from_input(Http::body());
        if (Db::value('SELECT COUNT(*) FROM `#__events` WHERE slug = ?', [$data['slug']])) $data['slug'] .= '-' . bin2hex(random_bytes(2));
        $data['created_at'] = $data['updated_at'] = Util::now();
        $id = Db::insert('events', $data);
        return event_admin(admin_event((string)$id));
    }],

    ['GET', '/admin/events/{id}', function ($p) {
        Auth::admin();
        return event_admin(admin_event($p['id']));
    }],

    ['PUT', '/admin/events/{id}', function ($p) {
        Auth::admin();
        $e = admin_event($p['id']);
        $data = event_from_input(Http::body(), $e);
        if (Db::value('SELECT COUNT(*) FROM `#__events` WHERE slug = ? AND id <> ?', [$data['slug'], $e['id']])) {
            throw new HttpError(422, 'Ya existe otro evento con ese enlace', ['field' => 'slug']);
        }
        $data['updated_at'] = Util::now();
        Db::update('events', $data, 'id = ?', [$e['id']]);
        return event_admin(admin_event($p['id']));
    }],

    ['POST', '/admin/events/{id}/default', function ($p) {
        Auth::admin();
        $e = admin_event($p['id']);
        Db::setSetting('default_event', (string)$e['id']);
        return ['ok' => true];
    }],

    ['DELETE', '/admin/events/{id}', function ($p) {
        Auth::admin();
        $e = admin_event($p['id']);
        if ((string)(Http::body()['confirm'] ?? '') !== $e['slug']) throw new HttpError(422, 'Escribe el enlace del evento para confirmar');
        Db::run('DELETE FROM `#__events` WHERE id = ?', [$e['id']]);
        $dir = UPLOADS_DIR . '/events/' . (int)$e['id'];
        if (is_dir($dir)) { array_map('unlink', glob($dir . '/*') ?: []); @rmdir($dir); }
        return ['ok' => true];
    }],

    ['POST', '/admin/events/{id}/upload', function ($p) {
        Auth::admin();
        $e = admin_event($p['id']);
        $kind = $_GET['kind'] ?? '';
        $rules = [
            'logo' => ['col' => 'logo_path', 'max' => 1024 * 1024, 'types' => ['image/png' => 'png', 'image/svg+xml' => 'svg']],
            'background' => ['col' => 'background_path', 'max' => 4 * 1024 * 1024, 'types' => ['image/jpeg' => 'jpg', 'image/webp' => 'webp']],
        ];
        if (!isset($rules[$kind])) throw new HttpError(422, 'Tipo de archivo no válido');
        $r = $rules[$kind];
        $f = $_FILES['file'] ?? null;
        if (!$f || $f['error'] !== UPLOAD_ERR_OK) throw new HttpError(422, 'No se recibió el archivo');
        if ($f['size'] > $r['max']) throw new HttpError(422, 'El archivo supera el tamaño permitido');
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        if ($mime === 'text/xml' || $mime === 'text/plain' || $mime === 'image/svg') $mime = 'image/svg+xml';
        if (!isset($r['types'][$mime])) throw new HttpError(422, 'Formato no permitido');
        if ($mime === 'image/svg+xml') {
            $svg = (string)file_get_contents($f['tmp_name']);
            if (!str_contains($svg, '<svg') || preg_match('/<script|on\w+\s*=|javascript:|<foreignObject|<iframe|<embed|<object/i', $svg)) {
                throw new HttpError(422, 'El SVG contiene elementos no permitidos');
            }
        } elseif (!@getimagesize($f['tmp_name'])) {
            throw new HttpError(422, 'La imagen no es válida');
        }
        $dir = UPLOADS_DIR . '/events/' . (int)$e['id'];
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) throw new HttpError(500, 'No se pudo crear la carpeta de archivos');
        $name = $kind . '-' . bin2hex(random_bytes(6)) . '.' . $r['types'][$mime];
        if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) throw new HttpError(500, 'No se pudo guardar el archivo');
        if ($e[$r['col']] && is_file(ROOT_DIR . '/' . $e[$r['col']])) @unlink(ROOT_DIR . '/' . $e[$r['col']]);
        Db::update('events', [$r['col'] => "uploads/events/{$e['id']}/$name", 'updated_at' => Util::now()], 'id = ?', [$e['id']]);
        return event_admin(admin_event($p['id']));
    }],

    ['DELETE', '/admin/events/{id}/upload', function ($p) {
        Auth::admin();
        $e = admin_event($p['id']);
        $col = ($_GET['kind'] ?? '') === 'logo' ? 'logo_path' : 'background_path';
        if ($e[$col] && is_file(ROOT_DIR . '/' . $e[$col])) @unlink(ROOT_DIR . '/' . $e[$col]);
        Db::update('events', [$col => null], 'id = ?', [$e['id']]);
        return event_admin(admin_event($p['id']));
    }],

    // ---------- Analítica ----------
    ['GET', '/admin/analytics', function () {
        Auth::admin();
        [$where, $params] = signature_filter();
        $days = $_GET['period'] ?? '30';
        $event = $_GET['event'] ?? 'all';

        $count = fn(string $extra = '', array $p = []) => (int)Db::value("SELECT COUNT(*) FROM `#__signatures` WHERE $where $extra", [...$params, ...$p]);
        $started = $count();
        $verified = $count("AND status = 'verified'");
        $signed = $count('AND signature_png IS NOT NULL');
        $avg = Db::value("SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, verified_at)) FROM `#__signatures` WHERE $where AND status = 'verified'", $params);
        $mobile = $verified ? (int)Db::value("SELECT COUNT(*) FROM `#__signatures` WHERE $where AND status = 'verified' AND device = 'mobile'", $params) : 0;

        $vw = ['1=1']; $vp = [];
        if ($event !== 'all') { $vw[] = 'event_id = ?'; $vp[] = (int)$event; }
        if ($days !== 'all') { $vw[] = 'day >= ?'; $vp[] = gmdate('Y-m-d', time() - (int)$days * 86400); }
        $visits = (int)Db::value('SELECT COALESCE(SUM(visits),0) FROM `#__event_visits` WHERE ' . implode(' AND ', $vw), $vp);

        // Periodo anterior para comparar.
        $prev = null;
        if ($days !== 'all') {
            $d = (int)$days;
            $pw = ['created_at >= ?', 'created_at < ?']; $pp = [gmdate('Y-m-d H:i:s', time() - 2 * $d * 86400), gmdate('Y-m-d H:i:s', time() - $d * 86400)];
            if ($event !== 'all') { $pw[] = 'event_id = ?'; $pp[] = (int)$event; }
            $pwhere = implode(' AND ', $pw);
            $ps = (int)Db::value("SELECT COUNT(*) FROM `#__signatures` WHERE $pwhere", $pp);
            $pv = (int)Db::value("SELECT COUNT(*) FROM `#__signatures` WHERE $pwhere AND status = 'verified'", $pp);
            $prev = ['started' => $ps, 'verified' => $pv, 'rate' => $ps ? $pv / $ps : null];
        }

        // Serie diaria.
        $span = $days === 'all' ? max(1, min(365, (int)Db::value("SELECT DATEDIFF(UTC_DATE(), MIN(DATE(created_at))) + 1 FROM `#__signatures` WHERE $where", $params))) : (int)$days;
        $daily = [];
        for ($i = $span - 1; $i >= 0; $i--) $daily[gmdate('Y-m-d', time() - $i * 86400)] = ['started' => 0, 'verified' => 0];
        foreach (Db::all("SELECT DATE(created_at) d, COUNT(*) n FROM `#__signatures` WHERE $where GROUP BY d", $params) as $r) if (isset($daily[$r['d']])) $daily[$r['d']]['started'] = (int)$r['n'];
        foreach (Db::all("SELECT DATE(verified_at) d, COUNT(*) n FROM `#__signatures` WHERE $where AND status = 'verified' GROUP BY d", $params) as $r) if (isset($daily[$r['d']])) $daily[$r['d']]['verified'] = (int)$r['n'];

        // Caracterización (solo firmas verificadas).
        $rows = Db::all("SELECT gender, birth_date, zone, department, municipality, ethnic_group, pets FROM `#__signatures` WHERE $where AND status = 'verified'", $params);
        $agg = ['gender' => [], 'age' => array_fill_keys(['18–24', '25–34', '35–44', '45–59', '60+'], 0), 'zone' => [], 'department' => [], 'municipality' => [], 'ethnic' => [], 'pets' => []];
        // Las opciones configuradas en el evento aparecen aunque tengan 0 registros.
        if ($event !== 'all' && ($ev = Db::one('SELECT * FROM `#__events` WHERE id = ?', [(int)$event]))) {
            $L = event_fields($ev)['lists'];
            $agg['zone'] = array_fill_keys($L['zone'], 0);
            $agg['pets'] = array_fill_keys($L['pets'], 0);
        }
        $inc = function (array &$a, ?string $k) { if ($k !== null && $k !== '') $a[$k] = ($a[$k] ?? 0) + 1; };
        foreach ($rows as $r) {
            $inc($agg['gender'], $r['gender']);
            if ($b = age_bucket($r['birth_date'])) $agg['age'][$b]++;
            $inc($agg['zone'], $r['zone']);
            $inc($agg['department'], $r['department'] ?: ($r['municipality'] ? 'Sin departamento' : null));
            $inc($agg['municipality'], $r['municipality'] ? $r['municipality'] . ($r['department'] ? ' · ' . $r['department'] : '') : null);
            $inc($agg['ethnic'], $r['ethnic_group']);
            foreach (array_filter(explode(',', (string)$r['pets'])) as $pet) $inc($agg['pets'], $pet);
        }
        $pairs = fn(array $a) => array_map(fn($k, $v) => ['label' => (string)$k, 'value' => $v], array_keys($a), $a);
        arsort($agg['gender']);

        return [
            'totals' => [
                'visits' => $visits, 'started' => $started, 'signed' => $signed, 'verified' => $verified,
                'rate' => $started ? $verified / $started : null,
                'avgSeconds' => $avg !== null ? (int)round((float)$avg) : null,
                'mobileShare' => $verified ? $mobile / $verified : null,
            ],
            'previous' => $prev,
            'daily' => array_map(fn($d, $v) => ['day' => $d] + $v, array_keys($daily), $daily),
            'gender' => $pairs($agg['gender']),
            'age' => $pairs($agg['age']),
            'zone' => $pairs($agg['zone']),
            'department' => top_with_others($agg['department'], 8),
            'municipality' => top_with_others($agg['municipality'], 8),
            'ethnic' => top_with_others($agg['ethnic']),
            'pets' => $pairs($agg['pets']),
        ];
    }],

    // ---------- Firmas ----------
    ['GET', '/admin/signatures', function () {
        Auth::admin();
        [$where, $params] = signature_filter('s');
        $q = trim((string)($_GET['q'] ?? ''));
        if ($q !== '') { $where .= ' AND (s.folio LIKE ? OR s.doc_number LIKE ? OR s.full_name LIKE ? OR s.email LIKE ?)'; array_push($params, "%$q%", "%$q%", "%$q%", "%$q%"); }
        $page = max(1, (int)($_GET['page'] ?? 1));
        $per = 25;
        $total = (int)Db::value("SELECT COUNT(*) FROM `#__signatures` s WHERE $where", $params);
        $rows = Db::all("SELECT s.id, s.folio, s.full_name, s.department, s.municipality, s.created_at, s.verified_at, s.status, s.code_expires_at, e.name event_name
            FROM `#__signatures` s JOIN `#__events` e ON e.id = s.event_id WHERE $where ORDER BY s.created_at DESC LIMIT $per OFFSET " . (($page - 1) * $per), $params);
        return [
            'total' => $total, 'page' => $page, 'perPage' => $per,
            'items' => array_map(fn($r) => [
                'id' => (int)$r['id'], 'folio' => $r['folio'], 'name' => Util::maskName($r['full_name']),
                'municipality' => $r['municipality'], 'department' => $r['department'], 'event' => $r['event_name'],
                'createdAt' => Util::iso($r['created_at']), 'verifiedAt' => Util::iso($r['verified_at']),
                'status' => $r['status'] === 'pending_code' && $r['code_expires_at'] && strtotime($r['code_expires_at'] . ' UTC') < time() ? 'expired' : $r['status'],
            ], $rows),
        ];
    }],

    ['GET', '/admin/signatures/{id}', function ($p) {
        Auth::admin();
        $s = Db::one('SELECT s.*, e.name event_name FROM `#__signatures` s JOIN `#__events` e ON e.id = s.event_id WHERE s.id = ?', [(int)$p['id']]);
        if (!$s) throw new HttpError(404, 'Registro no encontrado');
        return [
            'id' => (int)$s['id'], 'folio' => $s['folio'], 'status' => $s['status'], 'event' => $s['event_name'],
            'fullName' => $s['full_name'], 'docType' => $s['doc_type'], 'docNumber' => $s['doc_number'], 'email' => $s['email'],
            'phone' => $s['phone'], 'birthDate' => $s['birth_date'], 'gender' => $s['gender'], 'department' => $s['department'], 'municipality' => $s['municipality'],
            'zone' => $s['zone'], 'ethnicGroup' => $s['ethnic_group'], 'pets' => $s['pets'], 'extra' => json_decode((string)$s['extra'], true),
            'consentNews' => (bool)$s['consent_news'], 'signature' => $s['signature_png'], 'hash' => $s['hash'],
            'device' => $s['device'], 'ip' => $s['ip'],
            'createdAt' => Util::iso($s['created_at']), 'signedAt' => Util::iso($s['signed_at']), 'verifiedAt' => Util::iso($s['verified_at']),
        ];
    }],

    ['GET', '/admin/export', function () {
        Auth::admin();
        [$where, $params] = signature_filter('s');
        if (($_GET['status'] ?? 'verified') === 'verified') $where .= " AND s.status = 'verified'";
        $st = Db::run("SELECT e.name evento, s.folio, s.status, s.full_name, s.doc_type, s.doc_number, s.email, s.phone, s.birth_date, s.gender,
            s.department, s.municipality, s.zone, s.ethnic_group, s.pets, s.extra, s.consent_news, s.device, s.created_at, s.verified_at, s.hash
            FROM `#__signatures` s JOIN `#__events` e ON e.id = s.event_id WHERE $where ORDER BY s.created_at", $params);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="firmas-' . date('Y-m-d') . '.csv"');
        header('Cache-Control: no-store');
        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF"); // BOM para que Excel reconozca UTF-8
        fputcsv($out, ['Evento', 'Folio', 'Estado', 'Nombre', 'Tipo documento', 'Documento', 'Correo', 'Celular', 'Nacimiento', 'Género',
            'Departamento', 'Municipio', 'Zona', 'Grupo étnico', 'Animales', 'Otros campos', 'Acepta información', 'Dispositivo', 'Registro (UTC)', 'Verificada (UTC)', 'Huella SHA-256'], ';');
        $labels = ['education' => 'Nivel educativo', 'disability' => 'Discapacidad'];
        foreach (Db::all('SELECT fields FROM `#__events`') as $ev) {
            foreach ((json_decode((string)$ev['fields'], true)['custom'] ?? []) as $c) $labels[$c['id']] = $c['label'];
        }
        $statusLabel = ['started' => 'Datos', 'signed' => 'Firmada', 'pending_code' => 'Pendiente código', 'verified' => 'Verificada', 'expired' => 'Código vencido'];
        while ($r = $st->fetch()) {
            $r['status'] = $statusLabel[$r['status']] ?? $r['status'];
            $extra = array_filter(json_decode((string)$r['extra'], true) ?: [], fn($v) => $v !== null && $v !== '');
            $r['extra'] = implode('; ', array_map(fn($k, $v) => ($labels[$k] ?? $k) . ': ' . $v, array_keys($extra), $extra));
            $r['consent_news'] = $r['consent_news'] ? 'Sí' : 'No';
            // Evita inyección de fórmulas en Excel.
            fputcsv($out, array_map(fn($v) => is_string($v) && preg_match('/^[=+\-@\t\r]/', $v) ? "'" . $v : $v, array_values($r)), ';');
        }
        fclose($out);
        exit;
    }],

    // ---------- Ajustes y seguridad ----------
    ['GET', '/admin/settings', function () {
        Auth::admin();
        return ['siteName' => Db::setting('site_name', 'Animalista'), 'siteUrl' => Db::setting('site_url', ''), 'mail' => mail_settings_public(), 'version' => APP_VERSION, 'author' => APP_AUTHOR];
    }],

    ['PUT', '/admin/settings', function () {
        Auth::admin();
        $b = Http::body();
        Db::setSetting('site_name', Http::str($b, 'siteName', 120) ?? 'Animalista');
        $url = Http::str($b, 'siteUrl', 255);
        if ($url && !filter_var($url, FILTER_VALIDATE_URL)) throw new HttpError(422, 'URL del sitio no válida', ['field' => 'siteUrl']);
        Db::setSetting('site_url', $url);
        if (isset($b['mail']) && is_array($b['mail'])) {
            $m = $b['mail'];
            $old = json_decode((string)Db::setting('mail'), true) ?: [];
            $from = Http::str($m, 'fromEmail', 190);
            if ($from && !filter_var($from, FILTER_VALIDATE_EMAIL)) throw new HttpError(422, 'Correo remitente no válido', ['field' => 'fromEmail']);
            Db::setSetting('mail', json_encode([
                'host' => Http::str($m, 'host', 190) ?? '', 'port' => (int)($m['port'] ?? 587),
                'secure' => in_array($m['secure'] ?? '', ['ssl', 'tls', 'none'], true) ? $m['secure'] : 'tls',
                'user' => Http::str($m, 'user', 190) ?? '',
                'pass' => isset($m['password']) && $m['password'] !== '' ? (string)$m['password'] : ($old['pass'] ?? ''),
                'from_email' => $from ?? '', 'from_name' => Http::str($m, 'fromName', 120) ?? '',
            ]));
        }
        return ['ok' => true];
    }],

    ['POST', '/admin/settings/test-mail', function () {
        $a = Auth::admin();
        try {
            Mailer::fromSettings()->send($a['email'], 'Prueba de correo · Animalista', '<p>El correo de la plataforma funciona correctamente.</p>', 'El correo de la plataforma funciona correctamente.');
        } catch (RuntimeException $e) {
            throw new HttpError(502, $e->getMessage());
        }
        return ['ok' => true, 'sentTo' => $a['email']];
    }],

    ['POST', '/admin/password', function () {
        $a = Auth::admin();
        $b = Http::body();
        $row = Db::one('SELECT password_hash FROM `#__admins` WHERE id = ?', [$a['id']]);
        if (!password_verify((string)($b['current'] ?? ''), $row['password_hash'])) throw new HttpError(422, 'La contraseña actual no es correcta', ['field' => 'current']);
        $new = (string)($b['new'] ?? '');
        if (strlen($new) < 10) throw new HttpError(422, 'La nueva contraseña debe tener al menos 10 caracteres', ['field' => 'new']);
        Db::update('admins', ['password_hash' => password_hash($new, PASSWORD_DEFAULT), 'reset_token_hash' => null, 'reset_expires_at' => null], 'id = ?', [$a['id']]);
        return ['ok' => true];
    }],

    ['POST', '/admin/2fa/recovery-codes', function () {
        $a = Auth::admin();
        $row = Db::one('SELECT totp_secret, totp_last_counter FROM `#__admins` WHERE id = ?', [$a['id']]);
        $counter = Totp::verify((string)$row['totp_secret'], (string)(Http::body()['code'] ?? ''), $row['totp_last_counter'] !== null ? (int)$row['totp_last_counter'] : null);
        if ($counter === null) throw new HttpError(422, 'Código de la app incorrecto o ya usado', ['field' => 'code']);
        Db::update('admins', ['totp_last_counter' => $counter], 'id = ?', [$a['id']]);
        $codes = Auth::recoveryCodes();
        Db::update('admins', ['recovery_codes' => json_encode($codes['hashed'])], 'id = ?', [$a['id']]);
        return ['recoveryCodes' => $codes['plain']];
    }],

    ['GET', '/admin/admins', function () {
        Auth::admin();
        return array_map(fn($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'email' => $r['email'], 'totpEnabled' => (bool)$r['totp_enabled'], 'lastLoginAt' => Util::iso($r['last_login_at'])],
            Db::all('SELECT id, name, email, totp_enabled, last_login_at FROM `#__admins` ORDER BY id'));
    }],

    ['POST', '/admin/admins', function () {
        Auth::admin();
        $b = Http::body();
        $email = strtolower((string)Http::str($b, 'email', 190, true));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new HttpError(422, 'Correo no válido', ['field' => 'email']);
        $pass = (string)($b['password'] ?? '');
        if (strlen($pass) < 10) throw new HttpError(422, 'La contraseña debe tener al menos 10 caracteres', ['field' => 'password']);
        if (Db::value('SELECT COUNT(*) FROM `#__admins` WHERE email = ?', [$email])) throw new HttpError(409, 'Ya existe un administrador con ese correo', ['field' => 'email']);
        Db::insert('admins', ['name' => Http::str($b, 'name', 150, true), 'email' => $email, 'password_hash' => password_hash($pass, PASSWORD_DEFAULT), 'created_at' => Util::now()]);
        return ['ok' => true];
    }],
];
