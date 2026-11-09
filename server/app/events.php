<?php
/** Serialización y validación de eventos. — © Jonnathan Bucheli Galindo */

const OPTIONAL_FIELDS = [
    'phone' => 'Celular',
    'birth_date' => 'Fecha de nacimiento',
    'gender' => 'Género',
    'municipality' => 'Municipio',
    'zone' => 'Zona urbana / rural',
    'ethnic_group' => 'Grupo étnico',
    'pets' => 'Convivencia con animales',
    'education' => 'Nivel educativo',
    'disability' => 'Discapacidad',
];

const DEFAULT_COLORS = ['bg' => '#F7F6F2', 'title' => '#161616', 'text' => '#3D3B36', 'button' => '#2C4BFF'];
const DEFAULT_MUNICIPALITIES = ['Pasto', 'Ipiales', 'Tumaco', 'Túquerres', 'Otro'];

function event_default_fields(): array
{
    $opt = array_fill_keys(array_keys(OPTIONAL_FIELDS), true);
    $opt['education'] = false;
    $opt['disability'] = false;
    return ['optional' => $opt, 'custom' => []];
}

function event_public(array $e): array
{
    $fields = json_decode((string)$e['fields'], true) ?: event_default_fields();
    $fields['optional'] = array_merge(event_default_fields()['optional'], $fields['optional'] ?? []);
    $now = gmdate('Y-m-d H:i:s');
    $open = $e['status'] === 'published'
        && (!$e['opens_at'] || $e['opens_at'] <= $now)
        && (!$e['closes_at'] || $e['closes_at'] > $now);
    $base = app_base_path();
    return [
        'id' => (int)$e['id'],
        'slug' => $e['slug'],
        'status' => $e['status'],
        'name' => $e['name'],
        'description' => (string)$e['description'],
        'organization' => (string)$e['organization'],
        'policyUrl' => (string)$e['policy_url'],
        'opensAt' => Util::iso($e['opens_at']),
        'closesAt' => Util::iso($e['closes_at']),
        'goal' => $e['goal'] !== null ? (int)$e['goal'] : null,
        'colors' => array_merge(DEFAULT_COLORS, json_decode((string)$e['colors'], true) ?: []),
        'logoUrl' => $e['logo_path'] ? $base . '/' . $e['logo_path'] : null,
        'backgroundUrl' => $e['background_path'] ? $base . '/' . $e['background_path'] : null,
        'fields' => $fields,
        'municipalities' => json_decode((string)$e['municipalities'], true) ?: DEFAULT_MUNICIPALITIES,
        'codeTtlMinutes' => (int)$e['code_ttl_minutes'],
        'requireEmailCode' => (bool)($e['require_email_code'] ?? true),
        'sendReceipt' => (bool)$e['send_receipt'],
        'isOpen' => $open,
        'verifiedCount' => (int)Db::value("SELECT COUNT(*) FROM `#__signatures` WHERE event_id = ? AND status = 'verified'", [$e['id']]),
    ];
}

function event_admin(array $e): array
{
    return event_public($e) + [
        'maxAttempts' => (int)$e['max_attempts'],
        'emailSubject' => $e['email_subject'],
        'createdAt' => Util::iso($e['created_at']),
        'updatedAt' => Util::iso($e['updated_at']),
    ];
}

function event_from_input(array $b, ?array $current = null): array
{
    $hex = fn($v, $d) => is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v) ? strtoupper($v) : $d;
    $colors = [];
    foreach (DEFAULT_COLORS as $k => $d) $colors[$k] = $hex($b['colors'][$k] ?? null, $d);

    $optional = [];
    foreach (event_default_fields()['optional'] as $k => $d) $optional[$k] = (bool)($b['fields']['optional'][$k] ?? $d);
    $custom = [];
    foreach (array_slice((array)($b['fields']['custom'] ?? []), 0, 10) as $c) {
        $label = is_array($c) ? trim((string)($c['label'] ?? '')) : '';
        if ($label === '') continue;
        $id = preg_match('/^[a-z0-9_]{1,30}$/', (string)($c['id'] ?? '')) ? $c['id'] : 'c_' . bin2hex(random_bytes(3));
        $custom[] = ['id' => $id, 'label' => mb_substr($label, 0, 80), 'required' => (bool)($c['required'] ?? false)];
    }

    $munis = array_values(array_filter(array_map(fn($m) => mb_substr(trim((string)$m), 0, 120), (array)($b['municipalities'] ?? DEFAULT_MUNICIPALITIES))));

    $date = function ($v) {
        if (!is_string($v) || $v === '') return null;
        $ts = strtotime($v);
        if ($ts === false) throw new HttpError(422, 'Fecha inválida');
        return gmdate('Y-m-d H:i:s', $ts);
    };
    $name = Http::str($b, 'name', 255, true);
    $slug = Util::slugify(Http::str($b, 'slug', 120) ?? $name);
    $policy = Http::str($b, 'policyUrl', 500);
    if ($policy && !filter_var($policy, FILTER_VALIDATE_URL)) throw new HttpError(422, 'El link de la política no es una URL válida', ['field' => 'policyUrl']);

    $in = fn($v, array $allowed, $d) => in_array($v, $allowed, true) ? $v : $d;
    return [
        'name' => $name,
        'slug' => $slug,
        'status' => $in($b['status'] ?? null, ['draft', 'published'], $current['status'] ?? 'draft'),
        'description' => Http::str($b, 'description', 5000),
        'organization' => Http::str($b, 'organization', 255),
        'policy_url' => $policy,
        'opens_at' => $date($b['opensAt'] ?? null),
        'closes_at' => $date($b['closesAt'] ?? null),
        'goal' => isset($b['goal']) && is_numeric($b['goal']) && $b['goal'] > 0 ? (int)$b['goal'] : null,
        'colors' => json_encode($colors),
        'fields' => json_encode(['optional' => $optional, 'custom' => $custom], JSON_UNESCAPED_UNICODE),
        'municipalities' => json_encode($munis ?: DEFAULT_MUNICIPALITIES, JSON_UNESCAPED_UNICODE),
        'code_ttl_minutes' => $in((int)($b['codeTtlMinutes'] ?? 10), [5, 10, 15], 10),
        'max_attempts' => $in((int)($b['maxAttempts'] ?? 3), [3, 5], 3),
        'require_email_code' => array_key_exists('requireEmailCode', $b) ? (!empty($b['requireEmailCode']) ? 1 : 0) : (int)($current['require_email_code'] ?? 1),
        'email_subject' => Http::str($b, 'emailSubject', 255) ?? 'Tu código para confirmar la firma',
        'send_receipt' => !empty($b['sendReceipt']) ? 1 : 0,
    ];
}
