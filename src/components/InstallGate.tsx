/* Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo */
import { useEffect, useState, type ReactNode } from 'react';

/** Si la plataforma aún no está instalada, lleva al asistente de instalación. */
export function InstallGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((s) => { if (s.installed === false) window.location.replace(s.installUrl ?? '/install/'); else setReady(true); })
      .catch(() => setReady(true));
  }, []);
  return ready ? <>{children}</> : <div className="page-loading" aria-busy="true">Cargando…</div>;
}
