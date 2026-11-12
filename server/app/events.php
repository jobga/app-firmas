<?php
/** Serialización y validación de eventos. — © Jonnathan Bucheli Galindo */

const OPTIONAL_FIELDS = [
    'phone' => 'Celular',
    'birth_date' => 'Fecha de nacimiento',
    'gender' => 'Género',
    'municipality' => 'Departamento y municipio',
    'zone' => 'Zona urbana / rural',
    'ethnic_group' => 'Grupo étnico',
    'pets' => 'Convivencia con animales',
    'education' => 'Nivel educativo',
    'disability' => 'Discapacidad',
];

const DEFAULT_COLORS = [
    // Página
    'bg' => '#F7F6F2', 'title' => '#161616', 'text' => '#3D3B36', 'button' => '#2C4BFF',
    // Formulario
    'formBg' => '#FFFFFF', 'formTitle' => '#161616', 'formText' => '#3D3B36', 'fieldBg' => '#FFFFFF', 'fieldBorder' => '#CFCCC4',
];

/** Colores del evento; los eventos anteriores a 1.4 heredan en el formulario los colores de títulos y texto de la página. */
function event_colors(array $e): array
{
    $stored = json_decode((string)$e['colors'], true) ?: [];
    $c = array_merge(DEFAULT_COLORS, $stored);
    if (!isset($stored['formTitle'])) $c['formTitle'] = $c['title'];
    if (!isset($stored['formText'])) $c['formText'] = $c['text'];
    return $c;
}
/** {politica} se convierte en el enlace a la política de tratamiento de datos del evento. */
const DEFAULT_CONSENT_DATA = 'Autorizo de manera libre, previa, expresa e informada el tratamiento de mis datos personales según la Ley 1581 de 2012 y la {politica} del evento.';
const DEFAULT_CONSENT_NEWS = 'Acepto recibir información sobre los resultados de esta convocatoria.';
const DEFAULT_THANKS_TITLE = '¡Gracias! Tu firma quedó registrada';
const DEFAULT_THANKS_MESSAGE = 'Recibirás en tu correo el comprobante con el folio, la fecha, la hora y la huella digital (hash) de tu firma.';

/** Texto de autorización de datos tal como lo lee el firmante (sin el marcador {politica}). */
function consent_data_plain(array $e): string
{
    $t = trim((string)($e['consent_data_text'] ?? '')) ?: DEFAULT_CONSENT_DATA;
    return str_replace('{politica}', 'Política de tratamiento de datos', $t);
}
const DEFAULT_MUNICIPALITIES = ['Pasto', 'Ipiales', 'Tumaco', 'Túquerres', 'Otro'];

/**
 * Campos de caracterización con lista de opciones editable por evento.
 * type: select (una opción en lista desplegable), radio (una opción en botones), multi (varias opciones).
 * En las listas de opción múltiple, «Ninguno»/«Ninguna» es excluyente.
 */
const LIST_FIELDS = [
    'gender' => ['label' => 'Género', 'type' => 'select', 'options' => ['Femenino', 'Masculino', 'No binario', 'Prefiero no decir']],
    'zone' => ['label' => 'Zona urbana / rural', 'type' => 'radio', 'options' => ['Urbana', 'Rural']],
    'ethnic_group' => ['label' => 'Grupo étnico', 'type' => 'select', 'options' => ['Ninguno', 'Indígena', 'Afrocolombiano', 'Raizal', 'Palenquero', 'Rrom', 'Campesino']],
    'pets' => ['label' => 'Convivencia con animales', 'type' => 'multi', 'options' => ['Perros', 'Gatos', 'Otros', 'Ninguno']],
    'education' => ['label' => 'Nivel educativo', 'type' => 'select', 'options' => ['Primaria', 'Secundaria', 'Técnico o tecnólogo', 'Universitario', 'Posgrado', 'Ninguno']],
    'disability' => ['label' => 'Discapacidad', 'type' => 'select', 'options' => ['No', 'Física', 'Visual', 'Auditiva', 'Cognitiva', 'Psicosocial', 'Múltiple']],
];
const MAX_OPTIONS = 60;
const MAX_OPTION_LEN = 60;

/** Limpia una lista de opciones: recorta, quita vacías y duplicadas, limita cantidad y longitud. */
function clean_options(mixed $list, int $max = MAX_OPTIONS): array
{
    if (is_string($list)) $list = preg_split('/\R/u', $list);
    $out = [];
    foreach ((array)$list as $o) {
        if (!is_string($o) && !is_numeric($o)) continue;
        $o = mb_substr(trim(preg_replace('/[\x00-\x1F\x7F,]+/u', ' ', (string)$o)), 0, MAX_OPTION_LEN);
        if ($o !== '' && !in_array(mb_strtolower($o), array_map('mb_strtolower', $out), true)) $out[] = $o;
        if (count($out) >= $max) break;
    }
    return $out;
}

/** Opción excluyente de una lista múltiple («Ninguno», «Ninguna»). */
function is_exclusive_option(string $o): bool
{
    return (bool)preg_match('/^ningun[oa]s?$/iu', trim($o));
}

/** Aplica la regla de exclusividad y conserva solo valores de la lista. */
function pick_multi(mixed $values, array $options): array
{
    $sel = array_values(array_intersect($options, array_map('strval', array_filter((array)$values, 'is_scalar'))));
    foreach ($sel as $v) if (is_exclusive_option($v)) return [$v];
    return $sel;
}

function event_default_fields(): array
{
    $opt = array_fill_keys(array_keys(OPTIONAL_FIELDS), true);
    $opt['education'] = false;
    $opt['disability'] = false;
    return ['optional' => $opt, 'custom' => [], 'lists' => array_map(fn($d) => $d['options'], LIST_FIELDS), 'geo' => ['departments' => []]];
}

/** Campos del evento con valores por defecto para eventos creados en versiones anteriores. */
function event_fields(array $e): array
{
    $f = json_decode((string)$e['fields'], true) ?: event_default_fields();
    $f['optional'] = array_merge(event_default_fields()['optional'], array_map('boolval', (array)($f['optional'] ?? [])));
    $lists = [];
    foreach (LIST_FIELDS as $k => $def) {
        $lists[$k] = clean_options($f['lists'][$k] ?? null) ?: $def['options'];
    }
    $f['lists'] = $lists;
    if (!isset($f['geo']) || !is_array($f['geo'])) {
        // Eventos anteriores a 1.3: su lista de municipios era de Nariño.
        $legacy = json_decode((string)($e['municipalities'] ?? ''), true) ?: DEFAULT_MUNICIPALITIES;
        $f['geo'] = ['departments' => array_diff($legacy, DEFAULT_MUNICIPALITIES) ? [] : ['52']];
    }
    $f['geo']['departments'] = geo_clean_departments($f['geo']['departments'] ?? []);
    $custom = [];
    foreach ((array)($f['custom'] ?? []) as $c) {
        if (!is_array($c) || empty($c['id'])) continue;
        $type = in_array($c['type'] ?? 'text', ['text', 'select', 'multi'], true) ? ($c['type'] ?? 'text') : 'text';
        $custom[] = ['id' => $c['id'], 'label' => (string)$c['label'], 'required' => !empty($c['required']), 'type' => $type,
            'options' => $type === 'text' ? [] : clean_options($c['options'] ?? [])];
    }
    $f['custom'] = $custom;
    return $f;
}

function event_public(array $e): array
{
    $fields = event_fields($e);
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
        'showDates' => (bool)($e['show_dates'] ?? true),
        'goal' => $e['goal'] !== null ? (int)$e['goal'] : null,
        'showCount' => (bool)($e['show_count'] ?? true),
        'lineDrawings' => in_array($e['line_drawings'] ?? '', ['animated', 'static', 'hidden'], true) ? $e['line_drawings'] : 'animated',
        'colors' => event_colors($e),
        'logoUrl' => $e['logo_path'] ? $base . '/' . $e['logo_path'] : null,
        'backgroundUrl' => $e['background_path'] ? $base . '/' . $e['background_path'] : null,
        'banner' => !empty($e['banner_path']) && !empty($e['banner_enabled'])
            ? ['url' => $base . '/' . $e['banner_path'], 'position' => $e['banner_position'] === 'above' ? 'above' : 'below', 'alt' => (string)$e['banner_alt']]
            : null,
        'consentDataText' => trim((string)($e['consent_data_text'] ?? '')) ?: DEFAULT_CONSENT_DATA,
        'consentNewsEnabled' => (bool)($e['consent_news_enabled'] ?? true),
        'consentNewsText' => trim((string)($e['consent_news_text'] ?? '')) ?: DEFAULT_CONSENT_NEWS,
        'thanks' => [
            'enabled' => (bool)($e['thanks_enabled'] ?? true),
            // null = texto predeterminado (el navegador lo adapta según se envíe o no el comprobante).
            'title' => trim((string)($e['thanks_title'] ?? '')) ?: null,
            'message' => trim((string)($e['thanks_message'] ?? '')) ?: null,
        ],
        'fields' => $fields,
        'municipalities' => json_decode((string)$e['municipalities'], true) ?: DEFAULT_MUNICIPALITIES,
        'codeTtlMinutes' => (int)$e['code_ttl_minutes'],
        'requireEmailCode' => (bool)($e['require_email_code'] ?? true),
        'sendReceipt' => (bool)$e['send_receipt'],
        'isOpen' => $open,
        // Si el evento oculta el contador, la API pública tampoco lo revela.
        'verifiedCount' => !empty($e['show_count']) || !array_key_exists('show_count', $e) ? event_verified_count($e) : null,
    ];
}

function event_verified_count(array $e): int
{
    return (int)Db::value("SELECT COUNT(*) FROM `#__signatures` WHERE event_id = ? AND status = 'verified'", [$e['id']]);
}

function event_admin(array $e): array
{
    return ['verifiedCount' => event_verified_count($e)] + event_public($e) + [
        'maxAttempts' => (int)$e['max_attempts'],
        'bannerUrl' => !empty($e['banner_path']) ? app_base_path() . '/' . $e['banner_path'] : null,
        'bannerEnabled' => (bool)($e['banner_enabled'] ?? true),
        'bannerPosition' => ($e['banner_position'] ?? 'below') === 'above' ? 'above' : 'below',
        'bannerAlt' => (string)($e['banner_alt'] ?? ''),
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
        $type = in_array($c['type'] ?? 'text', ['text', 'select', 'multi'], true) ? ($c['type'] ?? 'text') : 'text';
        $options = $type === 'text' ? [] : clean_options($c['options'] ?? []);
        if ($type !== 'text' && count($options) < 2) {
            throw new HttpError(422, "El campo «" . mb_substr($label, 0, 80) . "» necesita al menos 2 opciones", ['field' => 'custom']);
        }
        $custom[] = ['id' => $id, 'label' => mb_substr($label, 0, 80), 'required' => (bool)($c['required'] ?? false), 'type' => $type, 'options' => $options];
    }
    $lists = [];
    foreach (LIST_FIELDS as $k => $def) {
        $opts = clean_options($b['fields']['lists'][$k] ?? $def['options']);
        if ($optional[$k] && count($opts) < 2) throw new HttpError(422, "La lista «{$def['label']}» necesita al menos 2 opciones", ['field' => 'lists']);
        $lists[$k] = $opts ?: $def['options'];
    }
    $geo = ['departments' => geo_clean_departments($b['fields']['geo']['departments'] ?? [])];

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
    // Si el campo no llega, se conserva el valor actual (así una petición antigua no borra ajustes nuevos).
    $flag = fn(string $key, string $col, int $default = 1) => array_key_exists($key, $b) ? (!empty($b[$key]) ? 1 : 0) : (int)($current[$col] ?? $default);
    $text = function (string $key, string $col, int $max, string $default) use ($b, $current) {
        if (!array_key_exists($key, $b)) return $current[$col] ?? null;
        $v = trim((string)$b[$key]);
        if (mb_strlen($v) > $max) throw new HttpError(422, 'El texto es demasiado largo', ['field' => $key]);
        return $v === '' || $v === $default ? null : $v; // null = texto predeterminado
    };
    $thanksTitle = $text('thanksTitle', 'thanks_title', 255, DEFAULT_THANKS_TITLE);
    return [
        'show_dates' => $flag('showDates', 'show_dates'),
        'show_count' => $flag('showCount', 'show_count'),
        'line_drawings' => array_key_exists('lineDrawings', $b) ? $in($b['lineDrawings'], ['animated', 'static', 'hidden'], 'animated') : ($current['line_drawings'] ?? 'animated'),
        'banner_enabled' => $flag('bannerEnabled', 'banner_enabled'),
        'banner_position' => array_key_exists('bannerPosition', $b) ? $in($b['bannerPosition'], ['above', 'below'], 'below') : ($current['banner_position'] ?? 'below'),
        'banner_alt' => array_key_exists('bannerAlt', $b) ? Http::str($b, 'bannerAlt', 255) : ($current['banner_alt'] ?? null),
        'consent_data_text' => $text('consentDataText', 'consent_data_text', 2000, DEFAULT_CONSENT_DATA),
        'consent_news_enabled' => $flag('consentNewsEnabled', 'consent_news_enabled'),
        'consent_news_text' => $text('consentNewsText', 'consent_news_text', 1000, DEFAULT_CONSENT_NEWS),
        'thanks_enabled' => $flag('thanksEnabled', 'thanks_enabled'),
        'thanks_title' => $thanksTitle,
        'thanks_message' => $text('thanksMessage', 'thanks_message', 2000, DEFAULT_THANKS_MESSAGE),
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
        'fields' => json_encode(['optional' => $optional, 'custom' => $custom, 'lists' => $lists, 'geo' => $geo], JSON_UNESCAPED_UNICODE),
        'municipalities' => json_encode($munis ?: DEFAULT_MUNICIPALITIES, JSON_UNESCAPED_UNICODE),
        'code_ttl_minutes' => $in((int)($b['codeTtlMinutes'] ?? 10), [5, 10, 15], 10),
        'max_attempts' => $in((int)($b['maxAttempts'] ?? 3), [3, 5], 3),
        'require_email_code' => array_key_exists('requireEmailCode', $b) ? (!empty($b['requireEmailCode']) ? 1 : 0) : (int)($current['require_email_code'] ?? 1),
        'email_subject' => Http::str($b, 'emailSubject', 255) ?? 'Tu código para confirmar la firma',
        'send_receipt' => !empty($b['sendReceipt']) ? 1 : 0,
    ];
}
