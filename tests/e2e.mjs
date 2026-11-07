/**
 * Pruebas de extremo a extremo: instalación, panel, firma pública, seguridad y exportación.
 *
 * Uso:
 *   BASE_URL=http://localhost:8080 DB_NAME=animalista DB_USER=animalista DB_PASS='...' node tests/e2e.mjs
 *
 * Requisitos: Playwright con Chromium. Las pruebas levantan un servidor SMTP de prueba en 127.0.0.1:2525
 * para leer los códigos enviados por correo, y el asistente de instalación se configura para usarlo.
 * Usa una base de datos vacía: el script instala la plataforma desde cero.
 *
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const DB = {
  host: process.env.DB_HOST ?? '127.0.0.1', port: process.env.DB_PORT ?? '3306',
  name: process.env.DB_NAME ?? 'animalista', user: process.env.DB_USER ?? 'animalista', pass: process.env.DB_PASS ?? '',
};
const SHOTS = process.env.SHOTS_DIR ?? 'test-results';
const ADMIN = { name: 'Jonnathan Bucheli Galindo', email: 'admin@example.com', pass: 'ClaveSegura2026' };
const H = { 'X-Requested-With': 'animalista' };
mkdirSync(SHOTS, { recursive: true });

// ---------- Mini arnés de pruebas ----------
const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✔ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, error: e.message });
    console.log(`  ✘ ${name}\n      ${e.message.split('\n')[0]}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const section = (t) => console.log(`\n${t}`);

// ---------- TOTP (RFC 6238) ----------
function totp(secret, offset = 0) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/\s/g, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[19] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

// ---------- Servidor SMTP de prueba ----------
const inbox = [];
function decodeMail(raw) {
  const m = raw.match(/Content-Type: text\/plain; charset=UTF-8\r?\nContent-Transfer-Encoding: base64\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/);
  return m ? Buffer.from(m[1].replace(/\s/g, ''), 'base64').toString('utf8') : raw;
}
const smtp = createServer((sock) => {
  let buf = '', data = false, msg = '', to = '';
  sock.write('220 sink\r\n');
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (data) {
        if (line === '.') { inbox.push({ to, text: decodeMail(msg) }); data = false; msg = ''; sock.write('250 ok\r\n'); }
        else msg += line + '\r\n';
        continue;
      }
      const u = line.toUpperCase();
      if (u.startsWith('RCPT TO:')) to = line.slice(8).replace(/[<>]/g, '').trim();
      if (u === 'DATA') { data = true; sock.write('354 go\r\n'); }
      else if (u === 'QUIT') { sock.end('221 bye\r\n'); }
      else sock.write('250 ok\r\n');
    }
  });
});
const lastCode = async (to) => {
  for (let i = 0; i < 40; i++) {
    const m = [...inbox].reverse().find((x) => x.to === to && /es: \d{6}/.test(x.text));
    if (m) return m.text.match(/es: (\d{6})/)[1];
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`No llegó el código a ${to}`);
};

// PNG 4×4 válido para firmas por API
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAADklEQVR4nGMQQwIMxHEAa3QEIUrRb/UAAAAASUVORK5CYII=';

async function fillCode(page, code) {
  const boxes = page.locator('.code');
  for (let i = 0; i < 6; i++) await boxes.nth(i).fill(code[i]);
}

// ---------- Pruebas ----------
async function main() {
  await new Promise((r) => smtp.listen(2525, '127.0.0.1', r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  let secret = '';
  let recoveryCodes = [];
  let eventSlug = '';
  let eventId = 0;

  console.log(`Pruebas contra ${BASE}`);

  section('1. Asistente de instalación');
  await test('la raíz redirige al asistente cuando no está instalado', async () => {
    await page.goto(BASE + '/');
    await page.waitForURL(/\/install\//, { timeout: 10000 });
  });
  await test('los requisitos obligatorios se cumplen', async () => {
    assert(await page.locator('.reqs li.bad').count() === 0, 'Hay requisitos obligatorios sin cumplir');
    await page.screenshot({ path: `${SHOTS}/01-requisitos.png`, fullPage: true });
    await page.click('text=Comenzar');
    await page.waitForURL(/step=2/);
  });
  await test('credenciales de base de datos erróneas muestran un error', async () => {
    await page.fill('[name=db_host]', DB.host); await page.fill('[name=db_port]', DB.port);
    await page.fill('[name=db_name]', DB.name); await page.fill('[name=db_user]', DB.user); await page.fill('[name=db_pass]', 'incorrecta');
    await page.click('button[type=submit]');
    await page.waitForSelector('.alert--error:has-text("No se pudo conectar")');
  });
  await test('con credenciales correctas avanza al paso 3', async () => {
    await page.fill('[name=db_pass]', DB.pass);
    await page.click('button[type=submit]');
    await page.waitForURL(/step=3/);
    await page.waitForSelector('text=Conexión correcta');
  });
  await test('rechaza una contraseña de administrador corta', async () => {
    await page.fill('[name=admin_name]', ADMIN.name); await page.fill('[name=admin_email]', ADMIN.email);
    await page.fill('[name=admin_pass]', 'corta'); await page.fill('[name=admin_pass2]', 'corta');
    await page.$eval('form', (f) => f.setAttribute('novalidate', ''));
    await page.click('button:has-text("Continuar")');
    await page.waitForSelector('.alert--error:has-text("al menos 10")');
  });
  await test('configura el sitio, el administrador y el correo', async () => {
    await page.fill('[name=site_url]', BASE);
    await page.fill('[name=admin_pass]', ADMIN.pass); await page.fill('[name=admin_pass2]', ADMIN.pass);
    await page.click('button:has-text("Continuar")');
    await page.waitForURL(/step=4/);
    await page.fill('[name=smtp_host]', '127.0.0.1'); await page.fill('[name=smtp_port]', '2525');
    await page.selectOption('[name=smtp_secure]', 'none'); await page.fill('[name=from_email]', 'firmas@example.com');
    await page.click('button:has-text("Enviar correo de prueba")');
    await page.waitForSelector('.alert--ok:has-text("Correo de prueba enviado")');
    assert(inbox.some((m) => m.to === ADMIN.email), 'El correo de prueba no llegó al buzón');
    await page.click('button:has-text("Continuar")');
    await page.waitForURL(/step=5/);
  });
  await test('instala y queda bloqueado', async () => {
    await page.click('button:has-text("Instalar ahora")');
    await page.waitForSelector('text=¡Instalación completada!');
    await page.screenshot({ path: `${SHOTS}/02-instalado.png`, fullPage: true });
    const again = await (await browser.newContext()).newPage();
    await again.goto(BASE + '/install/');
    await again.waitForSelector('text=La plataforma ya está instalada');
    const st = await (await ctx.request.get(BASE + '/api/status')).json();
    assert(st.installed === true, 'La API no reporta instalación');
  });
  await test('config/ y app/ no son accesibles desde la web', async () => {
    for (const p of ['/config/config.php', '/app/bootstrap.php', '/app/schema.php']) {
      const r = await ctx.request.get(BASE + p);
      assert(r.status() === 403 || r.status() === 404, `${p} respondió ${r.status()}`);
      assert(!(await r.text()).includes("'pass'"), `${p} expone credenciales`);
    }
  });

  section('2. Acceso de administrador y 2FA');
  await test('una contraseña incorrecta se rechaza', async () => {
    await page.goto(BASE + '/admin');
    await page.waitForURL(/admin\/acceso/);
    await page.fill('[name=email]', ADMIN.email); await page.fill('[name=password]', 'NoEsLaClave1');
    await page.click('button[type=submit]');
    await page.waitForSelector('.alert--error:has-text("incorrectos")');
  });
  await test('el primer ingreso muestra el QR de la app autenticadora', async () => {
    await page.fill('[name=password]', ADMIN.pass);
    await page.click('button[type=submit]');
    await page.waitForSelector('text=Activa la verificación en dos pasos');
    await page.waitForSelector('.qr img[alt^="Código QR"]');
    secret = (await page.textContent('code.secret')).replace(/\s/g, '');
    assert(/^[A-Z2-7]{32}$/.test(secret), `Clave TOTP inesperada: ${secret}`);
    await page.screenshot({ path: `${SHOTS}/03-qr-2fa.png`, fullPage: true });
  });
  await test('un código TOTP incorrecto se rechaza', async () => {
    await fillCode(page, '000000');
    await page.click('text=Activar y entrar al panel');
    await page.waitForSelector('.alert--error:has-text("Código incorrecto")');
  });
  await test('un código TOTP correcto activa 2FA y entrega 10 códigos de recuperación', async () => {
    await fillCode(page, totp(secret));
    await page.click('text=Activar y entrar al panel');
    await page.waitForSelector('text=Guarda tus códigos de recuperación');
    recoveryCodes = await page.locator('.recovery code').allTextContents();
    assert(recoveryCodes.length === 10, `Se esperaban 10 códigos, hay ${recoveryCodes.length}`);
    await page.click('text=Ya los guardé');
    await page.waitForSelector('text=Analítica del registro');
  });

  section('3. Eventos');
  await test('crea un evento con campo personalizado y lo publica', async () => {
    await page.goto(BASE + '/admin/eventos/nuevo');
    await page.waitForSelector('text=Nuevo evento');
    await page.fill('label:has-text("Nombre del evento") input', 'Pacto por el bienestar de perros y gatos');
    await page.fill('label:has-text("Organización que convoca") input', 'Colectivo Huellas Pasto');
    await page.fill('label:has-text("Descripción") textarea', 'Prueba automática de la plataforma.');
    await page.fill('label:has-text("Meta de firmas") input', '100');
    await page.fill('input[placeholder^="Nombre del campo"]', 'Barrio');
    await page.click('text=+ Agregar campo personalizado');
    await page.click('button:has-text("Publicar evento")');
    await page.waitForSelector('.alert--ok:has-text("Evento publicado")');
    await page.waitForURL(/admin\/eventos\/\d+$/);
    eventId = Number(page.url().split('/').pop());
    eventSlug = await page.inputValue('.slug-field input');
    assert(eventSlug === 'pacto-por-el-bienestar-de-perros-y-gatos', `Enlace inesperado: ${eventSlug}`);
  });
  await test('sube un logo PNG válido', async () => {
    await page.setInputFiles('.drop:has-text("Logo") input[type=file]', { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(PNG.split(',')[1], 'base64') });
    await page.waitForSelector('.alert--ok:has-text("Logo actualizado")');
    const src = await page.getAttribute('.drop:has-text("Logo") img', 'src');
    const r = await ctx.request.get(BASE + src);
    assert(r.status() === 200 && r.headers()['content-type'].includes('image/png'), 'El logo no se sirve como imagen');
  });
  await test('rechaza un PHP disfrazado de imagen y un SVG con script', async () => {
    const up = (name, mimeType, text) => ctx.request.post(`${BASE}/api/admin/events/${eventId}/upload?kind=logo`, { headers: H, multipart: { file: { name, mimeType, buffer: Buffer.from(text) } } });
    const php = await up('x.png', 'image/png', '<?php echo "hola"; ?>');
    assert(php.status() === 422, `PHP disfrazado: ${php.status()}`);
    const svg = await up('x.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    assert(svg.status() === 422, `SVG con script: ${svg.status()}`);
  });
  await test('un borrador no es visible para el público', async () => {
    const r = await ctx.request.post(`${BASE}/api/admin/events`, { headers: H, data: { name: 'Borrador secreto', status: 'draft' } });
    assert(r.ok(), 'No se pudo crear el borrador');
    const anon = await (await browser.newContext()).request.get(`${BASE}/api/events/borrador-secreto`);
    assert(anon.status() === 404, `Borrador visible al público: ${anon.status()}`);
  });
  await test('el evento publicado se usa como página principal', async () => {
    const r = await ctx.request.post(`${BASE}/api/admin/events/${eventId}/default`, { headers: H });
    assert(r.ok(), 'No se pudo marcar como principal');
  });

  section('4. Firma pública');
  const pubCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pub = await pubCtx.newPage();
  pub.on('pageerror', (e) => consoleErrors.push('público: ' + e.message));
  const signer = { name: 'Laura Martínez', doc: '1085123456', email: 'laura@example.com' };
  await test('la página pública muestra el evento y el formulario', async () => {
    await pub.goto(BASE + '/');
    await pub.waitForSelector('h1:has-text("Pacto por el bienestar")');
    await pub.waitForSelector('label:has-text("Barrio")');
    await pub.waitForTimeout(1200);
    await pub.screenshot({ path: `${SHOTS}/04-publica.png`, fullPage: true });
  });
  await test('completa los datos personales', async () => {
    await pub.fill('[name=fullName]', signer.name); await pub.fill('[name=docNumber]', signer.doc); await pub.fill('[name=email]', signer.email);
    await pub.fill('[name=phone]', '3001234567'); await pub.fill('[name=birthDate]', '1990-05-01');
    await pub.selectOption('[name=gender]', 'Femenino'); await pub.selectOption('[name=municipality]', 'Pasto');
    await pub.selectOption('[name=ethnicGroup]', 'Campesino'); await pub.fill('input[name^=custom_]', 'Centro');
    await pub.check('[name=pets][value=Perros]'); await pub.check('[name=pets][value=Gatos]'); await pub.check('[name=consentData]');
    await pub.click('text=Continuar a la firma');
    await pub.waitForSelector('text=Dibuja tu firma');
  });
  await test('no deja continuar sin dibujar la firma', async () => {
    await pub.click('text=Enviar código a mi correo');
    await pub.waitForSelector('.alert--error:has-text("Dibuja tu firma")');
  });
  await test('dibuja la firma y recibe el código por correo', async () => {
    const box = await pub.locator('canvas[aria-label="Área para dibujar la firma"]').boundingBox();
    await pub.mouse.move(box.x + 60, box.y + 150); await pub.mouse.down();
    for (let i = 0; i < 40; i++) await pub.mouse.move(box.x + 60 + i * 10, box.y + 150 - Math.sin(i / 4) * 50);
    await pub.mouse.up();
    await pub.click('text=Enviar código a mi correo');
    await pub.waitForSelector('text=Confirma tu firma');
    await lastCode(signer.email);
  });
  await test('reenviar el código de inmediato se limita', async () => {
    await pub.click('text=Reenviar código');
    await pub.waitForSelector('.alert--error:has-text("Espera unos segundos")');
  });
  await test('un código incorrecto informa los intentos restantes', async () => {
    await fillCode(pub, '000000');
    await pub.click('text=Verificar y firmar');
    await pub.waitForSelector('.alert--error:has-text("Te quedan 2 intentos")');
  });
  let folio = '';
  await test('el código correcto registra la firma con folio', async () => {
    await fillCode(pub, await lastCode(signer.email));
    await pub.click('text=Verificar y firmar');
    await pub.waitForSelector('text=Tu firma quedó registrada');
    folio = (await pub.textContent('.done__receipt')).match(/AN-\d{6}/)[0];
    await pub.screenshot({ path: `${SHOTS}/05-firmada.png`, fullPage: true });
  });
  await test('llega el correo con el comprobante', async () => {
    await new Promise((r) => setTimeout(r, 500));
    assert(inbox.some((m) => m.to === signer.email && m.text.includes(folio) && /Huella: [a-f0-9]{64}/.test(m.text)), 'No llegó el comprobante');
  });
  await test('el comprobante muestra folio, huella y firma', async () => {
    await pub.click('text=Descargar comprobante');
    await pub.waitForSelector('text=Comprobante de firma verificada');
    assert((await pub.textContent('.rcpt__data')).includes(folio), 'El comprobante no muestra el folio');
    assert(await pub.locator('.rcpt__sig img').count() === 1, 'El comprobante no muestra la firma');
    await pub.screenshot({ path: `${SHOTS}/06-comprobante.png`, fullPage: true });
  });
  await test('el mismo documento no puede firmar dos veces', async () => {
    const r = await pubCtx.request.post(`${BASE}/api/events/${eventSlug}/signatures`, {
      headers: H, data: { fullName: 'Otra', docType: 'Cédula de ciudadanía', docNumber: signer.doc, email: 'otra@example.com', birthDate: '1990-01-01', gender: 'Femenino', municipality: 'Pasto', zone: 'Urbana', consentData: true, custom: {} },
    });
    assert(r.status() === 409, `Duplicado aceptado: ${r.status()}`);
  });
  await test('sin autorización de datos no se registra', async () => {
    const r = await pubCtx.request.post(`${BASE}/api/events/${eventSlug}/signatures`, { headers: H, data: { fullName: 'X', docNumber: '99999999', email: 'x@example.com' } });
    assert(r.status() === 422, `Respondió ${r.status()}`);
  });
  await test('segunda firma por API (nombre con fórmula para probar el CSV)', async () => {
    const ev = await (await pubCtx.request.get(`${BASE}/api/events/${eventSlug}`)).json();
    const custom = { [ev.fields.custom[0].id]: 'Obrero' };
    const r = await pubCtx.request.post(`${BASE}/api/events/${eventSlug}/signatures`, {
      headers: H, data: { fullName: '=HYPERLINK("http://malo")', docType: 'Pasaporte', docNumber: 'AB123456', email: 'pedro@example.com', birthDate: '1970-03-03', gender: 'Masculino', municipality: 'Ipiales', zone: 'Rural', ethnicGroup: 'Indígena', pets: ['Ninguno'], consentData: true, custom },
    });
    const { token } = await r.json();
    assert((await pubCtx.request.post(`${BASE}/api/signatures/${token}/sign`, { headers: H, data: { image: PNG } })).ok(), 'No se guardó la firma');
    const v = await pubCtx.request.post(`${BASE}/api/signatures/${token}/verify`, { headers: H, data: { code: await lastCode('pedro@example.com') } });
    assert(v.ok(), `Verificación falló: ${v.status()}`);
  });

  section('5. Panel: analítica y exportación');
  await test('el dashboard muestra los registros y la caracterización', async () => {
    await page.goto(BASE + '/admin');
    await page.waitForSelector(`text=${folio}`);
    const a = await (await ctx.request.get(`${BASE}/api/admin/analytics?event=all&period=30`)).json();
    assert(a.totals.verified === 2 && a.totals.started === 2, `Totales inesperados: ${JSON.stringify(a.totals)}`);
    assert(a.zone.Urbana === 1 && a.zone.Rural === 1, 'Zona mal contada');
    assert(a.age.find((x) => x.label === '35–44').value === 1 && a.age.find((x) => x.label === '45–59').value === 1, 'Edades mal agrupadas');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/07-dashboard.png`, fullPage: true });
  });
  await test('«Ver firma» abre el detalle con la imagen', async () => {
    await page.locator('tr', { hasText: folio }).locator('text=Ver firma').click();
    await page.waitForSelector('dialog[open] img[alt^="Firma de"]');
    assert((await page.textContent('dialog[open]')).includes(signer.doc), 'El detalle no muestra el documento');
    await page.keyboard.press('Escape');
  });
  await test('la búsqueda filtra por documento', async () => {
    const r = await (await ctx.request.get(`${BASE}/api/admin/signatures?period=all&q=AB1234`)).json();
    assert(r.total === 1, `La búsqueda devolvió ${r.total}`);
  });
  await test('el CSV exporta con BOM, separador «;» y fórmulas neutralizadas', async () => {
    const r = await ctx.request.get(`${BASE}/api/admin/export?event=all&period=all`);
    const body = await r.body();
    assert(body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf, 'Falta el BOM UTF-8');
    const text = body.toString('utf8');
    assert(text.includes(folio) && text.includes('Barrio: Centro'), 'El CSV no tiene los datos esperados');
    assert(text.includes(`"'=HYPERLINK`) && !/;"?=HYPERLINK/.test(text), 'La fórmula no fue neutralizada');
  });

  section('6. Seguridad');
  const anon = await browser.newContext();
  await test('peticiones sin la cabecera anti-CSRF se rechazan', async () => {
    const r = await ctx.request.post(`${BASE}/api/admin/events`, { data: { name: 'x' } });
    assert(r.status() === 403, `Respondió ${r.status()}`);
  });
  await test('la API de administración exige sesión', async () => {
    for (const p of ['/api/admin/me', '/api/admin/analytics', '/api/admin/export', '/api/admin/signatures/1']) {
      const r = await anon.request.get(BASE + p);
      assert(r.status() === 401, `${p} respondió ${r.status()}`);
    }
  });
  await test('solo la contraseña no basta: sin 2FA no hay sesión', async () => {
    await anon.request.post(`${BASE}/api/admin/login`, { headers: H, data: { email: ADMIN.email, password: ADMIN.pass } });
    const r = await anon.request.get(`${BASE}/api/admin/me`);
    assert(r.status() === 401, `Respondió ${r.status()}`);
  });
  await test('un comprobante con token inválido no existe', async () => {
    const r = await anon.request.get(`${BASE}/api/receipts/${'0'.repeat(48)}`);
    assert(r.status() === 404, `Respondió ${r.status()}`);
  });
  await test('la carpeta uploads no ejecuta PHP', async () => {
    const r = await anon.request.get(`${BASE}/uploads/.htaccess`);
    assert(r.status() === 403 || r.status() === 404, `.htaccess de uploads visible: ${r.status()}`);
  });
  await test('una cuenta se bloquea tras 5 contraseñas incorrectas', async () => {
    await ctx.request.post(`${BASE}/api/admin/admins`, { headers: H, data: { name: 'Segundo', email: 'segundo@example.com', password: 'OtraClave2026' } });
    const c = await browser.newContext();
    for (let i = 0; i < 5; i++) await c.request.post(`${BASE}/api/admin/login`, { headers: H, data: { email: 'segundo@example.com', password: 'mala' } });
    const r = await c.request.post(`${BASE}/api/admin/login`, { headers: H, data: { email: 'segundo@example.com', password: 'OtraClave2026' } });
    assert(r.status() === 423, `Con la clave correcta respondió ${r.status()} en lugar de bloqueo`);
  });
  await test('cerrar sesión y volver a entrar con un código de recuperación', async () => {
    await page.click('button[aria-label="Cerrar sesión"]');
    await page.waitForURL(/admin\/acceso/);
    await page.goto(BASE + '/admin');
    await page.waitForURL(/admin\/acceso/);
    await page.fill('[name=email]', ADMIN.email); await page.fill('[name=password]', ADMIN.pass);
    await page.click('button[type=submit]');
    await page.waitForSelector('text=Verificación en dos pasos');
    await page.click('text=¿Perdiste el teléfono?');
    await page.fill('input[placeholder="XXXXX-XXXXX"]', recoveryCodes[0]);
    await page.click('text=Entrar al panel');
    await page.waitForSelector('text=Analítica del registro');
  });
  await test('un código de recuperación no sirve dos veces', async () => {
    const c = await browser.newContext();
    await c.request.post(`${BASE}/api/admin/login`, { headers: H, data: { email: ADMIN.email, password: ADMIN.pass } });
    const r = await c.request.post(`${BASE}/api/admin/2fa/verify`, { headers: H, data: { recoveryCode: recoveryCodes[0] } });
    assert(r.status() === 422, `Respondió ${r.status()}`);
  });

  section('7. Diseño adaptable');
  await test('la página pública no se desborda en un celular', async () => {
    const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
    await m.goto(BASE + '/');
    await m.waitForSelector('text=Tus datos');
    const w = await m.evaluate(() => document.documentElement.scrollWidth);
    assert(w <= 390, `Desborde horizontal: ${w}px`);
    await m.screenshot({ path: `${SHOTS}/08-celular.png`, fullPage: true });
  });
  await test('el panel no se desborda en un celular', async () => {
    const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })).newPage();
    await m.goto(BASE + '/admin');
    await m.waitForSelector('text=Analítica del registro');
    const w = await m.evaluate(() => document.documentElement.scrollWidth);
    assert(w <= 390, `Desborde horizontal: ${w}px`);
  });
  await test('sin errores de JavaScript en la consola', async () => {
    assert(consoleErrors.length === 0, consoleErrors.join(' | '));
  });

  await browser.close();
  smtp.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} de ${results.length} pruebas superadas${failed.length ? `, ${failed.length} fallaron` : ''}. Capturas en ${SHOTS}/`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
