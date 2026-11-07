/* Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type SignaturePadHandle = { clear: () => void; toDataURL: () => string | null };

/** Canvas you draw a signature on with finger, stylus or mouse. */
export const SignaturePad = forwardRef<SignaturePadHandle, { onSign?: () => void }>(function SignaturePad({ onSign }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onSignRef = useRef(onSign);
  onSignRef.current = onSign;

  useImperativeHandle(ref, () => ({
    clear: () => {
      const el = canvasRef.current;
      el?.getContext('2d')?.clearRect(0, 0, el.width, el.height);
    },
    toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? null,
  }));

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = el.clientWidth * dpr;
    el.height = el.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#161616';

    let down = false, lx = 0, ly = 0;
    const pos = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const onDown = (e: PointerEvent) => { down = true; el.setPointerCapture(e.pointerId); [lx, ly] = pos(e); };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const [x, y] = pos(e);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.quadraticCurveTo(lx, ly, (lx + x) / 2, (ly + y) / 2);
      ctx.lineTo(x, y);
      ctx.stroke();
      lx = x; ly = y;
      onSignRef.current?.();
    };
    const onUp = () => { down = false; };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div className="sig-pad">
      <canvas ref={canvasRef} aria-label="Área para dibujar la firma" className="sig-pad__canvas" />
      <div aria-hidden="true" className="sig-pad__line" />
      <span aria-hidden="true" className="sig-pad__hint">Firma aquí</span>
    </div>
  );
});
