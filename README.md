# Animalista · Plataforma de firmas

Plataforma web para recoger firmas verificadas por correo, con caracterización de firmantes, panel de analítica y **asistente de instalación para Plesk** (al estilo de WordPress).

**Autor: Jonnathan Bucheli Galindo** · © Jonnathan Bucheli Galindo. Todos los derechos reservados. Ver [AUTHORS.md](AUTHORS.md) y [LICENSE.md](LICENSE.md).

## Qué incluye

| Ruta | Pantalla |
| --- | --- |
| `/` y `/firma/<enlace>` | Registro público: datos → firma dibujada → código de 6 dígitos por correo → comprobante. El código por correo se puede desactivar en cada evento (*Eventos → Verificación y comprobante*); esas firmas quedan marcadas como «Sin código» |
| `/comprobante/<token>` | Comprobante en línea y en PDF (folio, fecha, huella SHA-256 y firma); el PDF también llega adjunto al correo |
| `/admin/acceso` | Acceso de administrador con contraseña y verificación en dos pasos (QR TOTP + códigos de recuperación), y «¿Olvidaste tu contraseña?» por correo |
| `/admin/restablecer/<token>` | Crear una contraseña nueva desde el enlace del correo (vence en 1 hora, un solo uso) |
| `/admin` | Analítica: indicadores, registros por día, embudo, caracterización y últimos registros |
| `/admin/eventos` | Lista y configuración de eventos con vista previa en vivo: logo, fondo, banner (encima o debajo de la descripción), colores de la página y del formulario, fechas de apertura y cierre (opcionales y visibles o no), campos, textos de autorización, mensaje de agradecimiento y QR del enlace. Cada evento ajusta en pestañas las opciones de sus listas (género, zona, grupo étnico, animales, nivel educativo, discapacidad y campos personalizados de lista u opción múltiple) y los departamentos permitidos |
| `/admin/ajustes` | Plataforma, correo SMTP, contraseña, códigos de recuperación y administradores |
| `/install/` | Asistente de instalación |

Seguridad: contraseñas con `password_hash`, 2FA obligatorio (un código TOTP no se acepta dos veces), bloqueo de 15 min tras 5 intentos, límites por IP, cookies `HttpOnly` + `SameSite=Strict`, cabecera anti-CSRF, carpetas `app/` y `config/` bloqueadas, `uploads/` sin ejecución de scripts, validación de imágenes y SVG, exportación CSV protegida contra inyección de fórmulas.

### Caracterización territorial

Departamento y municipio salen de la DIVIPOLA del DANE (33 departamentos y 1.122 municipios, distritos y áreas no municipalizadas, en `server/app/data/colombia.json`). El firmante elige el departamento y luego el municipio; el servidor valida que el municipio pertenezca al departamento y al alcance del evento, y la analítica agrupa por departamento y municipio. En las listas de opción múltiple, «Ninguno» o «Ninguna» desmarca las demás opciones.

## Requisitos del hosting

- PHP 8.1 o superior con `pdo_mysql`, `openssl`, `mbstring`, `fileinfo`
- MySQL 5.7+ o MariaDB 10.3+
- Apache (con `mod_rewrite`) o nginx + Apache de Plesk. En Plesk para Windows (IIS) se incluye `web.config`.
- Se instala en la raíz de un dominio, en un subdominio o en cualquier subdirectorio (ver «Dónde se puede instalar»).

## Instalación en Plesk (paso a paso)

1. **Genera el paquete** (o descárgalo ya generado):
   ```bash
   npm install
   ```
   ```bash
   npm run package
   ```
   Se crea `release/animalista-firmas-<versión>.zip`.
2. En Plesk, **Sitios web y dominios → tu dominio → PHP**: elige PHP 8.1 o superior.
3. **Bases de datos → Añadir base de datos**: crea una base de datos y un usuario (anota nombre, usuario y contraseña).
4. **Correo → Crear dirección de correo** (p. ej. `firmas@tudominio.org`) para enviar los códigos.
5. **Administrador de archivos**: entra a `httpdocs`, sube el ZIP y usa **Extraer archivos**.
6. **SSL/TLS Certificates**: activa Let's Encrypt para tener HTTPS.
7. Abre `https://tu-dominio/`: te llevará al asistente `/install/`, que:
   1. revisa los requisitos del servidor;
   2. prueba la conexión a la base de datos;
   3. crea la cuenta de administrador;
   4. configura y prueba el correo SMTP (opcional);
   5. crea las tablas y escribe `config/config.php`.
8. Al terminar, **elimina la carpeta `install/`** (el asistente ya queda bloqueado, pero es buena práctica).
9. Entra a `/admin/acceso`, escanea el QR con Google Authenticator, Microsoft Authenticator o Authy y guarda los códigos de recuperación.
10. En **Eventos**, edita el evento de ejemplo o crea uno nuevo y pulsa **Publicar evento**.

## Dónde se puede instalar

El mismo ZIP funciona sin cambios en cualquiera de estas ubicaciones; la plataforma detecta sola su carpeta:

| Ubicación | Ejemplo | En Plesk |
| --- | --- | --- |
| Raíz del dominio | `https://tudominio.org/` | Extrae el ZIP en `httpdocs` |
| Subdominio | `https://firmas.tudominio.org/` | *Sitios web y dominios → Añadir subdominio*; extrae el ZIP en la carpeta raíz del subdominio |
| Subdirectorio | `https://tudominio.org/firmas/` | Crea la carpeta `httpdocs/firmas` y extrae ahí el ZIP |
| Subdirectorio anidado | `https://tudominio.org/campanas/2026/` | Igual, en `httpdocs/campanas/2026` |

- Abre la dirección elegida: te llevará al asistente en `<dirección>/install/`.
- Puedes tener varias instalaciones en el mismo dominio, por ejemplo una por campaña. Cada una tiene su propia sesión de administrador, sus archivos y sus tablas. Pueden compartir la misma base de datos si usas un **prefijo de tablas distinto** para cada una (paso 2 del asistente).
- Si el sitio principal del dominio es otra aplicación (por ejemplo WordPress), el subdirectorio de la plataforma tiene su propio `.htaccess` y no interfiere con ella.

## Actualizar una instalación

1. Genera el paquete nuevo con `npm run package`, o descárgalo de la pestaña *Actions* de GitHub (artefacto `animalista-firmas-zip`).
2. Haz una copia de seguridad de la base de datos (Plesk: *Bases de datos → Exportar copia*) y de `config/` y `uploads/`.
3. Sube el ZIP a la carpeta de la instalación (`httpdocs`, o el subdirectorio o subdominio donde esté) y extráelo **sobrescribiendo** los archivos.
4. Elimina otra vez la carpeta `install/`.

**No elimines al actualizar** (el ZIP no los trae, así que extraerlo encima los conserva):

| Qué | Por qué |
| --- | --- |
| `config/config.php` | Conexión a la base de datos y clave de la instalación. Sin él la plataforma vuelve al asistente de instalación. |
| `uploads/` (incluida `uploads/events/`) | Logos, imágenes de fondo y banners de los eventos. |
| La base de datos y sus tablas (con su prefijo, p. ej. `an_`) | Eventos, firmas, administradores y ajustes. |

No borres la carpeta completa para «instalar limpio»: sube el ZIP encima. Si lo haces, restaura después `config/config.php` y `uploads/` desde la copia de seguridad.

La primera petición después de actualizar aplica sola los cambios pendientes de la base de datos (`server/app/migrations.php`), como hace WordPress. Los datos se conservan.

Para reinstalar: borra `config/config.php` (y las tablas, o usa otro prefijo) y vuelve a abrir `/install/`.

## Desarrollo local

```bash
npm install
```
```bash
npm run dev:php
```
```bash
npm run dev
```

`dev:php` levanta la API PHP en `127.0.0.1:8000` y Vite le pasa `/api`, `/install` y `/uploads`. Necesitas una base de datos MySQL/MariaDB local; abre `http://localhost:5173/install/` la primera vez.

## Servidor local y pruebas

Para montar en Ubuntu/Debian un servidor parecido a Plesk (Apache con `.htaccess`, PHP y MariaDB) y desplegar la plataforma en `http://localhost:8080`:

```bash
sudo bash scripts/setup-local-server.sh
```

En Windows o macOS puedes usar XAMPP o Laragon: copia el contenido de `release/animalista-firmas/` en la carpeta pública (`htdocs` o `www`), crea una base de datos en phpMyAdmin y abre el sitio en el navegador.

La batería de pruebas de extremo a extremo instala la plataforma desde cero con el asistente y recorre el panel, la firma pública, la seguridad, la exportación, la recuperación de contraseña y el diseño en celular (65 pruebas). Necesita una base de datos **vacía** y Playwright con Chromium. Levanta su propio SMTP de prueba en el puerto 2525 para leer los códigos.

```bash
BASE_URL=http://localhost:8080 DB_NAME=animalista DB_USER=animalista DB_PASS='Firmas#2026' npm run test:e2e
```

`BASE_URL` puede apuntar a un subdirectorio (`http://localhost:8080/firmas`) o a un subdominio, y `DB_PREFIX` permite probar varias instalaciones en la misma base de datos. Para servir el paquete en un subdirectorio sin Apache:

```bash
APP_BASE=/firmas php -S 127.0.0.1:8080 -t release/animalista-firmas scripts/dev-router.php
```

Las capturas quedan en `test-results/`.

En GitHub, el flujo `.github/workflows/pruebas.yml` corre lo mismo en cada push y pull request con PHP 8.1 (la versión mínima) y MariaDB, instalando la plataforma en la raíz, en `/firmas` y en `/campanas/2026`, y publica el ZIP listo para Plesk como artefacto.

## Estructura

```
src/                 Frontend React + TypeScript (Vite)
server/api/          API JSON (punto de entrada index.php)
server/app/          Núcleo PHP: base de datos, 2FA TOTP, correo SMTP, rutas, esquema
server/install/      Asistente de instalación
server/config/       config.php generado por el instalador (no se versiona)
server/uploads/      Logos e imágenes de fondo de los eventos
scripts/package.mjs  Empaquetado para Plesk
scripts/setup-local-server.sh  Servidor local Apache + PHP + MariaDB
tests/e2e.mjs        Pruebas de extremo a extremo
.github/workflows/   Integración continua
```
