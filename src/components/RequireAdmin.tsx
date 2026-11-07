/* Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo */
import { createContext, useContext, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { get, type Me } from '../lib/api';
import { useAsync } from '../lib/useAsync';

const AdminContext = createContext<Me | null>(null);

/** Protege las rutas del panel: sin sesión completa (contraseña + 2FA) redirige al acceso. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data, error, loading } = useAsync(() => get<Me>('/admin/me'), []);
  if (loading && !data) return <div className="page-loading" aria-busy="true">Cargando…</div>;
  if (error || !data) return <Navigate to="/admin/acceso" replace state={{ from: location.pathname + location.hash }} />;
  return <AdminContext.Provider value={data}>{children}</AdminContext.Provider>;
}

export function useAdmin(): Me {
  const me = useContext(AdminContext);
  if (!me) throw new Error('useAdmin fuera de <RequireAdmin>');
  return me;
}
