/**
 * Carpeta web donde está instalada la plataforma: "" en la raíz o un subdominio, "/firmas" en un subdirectorio.
 * La indica index.php del servidor en window.__APP_BASE__.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
declare global {
  interface Window { __APP_BASE__?: string }
}

export const BASE = (window.__APP_BASE__ ?? '').replace(/\/+$/, '');

/** Ruta absoluta en el servidor, p. ej. appUrl('/firma/x') → "/firmas/firma/x". */
export const appUrl = (path: string) => BASE + path;

/** URL completa con dominio, para compartir o generar códigos QR. */
export const absoluteUrl = (path: string) => window.location.origin + BASE + path;

/** Ruta de la API, p. ej. apiUrl('/receipts/x/pdf') → "/firmas/api/receipts/x/pdf". */
export const apiUrl = (path: string) => BASE + '/api' + path;
