# Animalista · Plataforma de firmas

Plataforma web para recoger firmas verificadas por correo, con caracterización de firmantes, panel de analítica y **asistente de instalación para Plesk** (al estilo de WordPress).

**Autor: Jonnathan Bucheli Galindo** · © Jonnathan Bucheli Galindo. Todos los derechos reservados. Ver [AUTHORS.md](AUTHORS.md) y [LICENSE.md](LICENSE.md).

## Qué incluye

| Ruta | Pantalla |
| --- | --- |
| `/` y `/firma/<enlace>` | Registro público: datos → firma dibujada → código de 6 dígitos por correo → comprobante |
| `/comprobante/<token>` | Comprobante imprimible (folio, fecha, huella SHA-256 y firma) |
| `/admin/acceso` | Acceso de administrador con contraseña y verificación en dos pasos (QR TOTP + códigos de recuperación) |
| `/admin` | Analítica: indicadores, registros por día, embudo, caracterización y últimos registros |
| `/admin/eventos` | Lista y configuración de eventos con vista previa en vivo, logo, fondo, colores, campos y QR del enlace |
| `/admin/ajustes` | Plataforma, correo SMTP, contraseña, códigos de recuperación y administradores |
| `/install/` | Asistente de instalación |

Seguridad: contraseñas con `password_hash`, 2FA obligatorio, bloqueo de 15 min tras 5 intentos, límites por IP, cookies `HttpOnly` + `SameSite=Strict`, cabecera anti-CSRF, carpetas `app/` y `config/` bloqueadas, `uploads/` sin ejecución de scripts, validación de imágenes y SVG, exportación CSV protegida contra inyección de fórmulas.

## Requisitos del hosting

- PHP 8.1 o superior con `pdo_mysql`, `openssl`, `mbstring`, `fileinfo`
- MySQL 5.7+ o MariaDB 10.3+
- Apache (con `mod_rewrite`) o nginx + Apache de Plesk. En Plesk para Windows (IIS) se incluye `web.config`.
- Se instala en la raíz de un dominio o subdominio (p. ej. `https://firmas.tudominio.org`).

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

La batería de pruebas de extremo a extremo instala la plataforma desde cero con el asistente y recorre el panel, la firma pública, la seguridad, la exportación y el diseño en celular (44 pruebas). Necesita una base de datos **vacía** y Playwright con Chromium. Levanta su propio SMTP de prueba en el puerto 2525 para leer los códigos.

```bash
BASE_URL=http://localhost:8080 DB_NAME=animalista DB_USER=animalista DB_PASS='Firmas#2026' npm run test:e2e
```

Las capturas quedan en `test-results/`.

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
```
