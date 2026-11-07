/**
 * Estructura común del panel: barra lateral oscura + contenido.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { CatMark } from './LineArt';
import { Icon, type IconName } from './Icon';
import { useAdmin } from './RequireAdmin';
import { post } from '../lib/api';
import { APP_AUTHOR } from '../lib/credits';
import './AdminLayout.css';

const items: { to: string; icon: IconName; label: string; end?: boolean; hash?: boolean }[] = [
  { to: '/admin', icon: 'chart', label: 'Dashboard', end: true },
  { to: '/admin/eventos', icon: 'calendar', label: 'Eventos' },
  { to: '/admin#firmas', icon: 'signature', label: 'Firmas', hash: true },
  { to: '/admin#caracterizacion', icon: 'people', label: 'Caracterización', hash: true },
  { to: '/admin#exportar', icon: 'download', label: 'Exportar', hash: true },
  { to: '/admin/ajustes', icon: 'shield', label: 'Seguridad y ajustes' },
];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'AD';

export function AdminLayout({ children }: { children: ReactNode }) {
  const me = useAdmin();
  const navigate = useNavigate();
  const logout = async () => {
    await post('/admin/logout').catch(() => undefined);
    navigate('/admin/acceso', { replace: true });
  };

  return (
    <div className="admin">
      <aside className="admin__side">
        <div className="admin__brand">
          <CatMark color="#FFFFFF" />
          <span>{me.siteName || 'Animalista'}</span>
        </div>
        <nav className="admin__nav" aria-label="Menú principal">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end || it.hash} className={({ isActive }) => (isActive && !it.hash ? 'is-active' : undefined)}>
              <Icon name={it.icon} />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin__foot">
          <div className="admin__user">
            <span className="admin__avatar" aria-hidden="true">{initials(me.name)}</span>
            <div className="admin__user-text">
              <span>{me.name}</span>
              <span className="admin__user-meta">{me.totpEnabled ? '2FA activo' : '2FA pendiente'}</span>
            </div>
            <button type="button" className="admin__logout" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" /></svg>
            </button>
          </div>
          <p className="admin__credit">Desarrollado por {APP_AUTHOR}</p>
        </div>
      </aside>
      <main className="admin__main">{children}</main>
    </div>
  );
}
