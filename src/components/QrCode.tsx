/* Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Código QR real (SVG) a partir de un texto, p. ej. un URI otpauth:// de TOTP. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#161616', light: '#FFFFFF' } })
      .then((svg) => { if (alive) setSrc('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)); });
    return () => { alive = false; };
  }, [value]);
  return src ? <img src={src} alt={label} style={{ width: '100%', height: '100%', display: 'block' }} /> : null;
}
