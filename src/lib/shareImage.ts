/**
 * Imagen vertical (1080 × 1920, formato de historias de Instagram) para compartir que se firmó.
 * Se dibuja en el navegador; no incluye datos personales del firmante.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { CAT_PATH, DOG_PATH } from '../components/LineArt';
import type { EventColors } from './api';

export type ShareImageInput = {
  eventName: string;
  organization: string;
  url: string;
  colors: EventColors;
  drawings: 'animated' | 'static' | 'hidden';
};

const W = 1080;
const H = 1920;
const PAD = 96;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    cut[maxLines - 1] = last.trimEnd() + '…';
    return cut;
  }
  return lines;
}

/** Ajusta el tamaño de letra para que el texto quepa en el número de líneas indicado. */
function fitLines(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, sizes: number[], maxWidth: number, maxLines: number) {
  for (const size of sizes) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, maxWidth, 99);
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  ctx.font = font(size);
  return { size, lines: wrap(ctx, text, maxWidth, maxLines) };
}

/** Un enlace no tiene espacios: se achica la letra y, si no cabe, se parte en dos líneas por las barras. */
function fitUrl(ctx: CanvasRenderingContext2D, url: string, maxWidth: number): string[] {
  for (const size of [38, 34, 30]) {
    ctx.font = `400 ${size}px Inter, system-ui, sans-serif`;
    if (ctx.measureText(url).width <= maxWidth) return [url];
  }
  const parts = url.split(/(?=\/)/);
  let first = '';
  while (parts.length && ctx.measureText(first + parts[0]).width <= maxWidth) first += parts.shift();
  if (!first) first = parts.shift() ?? '';
  let rest = parts.join('');
  while (rest && ctx.measureText(rest).width > maxWidth) rest = rest.slice(0, -2) + '…';
  return rest ? [first, rest] : [first];
}

export async function renderShareImage(input: ShareImageInput): Promise<Blob> {
  const { colors } = input;
  await Promise.all([
    document.fonts?.load('300 96px Sora'),
    document.fonts?.load('500 48px Sora'),
    document.fonts?.load('600 40px Inter'),
    document.fonts?.load('400 36px Inter'),
  ].map((p) => p?.catch(() => undefined)));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no puede generar la imagen');

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  // Organización
  let y = PAD + 40;
  if (input.organization) {
    ctx.fillStyle = colors.text;
    ctx.font = '600 40px Inter, system-ui, sans-serif';
    for (const l of wrap(ctx, input.organization, W - 2 * PAD, 2)) { ctx.fillText(l, PAD, y); y += 52; }
  }

  // «Yo firmé» y nombre del evento
  y = Math.max(y + 120, 420);
  ctx.fillStyle = colors.button;
  ctx.font = '600 46px Inter, system-ui, sans-serif';
  ctx.fillText('YO FIRMÉ', PAD, y);
  ctx.fillRect(PAD, y + 28, 120, 8);
  y += 150;
  const title = fitLines(ctx, input.eventName, (s) => `300 ${s}px Sora, system-ui, sans-serif`, [112, 100, 88, 76, 66], W - 2 * PAD, 5);
  ctx.fillStyle = colors.title;
  for (const l of title.lines) { ctx.fillText(l, PAD, y); y += Math.round(title.size * 1.12); }

  // Dibujo de un trazo: gato y perro
  if (input.drawings !== 'hidden') {
    const scale = 2.05;
    const top = Math.max(y + 40, 1130);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.2;
    const draw = (d: string, x: number, color: string) => {
      ctx.save();
      ctx.translate(x, top);
      ctx.scale(scale, scale);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.2 / scale * 1.6;
      ctx.stroke(new Path2D(d));
      ctx.restore();
    };
    draw(CAT_PATH, PAD - 30, colors.title);
    draw(DOG_PATH, PAD - 30 + 200 * scale, colors.button);
  }

  // Llamado a la acción y enlace
  const bottom = H - PAD;
  ctx.fillStyle = colors.title;
  ctx.font = '500 56px Sora, system-ui, sans-serif';
  ctx.fillText('Firma tú también', PAD, bottom - 150);
  ctx.fillStyle = colors.button;
  const urlLines = fitUrl(ctx, input.url.replace(/^https?:\/\//, ''), W - 2 * PAD);
  urlLines.forEach((l, i) => ctx.fillText(l, PAD, bottom - 82 + i * 46));

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png'));
}

/** Texto para compartir: {evento} se reemplaza por el nombre del evento. */
export const shareMessage = (template: string, eventName: string) => template.split('{evento}').join(eventName);

export const DEFAULT_SHARE_TEXT = 'Ya firmé por «{evento}». ¡Súmate tú también!';

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
