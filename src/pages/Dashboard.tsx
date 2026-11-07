import { useMemo, useState } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Icon } from '../components/Icon';
import { useHashScroll } from '../lib/useHashScroll';
import {
  TOTAL_VERIFIED, ages, dailySeries, ethnic, funnel, gender, kpis, pets, recentRows, towns, zones,
  type SignatureStatus,
} from '../data/sample';
import './Dashboard.css';

const fmt = (n: number) => n.toLocaleString('es-CO');
const pct = (n: number) => (n / TOTAL_VERIFIED * 100).toFixed(1).replace('.', ',') + ' %';
const points = (arr: [number, number][]) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

const STATUS_LABEL: Record<SignatureStatus, string> = { ok: 'Verificada', wait: 'Pendiente código', exp: 'Código vencido' };

function HBars({ data, color, labelWidth }: { data: [string, number][]; color: string; labelWidth: number }) {
  const max = Math.max(...data.map(([, v]) => v));
  return (
    <div className="hbars">
      {data.map(([label, v]) => (
        <div key={label} className="hbar" style={{ gridTemplateColumns: `${labelWidth}px minmax(0, 1fr) 48px` }}>
          <span>{label}</span>
          <div className="track"><div style={{ width: `${(v / max * 100).toFixed(1)}%`, background: color }} /></div>
          <strong className="val">{fmt(v)}</strong>
        </div>
      ))}
    </div>
  );
}

/** Admin analytics: KPIs, daily registrations, funnel and signer characterization. */
export function Dashboard() {
  useHashScroll();
  const series = useMemo(dailySeries, []);
  const [query, setQuery] = useState('');
  const maxAge = Math.max(...ages.map(([, v]) => v));
  const urbanPct = (zones.urban / TOTAL_VERIFIED * 100).toFixed(1);
  const rows = recentRows.filter((r) => !query || r.folio.toLowerCase().includes(query.toLowerCase()));

  return (
    <AdminLayout>
      <header className="admin-header">
        <div className="admin-header__titles">
          <span className="pill pill--warn">Datos de muestra</span>
          <h1 className="admin-title">Analítica del registro</h1>
        </div>
        <div className="admin-header__actions">
          <label className="filter">Evento
            <select className="sel"><option>Pacto por el bienestar de perros y gatos</option><option>Todos los eventos</option></select>
          </label>
          <label className="filter">Periodo
            <select className="sel"><option>Últimos 30 días</option><option>Últimos 7 días</option><option>Desde el inicio</option></select>
          </label>
          <button type="button" id="exportar" className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-end' }}>
            <Icon name="download" size={16} strokeWidth={1.8} />Exportar Excel / CSV
          </button>
        </div>
      </header>

      <section aria-label="Indicadores" className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className="card kpi">
            <span className="kpi__label">{k.label}</span>
            <span className="kpi__value">{k.value}</span>
            <span className={`kpi__delta tone-${k.tone}`}>{k.delta}</span>
          </div>
        ))}
      </section>

      <section className="row">
        <div className="card" style={{ flex: '2 1 520px' }}>
          <div className="card-head">
            <h2 className="card-title">Registros por día</h2>
            <div className="legend">
              <span><i style={{ background: 'var(--accent-light)' }} />Iniciados</span>
              <span><i style={{ background: 'var(--accent)' }} />Verificados</span>
            </div>
          </div>
          <svg viewBox="0 0 640 220" role="img" aria-label="Línea de registros iniciados y verificados por día durante 30 días" style={{ width: '100%', height: 'auto' }}>
            <line x1="0" y1="200" x2="640" y2="200" stroke="#E4E2DC" />
            <line x1="0" y1="135" x2="640" y2="135" stroke="#EFEDE8" />
            <line x1="0" y1="70" x2="640" y2="70" stroke="#EFEDE8" />
            <polyline className="ln" points={points(series.started)} fill="none" stroke="#9BA9FF" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <polyline className="ln" points={points(series.verified)} fill="none" stroke="#2C4BFF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <text x="0" y="216" fontSize="11" fill="#6B6860">Hace 30 días</text>
            <text x="640" y="216" fontSize="11" fill="#6B6860" textAnchor="end">Hoy</text>
          </svg>
        </div>

        <div className="card" style={{ flex: '1 1 300px' }}>
          <h2 className="card-title">Embudo de firma</h2>
          <div className="funnel">
            {funnel.map(([label, v]) => (
              <div key={label} className="funnel__item">
                <div className="funnel__label"><span>{label}</span><strong>{fmt(v)}</strong></div>
                <div className="track"><div style={{ width: `${(v / funnel[0][1] * 100).toFixed(1)}%`, background: 'var(--accent)' }} /></div>
              </div>
            ))}
          </div>
          <p className="small muted">La mayor caída ocurre entre la firma dibujada y la verificación del código.</p>
        </div>
      </section>

      <h2 id="caracterizacion" className="section-title">Caracterización de firmantes verificados</h2>

      <section className="char-grid">
        <div className="card">
          <h3 className="card-title">Género</h3>
          <div className="stacked" role="img" aria-label="Distribución por género">
            {gender.map(([label, v, c]) => <span key={label} style={{ width: `${(v / TOTAL_VERIFIED * 100).toFixed(2)}%`, background: c }} />)}
          </div>
          <ul className="swatches">
            {gender.map(([label, v, c]) => (
              <li key={label}><span className="sw" style={{ background: c }} /><span>{label} · <strong className="val">{pct(v)}</strong></span></li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3 className="card-title">Rango de edad</h3>
          <div className="cols" role="img" aria-label="Firmantes por rango de edad">
            {ages.map(([label, v], i) => (
              <div key={label} className="cols__item">
                <span>{fmt(v)}</span>
                <div className="cols__bar col" style={{ height: `${(v / maxAge * 78).toFixed(0)}%`, background: i === 1 ? '#2C4BFF' : '#9BA9FF' }} />
              </div>
            ))}
          </div>
          <div className="cols-labels">{ages.map(([label]) => <span key={label}>{label}</span>)}</div>
        </div>

        <div className="card">
          <h3 className="card-title">Zona de residencia</h3>
          <div className="donut-wrap">
            <div className="donut" role="img" aria-label={`Urbana ${urbanPct.replace('.', ',')} %, rural ${(100 - +urbanPct).toFixed(1).replace('.', ',')} %`}
              style={{ background: `conic-gradient(#2C4BFF 0 ${urbanPct}%, #F0A35E ${urbanPct}% 100%)` }}>
              <div className="donut__hole"><strong>{fmt(TOTAL_VERIFIED)}</strong>firmas</div>
            </div>
            <ul className="zone-list">
              <li><span className="sw" style={{ background: '#2C4BFF' }} />Urbana · <strong className="val">{fmt(zones.urban)}</strong></li>
              <li><span className="sw" style={{ background: '#F0A35E' }} />Rural · <strong className="val">{fmt(zones.rural)}</strong></li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Municipio</h3>
          <HBars data={towns} color="#2C4BFF" labelWidth={84} />
        </div>

        <div className="card">
          <h3 className="card-title">Grupo étnico o poblacional</h3>
          <HBars data={ethnic} color="#E07A1F" labelWidth={110} />
        </div>

        <div className="card">
          <h3 className="card-title">Conviven con animales</h3>
          <div className="pets">
            {pets.map(([label, v]) => (
              <div key={label} className="pet">
                <span>{label}</span>
                <strong>{fmt(v)}</strong>
                <span className="xsmall muted">{pct(v)} de firmantes</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="firmas" className="card table-card">
        <div className="table-head">
          <h2 className="card-title">Últimos registros</h2>
          <label className="search">
            <span className="sr-only">Buscar registro</span>
            <input type="search" placeholder="Buscar por folio o documento" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Folio</th><th>Firmante</th><th>Municipio</th><th>Fecha</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.folio}>
                  <td className="mono">{r.folio}</td>
                  <td>{r.name}</td>
                  <td>{r.town}</td>
                  <td>{r.date}</td>
                  <td><span className={`status status--${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
                  <td><a href="#ver" className="small" style={{ fontWeight: 500 }}>Ver firma</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}
