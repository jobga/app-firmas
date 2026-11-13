/**
 * Imagen vertical (1080 × 1920, formato de historias de Instagram) para compartir que se firmó.
 * Se dibuja en el navegador y no incluye datos personales del firmante. Respeta las zonas que
 * Instagram tapa en las historias (≈250 px arriba y abajo).
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { CAT_PATH, DOG_PATH } from '../components/LineArt';
import type { EventColors } from './api';

export type ShareVisual = 'drawings' | 'banner' | 'logo' | 'none';

/** Textos e imagen central; en los textos, null = predeterminado. */
export type ShareImageOptions = {
  kicker: string | null;
  title: string | null;
  message: string | null;
  cta: string | null;
  visual: ShareVisual;
  showOrganization: boolean;
  showUrl: boolean;
};

export type ShareImageInput = {
  eventName: string;
  organization: string;
  url: string;
  colors: EventColors;
  options: ShareImageOptions;
  bannerUrl?: string | null;
  logoUrl?: string | null;
};

export const DEFAULT_SHARE_KICKER = 'YO FIRMÉ';
export const DEFAULT_SHARE_CTA = 'Firma tú también';
export const DEFAULT_SHARE_TEXT = 'Ya firmé por «{evento}». ¡Súmate tú también!';
export const DEFAULT_SHARE_IMAGE: ShareImageOptions = {
  kicker: null, title: null, message: null, cta: null, visual: 'drawings', showOrganization: true, showUrl: true,
};

const W = 1080;
const H = 1920;
const PAD = 96;
const SAFE_TOP = 250;
const SAFE_BOTTOM = H - 250;
const CONTENT_W = W - 2 * PAD;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const w of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
  }
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    cut[maxLines - 1] = last.trimEnd() + '…';
    return cut;
  }
  return lines;
}

/** Elige el tamaño de letra más grande con el que el texto cabe en el número de líneas indicado. */
function fitLines(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, sizes: number[], maxLines: number) {
  for (const size of sizes) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, CONTENT_W, 99);
    if (lines.length <= maxLines) return { size, lines, font: font(size) };
  }
  const size = sizes[sizes.length - 1];
  ctx.font = font(size);
  return { size, lines: wrap(ctx, text, CONTENT_W, maxLines), font: font(size) };
}

/** Un enlace no tiene espacios: se achica la letra y, si no cabe, se parte en dos líneas por las barras. */
function fitUrl(ctx: CanvasRenderingContext2D, url: string): { font: string; lines: string[] } {
  for (const size of [38, 34, 30]) {
    const font = `400 ${size}px Inter, system-ui, sans-serif`;
    ctx.font = font;
    if (ctx.measureText(url).width <= CONTENT_W) return { font, lines: [url] };
  }
  const font = '400 30px Inter, system-ui, sans-serif';
  ctx.font = font;
  const parts = url.split(/(?=\/)/);
  let first = '';
  while (parts.length && ctx.measureText(first + parts[0]).width <= CONTENT_W) first += parts.shift();
  if (!first) first = parts.shift() ?? '';
  let rest = parts.join('');
  while (rest && ctx.measureText(rest).width > CONTENT_W) rest = rest.slice(0, -2) + '…';
  return { font, lines: rest ? [first, rest] : [first] };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 5000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderShareImage(input: ShareImageInput): Promise<Blob> {
  const { colors, options } = input;
  await Promise.all(['300 96px Sora', '500 48px Sora', '600 40px Inter', '400 36px Inter']
    .map((f) => document.fonts?.load(f).catch(() => undefined)));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no puede generar la imagen');
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  // ---------- Medir los bloques ----------
  const header = options.showOrganization && input.organization
    ? (ctx.font = '600 40px Inter, system-ui, sans-serif', { font: ctx.font, lines: wrap(ctx, input.organization, CONTENT_W, 2) })
    : null;
  const headerH = header ? header.lines.length * 52 : 0;

  const kicker = (options.kicker ?? DEFAULT_SHARE_KICKER).trim();
  const title = fitLines(ctx, (options.title ?? input.eventName).trim(), (s) => `300 ${s}px Sora, system-ui, sans-serif`, [112, 100, 88, 76, 66], 5);
  const message = options.message
    ? (ctx.font = '400 44px Inter, system-ui, sans-serif', { font: ctx.font, lines: wrap(ctx, options.message, CONTENT_W, 4) })
    : null;
  const titleLead = Math.round(title.size * 1.12);
  const textH = (kicker ? 150 : 0) + title.lines.length * titleLead + (message ? 30 + message.lines.length * 60 : 0);

  const cta = (options.cta ?? DEFAULT_SHARE_CTA).trim();
  const url = options.showUrl ? fitUrl(ctx, input.url.replace(/^https?:\/\//, '')) : null;
  const footerH = (cta ? 70 : 0) + (url ? url.lines.length * 46 : 0);

  // Imagen central
  type Visual = { kind: 'drawings' } | { kind: 'image'; img: HTMLImageElement; cover: boolean };
  let visual: Visual | null = null;
  if (options.visual === 'drawings') visual = { kind: 'drawings' };
  else if (options.visual === 'banner' && input.bannerUrl) {
    const img = await loadImage(input.bannerUrl);
    if (img) visual = { kind: 'image', img, cover: true };
  } else if (options.visual === 'logo' && input.logoUrl) {
    const img = await loadImage(input.logoUrl);
    if (img) visual = { kind: 'image', img, cover: false };
  }

  // ---------- Distribuir el espacio dentro de la zona segura ----------
  let y = SAFE_TOP;
  const textTopMin = y + (header ? headerH + 100 : 40);
  const footerTop = SAFE_BOTTOM - footerH - 24; // margen para las letras que bajan de la línea (g, p, y)
  let textTop = textTopMin;
  if (!visual) textTop = Math.max(textTopMin, Math.round((textTopMin + footerTop - 80 - textH) / 2));

  // Organización
  if (header) {
    ctx.fillStyle = colors.text;
    ctx.font = header.font;
    y = SAFE_TOP + 40;
    for (const l of header.lines) { ctx.fillText(l, PAD, y); y += 52; }
  }

  // Texto superior, título y mensaje
  y = textTop;
  if (kicker) {
    y += 46;
    ctx.fillStyle = colors.button;
    ctx.font = '600 46px Inter, system-ui, sans-serif';
    ctx.fillText(wrap(ctx, kicker.toUpperCase(), CONTENT_W, 1)[0], PAD, y);
    ctx.fillRect(PAD, y + 28, 120, 8);
    y += 104;
  }
  ctx.fillStyle = colors.title;
  ctx.font = title.font;
  y += Math.round(title.size * 0.85);
  for (const l of title.lines) { ctx.fillText(l, PAD, y); y += titleLead; }
  y -= titleLead - Math.round(title.size * 0.3);
  if (message) {
    ctx.fillStyle = colors.text;
    ctx.font = message.font;
    y += 70;
    for (const l of message.lines) { ctx.fillText(l, PAD, y); y += 60; }
  }
  const textBottom = y;

  // Imagen central, centrada en el espacio libre
  if (visual) {
    const top = textBottom + 70;
    const bottom = footerTop - 70;
    const room = Math.max(0, bottom - top);
    if (visual.kind === 'drawings' && room > 120) {
      const scale = Math.min(2.05, room / 205);
      const w = 420 * scale;
      const x0 = (W - w) / 2 - 20 * scale;
      const y0 = top + (room - 200 * scale) / 2;
      const draw = (d: string, x: number, color: string) => {
        ctx.save();
        ctx.translate(x, y0);
        ctx.scale(scale, scale);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3.2 / scale * 1.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(new Path2D(d));
        ctx.restore();
      };
      draw(CAT_PATH, x0, colors.title);
      draw(DOG_PATH, x0 + 200 * scale, colors.button);
    } else if (visual.kind === 'image' && room > 120) {
      const { img, cover } = visual;
      if (cover) {
        // Banner: ancho completo, recortado a una proporción entre 16:9 y 4:3
        const h = Math.min(room, Math.max(CONTENT_W * 9 / 16, Math.min(CONTENT_W * 3 / 4, CONTENT_W * img.height / img.width)));
        const y0 = top + (room - h) / 2;
        const ratio = Math.max(CONTENT_W / img.width, h / img.height);
        const sw = CONTENT_W / ratio, sh = h / ratio;
        ctx.save();
        roundRect(ctx, PAD, y0, CONTENT_W, h, 32);
        ctx.clip();
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, PAD, y0, CONTENT_W, h);
        ctx.restore();
      } else {
        // Logo: contenido en un cuadrado centrado
        const box = Math.min(room, 380);
        const k = Math.min(box / img.width, box / img.height);
        const w = img.width * k, h = img.height * k;
        ctx.drawImage(img, (W - w) / 2, top + (room - h) / 2, w, h);
      }
    }
  }

  // Llamado a la acción y enlace
  y = footerTop;
  if (cta) {
    y += 56;
    ctx.fillStyle = colors.title;
    ctx.font = '500 56px Sora, system-ui, sans-serif';
    ctx.fillText(wrap(ctx, cta, CONTENT_W, 1)[0], PAD, y);
    y += 14;
  }
  if (url) {
    ctx.fillStyle = colors.button;
    ctx.font = url.font;
    for (const l of url.lines) { y += 46; ctx.fillText(l, PAD, y); }
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png'));
}

/** Texto para compartir: {evento} se reemplaza por el nombre del evento. */
export const shareMessage = (template: string, eventName: string) => template.split('{evento}').join(eventName);

export const xIntentUrl = (text: string, url: string) =>
  `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
