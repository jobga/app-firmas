<?php
/**
 * Rutas públicas: evento, registro, firma, código y comprobante.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */

function find_event_by_slug(string $slug): array
{
    $e = Db::one('SELECT * FROM `#__events` WHERE slug = ?', [$slug]);
    if (!$e || $e['status'] !== 'published') {
        // Los administradores con sesión pueden previsualizar borradores.
        Auth::start();
        if (!$e || empty($_SESSION['mfa_ok'])) throw new HttpError(404, 'Evento no encontrado');
    }
    return $e;
}

function find_signature(string $token): array
{
    if (!preg_match('/^[a-f0-9]{48}$/', $token)) throw new HttpError(404, 'Registro no encontrado');
    $s = Db::one('SELECT * FROM `#__signatures` WHERE token = ?', [$token]);
    if (!$s) throw new HttpError(404, 'Registro no encontrado');
    return $s;
}

function signature_event(array $s): array
{
    return Db::one('SELECT * FROM `#__events` WHERE id = ?', [$s['event_id']]);
}

function assert_open(array $e): void
{
    if (!event_public($e)['isOpen']) throw new HttpError(409, 'La recolección de firmas de este evento no está abierta');
}

function send_code(array $s, array $e): void
{
    if ((int)$s['codes_sent'] >= 5) throw new HttpError(429, 'Se alcanzó el máximo de códigos enviados para este registro');
    if ($s['last_code_at'] && strtotime($s['last_code_at'] . ' UTC') > time() - 45) throw new HttpError(429, 'Espera unos segundos antes de pedir otro código');
    Http::rateLimit('code:' . Http::ip(), 20, 3600);

    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $ttl = (int)$e['code_ttl_minutes'];
    Db::update('signatures', [
        'code_hash' => password_hash($code, PASSWORD_DEFAULT),
        'code_expires_at' => gmdate('Y-m-d H:i:s', time() + $ttl * 60),
        'code_attempts' => 0,
        'codes_sent' => (int)$s['codes_sent'] + 1,
        'last_code_at' => Util::now(),
        'status' => 'pending_code',
    ], 'id = ?', [$s['id']]);

    $name = Util::e(explode(' ', $s['full_name'])[0]);
    $event = Util::e($e['name']);
    $html = "<div style=\"font-family:Arial,sans-serif;color:#3D3B36;max-width:480px\">"
        . "<p>Hola {$name},</p><p>Usa este código para confirmar tu firma en <strong>{$event}</strong>:</p>"
        . "<p style=\"font-size:32px;letter-spacing:8px;font-weight:bold;color:#161616\">{$code}</p>"
        . "<p>El código vence en {$ttl} minutos. Si no solicitaste esta firma, ignora este mensaje.</p></div>";
    $text = "Hola,\n\nTu código para confirmar la firma en {$e['name']} es: {$code}\nVence en {$ttl} minutos.";
    try {
        Mailer::fromSettings()->send($s['email'], $e['email_subject'], $html, $text);
    } catch (RuntimeException $err) {
        error_log('[animalista] código: ' . $err->getMessage());
        throw new HttpError(502, 'No pudimos enviar el código a tu correo. Inténtalo de nuevo en unos minutos.');
    }
}

const CAT_PATH = 'M20 186 L100 186 C108 186 110 178 104 176 C96 160 92 130 96 112 C84 108 74 96 74 82 C74 70 76 60 80 52 L84 34 L98 50 C104 48 112 48 118 50 L132 36 L132 56 C138 68 136 86 126 96 C140 104 156 124 158 150 C160 170 150 184 132 186 C160 188 186 180 188 160 C190 144 176 138 170 146';

/** Convierte la firma (PNG con transparencia) a JPEG sobre fondo blanco para el PDF. Requiere GD. */
function signature_jpeg(?string $dataUrl): ?string
{
    if (!$dataUrl || !function_exists('imagecreatefromstring')) return null;
    $png = base64_decode((string)substr($dataUrl, strpos($dataUrl, ',') + 1), true);
    $src = $png ? @imagecreatefromstring($png) : false;
    if (!$src) return null;
    $w = imagesx($src); $h = imagesy($src);
    $dst = imagecreatetruecolor($w, $h);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopy($dst, $src, 0, 0, 0, 0, $w, $h);
    ob_start();
    imagejpeg($dst, null, 90);
    return ob_get_clean() ?: null;
}

/** Comprobante en PDF (A4). */
function receipt_pdf(array $s, array $e): string
{
    $r = receipt_data($s, $e);
    $tz = app_config()['timezone'] ?? 'America/Bogota';
    $when = (new DateTime($s['verified_at'] . ' UTC'))->setTimezone(new DateTimeZone($tz))->format('d/m/Y H:i:s') . " ({$tz})";
    $pdf = new Pdf('Comprobante ' . $r['folio'], APP_AUTHOR);
    $x = 56; $w = Pdf::W - 2 * $x;

    $pdf->svgPath(CAT_PATH, $x - 4, 48, 0.24, '#161616', 2.2);
    $pdf->text($x + 60, 66, 'COMPROBANTE DE FIRMA VERIFICADA', 9, 'bold', '#2C4BFF');
    $y = $pdf->paragraph($x + 60, 88, $w - 60, $r['eventName'], 18, 'bold', '#161616', 1.25);
    if ($r['organization']) $y = $pdf->paragraph($x + 60, $y + 2, $w - 60, $r['organization'], 11, 'regular', '#6B6860');
    $y = max($y, 120) + 12;
    $pdf->line($x, $y, $x + $w, $y);
    $y += 30;

    $rows = [['Folio', $r['folio'], 'mono'], ['Firmante', $r['signer'], 'regular'], ['Documento', $r['document'], 'regular'], ['Verificada', $when, 'regular']];
    foreach ($rows as [$label, $value, $font]) {
        $pdf->text($x, $y, $label, 11, 'bold', '#161616');
        $pdf->text($x + 130, $y, (string)$value, 11, $font);
        $y += 24;
    }
    $pdf->text($x, $y, 'Huella SHA-256', 11, 'bold', '#161616');
    $pdf->text($x + 130, $y, substr((string)$r['hash'], 0, 32), 10, 'mono');
    $pdf->text($x + 130, $y + 14, substr((string)$r['hash'], 32), 10, 'mono');
    $y += 44;

    $boxH = 190;
    $pdf->rect($x, $y, $w, $boxH, '#FFFFFF', '#B9B6AD', [4, 3]);
    $jpg = signature_jpeg($s['signature_png']);
    if ($jpg) $pdf->jpeg($jpg, $x + 20, $y + 14, $w - 40, $boxH - 44);
    else $pdf->text($x + 20, $y + $boxH / 2, 'La imagen de la firma está guardada en el sistema.', 10, 'regular', '#6B6860');
    $label = 'Firma registrada';
    $pdf->text($x + ($w - Pdf::width($label, 9)) / 2, $y + $boxH - 12, $label, 9, 'regular', '#6B6860');
    $y += $boxH + 28;

    $y = $pdf->paragraph($x, $y, $w, 'La huella digital (SHA-256) se calculó al verificar el código enviado al correo del firmante e incluye sus datos y la imagen de la firma. Permite comprobar que el registro no fue alterado después de la verificación. El registro original se conserva en la plataforma del evento.', 9.5, 'regular', '#6B6860');

    $pdf->line($x, Pdf::H - 64, $x + $w, Pdf::H - 64);
    $pdf->text($x, Pdf::H - 46, 'Animalista · Plataforma de firmas', 8.5, 'bold', '#3D3B36');
    $gen = 'Generado el ' . (new DateTime('now', new DateTimeZone($tz)))->format('d/m/Y H:i');
    $pdf->text($x + $w - Pdf::width($gen, 8.5), Pdf::H - 46, $gen, 8.5, 'regular', '#6B6860');
    return $pdf->output();
}

function receipt_data(array $s, array $e): array
{
    return [
        'folio' => $s['folio'],
        'eventName' => $e['name'],
        'organization' => $e['organization'],
        'signer' => Util::maskName($s['full_name']),
        'document' => $s['doc_type'] . ' ••••' . substr($s['doc_number'], -3),
        'verifiedAt' => Util::iso($s['verified_at']),
        'hash' => $s['hash'],
        'signature' => $s['signature_png'],
    ];
}

return [
    ['GET', '/status', fn() => ['installed' => true, 'version' => APP_VERSION, 'siteName' => Db::setting('site_name', 'Animalista')]],

    ['GET', '/events/current', function () {
        $id = Db::setting('default_event');
        $e = $id ? Db::one("SELECT * FROM `#__events` WHERE id = ? AND status = 'published'", [$id]) : null;
        $e ??= Db::one("SELECT * FROM `#__events` WHERE status = 'published' ORDER BY created_at DESC LIMIT 1");
        if (!$e) throw new HttpError(404, 'No hay eventos publicados');
        return event_public($e);
    }],

    ['GET', '/events/{slug}', fn($p) => event_public(find_event_by_slug($p['slug']))],

    ['POST', '/events/{slug}/visit', function ($p) {
        $e = find_event_by_slug($p['slug']);
        Db::run('INSERT INTO `#__event_visits` (event_id, day, visits) VALUES (?, UTC_DATE(), 1) ON DUPLICATE KEY UPDATE visits = visits + 1', [$e['id']]);
        return ['ok' => true];
    }],

    // Paso 1: datos personales y autorización.
    ['POST', '/events/{slug}/signatures', function ($p) {
        $e = find_event_by_slug($p['slug']);
        assert_open($e);
        Http::rateLimit('start:' . Http::ip(), 30, 3600);
        $b = Http::body();
        $f = json_decode((string)$e['fields'], true) ?: event_default_fields();
        $opt = array_merge(event_default_fields()['optional'], $f['optional'] ?? []);

        if (empty($b['consentData'])) throw new HttpError(422, 'Debes autorizar el tratamiento de datos personales', ['field' => 'consentData']);
        $email = Http::str($b, 'email', 190, true);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new HttpError(422, 'Correo electrónico no válido', ['field' => 'email']);
        $docType = Http::str($b, 'docType', 40, true);
        $docNumber = preg_replace('/[^0-9A-Za-z]/', '', (string)Http::str($b, 'docNumber', 40, true));
        if (strlen($docNumber) < 4) throw new HttpError(422, 'Número de documento no válido', ['field' => 'docNumber']);

        $dup = Db::value("SELECT COUNT(*) FROM `#__signatures` WHERE event_id = ? AND doc_type = ? AND doc_number = ? AND status = 'verified'", [$e['id'], $docType, $docNumber]);
        if ($dup) throw new HttpError(409, 'Este documento ya firmó en esta convocatoria', ['field' => 'docNumber']);

        $birth = null;
        if ($opt['birth_date']) {
            $birth = Http::str($b, 'birthDate', 10, true);
            $ts = strtotime($birth);
            if (!$ts || $ts > strtotime('-14 years') || $ts < strtotime('-120 years')) throw new HttpError(422, 'Fecha de nacimiento no válida', ['field' => 'birthDate']);
            $birth = date('Y-m-d', $ts);
        }
        $extra = [];
        foreach (['education', 'disability'] as $k) if ($opt[$k]) $extra[$k] = Http::str($b, $k, 120);
        foreach ($f['custom'] ?? [] as $c) {
            $extra[$c['id']] = Http::str((array)($b['custom'] ?? []), $c['id'], 500, !empty($c['required']), $c['label']);
        }
        $pets = $opt['pets'] ? array_values(array_intersect((array)($b['pets'] ?? []), ['Perros', 'Gatos', 'Otros', 'Ninguno'])) : [];
        $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);

        $token = bin2hex(random_bytes(24));
        Db::insert('signatures', [
            'event_id' => $e['id'],
            'token' => $token,
            'full_name' => Http::str($b, 'fullName', 200, true),
            'doc_type' => $docType,
            'doc_number' => $docNumber,
            'email' => strtolower($email),
            'phone' => $opt['phone'] ? Http::str($b, 'phone', 40) : null,
            'birth_date' => $birth,
            'gender' => $opt['gender'] ? Http::str($b, 'gender', 40, true) : null,
            'municipality' => $opt['municipality'] ? Http::str($b, 'municipality', 120, true) : null,
            'zone' => $opt['zone'] ? (in_array($b['zone'] ?? '', ['Urbana', 'Rural'], true) ? $b['zone'] : throw new HttpError(422, 'Selecciona la zona de residencia', ['field' => 'zone'])) : null,
            'ethnic_group' => $opt['ethnic_group'] ? Http::str($b, 'ethnicGroup', 60) : null,
            'pets' => $pets ? implode(',', $pets) : null,
            'extra' => $extra ? json_encode($extra, JSON_UNESCAPED_UNICODE) : null,
            'consent_data' => 1,
            'consent_news' => !empty($b['consentNews']) ? 1 : 0,
            'device' => preg_match('/Mobi|Android|iPhone|iPad/i', $ua) ? 'mobile' : 'desktop',
            'ip' => Http::ip(),
            'user_agent' => $ua,
            'created_at' => Util::now(),
        ]);
        return ['token' => $token];
    }],

    // Paso 2: firma dibujada (PNG). Envía el código al correo.
    ['POST', '/signatures/{token}/sign', function ($p) {
        $s = find_signature($p['token']);
        if ($s['status'] === 'verified') throw new HttpError(409, 'Esta firma ya fue verificada');
        $e = signature_event($s);
        assert_open($e);
        $img = (string)(Http::body()['image'] ?? '');
        if (!preg_match('#^data:image/png;base64,([A-Za-z0-9+/=]+)$#', $img, $m)) throw new HttpError(422, 'Firma no válida');
        $bin = base64_decode($m[1], true);
        if ($bin === false || strlen($bin) > 600 * 1024 || substr($bin, 0, 8) !== "\x89PNG\r\n\x1a\n") throw new HttpError(422, 'La imagen de la firma no es válida');
        Db::update('signatures', ['signature_png' => $img, 'status' => 'signed', 'signed_at' => Util::now()], 'id = ?', [$s['id']]);
        send_code(find_signature($p['token']), $e);
        return ['ok' => true, 'email' => $s['email'], 'codeTtlMinutes' => (int)$e['code_ttl_minutes']];
    }],

    ['POST', '/signatures/{token}/resend', function ($p) {
        $s = find_signature($p['token']);
        if (!in_array($s['status'], ['pending_code', 'expired'], true)) throw new HttpError(409, 'Primero dibuja tu firma');
        $e = signature_event($s);
        assert_open($e);
        send_code($s, $e);
        return ['ok' => true];
    }],

    // Paso 3: verificación del código → folio y huella (hash).
    ['POST', '/signatures/{token}/verify', function ($p) {
        $s = find_signature($p['token']);
        $e = signature_event($s);
        if ($s['status'] === 'verified') return receipt_data($s, $e) + ['token' => $s['token']];
        if ($s['status'] !== 'pending_code') throw new HttpError(409, 'Solicita primero un código');
        if ((int)$s['code_attempts'] >= (int)$e['max_attempts']) throw new HttpError(429, 'Superaste los intentos permitidos. Solicita un nuevo código.');
        if (!$s['code_expires_at'] || strtotime($s['code_expires_at'] . ' UTC') < time()) {
            Db::update('signatures', ['status' => 'expired'], 'id = ?', [$s['id']]);
            throw new HttpError(410, 'El código venció. Solicita uno nuevo.');
        }
        $code = preg_replace('/\D/', '', (string)(Http::body()['code'] ?? ''));
        if (!password_verify($code, (string)$s['code_hash'])) {
            Db::run('UPDATE `#__signatures` SET code_attempts = code_attempts + 1 WHERE id = ?', [$s['id']]);
            $left = (int)$e['max_attempts'] - (int)$s['code_attempts'] - 1;
            throw new HttpError(422, $left > 0 ? "Código incorrecto. Te quedan {$left} intentos." : 'Código incorrecto. Solicita un nuevo código.');
        }
        $dup = Db::value("SELECT COUNT(*) FROM `#__signatures` WHERE event_id = ? AND doc_type = ? AND doc_number = ? AND status = 'verified'", [$e['id'], $s['doc_type'], $s['doc_number']]);
        if ($dup) throw new HttpError(409, 'Este documento ya firmó en esta convocatoria');

        $verifiedAt = Util::now();
        $folio = 'AN-' . str_pad((string)$s['id'], 6, '0', STR_PAD_LEFT);
        $hash = hash('sha256', json_encode([
            'event' => (int)$e['id'], 'folio' => $folio, 'name' => $s['full_name'], 'docType' => $s['doc_type'],
            'doc' => $s['doc_number'], 'email' => $s['email'], 'verifiedAt' => $verifiedAt,
            'signature' => hash('sha256', (string)$s['signature_png']),
        ], JSON_UNESCAPED_UNICODE));
        Db::update('signatures', ['status' => 'verified', 'folio' => $folio, 'hash' => $hash, 'verified_at' => $verifiedAt, 'code_hash' => null], 'id = ?', [$s['id']]);
        $s = find_signature($p['token']);

        if ($e['send_receipt']) {
            $url = Util::baseUrl() . '/comprobante/' . $s['token'];
            $ev = Util::e($e['name']);
            $html = "<div style=\"font-family:Arial,sans-serif;color:#3D3B36;max-width:520px\">"
                . "<h2 style=\"color:#161616\">¡Gracias! Tu firma quedó registrada</h2>"
                . "<p>Evento: <strong>{$ev}</strong></p><p>Folio: <strong>{$folio}</strong><br>Verificada: " . date('Y-m-d H:i', strtotime($verifiedAt . ' UTC')) . "</p>"
                . "<p style=\"font-family:monospace;font-size:12px;word-break:break-all\">Huella (SHA-256): {$hash}</p>"
                . "<p>Adjuntamos el comprobante en PDF. También puedes <a href=\"{$url}\">verlo en línea</a>.</p></div>";
            try {
                Mailer::fromSettings()->send($s['email'], 'Comprobante de tu firma · ' . $folio, $html, "Folio: {$folio}\nHuella: {$hash}\nComprobante: {$url}",
                    [['name' => "comprobante-{$folio}.pdf", 'mime' => 'application/pdf', 'data' => receipt_pdf($s, $e)]]);
            } catch (Throwable $err) {
                error_log('[animalista] comprobante: ' . $err->getMessage());
            }
        }
        return receipt_data($s, $e) + ['token' => $s['token']];
    }],

    ['GET', '/receipts/{token}/pdf', function ($p) {
        $s = find_signature($p['token']);
        if ($s['status'] !== 'verified') throw new HttpError(404, 'Comprobante no disponible');
        $pdf = receipt_pdf($s, signature_event($s));
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="comprobante-' . $s['folio'] . '.pdf"');
        header('Content-Length: ' . strlen($pdf));
        header('Cache-Control: private, no-store');
        echo $pdf;
        exit;
    }],

    ['GET', '/receipts/{token}', function ($p) {
        $s = find_signature($p['token']);
        if ($s['status'] !== 'verified') throw new HttpError(404, 'Comprobante no disponible');
        return receipt_data($s, signature_event($s));
    }],
];
