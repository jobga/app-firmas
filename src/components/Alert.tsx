/* Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo */
import type { ReactNode } from 'react';

/** Mensaje de error, éxito o aviso. */
export function Alert({ tone = 'error', children }: { tone?: 'error' | 'ok' | 'warn'; children: ReactNode }) {
  if (!children) return null;
  return <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}
