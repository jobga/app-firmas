#!/usr/bin/env bash
# Monta un servidor local parecido a Plesk (Apache + .htaccess, PHP 8.3, MariaDB) en Ubuntu/Debian
# y despliega el paquete de la plataforma en http://localhost:8080 listo para el asistente de instalación.
#
# Uso (como root):  bash scripts/setup-local-server.sh
# Variables opcionales: DB_NAME, DB_USER, DB_PASS, PORT, WEB_ROOT
#
# Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
set -euo pipefail
DB_NAME="${DB_NAME:-animalista}"
DB_USER="${DB_USER:-animalista}"
DB_PASS="${DB_PASS:-Firmas#2026}"
PORT="${PORT:-8080}"
WEB_ROOT="${WEB_ROOT:-/var/www/animalista}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Instalando Apache, PHP y MariaDB"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq apache2 libapache2-mod-php php-mysql php-mbstring php-gd php-curl mariadb-server unzip >/dev/null

echo "→ Iniciando MariaDB"
mkdir -p /run/mysqld && chown mysql:mysql /run/mysqld
if ! mysqladmin ping --silent 2>/dev/null; then
  (service mariadb start || (mysqld_safe >/dev/null 2>&1 &)) >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do mysqladmin ping --silent 2>/dev/null && break; sleep 1; done
fi
mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "→ Generando el paquete"
cd "$REPO"
[ -d node_modules ] || npm install --silent
npm run package --silent

echo "→ Desplegando en ${WEB_ROOT}"
rm -rf "$WEB_ROOT" && mkdir -p "$WEB_ROOT"
unzip -q "$REPO"/release/animalista-firmas-*.zip -d "$WEB_ROOT"
chown -R www-data:www-data "$WEB_ROOT"

echo "→ Configurando Apache en el puerto ${PORT}"
cat > /etc/apache2/sites-available/animalista.conf <<CONF
Listen ${PORT}
<VirtualHost *:${PORT}>
    ServerName localhost
    DocumentRoot ${WEB_ROOT}
    <Directory ${WEB_ROOT}>
        AllowOverride All
        Require all granted
    </Directory>
    ErrorLog \${APACHE_LOG_DIR}/animalista-error.log
    CustomLog \${APACHE_LOG_DIR}/animalista-access.log combined
</VirtualHost>
CONF
a2enmod -q rewrite headers >/dev/null
a2ensite -q animalista >/dev/null
apache2ctl -k graceful 2>/dev/null || apache2ctl start

echo
echo "Listo. Abre http://localhost:${PORT}/ para el asistente de instalación."
echo "Base de datos: ${DB_NAME} · usuario: ${DB_USER} · servidor: 127.0.0.1"
