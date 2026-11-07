/**
 * Lista de eventos del panel.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { Alert } from '../components/Alert';
import { fmtDate, fmtNumber, get, post, type AdminEvent } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import './Dashboard.css';
import './EventConfig.css';

export function Events() {
  const { data, error, reload } = useAsync(() => get<AdminEvent[]>('/admin/events'), []);
  const makeDefault = async (id: number) => { await post(`/admin/events/${id}/default`); reload(); };

  return (
    <AdminLayout>
      <header className="admin-header">
        <div className="admin-header__titles"><h1 className="admin-title">Eventos</h1></div>
        <div className="admin-header__actions">
          <Link to="/admin/eventos/nuevo" className="btn btn--primary btn--sm">+ Nuevo evento</Link>
        </div>
      </header>
      <Alert>{error?.message}</Alert>
      <section className="card table-card">
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Evento</th><th>Estado</th><th>Firmas verificadas</th><th>Cierre</th><th>Enlace público</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {data?.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'normal', minWidth: 220 }}>
                    <Link to={`/admin/eventos/${e.id}`} style={{ fontWeight: 600, color: 'var(--ink)' }}>{e.name}</Link>
                    {e.isDefault && <span className="xsmall muted"> · Página principal</span>}
                  </td>
                  <td>
                    <span className={`status status--${e.status === 'published' ? (e.isOpen ? 'ok' : 'exp') : 'wait'}`}>
                      {e.status === 'draft' ? 'Borrador' : e.isOpen ? 'Abierto' : 'Cerrado'}
                    </span>
                  </td>
                  <td>{fmtNumber(e.verifiedCount)}{e.goal ? ` / ${fmtNumber(e.goal)}` : ''}</td>
                  <td>{e.closesAt ? fmtDate(e.closesAt) : 'Sin fecha'}</td>
                  <td className="mono small"><a href={`/firma/${e.slug}`} target="_blank" rel="noreferrer">/firma/{e.slug}</a></td>
                  <td>
                    <div className="btn-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      <Link to={`/admin/eventos/${e.id}`} className="btn btn--outline btn--sm">Editar</Link>
                      {!e.isDefault && e.status === 'published' && (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => makeDefault(e.id)}>Usar como principal</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data && !data.length && (
                <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 32 }}>Aún no hay eventos. Crea el primero.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="small muted">El evento marcado como «Página principal» es el que se muestra en la raíz del dominio. Los demás se abren con su enlace público.</p>
    </AdminLayout>
  );
}
