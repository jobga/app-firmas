/**
 * Configuración de un evento con vista previa en vivo.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { useEffect, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { AnimalDrawing, CatMark } from '../components/LineArt';
import { Icon } from '../components/Icon';
import { Alert } from '../components/Alert';
import { QrCode } from '../components/QrCode';
import QRCode from 'qrcode';
import { api, ApiError, del, get, post, put, type AdminEvent, type CustomField, type EventColors, type OptionalField } from '../lib/api';
import { contrastRatio } from '../lib/contrast';
import { absoluteUrl, appUrl } from '../lib/base';
import './EventConfig.css';

const COLOR_FIELDS: { key: keyof EventColors; label: string }[] = [
  { key: 'bg', label: 'Fondo' }, { key: 'title', label: 'Títulos' }, { key: 'text', label: 'Texto' }, { key: 'button', label: 'Botones' },
];

const OPTIONAL_FIELDS: [OptionalField, string][] = [
  ['phone', 'Celular'], ['birth_date', 'Fecha de nacimiento'], ['gender', 'Género'], ['municipality', 'Municipio'],
  ['zone', 'Zona urbana / rural'], ['ethnic_group', 'Grupo étnico'], ['pets', 'Convivencia con animales'],
  ['education', 'Nivel educativo'], ['disability', 'Discapacidad'],
];

type Draft = {
  name: string; slug: string; description: string; organization: string; policyUrl: string;
  opensAt: string; closesAt: string; goal: string; colors: EventColors;
  optional: Record<OptionalField, boolean>; custom: CustomField[]; municipalities: string;
  animation: AdminEvent['animation']; intensity: AdminEvent['intensity'];
  codeTtlMinutes: number; maxAttempts: number; requireEmailCode: boolean; emailSubject: string; sendReceipt: boolean;
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const EMPTY: Draft = {
  name: 'Nuevo evento', slug: '', description: '', organization: '', policyUrl: '', opensAt: '', closesAt: '', goal: '',
  colors: { bg: '#F7F6F2', title: '#161616', text: '#3D3B36', button: '#2C4BFF' },
  optional: { phone: true, birth_date: true, gender: true, municipality: true, zone: true, ethnic_group: true, pets: true, education: false, disability: false },
  custom: [], municipalities: 'Pasto\nIpiales\nTumaco\nTúquerres\nOtro',
  animation: 'both', intensity: 'subtle', codeTtlMinutes: 10, maxAttempts: 3, requireEmailCode: true, emailSubject: 'Tu código para confirmar la firma', sendReceipt: true,
};

function fromEvent(e: AdminEvent): Draft {
  return {
    name: e.name, slug: e.slug, description: e.description, organization: e.organization, policyUrl: e.policyUrl,
    opensAt: toLocalInput(e.opensAt), closesAt: toLocalInput(e.closesAt), goal: e.goal ? String(e.goal) : '',
    colors: e.colors, optional: e.fields.optional, custom: e.fields.custom, municipalities: e.municipalities.join('\n'),
    animation: e.animation, intensity: e.intensity, codeTtlMinutes: e.codeTtlMinutes, maxAttempts: e.maxAttempts,
    requireEmailCode: e.requireEmailCode, emailSubject: e.emailSubject, sendReceipt: e.sendReceipt,
  };
}

export function EventConfig() {
  const { id } = useParams();
  const isNew = !id || id === 'nuevo';
  const navigate = useNavigate();
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [newField, setNewField] = useState('');
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (isNew) { setEvent(null); setDraft(EMPTY); setLoading(false); return; }
    setLoading(true);
    get<AdminEvent>(`/admin/events/${id}`)
      .then((e) => { setEvent(e); setDraft(fromEvent(e)); })
      .catch((e: ApiError) => setMsg({ tone: 'error', text: e.message }))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const { colors } = draft;

  const save = async (status: 'draft' | 'published') => {
    setBusy(true); setMsg(null);
    const body = {
      name: draft.name, slug: draft.slug || undefined, status, description: draft.description, organization: draft.organization,
      policyUrl: draft.policyUrl, opensAt: draft.opensAt ? new Date(draft.opensAt).toISOString() : '',
      closesAt: draft.closesAt ? new Date(draft.closesAt).toISOString() : '', goal: draft.goal ? Number(draft.goal) : null,
      colors, fields: { optional: draft.optional, custom: draft.custom },
      municipalities: draft.municipalities.split('\n').map((m) => m.trim()).filter(Boolean),
      animation: draft.animation, intensity: draft.intensity, codeTtlMinutes: draft.codeTtlMinutes, maxAttempts: draft.maxAttempts,
      requireEmailCode: draft.requireEmailCode, emailSubject: draft.emailSubject, sendReceipt: draft.sendReceipt,
    };
    try {
      const saved = isNew ? await post<AdminEvent>('/admin/events', body) : await put<AdminEvent>(`/admin/events/${id}`, body);
      setEvent(saved);
      setDraft(fromEvent(saved));
      setMsg({ tone: 'ok', text: status === 'published' ? 'Evento publicado' : 'Borrador guardado' });
      if (isNew) navigate(`/admin/eventos/${saved.id}`, { replace: true });
    } catch (e) {
      setMsg({ tone: 'error', text: (e as ApiError).message });
    } finally { setBusy(false); }
  };

  const upload = async (kind: 'logo' | 'background', e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !event) return;
    const fd = new FormData();
    fd.append('file', file);
    setMsg(null);
    try {
      const saved = await api<AdminEvent>(`/admin/events/${event.id}/upload?kind=${kind}`, 'POST', fd);
      setEvent(saved);
      setMsg({ tone: 'ok', text: kind === 'logo' ? 'Logo actualizado' : 'Imagen de fondo actualizada' });
    } catch (err) { setMsg({ tone: 'error', text: (err as ApiError).message }); }
  };

  const removeUpload = async (kind: 'logo' | 'background') => {
    if (!event) return;
    setEvent(await del<AdminEvent>(`/admin/events/${event.id}/upload?kind=${kind}`));
  };

  const remove = async () => {
    if (!event) return;
    const confirm = window.prompt(`Esto borrará el evento y TODAS sus firmas. Escribe «${event.slug}» para confirmar.`);
    if (confirm === null) return;
    try { await del(`/admin/events/${event.id}`, { confirm }); navigate('/admin/eventos'); }
    catch (e) { setMsg({ tone: 'error', text: (e as ApiError).message }); }
  };

  const addField = () => {
    const label = newField.trim();
    if (!label) return;
    set('custom', [...draft.custom, { label, required: false }]);
    setNewField('');
  };

  const rText = contrastRatio(colors.text, colors.bg);
  const rButton = contrastRatio('#FFFFFF', colors.button);
  const contrastOk = rText >= 4.5 && rButton >= 4.5;
  const ratios = `texto ${rText.toFixed(1)}:1 · botón ${rButton.toFixed(1)}:1`;
  const publicPath = event ? appUrl(`/firma/${event.slug}`) : null;
  const publicUrl = event ? absoluteUrl(`/firma/${event.slug}`) : '';

  if (loading) return <AdminLayout><div className="page-loading" aria-busy="true">Cargando…</div></AdminLayout>;

  return (
    <AdminLayout>
      <header className="admin-header">
        <div className="admin-header__titles">
          <Link to="/admin/eventos" className="small" style={{ textDecoration: 'none' }}>← Eventos</Link>
          <h1 className="admin-title">{isNew ? 'Nuevo evento' : 'Configurar evento'}</h1>
        </div>
        <div className="admin-header__actions" style={{ alignItems: 'center' }}>
          {event && <span className={`status status--${event.status === 'published' ? 'ok' : 'wait'}`}>{event.status === 'published' ? 'Publicado' : 'Borrador'}</span>}
          <button type="button" className="btn btn--outline btn--sm" style={{ minHeight: 46 }} disabled={busy} onClick={() => save('draft')}>
            {event?.status === 'published' ? 'Pasar a borrador' : 'Guardar borrador'}
          </button>
          <button type="button" className="btn btn--primary btn--sm" style={{ minHeight: 46 }} disabled={busy} onClick={() => save('published')}>
            {event?.status === 'published' ? 'Guardar cambios' : 'Publicar evento'}
          </button>
        </div>
      </header>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <div className="ev-layout">
        <div className="ev-form">
          <section className="card card--roomy">
            <h2 className="card-title card-title--lg">Información del evento</h2>
            <label className="lbl">Nombre del evento
              <input className="field" type="text" required maxLength={255} value={draft.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="lbl">Organización que convoca
              <input className="field" type="text" maxLength={255} value={draft.organization} onChange={(e) => set('organization', e.target.value)} />
            </label>
            <label className="lbl">Descripción
              <textarea className="field" rows={4} maxLength={5000} value={draft.description} onChange={(e) => set('description', e.target.value)} />
            </label>
            <label className="lbl">Link de la política de tratamiento de datos personales
              <input className="field" type="url" placeholder="https://tu-organizacion.org/politica-de-datos" value={draft.policyUrl} onChange={(e) => set('policyUrl', e.target.value)} />
            </label>
            <label className="lbl">Enlace público
              <span className="slug-field"><span className="mono small muted">{appUrl('/firma/')}</span>
                <input className="field" type="text" maxLength={120} placeholder="se genera del nombre" value={draft.slug} onChange={(e) => set('slug', e.target.value)} />
              </span>
            </label>
            <div className="grid-3">
              <label className="lbl">Apertura<input className="field" type="datetime-local" value={draft.opensAt} onChange={(e) => set('opensAt', e.target.value)} /></label>
              <label className="lbl">Cierre<input className="field" type="datetime-local" value={draft.closesAt} onChange={(e) => set('closesAt', e.target.value)} /></label>
              <label className="lbl">Meta de firmas<input className="field" type="number" min={1} placeholder="Opcional" value={draft.goal} onChange={(e) => set('goal', e.target.value)} /></label>
            </div>
          </section>

          <section className="card card--roomy">
            <h2 className="card-title card-title--lg">Identidad visual</h2>
            {event ? (
              <div className="grid-drops">
                {([['logo', 'Logo', 'PNG o SVG, fondo transparente, máx. 1 MB', 'image/png,image/svg+xml', event.logoUrl, 'upload'],
                  ['background', 'Imagen de fondo', 'JPG o WebP, 1920 × 1080 px recomendado, máx. 4 MB', 'image/jpeg,image/webp', event.backgroundUrl, 'image']] as const)
                  .map(([kind, title, hint, accept, url, icon]) => (
                    <div key={kind} className="drop-wrap">
                      <label className="drop">
                        {url ? <img src={url} alt="" className="drop__img" /> : <Icon name={icon} size={26} strokeWidth={1.6} color="#2C4BFF" />}
                        <strong>{title}</strong>
                        <span>{url ? 'Clic para reemplazar' : hint}</span>
                        <input type="file" accept={accept} onChange={(e) => upload(kind, e)} />
                      </label>
                      {url && <button type="button" className="link-btn small" onClick={() => removeUpload(kind)}>Quitar</button>}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="small muted">Guarda el evento para poder subir el logo y la imagen de fondo.</p>
            )}
            <div className="grid-swatches">
              {COLOR_FIELDS.map(({ key, label }) => (
                <label key={key} className="lbl">{label}
                  <span className="swatch">
                    <input type="color" value={colors[key]} aria-label={label} onChange={(e) => set('colors', { ...colors, [key]: e.target.value.toUpperCase() })} />
                    <span>{colors[key]}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="small" style={{ color: contrastOk ? 'var(--ok-fg)' : 'var(--bad-fg)' }}>
              {contrastOk ? `Contraste accesible: ${ratios}` : `Contraste bajo (${ratios}). Se recomienda al menos 4,5:1.`}
            </p>
          </section>

          <section className="card card--roomy">
            <h2 className="card-title card-title--lg">Campos de caracterización</h2>
            <p style={{ marginTop: -8, fontSize: 14 }}>Nombre, documento, correo, autorización y firma son fijos. Elige los demás.</p>
            <div className="chips">
              {OPTIONAL_FIELDS.map(([key, label]) => (
                <label key={key} className="chip">
                  <input type="checkbox" checked={draft.optional[key]} onChange={(e) => set('optional', { ...draft.optional, [key]: e.target.checked })} /> {label}
                </label>
              ))}
            </div>
            {draft.custom.length > 0 && (
              <ul className="custom-fields">
                {draft.custom.map((c, i) => (
                  <li key={c.id ?? `new-${i}`}>
                    <input className="field" value={c.label} aria-label="Nombre del campo" onChange={(e) => set('custom', draft.custom.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                    <label className="check-row"><input type="checkbox" checked={c.required} onChange={(e) => set('custom', draft.custom.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} /> Obligatorio</label>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => set('custom', draft.custom.filter((_, j) => j !== i))}>Quitar</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="btn-row" style={{ gap: 8 }}>
              <input className="field" style={{ flex: '1 1 220px' }} placeholder="Nombre del campo, p. ej. Barrio" value={newField}
                onChange={(e) => setNewField(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }} />
              <button type="button" className="btn btn--dashed" onClick={addField}>+ Agregar campo personalizado</button>
            </div>
            {draft.optional.municipality && (
              <label className="lbl">Municipios (uno por línea)
                <textarea className="field" rows={5} value={draft.municipalities} onChange={(e) => set('municipalities', e.target.value)} />
              </label>
            )}
          </section>

          <section className="card card--roomy">
            <h2 className="card-title card-title--lg">Animación y verificación</h2>
            <div className="grid-4">
              <label className="lbl">Animación Three.js
                <select className="field" value={draft.animation} onChange={(e) => set('animation', e.target.value as Draft['animation'])}>
                  <option value="both">Perros y gatos de un trazo</option><option value="cats">Solo gatos</option><option value="dogs">Solo perros</option><option value="off">Desactivada</option>
                </select>
              </label>
              <label className="lbl">Intensidad
                <select className="field" value={draft.intensity} onChange={(e) => set('intensity', e.target.value as Draft['intensity'])}>
                  <option value="subtle">Sutil</option><option value="medium">Media</option><option value="high">Alta</option>
                </select>
              </label>
            </div>

            <div className="verify-toggle">
              <label className="check-row verify-toggle__switch">
                <input type="checkbox" checked={draft.requireEmailCode} onChange={(e) => set('requireEmailCode', e.target.checked)} />
                <span><strong>Solicitar código de verificación por correo</strong><br />
                  <span className="small muted">El firmante recibe un código de 6 dígitos y debe escribirlo para que su firma quede registrada.</span></span>
              </label>
              {!draft.requireEmailCode && (
                <Alert tone="warn">
                  Sin el código, la firma queda registrada en cuanto la persona la dibuja y no se comprueba que el correo sea suyo: alguien podría firmar con un correo ajeno.
                  Úsalo solo en convocatorias de bajo riesgo o con verificación presencial. Las firmas quedarán marcadas como «Sin código» en el comprobante y en la exportación.
                </Alert>
              )}
              <fieldset className="verify-toggle__options" disabled={!draft.requireEmailCode} aria-label="Opciones del código de verificación">
                <div className="grid-4">
                  <label className="lbl">Vigencia del código
                    <select className="field" value={draft.codeTtlMinutes} onChange={(e) => set('codeTtlMinutes', Number(e.target.value))}>
                      <option value={10}>10 minutos</option><option value={5}>5 minutos</option><option value={15}>15 minutos</option>
                    </select>
                  </label>
                  <label className="lbl">Intentos máximos
                    <select className="field" value={draft.maxAttempts} onChange={(e) => set('maxAttempts', Number(e.target.value))}>
                      <option value={3}>3</option><option value={5}>5</option>
                    </select>
                  </label>
                </div>
                <label className="lbl">Asunto del correo de verificación
                  <input className="field" type="text" maxLength={255} value={draft.emailSubject} onChange={(e) => set('emailSubject', e.target.value)} />
                </label>
              </fieldset>
            </div>
            <label className="check-row"><input type="checkbox" checked={draft.sendReceipt} onChange={(e) => set('sendReceipt', e.target.checked)} /> Enviar comprobante con folio y hash al completar la firma</label>
          </section>

          {event && (
            <section className="card card--roomy danger">
              <h2 className="card-title card-title--lg">Eliminar evento</h2>
              <p className="small">Borra el evento, sus imágenes y todas las firmas recogidas. No se puede deshacer; exporta las firmas antes.</p>
              <button type="button" className="btn btn--outline btn--sm danger__btn" onClick={remove}>Eliminar evento</button>
            </section>
          )}
        </div>

        <aside aria-label="Vista previa" className="ev-side">
          <div className="card-head">
            <h2 className="card-title card-title--lg">Vista previa</h2>
            {publicPath && <a href={publicPath} target="_blank" rel="noreferrer" className="small" style={{ fontWeight: 500 }}>Abrir página pública</a>}
          </div>
          <div className="preview" style={{ background: colors.bg }}>
            <div className="preview__bar" style={{ color: colors.text }}>
              <span className="preview__logo">
                {event?.logoUrl ? <img src={event.logoUrl} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} /> : <CatMark color={colors.title} strokeWidth={9} size={20} />}
              </span>
              {draft.organization || 'Logo del evento'}
            </div>
            <div className="preview__body">
              <AnimalDrawing animal="dog" color={colors.button} style={{ width: 96, height: 96 }} />
              <h3 className="preview__title" style={{ color: colors.title }}>{draft.name}</h3>
              <p className="preview__desc" style={{ color: colors.text }}>{draft.description}</p>
              <div className="preview__form" aria-hidden="true">
                <span />
                <span />
                <span className="preview__sig">Firma</span>
                <span className="preview__cta" style={{ background: colors.button }}>Continuar a la firma</span>
              </div>
            </div>
          </div>
          {publicPath && (
            <div className="card" style={{ padding: 16, gap: 10 }}>
              <span className="small" style={{ fontWeight: 500 }}>Enlace público</span>
              <div className="btn-row" style={{ gap: 8 }}>
                <code className="link-box">{publicUrl}</code>
                <button type="button" className="btn btn--outline btn--tiny" onClick={() => navigator.clipboard?.writeText(publicUrl)}>Copiar</button>
                <button type="button" className="btn btn--outline btn--tiny" aria-expanded={showQr} onClick={() => setShowQr(!showQr)}>Código QR</button>
              </div>
              {showQr && (
                <div className="qr-share">
                  <div className="qr-share__img"><QrCode value={publicUrl} label={`Código QR del enlace ${publicUrl}`} /></div>
                  <button type="button" className="btn btn--outline btn--tiny" onClick={async () => {
                    const a = document.createElement('a');
                    a.href = await QRCode.toDataURL(publicUrl, { width: 1024, margin: 2 });
                    a.download = `qr-${event!.slug}.png`;
                    a.click();
                  }}>Descargar PNG</button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </AdminLayout>
  );
}
