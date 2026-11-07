<?php
/** Utilidades HTTP/JSON. — © Jonnathan Bucheli Galindo */
final class HttpError extends RuntimeException
{
    public function __construct(public int $status, string $message, public ?array $extra = null)
    {
        parent::__construct($message);
    }
}

final class Http
{
    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function body(): array
    {
        static $body = null;
        if ($body === null) {
            $raw = file_get_contents('php://input') ?: '';
            $body = $raw === '' ? [] : json_decode($raw, true);
            if (!is_array($body)) throw new HttpError(400, 'JSON inválido');
        }
        return $body;
    }

    private const LABELS = [
        'fullName' => 'Nombres y apellidos', 'docType' => 'Tipo de documento', 'docNumber' => 'Número de documento',
        'email' => 'Correo electrónico', 'phone' => 'Celular', 'birthDate' => 'Fecha de nacimiento', 'gender' => 'Género',
        'municipality' => 'Municipio', 'ethnicGroup' => 'Grupo étnico', 'name' => 'Nombre', 'description' => 'Descripción',
    ];

    public static function str(array $src, string $key, int $max = 255, bool $required = false, ?string $label = null): ?string
    {
        $label ??= self::LABELS[$key] ?? $key;
        $v = isset($src[$key]) && is_scalar($src[$key]) ? trim((string)$src[$key]) : '';
        if ($v === '') {
            if ($required) throw new HttpError(422, "El campo «{$label}» es obligatorio", ['field' => $key]);
            return null;
        }
        if (mb_strlen($v) > $max) throw new HttpError(422, "El campo «{$label}» es demasiado largo", ['field' => $key]);
        return $v;
    }

    public static function ip(): string
    {
        return substr($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', 0, 45);
    }

    /** Límite simple por cubeta (IP, correo…) guardado en BD. */
    public static function rateLimit(string $bucket, int $max, int $windowSeconds): void
    {
        $now = gmdate('Y-m-d H:i:s');
        $row = Db::one('SELECT hits, reset_at FROM `#__rate_limits` WHERE bucket = ?', [$bucket]);
        if (!$row || $row['reset_at'] < $now) {
            Db::run('REPLACE INTO `#__rate_limits` (bucket, hits, reset_at) VALUES (?, 1, ?)', [$bucket, gmdate('Y-m-d H:i:s', time() + $windowSeconds)]);
            return;
        }
        if ((int)$row['hits'] >= $max) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
        Db::run('UPDATE `#__rate_limits` SET hits = hits + 1 WHERE bucket = ?', [$bucket]);
    }
}
