import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { AnimalDrawing, CatMark } from '../components/LineArt';
import { Icon } from '../components/Icon';
import { useEvent, type EventColors } from '../data/event';
import { contrastRatio } from '../lib/contrast';
import './EventConfig.css';

const COLOR_FIELDS: { key: keyof EventColors; label: string }[] = [
  { key: 'bg', label: 'Fondo' },
  { key: 'title', label: 'Títulos' },
  { key: 'text', label: 'Texto' },
  { key: 'button', label: 'Botones' },
];

const OPTIONAL_FIELDS: [string, boolean][] = [
  ['Celular', true], ['Fecha de nacimiento', true], ['Género', true], ['Municipio', true],
  ['Zona urbana / rural', true], ['Grupo étnico', true], ['Convivencia con animales', true],
  ['Nivel educativo', false], ['Discapacidad', false],
];

/** Admin form to configure an event, with a live preview of the public page. */
export function EventConfig() {
  const { event, saveEvent } = useEvent();
  const [draft, setDraft] = useState(event);
  const [saved, setSaved] = useState<string | null>(null);
  const { colors } = draft;

  const setColor = (key: keyof EventColors, value: string) => setDraft((d) => ({ ...d, colors: { ...d.colors, [key]: value } }));
  const save = (msg: string) => { saveEvent(draft); setSaved(msg); };

  const rText = contrastRatio(colors.text, colors.bg);
  const rButton = contrastRatio('#FFFFFF', colors.button);
  const contrastOk = rText >= 4.5 && rButton >= 4.5;
  const ratios = `texto ${rText.toFixed(1)}:1 · botón ${rButton.toFixed(1)}:1`;
  const publicUrl = `[tu-dominio]/firma/${draft.slug}`;

  return (
    <AdminLayout>
      <header className="admin-header">
        <div className="admin-header__titles">
          <Link to="/admin" className="small" style={{ textDecoration: 'none' }}>← Eventos</Link>
          <h1 className="admin-title">Configurar evento</h1>
        </div>
        <div className="admin-header__actions" style={{ alignItems: 'center' }}>
          {saved && <span role="status" className="small tone-ok" style={{ color: 'var(--ok-fg)' }}>{saved}</span>}
          <button type="button" className="btn btn--outline btn--sm" style={{ minHeight: 46 }} onClick={() => save('Borrador guardado')}>Guardar borrador</button>
          <button type="button" className="btn btn--primary btn--sm" style={{ minHeight: 46 }} onClick={() => save('Evento publicado')}>Publicar evento</button>
        </div>
      </header>

      <div className="ev-layout">
        <div className="ev-form">
          <section className="card card--roomy">
            <h2 className="card-title card-title--lg">Información del evento</h2>
            <label className="lbl">Nombre del evento
              <input className="field" type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="lbl">Descripción
              <textarea className="field" rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </label>
            <label className="lbl">Link de la política de tratamiento de datos personales
              <input className="field" type="url" placeholder="https://tu-organizacion.org/politica-de-datos" value={draft.policyUrl}
                onChange={(e) => setDraft({ ...draft, policyUrl: e.target.value })} />
            </label>
            <div className="grid-3">
              <label className="lbl">Apertura<input className="field" type="datetime-local" /></label>
              <label className="lbl">Cierre<input className="field" type="datetime-local" /></label>
              <label className="lbl">Meta de firmas<input className="field" type="number" min={1} placeholder="[META]" /></label>
            </div>
          </section>

          <section className="card card--roomy">
            <h2 className="card-title card-title--lg">Identidad visual</h2>
            <div className="grid-drops">
              <label className="drop">
                <Icon name="upload" size={26} strokeWidth={1.6} color="#2C4BFF" />
                <strong>Logo</strong>
                <span>PNG o SVG, fondo transparente, máx. 1 MB</span>
                <input type="file" accept="image/png,image/svg+xml" />
              </label>
              <label className="drop">
                <Icon name="image" size={26} strokeWidth={1.6} color="#2C4BFF" />
                <strong>Imagen de fondo</strong>
                <span>JPG o WebP, 1920 × 1080 px recomendado</span>
                <input type="file" accept="image/jpeg,image/webp" />
              </label>
            </div>
            <div className="grid-swatches">
              {COLOR_FIELDS.map(({ key, label }) => (
                <label key={key} className="lbl">{label}
                  <span className="swatch">
                    <input type="color" value={colors[key]} aria-label={label} onChange={(e) => setColor(key, e.target.value)} />
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
              {OPTIONAL_FIELDS.map(([label, on]) => (
                <label key={label} className="chip"><input type="checkbox" defaultChecked={on} /> {label}</label>
              ))}
            </div>
            <button type="button" className="btn btn--dashed" style={{ alignSelf: 'flex-start' }}>+ Agregar campo personalizado</button>
          </section>

          <section className="card card--roomy">
            <h2 className="card-title card-title--lg">Animación y verificación</h2>
            <div className="grid-4">
              <label className="lbl">Animación Three.js
                <select className="field"><option>Perros y gatos de un trazo</option><option>Solo gatos</option><option>Solo perros</option><option>Desactivada</option></select>
              </label>
              <label className="lbl">Intensidad
                <select className="field"><option>Sutil</option><option>Media</option><option>Alta</option></select>
              </label>
              <label className="lbl">Vigencia del código
                <select className="field"><option>10 minutos</option><option>5 minutos</option><option>15 minutos</option></select>
              </label>
              <label className="lbl">Intentos máximos
                <select className="field"><option>3</option><option>5</option></select>
              </label>
            </div>
            <label className="lbl">Asunto del correo de verificación
              <input className="field" type="text" defaultValue="Tu código para confirmar la firma" />
            </label>
            <label className="check-row"><input type="checkbox" defaultChecked /> Enviar comprobante PDF con folio y hash al completar la firma</label>
          </section>
        </div>

        <aside aria-label="Vista previa" className="ev-side">
          <div className="card-head">
            <h2 className="card-title card-title--lg">Vista previa</h2>
            <Link to="/" className="small" style={{ fontWeight: 500 }}>Abrir página pública</Link>
          </div>
          <div className="preview" style={{ background: colors.bg }}>
            <div className="preview__bar" style={{ color: colors.text }}>
              <span className="preview__logo"><CatMark color={colors.title} strokeWidth={9} size={20} /></span>
              Logo del evento
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
          <div className="card" style={{ padding: 16, gap: 10 }}>
            <span className="small" style={{ fontWeight: 500 }}>Enlace público</span>
            <div className="btn-row" style={{ gap: 8 }}>
              <code className="link-box">{publicUrl}</code>
              <button type="button" className="btn btn--outline btn--tiny" onClick={() => navigator.clipboard?.writeText(publicUrl)}>Copiar</button>
              <button type="button" className="btn btn--outline btn--tiny">Código QR</button>
            </div>
          </div>
        </aside>
      </div>
    </AdminLayout>
  );
}
