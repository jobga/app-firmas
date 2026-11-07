<?php
/** Sesiones de administrador con contraseña + TOTP. — © Jonnathan Bucheli Galindo */
final class Auth
{
    public const MAX_FAILED = 5;
    public const LOCK_MINUTES = 15;

    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        session_name('animalista_sid');
        session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Strict']);
        session_start();
    }

    /** Administrador con sesión completa (contraseña + 2FA). */
    public static function admin(): array
    {
        self::start();
        $id = $_SESSION['admin_id'] ?? null;
        if (!$id || empty($_SESSION['mfa_ok'])) throw new HttpError(401, 'Sesión no iniciada');
        if (time() - ($_SESSION['seen'] ?? 0) > 60 * 60 * 8) { session_destroy(); throw new HttpError(401, 'La sesión expiró'); }
        $_SESSION['seen'] = time();
        $a = Db::one('SELECT id, name, email, totp_enabled FROM `#__admins` WHERE id = ?', [$id]);
        if (!$a) throw new HttpError(401, 'Sesión no válida');
        return $a;
    }

    /** Administrador que pasó la contraseña pero aún no el 2FA. */
    public static function pending(): array
    {
        self::start();
        $id = $_SESSION['pending_admin_id'] ?? null;
        if (!$id || time() - ($_SESSION['pending_at'] ?? 0) > 600) throw new HttpError(401, 'Vuelve a ingresar tu contraseña');
        $a = Db::one('SELECT * FROM `#__admins` WHERE id = ?', [$id]);
        if (!$a) throw new HttpError(401, 'Sesión no válida');
        return $a;
    }

    public static function complete(int $adminId): void
    {
        session_regenerate_id(true);
        unset($_SESSION['pending_admin_id'], $_SESSION['pending_at']);
        $_SESSION['admin_id'] = $adminId;
        $_SESSION['mfa_ok'] = true;
        $_SESSION['seen'] = time();
        Db::update('admins', ['last_login_at' => gmdate('Y-m-d H:i:s'), 'failed_attempts' => 0, 'locked_until' => null], 'id = ?', [$adminId]);
    }

    /** @return array{plain: string[], hashed: string[]} */
    public static function recoveryCodes(): array
    {
        $plain = [];
        for ($i = 0; $i < 10; $i++) {
            $c = strtoupper(bin2hex(random_bytes(5)));
            $plain[] = substr($c, 0, 5) . '-' . substr($c, 5);
        }
        return ['plain' => $plain, 'hashed' => array_map(fn($c) => password_hash($c, PASSWORD_DEFAULT), $plain)];
    }
}
