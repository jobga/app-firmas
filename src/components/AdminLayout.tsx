import { NavLink, type NavLinkProps } from 'react-router-dom';
import type { ReactNode } from 'react';
import { CatMark } from './LineArt';
import { Icon, type IconName } from './Icon';
import './AdminLayout.css';

const items: { to: string; icon: IconName; label: string; end?: boolean }[] = [
  { to: '/admin', icon: 'chart', label: 'Dashboard', end: true },
  { to: '/admin/eventos', icon: 'calendar', label: 'Eventos' },
  { to: '/admin#firmas', icon: 'signature', label: 'Firmas' },
  { to: '/admin#caracterizacion', icon: 'people', label: 'Caracterización' },
  { to: '/admin#exportar', icon: 'download', label: 'Exportar' },
  { to: '/admin/acceso', icon: 'shield', label: 'Seguridad y 2FA' },
];

/** Dark sidebar + content shell shared by every admin screen. */
export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin">
      <aside className="admin__side">
        <div className="admin__brand">
          <CatMark color="#FFFFFF" />
          <span>Animalista</span>
        </div>
        <nav className="admin__nav" aria-label="Menú principal">
          {items.map((it) => {
            const isHash = it.to.includes('#');
            const cls: NavLinkProps['className'] = ({ isActive }) => (isActive && !isHash ? 'is-active' : undefined);
            return (
              <NavLink key={it.to} to={it.to} end={it.end || isHash} className={cls}>
                <Icon name={it.icon} />
                {it.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="admin__user">
          <span className="admin__avatar" aria-hidden="true">JA</span>
          <div className="admin__user-text">
            <span>Administrador</span>
            <span className="admin__user-meta">2FA activo</span>
          </div>
        </div>
      </aside>
      <main className="admin__main">{children}</main>
    </div>
  );
}
