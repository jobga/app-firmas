<?php
/** Acceso a datos con PDO. `#__` = prefijo de tablas. — © Jonnathan Bucheli Galindo */
final class Db
{
    private static ?PDO $pdo = null;
    private static string $prefix = '';

    public static function connect(array $c): PDO
    {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], (int)($c['port'] ?? 3306), $c['name']);
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        $pdo->exec("SET time_zone = '+00:00'");
        return $pdo;
    }

    public static function init(array $c): void
    {
        self::$pdo = self::connect($c);
        self::$prefix = $c['prefix'] ?? '';
    }

    public static function pdo(): PDO
    {
        if (!self::$pdo) throw new RuntimeException('Base de datos no inicializada');
        return self::$pdo;
    }

    public static function sql(string $sql): string
    {
        return str_replace('#__', self::$prefix, $sql);
    }

    public static function run(string $sql, array $params = []): PDOStatement
    {
        $st = self::pdo()->prepare(self::sql($sql));
        $st->execute($params);
        return $st;
    }

    public static function all(string $sql, array $params = []): array { return self::run($sql, $params)->fetchAll(); }
    public static function one(string $sql, array $params = []): ?array { $r = self::run($sql, $params)->fetch(); return $r ?: null; }
    public static function value(string $sql, array $params = []): mixed { $v = self::run($sql, $params)->fetchColumn(); return $v === false ? null : $v; }

    public static function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $sql = sprintf('INSERT INTO `#__%s` (`%s`) VALUES (%s)', $table, implode('`,`', $cols), implode(',', array_fill(0, count($cols), '?')));
        self::run($sql, array_values($data));
        return (int) self::pdo()->lastInsertId();
    }

    public static function update(string $table, array $data, string $where, array $params = []): void
    {
        $set = implode(',', array_map(fn($c) => "`$c` = ?", array_keys($data)));
        self::run("UPDATE `#__$table` SET $set WHERE $where", [...array_values($data), ...$params]);
    }

    public static function setting(string $name, ?string $default = null): ?string
    {
        $v = self::value('SELECT `value` FROM `#__settings` WHERE `name` = ?', [$name]);
        return $v ?? $default;
    }

    public static function setSetting(string $name, ?string $value): void
    {
        self::run('INSERT INTO `#__settings` (`name`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)', [$name, $value]);
    }
}
