/**
 * Empaqueta la plataforma para subirla a Plesk (o cualquier hosting PHP + MySQL).
 * Resultado: release/animalista-firmas/ y release/animalista-firmas-<versión>.zip
 *
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const dist = join(root, 'dist');
const out = join(root, 'release');
const app = join(out, 'animalista-firmas');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('Falta dist/. Ejecuta primero: npm run build');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(app, { recursive: true });
cpSync(dist, app, { recursive: true });
cpSync(join(root, 'server'), app, {
  recursive: true,
  filter: (src) => {
    const rel = relative(join(root, 'server'), src).split(sep).join('/');
    return rel !== 'config/config.php' && !rel.startsWith('uploads/events');
  },
});
for (const f of ['README.md', 'AUTHORS.md', 'LICENSE.md']) if (existsSync(join(root, f))) cpSync(join(root, f), join(app, f));
writeFileSync(join(app, 'VERSION'), `${version}\nAnimalista · Plataforma de firmas — © Jonnathan Bucheli Galindo\n`);

const zipName = `animalista-firmas-${version}.zip`;
try {
  execFileSync('zip', ['-rqX', join(out, zipName), '.'], { cwd: app, stdio: 'inherit' });
  console.log(`Listo: release/${zipName}`);
} catch {
  console.log('No se encontró el comando «zip». Comprime manualmente el contenido de release/animalista-firmas/.');
}
console.log('Sube el contenido del ZIP a la carpeta httpdocs del dominio y abre https://tu-dominio/install/');
