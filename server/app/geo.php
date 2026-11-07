<?php
/**
 * Departamentos y municipios de Colombia (DANE · DIVIPOLA: municipios, distritos y áreas no municipalizadas).
 * Datos en app/data/colombia.json: [{code, name, municipalities: [[código, nombre], …]}, …]
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */

function geo_data(): array
{
    static $data = null;
    if ($data === null) {
        $raw = json_decode((string)file_get_contents(__DIR__ . '/data/colombia.json'), true);
        $data = [];
        foreach ($raw['departments'] ?? [] as $d) $data[$d['code']] = $d;
    }
    return $data;
}

/** Códigos de departamento válidos, sin duplicados y en el orden de la DIVIPOLA. */
function geo_clean_departments(mixed $codes): array
{
    $codes = array_map('strval', array_filter((array)$codes, 'is_scalar'));
    // array_keys() devuelve 52 (entero) para la clave "52": se normaliza a texto.
    return array_values(array_filter(array_map('strval', array_keys(geo_data())), fn($c) => in_array($c, $codes, true)));
}

/** Departamentos que puede elegir el firmante de un evento ([] = todo el país). */
function geo_allowed(array $fields): array
{
    $all = geo_data();
    $sel = $fields['geo']['departments'] ?? [];
    return $sel ? array_intersect_key($all, array_flip($sel)) : $all;
}

/** Versión ligera para el navegador: [{code, name, municipalities: [nombre, …]}]. */
function geo_public(): array
{
    return array_values(array_map(fn($d) => [
        'code' => (string)$d['code'], 'name' => $d['name'], 'municipalities' => array_map(fn($m) => $m[1], $d['municipalities']),
    ], geo_data()));
}

/**
 * Valida departamento + municipio contra la DIVIPOLA y el alcance del evento.
 * Acepta el departamento por código o nombre; si no llega y el municipio solo existe en un departamento permitido, lo deduce.
 * @return array{0:string,1:string} [nombre del departamento, nombre del municipio]
 */
function geo_resolve(array $fields, ?string $department, ?string $municipality): array
{
    $allowed = geo_allowed($fields);
    $key = fn(string $s) => mb_strtolower(trim($s));
    $municipality = trim((string)$municipality);
    $dep = null;
    if ($department !== null && trim($department) !== '') {
        foreach ($allowed as $code => $d) {
            if ((string)$code === trim($department) || $key($d['name']) === $key($department)) { $dep = $d; break; }
        }
        if (!$dep) throw new HttpError(422, 'Selecciona un departamento de la lista', ['field' => 'department']);
    }
    if ($municipality === '') throw new HttpError(422, 'Selecciona el municipio', ['field' => 'municipality']);
    $matches = [];
    foreach ($dep ? [$dep] : $allowed as $d) {
        foreach ($d['municipalities'] as [, $name]) {
            if ($key($name) === $key($municipality)) $matches[] = [$d['name'], $name];
        }
    }
    if (count($matches) === 1) return $matches[0];
    if (!$matches) throw new HttpError(422, 'El municipio no pertenece al departamento seleccionado', ['field' => 'municipality']);
    throw new HttpError(422, 'Selecciona el departamento', ['field' => 'department']);
}
