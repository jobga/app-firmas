/**
 * Botones para compartir la convocatoria en Instagram y X al terminar la firma.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { useState } from 'react';
import type { PublicEvent } from '../lib/api';
import { absoluteUrl } from '../lib/base';
import { DEFAULT_SHARE_TEXT, downloadBlob, renderShareImage, shareMessage, xIntentUrl } from '../lib/shareImage';

export function XGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4l16 16M20 4L4 20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function InstagramGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShareButtons({ event, onNotice }: { event: PublicEvent; onNotice: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  const url = absoluteUrl('/firma/' + event.slug);
  const text = shareMessage(event.share.text ?? DEFAULT_SHARE_TEXT, event.name);

  const instagram = async () => {
    setBusy(true);
    try {
      const blob = await renderShareImage({
        eventName: event.name, organization: event.organization, url, colors: event.colors, drawings: event.lineDrawings,
      });
      const file = new File([blob], `firma-${event.slug}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        // En el celular abre el menú de compartir del sistema, donde aparece Instagram (historias, publicación o mensaje).
        await navigator.share({ files: [file], text: `${text} ${url}` }).catch(() => undefined);
      } else {
        downloadBlob(blob, file.name);
        onNotice('Descargamos la imagen para Instagram: súbela a tus historias o a una publicación.');
      }
    } catch {
      onNotice('No pudimos generar la imagen. Comparte el enlace de la convocatoria.');
    } finally { setBusy(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); onNotice('Enlace copiado al portapapeles.'); }
    catch { onNotice(url); }
  };

  return (
    <div className="share" role="group" aria-label="Compartir la convocatoria">
      <span className="share__label">Invita a más personas a firmar</span>
      <div className="share__buttons">
        <button type="button" className="btn btn--outline share__btn" onClick={instagram} disabled={busy}>
          <InstagramGlyph />{busy ? 'Generando…' : 'Instagram'}
        </button>
        <a className="btn btn--outline share__btn" href={xIntentUrl(text, url)} target="_blank" rel="noopener noreferrer">
          <XGlyph />X
        </a>
        <button type="button" className="btn btn--outline share__btn" onClick={copy}>Copiar enlace</button>
      </div>
    </div>
  );
}
