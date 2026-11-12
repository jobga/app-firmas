/**
 * Configuración de un evento con vista previa en vivo.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { useEffect, useState, type ChangeEvent } from 'react';
import { loadGeo, type Department } from '../lib/geo';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { AnimalDrawing, CatMark } from '../components/LineArt';
import { Icon } from '../components/Icon';
import { Alert } from '../components/Alert';
import { QrCode } from '../components/QrCode';
import QRCode from 'qrcode';
import {
  api, ApiError, DEFAULT_CONSENT_DATA, DEFAULT_CONSENT_NEWS, DEFAULT_THANKS_TITLE, defaultThanksMessage, del, get, isExclusiveOption, post, put,
  type AdminEvent, type CustomField, type CustomFieldType, type EventColors, type ListKey, type OptionalField,
} from '../lib/api';
import { ConsentText } from './PublicSign';
import { contrastRatio } from '../lib/contrast';
import { absoluteUrl, appUrl } from '../lib/base';
import './EventConfig.css';

const COLOR_FIELDS: { key: keyof EventColors; label: string }[] = [
  { key: 'bg', label: 'Fondo' }, { key: 'title', label: 'Títulos' }, { key: 'text', label: 'Texto' }, { key: 'button', label: 'Botones' },
];
const FORM_COLOR_FIELDS: { key: keyof EventColors; label: string }[] = [
  { key: 'formBg', label: 'Fondo del formulario' }, { key: 'formTitle', label: 'Títulos del formulario' }, { key: 'formText', label: 'Texto del formulario' },
  { key: 'fieldBg', label: 'Fondo de los campos' }, { key: 'fieldBorder', label: 'Borde de los campos' },
];
const DEFAULT_COLORS: EventColors = {
  bg: '#F7F6F2', title: '#161616', text: '#3D3B36', button: '#2C4BFF',
  formBg: '#FFFFFF', formTitle: '#161616', formText: '#3D3B36', fieldBg: '#FFFFFF', fieldBorder: '#CFCCC4',
};

const OPTIONAL_FIELDS: [OptionalField, string][] = [
  ['phone', 'Celular'], ['birth_date', 'Fecha de nacimiento'], ['gender', 'Género'], ['municipality', 'Departamento y municipio'],
  ['zone', 'Zona urbana / rural'], ['ethnic_group', 'Grupo étnico'], ['pets', 'Convivencia con animales'],
  ['education', 'Nivel educativo'], ['disability', 'Discapacidad'],
];

/** Listas predeterminadas (iguales a LIST_FIELDS en server/app/events.php). */
const LIST_FIELDS: { key: ListKey; label: string; kind: 'select' | 'radio' | 'multi'; defaults: string[] }[] = [
  { key: 'gender', label: 'Género', kind: 'select', defaults: ['Femenino', 'Masculino', 'No binario', 'Prefiero no decir'] },
  { key: 'zone', label: 'Zona', kind: 'radio', defaults: ['Urbana', 'Rural'] },
  { key: 'ethnic_group', label: 'Grupo étnico', kind: 'select', defaults: ['Ninguno', 'Indígena', 'Afrocolombiano', 'Raizal', 'Palenquero', 'Rrom', 'Campesino'] },
  { key: 'pets', label: 'Animales', kind: 'multi', defaults: ['Perros', 'Gatos', 'Otros', 'Ninguno'] },
  { key: 'education', label: 'Nivel educativo', kind: 'select', defaults: ['Primaria', 'Secundaria', 'Técnico o tecnólogo', 'Universitario', 'Posgrado', 'Ninguno'] },
  { key: 'disability', label: 'Discapacidad', kind: 'select', defaults: ['No', 'Física', 'Visual', 'Auditiva', 'Cognitiva', 'Psicosocial', 'Múltiple'] },
];
const DEFAULT_LISTS = Object.fromEntries(LIST_FIELDS.map((f) => [f.key, f.defaults])) as Record<ListKey, string[]>;
const KIND_HINT = {
  select: 'Lista desplegable: el firmante elige una opción.',
  radio: 'Botones: el firmante elige una opción.',
  multi: 'Opción múltiple: el firmante puede marcar varias. «Ninguno» o «Ninguna» desmarca las demás.',
};
const TYPE_LABEL: Record<CustomFieldType, string> = { text: 'Texto', select: 'Lista', multi: 'Opción múltiple' };
/** Limpia las líneas escritas: sin espacios sobrantes, vacías ni repetidas. */
const cleanLines = (lines: string[]) => lines.map((l) => l.trim()).filter((l, i, a) => l && a.findIndex((x) => x.toLowerCase() === l.toLowerCase()) === i);

type Draft = {
  name: string; slug: string; description: string; organization: string; policyUrl: string;
  scheduleDates: boolean; opensAt: string; closesAt: string; showDates: boolean; goal: string; showCount: boolean; colors: EventColors;
  lineDrawings: 'animated' | 'static' | 'hidden';
  bannerEnabled: boolean; bannerPosition: 'above' | 'below'; bannerAlt: string;
  consentDataText: string; consentNewsEnabled: boolean; consentNewsText: string;
  thanksEnabled: boolean; thanksTitle: string; thanksMessage: string;
  optional: Record<OptionalField, boolean>; custom: CustomField[]; lists: Record<ListKey, string[]>; geoDeps: string[];
  codeTtlMinutes: number; maxAttempts: number; requireEmailCode: boolean; emailSubject: string; sendReceipt: boolean;
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const EMPTY: Draft = {
  name: 'Nuevo evento', slug: '', description: '', organization: '', policyUrl: '',
  scheduleDates: false, opensAt: '', closesAt: '', showDates: true, goal: '', showCount: true, lineDrawings: 'animated',
  colors: DEFAULT_COLORS,
  bannerEnabled: true, bannerPosition: 'below', bannerAlt: '',
  consentDataText: DEFAULT_CONSENT_DATA, consentNewsEnabled: true, consentNewsText: DEFAULT_CONSENT_NEWS,
  thanksEnabled: true, thanksTitle: '', thanksMessage: '',
  optional: { phone: true, birth_date: true, gender: true, municipality: true, zone: true, ethnic_group: true, pets: true, education: false, disability: false },
  custom: [], lists: DEFAULT_LISTS, geoDeps: [],
  codeTtlMinutes: 10, maxAttempts: 3, requireEmailCode: true, emailSubject: 'Tu código para confirmar la firma', sendReceipt: true,
};

function fromEvent(e: AdminEvent): Draft {
  return {
    name: e.name, slug: e.slug, description: e.description, organization: e.organization, policyUrl: e.policyUrl,
    scheduleDates: !!(e.opensAt || e.closesAt), opensAt: toLocalInput(e.opensAt), closesAt: toLocalInput(e.closesAt),
    showDates: e.showDates, goal: e.goal ? String(e.goal) : '', showCount: e.showCount, lineDrawings: e.lineDrawings,
    colors: { ...DEFAULT_COLORS, ...e.colors },
    bannerEnabled: e.bannerEnabled, bannerPosition: e.bannerPosition, bannerAlt: e.bannerAlt,
    consentDataText: e.consentDataText, consentNewsEnabled: e.consentNewsEnabled, consentNewsText: e.consentNewsText,
    thanksEnabled: e.thanks.enabled, thanksTitle: e.thanks.title ?? '', thanksMessage: e.thanks.message ?? '', optional: e.fields.optional, custom: e.fields.custom,
    lists: { ...DEFAULT_LISTS, ...e.fields.lists }, geoDeps: e.fields.geo.departments,
    codeTtlMinutes: e.codeTtlMinutes, maxAttempts: e.maxAttempts,
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
  const [newType, setNewType] = useState<CustomFieldType>('text');
  const [showQr, setShowQr] = useState(false);
  const [previewMode, setPreviewMode] = useState<'form' | 'thanks'>('form');

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
      policyUrl: draft.policyUrl,
      opensAt: draft.scheduleDates && draft.opensAt ? new Date(draft.opensAt).toISOString() : '',
      closesAt: draft.scheduleDates && draft.closesAt ? new Date(draft.closesAt).toISOString() : '',
      showDates: draft.showDates, goal: draft.goal ? Number(draft.goal) : null, showCount: draft.showCount, lineDrawings: draft.lineDrawings,
      colors, bannerEnabled: draft.bannerEnabled, bannerPosition: draft.bannerPosition, bannerAlt: draft.bannerAlt,
      consentDataText: draft.consentDataText, consentNewsEnabled: draft.consentNewsEnabled, consentNewsText: draft.consentNewsText,
      thanksEnabled: draft.thanksEnabled, thanksTitle: draft.thanksTitle, thanksMessage: draft.thanksMessage,
      fields: {
        optional: draft.optional,
        custom: draft.custom.map((c) => ({ ...c, options: c.type === 'text' ? [] : cleanLines(c.options) })),
        lists: Object.fromEntries(LIST_FIELDS.map((f) => [f.key, cleanLines(draft.lists[f.key])])),
        geo: { departments: draft.geoDeps },
      },
      codeTtlMinutes: draft.codeTtlMinutes, maxAttempts: draft.maxAttempts,
      requireEmailCode: draft.requireEmailCode, emailSubject: draft.emailSubject, sendReceipt: draft.sendReceipt,
    };
    if (draft.scheduleDates && draft.opensAt && draft.closesAt && new Date(draft.closesAt) <= new Date(draft.opensAt)) {
      setBusy(false);
      setMsg({ tone: 'error', text: 'El cierre debe ser posterior a la apertura.' });
      return;
    }
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

  const upload = async (kind: 'logo' | 'background' | 'banner', e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !event) return;
    const fd = new FormData();
    fd.append('file', file);
    setMsg(null);
    try {
      const saved = await api<AdminEvent>(`/admin/events/${event.id}/upload?kind=${kind}`, 'POST', fd);
      setEvent(saved);
      setMsg({ tone: 'ok', text: { logo: 'Logo actualizado', background: 'Imagen de fondo actualizada', banner: 'Banner actualizado' }[kind] });
    } catch (err) { setMsg({ tone: 'error', text: (err as ApiError).message }); }
  };

  const removeUpload = async (kind: 'logo' | 'background' | 'banner') => {
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
    set('custom', [...draft.custom, { label, required: false, type: newType, options: newType === 'text' ? [] : ['Opción 1', 'Opción 2'] }]);
    setNewField('');
  };

  const rText = contrastRatio(colors.text, colors.bg);
  const rButton = contrastRatio('#FFFFFF', colors.button);
  const contrastOk = rText >= 4.5 && rButton >= 4.5;
  const ratios = `texto ${rText.toFixed(1)}:1 · botón ${rButton.toFixed(1)}:1`;
  const rForm = Math.min(contrastRatio(colors.formText, colors.formBg), contrastRatio(colors.formTitle, colors.formBg));
  const rField = contrastRatio(colors.formTitle, colors.fieldBg);
  const formContrastOk = rForm >= 4.5 && rField >= 4.5;
  const formRatios = `texto sobre el formulario ${rForm.toFixed(1)}:1 · texto en los campos ${rField.toFixed(1)}:1`;
  const bannerUrl = event?.bannerUrl ?? null;
  const banner = bannerUrl && draft.bannerEnabled ? <img className="preview__banner" src={bannerUrl} alt="" /> : null;
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
            <div className="option-block">
              <label className="check-row">
                <input type="checkbox" checked={draft.scheduleDates} onChange={(e) => set('scheduleDates', e.target.checked)} />
                <span><strong>Programar fechas de apertura y cierre</strong><br />
                  <span className="small muted">Fuera de estas fechas el formulario no recibe firmas. Sin fechas, recibe firmas mientras el evento esté publicado.</span></span>
              </label>
              {draft.scheduleDates && (
                <>
                  <div className="grid-3">
                    <label className="lbl">Apertura<input className="field" type="datetime-local" value={draft.opensAt} onChange={(e) => set('opensAt', e.target.value)} /></label>
                    <label className="lbl">Cierre<input className="field" type="datetime-local" value={draft.closesAt} onChange={(e) => set('closesAt', e.target.value)} /></label>
                  </div>
                  <label className="check-row">
                    <input type="checkbox" checked={draft.showDates} onChange={(e) => set('showDates', e.target.checked)} /> Mostrar las fechas en la página pública
                  </label>
                </>
              )}
            </div>
            <div className="option-block">
              <label className="check-row">
                <input type="checkbox" checked={draft.showCount} onChange={(e) => set('showCount', e.target.checked)} />
                <span><strong>Mostrar el número de firmas verificadas</strong><br />
                  <span className="small muted">Si lo ocultas, la página pública tampoco muestra la barra de avance hacia la meta.</span></span>
              </label>
              <label className="lbl" style={{ maxWidth: 240 }}>Meta de firmas<input className="field" type="number" min={1} placeholder="Opcional" value={draft.goal} onChange={(e) => set('goal', e.target.value)} /></label>
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
              <p className="small muted">Guarda el evento para poder subir el logo, la imagen de fondo y el banner.</p>
            )}

            <div className="option-block">
              <h3 className="card-title">Banner</h3>
              <p className="small muted" style={{ marginTop: -6 }}>Imagen horizontal que se muestra encima o debajo de la descripción del evento.</p>
              {event ? (
                <>
                  <div className="drop-wrap">
                    <label className="drop drop--wide">
                      {bannerUrl ? <img src={bannerUrl} alt="" className="drop__banner" /> : <Icon name="image" size={26} strokeWidth={1.6} color="#2C4BFF" />}
                      <strong>Banner</strong>
                      <span>{bannerUrl ? 'Clic para reemplazar' : 'JPG, PNG o WebP, 1600 × 600 px recomendado, máx. 3 MB'}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload('banner', e)} />
                    </label>
                    {bannerUrl && <button type="button" className="link-btn small" onClick={() => removeUpload('banner')}>Quitar banner</button>}
                  </div>
                  {bannerUrl && (
                    <>
                      <label className="check-row"><input type="checkbox" checked={draft.bannerEnabled} onChange={(e) => set('bannerEnabled', e.target.checked)} /> Mostrar el banner en la página pública</label>
                      <fieldset className="verify-toggle__options" disabled={!draft.bannerEnabled}>
                        <div className="grid-fields">
                          <label className="lbl">Posición
                            <select className="field" value={draft.bannerPosition} onChange={(e) => set('bannerPosition', e.target.value as Draft['bannerPosition'])}>
                              <option value="above">Encima de la descripción</option>
                              <option value="below">Debajo de la descripción</option>
                            </select>
                          </label>
                          <label className="lbl">Texto alternativo (accesibilidad)
                            <input className="field" maxLength={255} placeholder="Describe la imagen" value={draft.bannerAlt} onChange={(e) => set('bannerAlt', e.target.value)} />
                          </label>
                        </div>
                      </fieldset>
                    </>
                  )}
                </>
              ) : <p className="small muted">Guarda el evento para subir el banner.</p>}
            </div>

            <div className="option-block">
              <label className="lbl" style={{ maxWidth: 360 }}>Dibujos de líneas (gato y perro)
                <select className="field" value={draft.lineDrawings} onChange={(e) => set('lineDrawings', e.target.value as Draft['lineDrawings'])}>
                  <option value="animated">Mostrar con animación del trazo</option>
                  <option value="static">Mostrar sin animación</option>
                  <option value="hidden">No mostrar</option>
                </select>
              </label>
            </div>

            <h3 className="card-title">Colores de la página</h3>
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

            <h3 className="card-title">Colores del formulario</h3>
            <div className="grid-swatches">
              {FORM_COLOR_FIELDS.map(({ key, label }) => (
                <label key={key} className="lbl">{label}
                  <span className="swatch">
                    <input type="color" value={colors[key]} aria-label={label} onChange={(e) => set('colors', { ...colors, [key]: e.target.value.toUpperCase() })} />
                    <span>{colors[key]}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="btn-row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <p className="small" style={{ color: formContrastOk ? 'var(--ok-fg)' : 'var(--bad-fg)' }}>
                {formContrastOk ? `Contraste accesible: ${formRatios}` : `Contraste bajo (${formRatios}). Se recomienda al menos 4,5:1.`}
              </p>
              <button type="button" className="link-btn small" onClick={() => set('colors', { ...colors, formBg: DEFAULT_COLORS.formBg, formTitle: DEFAULT_COLORS.formTitle, formText: DEFAULT_COLORS.formText, fieldBg: DEFAULT_COLORS.fieldBg, fieldBorder: DEFAULT_COLORS.fieldBorder })}>
                Restaurar colores del formulario
              </button>
            </div>
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
                    <select className="field field--type" value={c.type} aria-label="Tipo de campo"
                      onChange={(e) => { const type = e.target.value as CustomFieldType; set('custom', draft.custom.map((x, j) => j === i ? { ...x, type, options: type === 'text' ? [] : x.options.length ? x.options : ['Opción 1', 'Opción 2'] } : x)); }}>
                      {(Object.keys(TYPE_LABEL) as CustomFieldType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </select>
                    <label className="check-row"><input type="checkbox" checked={c.required} onChange={(e) => set('custom', draft.custom.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} /> Obligatorio</label>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => set('custom', draft.custom.filter((_, j) => j !== i))}>Quitar</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="btn-row" style={{ gap: 8 }}>
              <input className="field" style={{ flex: '1 1 220px' }} placeholder="Nombre del campo, p. ej. Barrio" value={newField}
                onChange={(e) => setNewField(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }} />
              <select className="field field--type" value={newType} aria-label="Tipo del campo nuevo" onChange={(e) => setNewType(e.target.value as CustomFieldType)}>
                {(Object.keys(TYPE_LABEL) as CustomFieldType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
              <button type="button" className="btn btn--dashed" onClick={addField}>+ Agregar campo personalizado</button>
            </div>
            <FieldOptionsTabs draft={draft} set={set} />
          </section>

          <section className="card card--roomy">
            <h2 className="card-title card-title--lg">Textos de autorización</h2>
            <label className="lbl">Autorización de tratamiento de datos (obligatoria)
              <textarea className="field" rows={4} maxLength={2000} value={draft.consentDataText} onChange={(e) => set('consentDataText', e.target.value)} />
            </label>
            <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: -6 }}>
              <span className="small muted">Escribe <code>{'{politica}'}</code> donde quieras el enlace a la política de tratamiento de datos.</span>
              <button type="button" className="link-btn small" onClick={() => set('consentDataText', DEFAULT_CONSENT_DATA)}>Restaurar texto original</button>
            </div>
            <div className="option-block">
              <label className="check-row"><input type="checkbox" checked={draft.consentNewsEnabled} onChange={(e) => set('consentNewsEnabled', e.target.checked)} /> Mostrar una segunda casilla (opcional para el firmante)</label>
              <fieldset className="verify-toggle__options" disabled={!draft.consentNewsEnabled}>
                <label className="lbl">Texto de la segunda casilla
                  <textarea className="field" rows={2} maxLength={1000} value={draft.consentNewsText} onChange={(e) => set('consentNewsText', e.target.value)} />
                </label>
                <button type="button" className="link-btn small" style={{ alignSelf: 'flex-end', marginTop: -8 }} onClick={() => set('consentNewsText', DEFAULT_CONSENT_NEWS)}>Restaurar texto original</button>
              </fieldset>
            </div>
          </section>

          <section className="card card--roomy">
            <h2 className="card-title card-title--lg">Mensaje de agradecimiento</h2>
            <label className="check-row">
              <input type="checkbox" checked={draft.thanksEnabled} onChange={(e) => { set('thanksEnabled', e.target.checked); setPreviewMode('thanks'); }} />
              <span><strong>Mostrar título y mensaje al terminar la firma</strong><br />
                <span className="small muted">Si lo desactivas, la pantalla final solo muestra el folio y los botones del comprobante.</span></span>
            </label>
            <fieldset className="verify-toggle__options" disabled={!draft.thanksEnabled} onFocus={() => setPreviewMode('thanks')}>
              <label className="lbl">Título
                <input className="field" maxLength={255} placeholder={DEFAULT_THANKS_TITLE} value={draft.thanksTitle} onChange={(e) => set('thanksTitle', e.target.value)} />
              </label>
              <label className="lbl">Mensaje
                <textarea className="field" rows={3} maxLength={2000} placeholder={defaultThanksMessage(draft.sendReceipt)} value={draft.thanksMessage} onChange={(e) => set('thanksMessage', e.target.value)} />
              </label>
              <span className="small muted" style={{ marginTop: -8 }}>Deja un campo vacío para usar el texto predeterminado.</span>
            </fieldset>
          </section>

          <section className="card card--roomy">
            <h2 className="card-title card-title--lg">Verificación y comprobante</h2>

            <div className="verify-toggle verify-toggle--first">
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
          <div className="preview-tabs" role="group" aria-label="Qué mostrar en la vista previa">
            <button type="button" className={previewMode === 'form' ? 'is-active' : undefined} aria-pressed={previewMode === 'form'} onClick={() => setPreviewMode('form')}>Formulario</button>
            <button type="button" className={previewMode === 'thanks' ? 'is-active' : undefined} aria-pressed={previewMode === 'thanks'} onClick={() => setPreviewMode('thanks')}>Pantalla final</button>
          </div>
          <div className="preview" style={{ background: colors.bg }}>
            <div className="preview__bar" style={{ color: colors.text }}>
              <span className="preview__logo">
                {event?.logoUrl ? <img src={event.logoUrl} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} /> : <CatMark color={colors.title} strokeWidth={9} size={20} />}
              </span>
              {draft.organization || 'Logo del evento'}
            </div>
            <div className="preview__body">
              {draft.lineDrawings !== 'hidden' && <AnimalDrawing animal="dog" color={colors.button} animated={draft.lineDrawings === 'animated'} style={{ width: 96, height: 96 }} />}
              <h3 className="preview__title" style={{ color: colors.title }}>{draft.name}</h3>
              {draft.bannerPosition === 'above' && banner}
              <p className="preview__desc" style={{ color: colors.text }}>{draft.description}</p>
              {draft.bannerPosition === 'below' && banner}
              {draft.showCount && (
                <p className="preview__count" style={{ color: colors.title }}>
                  <strong>{(event?.verifiedCount ?? 0).toLocaleString('es-CO')}</strong>
                  <span style={{ color: colors.text }}> firmas verificadas{draft.goal ? ` de ${Number(draft.goal).toLocaleString('es-CO')}` : ''}</span>
                </p>
              )}
              {draft.scheduleDates && draft.showDates && (draft.opensAt || draft.closesAt) && (
                <p className="preview__dates" style={{ color: colors.text }}>
                  {draft.opensAt && <span>Apertura: {new Date(draft.opensAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })}</span>}
                  {draft.closesAt && <span>Cierre: {new Date(draft.closesAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })}</span>}
                </p>
              )}
              {previewMode === 'form' ? (
                <div className="preview__form" style={{ background: colors.formBg, color: colors.formText }}>
                  <span className="preview__label">Nombres y apellidos</span>
                  <span className="preview__field" style={{ background: colors.fieldBg, borderColor: colors.fieldBorder }} />
                  <span className="preview__label">Correo electrónico</span>
                  <span className="preview__field" style={{ background: colors.fieldBg, borderColor: colors.fieldBorder }} />
                  <span className="preview__consent">
                    <span className="preview__check" style={{ borderColor: colors.fieldBorder }} />
                    <span><ConsentText text={draft.consentDataText || DEFAULT_CONSENT_DATA} policyUrl={draft.policyUrl} /> *</span>
                  </span>
                  {draft.consentNewsEnabled && (
                    <span className="preview__consent">
                      <span className="preview__check" style={{ borderColor: colors.fieldBorder }} />
                      <span>{draft.consentNewsText || DEFAULT_CONSENT_NEWS}</span>
                    </span>
                  )}
                  <span className="preview__cta" style={{ background: colors.button }}>Continuar a la firma</span>
                </div>
              ) : (
                <div className="preview__form preview__thanks" style={{ background: colors.formBg, color: colors.formText }}>
                  {draft.lineDrawings !== 'hidden' && <AnimalDrawing animal="cat" color={colors.button} animated={draft.lineDrawings === 'animated'} style={{ width: 64, height: 64 }} />}
                  {draft.thanksEnabled && (
                    <>
                      <strong style={{ color: colors.formTitle }}>{draft.thanksTitle || DEFAULT_THANKS_TITLE}</strong>
                      <span className="preview__msg">{draft.thanksMessage || defaultThanksMessage(draft.sendReceipt)}</span>
                    </>
                  )}
                  <span className="preview__folio">Folio: AN-000123</span>
                  <span className="preview__cta" style={{ background: colors.button }}>Descargar comprobante</span>
                </div>
              )}
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

type Tab = { id: string; label: string };

/** Pestañas para ajustar las opciones de cada campo de lista u opción múltiple activo, y el alcance geográfico. */
function FieldOptionsTabs({ draft, set }: { draft: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void }) {
  const tabs: Tab[] = [
    ...(draft.optional.municipality ? [{ id: 'geo', label: 'Departamentos' }] : []),
    ...LIST_FIELDS.filter((f) => draft.optional[f.key]).map((f) => ({ id: f.key, label: f.label })),
    ...draft.custom.map((c, i) => ({ c, i })).filter(({ c }) => c.type !== 'text').map(({ c, i }) => ({ id: `custom:${i}`, label: c.label || `Campo ${i + 1}` })),
  ];
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  const listField = LIST_FIELDS.find((f) => f.key === current.id);
  const customIndex = current.id.startsWith('custom:') ? Number(current.id.slice(7)) : -1;
  const custom = customIndex >= 0 ? draft.custom[customIndex] : null;
  const lines = listField ? draft.lists[listField.key] : custom?.options ?? [];
  const kind = listField ? listField.kind : custom?.type === 'multi' ? 'multi' : 'select';
  const setLines = (v: string[]) => {
    if (listField) set('lists', { ...draft.lists, [listField.key]: v });
    else if (custom) set('custom', draft.custom.map((x, j) => (j === customIndex ? { ...x, options: v } : x)));
  };
  const count = cleanLines(lines).length;
  const tabKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = tabs[(i + d + tabs.length) % tabs.length];
    setActive(next.id);
    document.getElementById(`opt-tab-${next.id}`)?.focus();
  };

  return (
    <div className="opt-tabs">
      <h3 className="opt-tabs__title">Opciones de las listas</h3>
      <div className="opt-tabs__list" role="tablist" aria-label="Campos con lista de opciones">
        {tabs.map((t, i) => (
          <button key={t.id} id={`opt-tab-${t.id}`} type="button" role="tab" aria-selected={t.id === current.id} aria-controls="opt-panel"
            tabIndex={t.id === current.id ? 0 : -1} className="opt-tab" onClick={() => setActive(t.id)} onKeyDown={(e) => tabKey(e, i)}>
            {t.label}
          </button>
        ))}
      </div>
      <div id="opt-panel" className="opt-tabs__panel" role="tabpanel" aria-labelledby={`opt-tab-${current.id}`}>
        {current.id === 'geo' ? (
          <GeoScope selected={draft.geoDeps} onChange={(v) => set('geoDeps', v)} />
        ) : (
          <>
            <p className="small muted" style={{ margin: 0 }}>{KIND_HINT[kind]}</p>
            <label className="lbl">Opciones (una por línea) · {count} {count === 1 ? 'opción' : 'opciones'}
              <textarea className="field" rows={Math.min(10, Math.max(4, lines.length + 1))} value={lines.join('\n')}
                onChange={(e) => setLines(e.target.value.split('\n'))} />
            </label>
            {count < 2 && <p className="small" style={{ color: 'var(--bad-fg)', margin: 0 }}>Agrega al menos 2 opciones.</p>}
            {kind === 'multi' && !cleanLines(lines).some(isExclusiveOption) && (
              <p className="small muted" style={{ margin: 0 }}>Consejo: agrega «Ninguno» si el firmante puede no marcar ninguna opción.</p>
            )}
            {listField && (
              <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}
                onClick={() => setLines(listField.defaults)}>Restaurar opciones predeterminadas</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Departamentos que puede elegir el firmante (todo el país o una selección). */
function GeoScope({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [geo, setGeo] = useState<Department[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { loadGeo().then(setGeo).catch(() => setErr(true)); }, []);
  if (err) return <p className="small" style={{ color: 'var(--bad-fg)' }}>No se pudo cargar la lista de departamentos.</p>;
  if (!geo) return <p className="small muted">Cargando departamentos…</p>;
  const all = selected.length === 0;
  const munis = (all ? geo : geo.filter((d) => selected.includes(d.code))).reduce((n, d) => n + d.municipalities.length, 0);
  const toggle = (code: string, on: boolean) => onChange(on ? [...selected, code] : selected.filter((c) => c !== code));
  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>Lista oficial del DANE (DIVIPOLA). El firmante elige departamento y luego municipio.</p>
      <div className="chips" role="radiogroup" aria-label="Alcance">
        <label className="chip"><input type="radio" name="geo-scope" checked={all} onChange={() => onChange([])} /> Todo el país</label>
        <label className="chip"><input type="radio" name="geo-scope" checked={!all} onChange={() => { if (all) onChange(['52']); }} /> Solo algunos departamentos</label>
      </div>
      {!all && (
        <div className="geo-grid">
          {geo.map((d) => (
            <label key={d.code} className="check-row">
              <input type="checkbox" checked={selected.includes(d.code)} disabled={selected.length === 1 && selected.includes(d.code)}
                onChange={(e) => toggle(d.code, e.target.checked)} /> {d.name} <span className="xsmall muted">({d.municipalities.length})</span>
            </label>
          ))}
        </div>
      )}
      <p className="small" style={{ margin: 0 }}><strong>{all ? geo.length : selected.length}</strong> departamentos · <strong>{munis.toLocaleString('es-CO')}</strong> municipios disponibles</p>
    </>
  );
}
