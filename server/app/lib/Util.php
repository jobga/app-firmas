<?php
/** Utilidades varias. — © Jonnathan Bucheli Galindo */
final class Util
{
    public static function now(): string { return gmdate('Y-m-d H:i:s'); }

    public static function iso(?string $utc): ?string
    {
        return $utc ? gmdate('c', strtotime($utc . ' UTC')) : null;
    }

    public static function slugify(string $s): string
    {
        $s = strtolower(trim(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s));
        $s = preg_replace('/[^a-z0-9]+/', '-', $s);
        return trim(substr($s, 0, 80), '-') ?: 'evento';
    }

    public static function baseUrl(): string
    {
        $configured = Db::setting('site_url');
        if ($configured) return rtrim($configured, '/');
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }

    public static function maskName(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        $first = $parts[0] ?? '';
        $initial = isset($parts[1]) ? mb_substr($parts[1], 0, 1) . '.' : '';
        return trim("$first $initial") . ' •••';
    }

    public static function e(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
}
