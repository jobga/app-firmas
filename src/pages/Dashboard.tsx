/**
 * Analítica del registro: indicadores, embudo, caracterización y últimos registros.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { Icon } from '../components/Icon';
import { Alert } from '../components/Alert';
import { useHashScroll } from '../lib/useHashScroll';
import { useAsync } from '../lib/useAsync';
import { apiUrl } from '../lib/base';
import {
  fmtDateTime, fmtNumber, get,
  type AdminEvent, type Analytics, type SignatureDetail, type SignatureRow, type SignatureStatus,
} from '../lib/api';
import './Dashboard.css';

const STATUS_LABEL: Record<SignatureStatus, string> = {
  started: 'Datos', signed: 'Firmada', pending_code: 'Pendiente código', verified: 'Verificada', expired: 'Código vencido',
};
const STATUS_CLASS: Record<SignatureStatus, string> = { started: 'exp', signed: 'wait', pending_code: 'wait', verified: 'ok', expired: 'exp' };
const ZONE_COLORS = ['#2C4BFF', '#F0A35E', '#1F8A5B', '#B04FC4', '#8C8A84'];
const GENDER_COLORS = ['#2C4BFF', '#9BA9FF', '#E07A1F', '#B9B6AD', '#55524B'];

const pct = (n: number, total: number) => (total ? (n / total * 100).toFixed(1).replace('.', ',') : '0') + ' %';
const duration = (s: number | null) => (s === null ? '—' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`);

function delta(cur: number, prev: number | undefined): { text: string; tone: 'ok' | 'bad' | 'neutral' } {
  if (prev === undefined) return { text: 'Desde el inicio', tone: 'neutral' };
  if (!prev) return { text: 'Sin datos del periodo anterior', tone: 'neutral' };
  const d = Math.round((cur - prev) / prev * 100);
  return { text: `${d >= 0 ? '+' : '−'}${Math.abs(d)} % vs. periodo anterior`, tone: d >= 0 ? 'ok' : 'bad' };
}

function HBars({ data, color, labelWidth }: { data: { label: string; value: number }[]; color: string; labelWidth: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="small muted">Aún no hay datos.</p>;
  return (
    <div className="hbars">
      {data.map(({ label, value }) => (
        <div key={label} className="hbar" style={{ gridTemplateColumns: `${labelWidth}px minmax(0, 1fr) 48px` }}>
          <span title={label}>{label}</span>
          <div className="track"><div style={{ width: `${(value / max * 100).toFixed(1)}%`, background: color }} /></div>
          <strong className="val">{fmtNumber(value)}</strong>
        </div>
      ))}
    </div>
  );
}

function DailyChart({ daily }: { daily: Analytics['daily'] }) {
  const n = daily.length;
  const max = Math.max(4, ...daily.map((d) => d.started));
  const x = (i: number) => (n <= 1 ? 320 : i * (640 / (n - 1)));
  const y = (v: number) => 200 - (v / max) * 180;
  const pts = (k: 'started' | 'verified') => daily.map((d, i) => `${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 640 220" role="img" aria-label={`Registros iniciados y verificados por día durante ${n} días`} style={{ width: '100%', height: 'auto' }}>
      <line x1="0" y1="200" x2="640" y2="200" stroke="#E4E2DC" />
      <line x1="0" y1="110" x2="640" y2="110" stroke="#EFEDE8" />
      <line x1="0" y1="20" x2="640" y2="20" stroke="#EFEDE8" />
      <text x="0" y="16" fontSize="11" fill="#6B6860">{fmtNumber(max)}</text>
      <polyline className="ln" points={pts('started')} fill="none" stroke="#9BA9FF" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline className="ln" points={pts('verified')} fill="none" stroke="#2C4BFF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <text x="0" y="216" fontSize="11" fill="#6B6860">Hace {n} días</text>
      <text x="640" y="216" fontSize="11" fill="#6B6860" textAnchor="end">Hoy</text>
    </svg>
  );
}

function SignatureDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { data, error } = useAsync(() => get<SignatureDetail>(`/admin/signatures/${id}`), [id]);
  useEffect(() => { ref.current?.showModal(); }, []);
  const rows: [string, string | null | undefined][] = data ? [
    ['Evento', data.event], ['Estado', STATUS_LABEL[data.status]], ['Folio', data.folio], ['Nombre', data.fullName],
    ['Documento', `${data.docType} ${data.docNumber}`], ['Correo', data.email], ['Celular', data.phone], ['Nacimiento', data.birthDate],
    ['Género', data.gender], ['Departamento', data.department], ['Municipio', data.municipality], ['Zona', data.zone], ['Grupo étnico', data.ethnicGroup], ['Animales', data.pets],
    ...Object.entries(data.extra ?? {}).filter(([, v]) => v).map(([k, v]) => [k === 'education' ? 'Nivel educativo' : k === 'disability' ? 'Discapacidad' : 'Campo adicional', v] as [string, string]),
    ['Autorización aceptada', data.consentText],
    ['Acepta información', data.consentNews ? 'Sí' : 'No'], ['Dispositivo', data.device], ['IP', data.ip],
    ['Registro', fmtDateTime(data.createdAt)], ['Firma', fmtDateTime(data.signedAt)],
    [data.verification === 'none' ? 'Registrada' : 'Verificada', fmtDateTime(data.verifiedAt)],
    ['Verificación', data.verification === 'none' ? 'Sin código por correo' : data.verification === 'email' ? 'Código por correo' : null],
    ['Huella SHA-256', data.hash],
  ] : [];
  return (
    <dialog ref={ref} className="sig-dialog" onClose={onClose} aria-labelledby="sig-title">
      <div className="sig-dialog__head">
        <h2 id="sig-title" className="card-title card-title--lg">Registro {data?.folio ?? ''}</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => ref.current?.close()}>Cerrar</button>
      </div>
      <Alert>{error?.message}</Alert>
      {data?.signature && <img className="sig-dialog__img" src={data.signature} alt={`Firma de ${data.fullName}`} />}
      <dl className="sig-dialog__data">
        {rows.filter(([, v]) => v).map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </dialog>
  );
}

export function Dashboard() {
  useHashScroll();
  const [event, setEvent] = useState('all');
  const [period, setPeriod] = useState('30');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => { const t = setTimeout(() => { setDebounced(query); setPage(1); }, 300); return () => clearTimeout(t); }, [query]);

  const events = useAsync(() => get<AdminEvent[]>('/admin/events'), []);
  const qs = `event=${event}&period=${period}`;
  const stats = useAsync(() => get<Analytics>(`/admin/analytics?${qs}`), [qs]);
  const list = useAsync(
    () => get<{ total: number; page: number; perPage: number; items: SignatureRow[] }>(`/admin/signatures?${qs}&page=${page}&q=${encodeURIComponent(debounced)}`),
    [qs, page, debounced],
  );

  const a = stats.data;
  const t = a?.totals;
  const prev = a?.previous ?? undefined;
  const verified = t?.verified ?? 0;
  const selectedEvent = events.data?.find((ev) => String(ev.id) === event);
  const funnelTop = Math.max(t?.visits ?? 0, t?.started ?? 0, 1);
  const funnel: [string, number][] = t ? [
    ['Abrieron la convocatoria', Math.max(t.visits, t.started)],
    ['Completaron datos y autorización', t.started],
    ['Dibujaron la firma', t.signed],
    [selectedEvent && !selectedEvent.requireEmailCode ? 'Firma registrada' : 'Verificaron el código', t.verified],
  ] : [];
  const zones = a?.zone ?? [];
  const zoneTotal = zones.reduce((n, z) => n + z.value, 0);
  let acc = 0;
  const zoneStops = zones.map((z, i) => {
    const from = acc; acc += zoneTotal ? (z.value / zoneTotal) * 100 : 0;
    return `${ZONE_COLORS[i % ZONE_COLORS.length]} ${from.toFixed(2)}% ${acc.toFixed(2)}%`;
  }).join(', ');
  const maxAge = Math.max(1, ...(a?.age ?? []).map((x) => x.value));
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.perPage)) : 1;

  return (
    <AdminLayout>
      <header className="admin-header">
        <div className="admin-header__titles">
          <h1 className="admin-title">Analítica del registro</h1>
        </div>
        <div className="admin-header__actions">
          <label className="filter">Evento
            <select className="sel" value={event} onChange={(e) => { setEvent(e.target.value); setPage(1); }}>
              <option value="all">Todos los eventos</option>
              {events.data?.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </label>
          <label className="filter">Periodo
            <select className="sel" value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }}>
              <option value="30">Últimos 30 días</option><option value="7">Últimos 7 días</option><option value="90">Últimos 90 días</option><option value="all">Desde el inicio</option>
            </select>
          </label>
          <a id="exportar" href={apiUrl(`/admin/export?${qs}`)} className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-end' }}>
            <Icon name="download" size={16} strokeWidth={1.8} />Exportar Excel / CSV
          </a>
        </div>
      </header>

      <Alert>{stats.error?.message}</Alert>

      {events.data && events.data.length === 0 && (
        <div className="card admin-empty">
          <h2 className="card-title card-title--lg">Aún no tienes eventos</h2>
          <p className="small muted">Crea tu primer evento para empezar a recoger firmas.</p>
          <Link to="/admin/eventos/nuevo" className="btn btn--primary btn--sm">Crear evento</Link>
        </div>
      )}

      <section aria-label="Indicadores" className="kpis" aria-busy={stats.loading}>
        {[
          { label: 'Registros iniciados', value: fmtNumber(t?.started ?? 0), ...delta(t?.started ?? 0, prev?.started) },
          { label: 'Firmas verificadas', value: fmtNumber(verified), ...delta(verified, prev?.verified) },
          {
            label: 'Tasa de verificación',
            value: t?.rate != null ? pct(t.rate, 1) : '—',
            ...(t?.rate != null && prev?.rate != null
              ? (() => { const d = (t.rate - prev.rate) * 100; return { text: `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1).replace('.', ',')} pts vs. periodo anterior`, tone: (d >= 0 ? 'ok' : 'bad') as 'ok' | 'bad' }; })()
              : { text: 'Verificadas / iniciadas', tone: 'neutral' as const }),
          },
          { label: 'Tiempo medio para firmar', value: duration(t?.avgSeconds ?? null), text: t?.mobileShare != null ? `${pct(t.mobileShare, 1)} desde celular` : 'Sin firmas aún', tone: 'neutral' as const },
        ].map((k) => (
          <div key={k.label} className="card kpi">
            <span className="kpi__label">{k.label}</span>
            <span className="kpi__value">{k.value}</span>
            <span className={`kpi__delta tone-${k.tone}`}>{k.text}</span>
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
          {a && <DailyChart daily={a.daily} />}
        </div>

        <div className="card" style={{ flex: '1 1 300px' }}>
          <h2 className="card-title">Embudo de firma</h2>
          <div className="funnel">
            {funnel.map(([label, v]) => (
              <div key={label} className="funnel__item">
                <div className="funnel__label"><span>{label}</span><strong>{fmtNumber(v)}</strong></div>
                <div className="track"><div style={{ width: `${(v / funnelTop * 100).toFixed(1)}%`, background: 'var(--accent)' }} /></div>
              </div>
            ))}
          </div>
          {t && t.signed > t.verified && (
            <p className="small muted">{fmtNumber(t.signed - t.verified)} personas dibujaron la firma pero aún no verifican el código.</p>
          )}
        </div>
      </section>

      <h2 id="caracterizacion" className="section-title">Caracterización de firmantes verificados</h2>

      <section className="char-grid">
        <div className="card">
          <h3 className="card-title">Género</h3>
          {a && a.gender.length ? (
            <>
              <div className="stacked" role="img" aria-label="Distribución por género">
                {a.gender.map((g, i) => <span key={g.label} style={{ width: `${(g.value / verified * 100).toFixed(2)}%`, background: GENDER_COLORS[i % GENDER_COLORS.length] }} />)}
              </div>
              <ul className="swatches">
                {a.gender.map((g, i) => (
                  <li key={g.label}><span className="sw" style={{ background: GENDER_COLORS[i % GENDER_COLORS.length] }} /><span>{g.label} · <strong className="val">{pct(g.value, verified)}</strong></span></li>
                ))}
              </ul>
            </>
          ) : <p className="small muted">Aún no hay datos.</p>}
        </div>

        <div className="card">
          <h3 className="card-title">Rango de edad</h3>
          <div className="cols" role="img" aria-label="Firmantes por rango de edad">
            {(a?.age ?? []).map((g) => (
              <div key={g.label} className="cols__item">
                <span>{fmtNumber(g.value)}</span>
                <div className="cols__bar col" style={{ height: `${(g.value / maxAge * 78).toFixed(0)}%`, background: g.value === maxAge && g.value > 0 ? '#2C4BFF' : '#9BA9FF' }} />
              </div>
            ))}
          </div>
          <div className="cols-labels">{(a?.age ?? []).map((g) => <span key={g.label}>{g.label}</span>)}</div>
        </div>

        <div className="card">
          <h3 className="card-title">Zona de residencia</h3>
          <div className="donut-wrap">
            <div className="donut" role="img" aria-label={zones.map((z) => `${z.label} ${pct(z.value, zoneTotal)}`).join(', ') || 'Sin datos'}
              style={{ background: zoneTotal ? `conic-gradient(${zoneStops})` : '#EFEDE8' }}>
              <div className="donut__hole"><strong>{fmtNumber(verified)}</strong>firmas</div>
            </div>
            <ul className="zone-list">
              {zones.map((z, i) => <li key={z.label}><span className="sw" style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }} />{z.label} · <strong className="val">{fmtNumber(z.value)}</strong></li>)}
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Departamento</h3>
          <HBars data={a?.department ?? []} color="#1F8A5B" labelWidth={120} />
        </div>

        <div className="card">
          <h3 className="card-title">Municipio</h3>
          <HBars data={a?.municipality ?? []} color="#2C4BFF" labelWidth={150} />
        </div>

        <div className="card">
          <h3 className="card-title">Grupo étnico o poblacional</h3>
          <HBars data={a?.ethnic ?? []} color="#E07A1F" labelWidth={110} />
        </div>

        <div className="card">
          <h3 className="card-title">Conviven con animales</h3>
          <div className="pets">
            {(a?.pets ?? []).map((p) => (
              <div key={p.label} className="pet">
                <span>{p.label === 'Otros' ? 'Otros animales' : p.label}</span>
                <strong>{fmtNumber(p.value)}</strong>
                <span className="xsmall muted">{pct(p.value, verified)} de firmantes</span>
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
            <input type="search" placeholder="Buscar por folio, documento, nombre o correo" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Folio</th><th>Firmante</th><th>Municipio</th><th>Evento</th><th>Fecha</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              {list.data?.items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.folio ?? '—'}</td>
                  <td>{r.name}</td>
                  <td>{r.municipality ? `${r.municipality}${r.department ? ` · ${r.department}` : ''}` : '—'}</td>
                  <td>{r.event}</td>
                  <td>{fmtDateTime(r.verifiedAt ?? r.createdAt)}</td>
                  <td><span className={`status status--${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                  <td><button type="button" className="link-btn small" style={{ fontWeight: 500 }} onClick={() => setOpen(r.id)}>Ver firma</button></td>
                </tr>
              ))}
              {list.data && !list.data.items.length && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>No hay registros para este filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="pager">
            <button type="button" className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
            <span className="small muted">Página {page} de {pages} · {fmtNumber(list.data?.total ?? 0)} registros</span>
            <button type="button" className="btn btn--outline btn--sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</button>
          </div>
        )}
      </section>

      {open !== null && <SignatureDialog id={open} onClose={() => setOpen(null)} />}
    </AdminLayout>
  );
}
