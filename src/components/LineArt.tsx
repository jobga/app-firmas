/* Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo */
import type { SVGProps } from 'react';

/** One-stroke cat outline (viewBox 0 0 200 200). */
export const CAT_PATH =
  'M20 186 L100 186 C108 186 110 178 104 176 C96 160 92 130 96 112 C84 108 74 96 74 82 C74 70 76 60 80 52 L84 34 L98 50 C104 48 112 48 118 50 L132 36 L132 56 C138 68 136 86 126 96 C140 104 156 124 158 150 C160 170 150 184 132 186 C160 188 186 180 188 160 C190 144 176 138 170 146';

/** One-stroke dog outline (viewBox 0 0 200 200). */
export const DOG_PATH =
  'M190 186 L110 186 C100 186 98 178 104 176 C112 156 116 130 112 112 C120 106 134 104 146 104 C158 104 164 96 160 88 C150 82 140 80 134 72 C128 60 112 56 100 62 C90 68 86 84 90 100 C94 106 100 100 98 90 C86 96 74 112 70 136 C66 160 74 182 96 186 C70 188 40 178 36 156 C34 146 42 140 46 148';

type StrokeProps = { color: string; strokeWidth?: number };

const strokeAttrs = (color: string, strokeWidth: number) => ({
  fill: 'none',
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/** The Animalista cat mark, static (used as logo). */
export function CatMark({ color, strokeWidth = 8, size = 30 }: StrokeProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <path d={CAT_PATH} {...strokeAttrs(color, strokeWidth)} />
    </svg>
  );
}

type DrawingProps = StrokeProps & {
  animal: 'cat' | 'dog';
  label?: string;
  slow?: boolean;
  /** false: el dibujo aparece completo, sin la animación del trazo. */
  animated?: boolean;
} & Omit<SVGProps<SVGSVGElement>, 'color'>;

/** Single animal drawn with an animated "one line" stroke. */
export function AnimalDrawing({ animal, color, strokeWidth = 3, label, slow, animated = true, className, ...rest }: DrawingProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg
      viewBox={animal === 'dog' ? '0 0 220 200' : '0 0 200 200'}
      className={[animated && 'draw', animated && slow && 'draw--slow', className].filter(Boolean).join(' ') || undefined}
      {...a11y}
      {...rest}
    >
      <path d={animal === 'cat' ? CAT_PATH : DOG_PATH} {...strokeAttrs(color, strokeWidth)} />
    </svg>
  );
}

/** Cat and dog side by side, drawn in sequence. */
export function CatAndDog({ catColor, dogColor, style, animated = true }: { catColor: string; dogColor: string; style?: React.CSSProperties; animated?: boolean }) {
  return (
    <svg className={animated ? 'draw' : undefined} viewBox="0 0 420 200" role="img" aria-label="Dibujo de un gato y un perro en una sola línea" style={style}>
      <path d={CAT_PATH} {...strokeAttrs(catColor, 2)} />
      <path className="delayed" transform="translate(200 0)" d={DOG_PATH} {...strokeAttrs(dogColor, 2)} />
    </svg>
  );
}
