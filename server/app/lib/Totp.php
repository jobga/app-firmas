<?php
/** TOTP (RFC 6238) compatible con Google/Microsoft Authenticator y Authy. — © Jonnathan Bucheli Galindo */
final class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function secret(int $bytes = 20): string
    {
        return self::base32Encode(random_bytes($bytes));
    }

    public static function uri(string $secret, string $account, string $issuer): string
    {
        return 'otpauth://totp/' . rawurlencode($issuer . ':' . $account)
            . '?secret=' . $secret . '&issuer=' . rawurlencode($issuer) . '&algorithm=SHA1&digits=6&period=30';
    }

    public static function code(string $secret, int $counter): string
    {
        $key = self::base32Decode($secret);
        $hash = hash_hmac('sha1', pack('N*', 0, $counter), $key, true);
        $offset = ord($hash[19]) & 0x0f;
        $bin = ((ord($hash[$offset]) & 0x7f) << 24) | (ord($hash[$offset + 1]) << 16) | (ord($hash[$offset + 2]) << 8) | ord($hash[$offset + 3]);
        return str_pad((string)($bin % 1000000), 6, '0', STR_PAD_LEFT);
    }

    /**
     * Acepta ±1 intervalo de 30 s para tolerar desfases de reloj.
     * Devuelve el contador del intervalo aceptado, o null. Con $lastCounter rechaza códigos ya usados.
     */
    public static function verify(string $secret, string $code, ?int $lastCounter = null): ?int
    {
        $code = preg_replace('/\D/', '', $code);
        if (strlen($code) !== 6) return null;
        $t = intdiv(time(), 30);
        foreach ([-1, 0, 1] as $d) {
            $counter = $t + $d;
            if ($lastCounter !== null && $counter <= $lastCounter) continue;
            if (hash_equals(self::code($secret, $counter), $code)) return $counter;
        }
        return null;
    }

    public static function base32Encode(string $data): string
    {
        $bits = '';
        foreach (str_split($data) as $c) $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
        $out = '';
        foreach (str_split($bits, 5) as $chunk) $out .= self::ALPHABET[bindec(str_pad($chunk, 5, '0'))];
        return $out;
    }

    public static function base32Decode(string $b32): string
    {
        $b32 = strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $b32));
        $bits = '';
        foreach (str_split($b32) as $c) $bits .= str_pad(decbin(strpos(self::ALPHABET, $c)), 5, '0', STR_PAD_LEFT);
        $out = '';
        foreach (str_split($bits, 8) as $byte) if (strlen($byte) === 8) $out .= chr(bindec($byte));
        return $out;
    }
}
