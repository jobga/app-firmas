/**
 * Página pública: datos → firma dibujada → código por correo → comprobante.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, fmtDate, fmtDateTime, fmtNumber, get, post, type PublicEvent, type Receipt } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { absoluteUrl, apiUrl } from '../lib/base';
import { AnimalDrawing, CatAndDog, CatMark } from '../components/LineArt';
import { Icon } from '../components/Icon';
import { CodeInput } from '../components/CodeInput';
import { Alert } from '../components/Alert';
import { SignaturePad, type SignaturePadHandle } from '../components/SignaturePad';
import './PublicSign.css';

const LineField = lazy(() => import('../components/LineField'));

const STEP_LABELS = ['Datos', 'Firma', 'Verificación', 'Listo'];
const DOC_TYPES = ['Cédula de ciudadanía', 'Cédula de extranjería', 'PEP / PPT', 'Pasaporte'];
const GENDERS = ['Femenino', 'Masculino', 'No binario', 'Prefiero no decir'];
const ETHNIC = ['Ninguno', 'Indígena', 'Afrocolombiano', 'Raizal', 'Palenquero', 'Rrom', 'Campesino'];
const EDUCATION = ['Primaria', 'Secundaria', 'Técnico o tecnólogo', 'Universitario', 'Posgrado', 'Ninguno'];
const PETS = ['Perros', 'Gatos', 'Otros', 'Ninguno'];

function maskEmail(email: string) {
  const at = email.indexOf('@');
  return at > 0 ? email[0] + '•••' + email.slice(at) : 'tu correo';
}

export function PublicSign() {
  const { slug } = useParams();
  const { data: event, error, loading } = useAsync(() => get<PublicEvent>(slug ? `/events/${encodeURIComponent(slug)}` : '/events/current'), [slug]);

  useEffect(() => {
    if (event) {
      document.title = event.name;
      post(`/events/${event.slug}/visit`).catch(() => undefined);
    }
  }, [event]);

  if (loading && !event) return <div className="page-loading" aria-busy="true">Cargando…</div>;
  if (error || !event) {
    return (
      <div className="pub" style={{ '--ev-bg': '#F7F6F2', '--ev-title': '#161616', '--ev-text': '#3D3B36' } as CSSProperties}>
        <main className="pub__empty">
          <AnimalDrawing animal="cat" color="#161616" label="Gato dibujado en una sola línea" style={{ width: 140, height: 140 }} />
          <h1 className="step__title">{error?.status === 404 ? 'No hay una convocatoria abierta' : 'No pudimos cargar la convocatoria'}</h1>
          <p className="muted">{error?.status === 404 ? 'Revisa el enlace que recibiste o vuelve más tarde.' : error?.message}</p>
        </main>
      </div>
    );
  }
  return <SignFlow event={event} />;
}

function SignFlow({ event }: { event: PublicEvent }) {
  const { colors, fields } = event;
  const opt = fields.optional;
  const [step, setStep] = useState(1);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [signed, setSigned] = useState(false);
  const [code, setCode] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sigRef = useRef<SignaturePadHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const policyHref = event.policyUrl || '#politica';
  const progress = event.goal ? Math.min(100, (event.verifiedCount / event.goal) * 100) : null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null); setNotice(null);
    try { await fn(); } catch (e) {
      const ae = e as ApiError;
      setErr(ae.message);
      if (ae.field && formRef.current) (formRef.current.elements.namedItem(ae.field) as HTMLElement | null)?.focus();
    } finally { setBusy(false); }
  };

  const submitData = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => (fd.get(k) as string | null) ?? '';
    const custom: Record<string, string> = {};
    fields.custom.forEach((c) => { if (c.id) custom[c.id] = s(`custom_${c.id}`); });
    run(async () => {
      const r = await post<{ token: string }>(`/events/${event.slug}/signatures`, {
        fullName: s('fullName'), docType: s('docType'), docNumber: s('docNumber'), email: s('email'), phone: s('phone'),
        birthDate: s('birthDate'), gender: s('gender'), municipality: s('municipality'), zone: s('zone'), ethnicGroup: s('ethnicGroup'),
        education: s('education'), disability: s('disability'), pets: fd.getAll('pets'),
        consentData: fd.get('consentData') === 'on', consentNews: fd.get('consentNews') === 'on', custom,
      });
      setToken(r.token);
      setStep(2);
    });
  };

  const sendSignature = () => run(async () => {
    const image = sigRef.current?.toDataURL();
    if (!signed || !image) throw new ApiError(422, 'Dibuja tu firma dentro del recuadro.');
    await post(`/signatures/${token}/sign`, { image });
    setStep(3);
  });

  const verify = () => run(async () => {
    if (code.length !== 6) throw new ApiError(422, 'Escribe los 6 dígitos del código.');
    setReceipt(await post<Receipt>(`/signatures/${token}/verify`, { code }));
    setStep(4);
  });

  const resend = () => run(async () => {
    await post(`/signatures/${token}/resend`);
    setNotice('Te enviamos un nuevo código. Revisa también la carpeta de spam.');
  });

  const share = async () => {
    const url = absoluteUrl('/firma/' + event.slug);
    if (navigator.share) await navigator.share({ title: event.name, url }).catch(() => undefined);
    else { await navigator.clipboard?.writeText(url); setNotice('Enlace copiado al portapapeles.'); }
  };

  const themeVars = {
    '--ev-bg': colors.bg, '--ev-title': colors.title, '--ev-text': colors.text, '--ev-button': colors.button, '--btn-bg': colors.button,
    ...(event.backgroundUrl ? { backgroundImage: `linear-gradient(${colors.bg}e6, ${colors.bg}e6), url("${event.backgroundUrl}")` } : {}),
  } as CSSProperties;

  return (
    <div className="pub" style={themeVars}>
      {event.animation !== 'off' && (
        <Suspense fallback={null}>
          <LineField animation={event.animation} intensity={event.intensity} catColor={colors.title} dogColor={colors.button} />
        </Suspense>
      )}
      <header className="pub__header">
        <div className="pub__org">
          <div className="pub__logo">
            {event.logoUrl ? <img src={event.logoUrl} alt="" /> : <CatMark color={colors.title} strokeWidth={7} size={34} />}
          </div>
          <div className="pub__org-text">
            <span className="pub__org-name">{event.organization || event.name}</span>
            {event.status === 'draft' && <span className="xsmall">Vista previa de un borrador (solo administradores)</span>}
          </div>
        </div>
        <a href={policyHref} className="pub__policy-link" target={event.policyUrl ? '_blank' : undefined} rel="noreferrer">Política de tratamiento de datos</a>
      </header>

      <main className="pub__main">
        <section className="pub__intro">
          <span className="pub__badge">Recolección de firmas · {event.isOpen ? 'abierta' : 'cerrada'}</span>
          <h1 className="pub__title">{event.name}</h1>
          {event.description && <p className="pub__desc">{event.description}</p>}
          <div className="pub__stats">
            <div className="pub__stat"><strong>{fmtNumber(event.verifiedCount)}</strong>firmas verificadas{event.goal ? ` de ${fmtNumber(event.goal)}` : ''}</div>
            {event.closesAt && <div className="pub__stat"><strong>{fmtDate(event.closesAt)}</strong>cierre de la convocatoria</div>}
          </div>
          {progress !== null && (
            <div className="pub__goal" role="progressbar" aria-label="Avance hacia la meta" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${progress}%` }} />
            </div>
          )}
          <CatAndDog catColor={colors.title} dogColor={colors.button} style={{ width: '100%', maxWidth: 460, height: 'auto' }} />
        </section>

        <section aria-label="Formulario de firma" className="pub__panel">
          {!event.isOpen && step < 4 ? (
            <div className="step">
              <h2 className="step__title">La recolección no está abierta</h2>
              <p className="step__sub">
                {event.opensAt && new Date(event.opensAt) > new Date()
                  ? `Abre el ${fmtDateTime(event.opensAt)}.`
                  : 'Esta convocatoria ya cerró. Gracias por tu interés.'}
              </p>
            </div>
          ) : (
            <>
              <ol className="steps">
                {STEP_LABELS.map((label, i) => (
                  <li key={label} className={i + 1 <= step ? 'is-done' : undefined} aria-current={i + 1 === step ? 'step' : undefined}>
                    <span className="steps__bar" />
                    <span className="steps__label">{i + 1}. {label}</span>
                  </li>
                ))}
              </ol>

              <Alert>{err}</Alert>
              <Alert tone="ok">{notice}</Alert>

              {step === 1 && (
                <form ref={formRef} className="step rise" onSubmit={submitData}>
                  <div className="step__head">
                    <h2 className="step__title">Tus datos</h2>
                    <p className="step__sub">Todos los campos con * son obligatorios.</p>
                  </div>
                  <div className="grid-fields">
                    <label className="lbl lbl--full">Nombres y apellidos *<input className="field" name="fullName" type="text" required maxLength={200} autoComplete="name" /></label>
                    <label className="lbl">Tipo de documento *
                      <select className="field" name="docType" required>{DOC_TYPES.map((d) => <option key={d}>{d}</option>)}</select>
                    </label>
                    <label className="lbl">Número de documento *<input className="field" name="docNumber" type="text" inputMode="numeric" required maxLength={40} /></label>
                    <label className="lbl">Correo electrónico *<input className="field" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                    {opt.phone && <label className="lbl">Celular<input className="field" name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>}
                    {opt.birth_date && <label className="lbl">Fecha de nacimiento *<input className="field" name="birthDate" type="date" required max={new Date().toISOString().slice(0, 10)} /></label>}
                    {opt.gender && (
                      <label className="lbl">Género *
                        <select className="field" name="gender" required defaultValue=""><option value="" disabled>Selecciona…</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select>
                      </label>
                    )}
                    {opt.municipality && (
                      <label className="lbl">Municipio *
                        <select className="field" name="municipality" required defaultValue=""><option value="" disabled>Selecciona…</option>{event.municipalities.map((m) => <option key={m}>{m}</option>)}</select>
                      </label>
                    )}
                    {opt.ethnic_group && (
                      <label className="lbl">Grupo étnico o poblacional
                        <select className="field" name="ethnicGroup">{ETHNIC.map((g) => <option key={g}>{g}</option>)}</select>
                      </label>
                    )}
                    {opt.education && (
                      <label className="lbl">Nivel educativo
                        <select className="field" name="education" defaultValue=""><option value="">Prefiero no decir</option>{EDUCATION.map((g) => <option key={g}>{g}</option>)}</select>
                      </label>
                    )}
                    {opt.disability && (
                      <label className="lbl">¿Tienes alguna discapacidad?
                        <select className="field" name="disability" defaultValue=""><option value="">Prefiero no decir</option><option>No</option><option>Física</option><option>Visual</option><option>Auditiva</option><option>Cognitiva</option><option>Psicosocial</option><option>Múltiple</option></select>
                      </label>
                    )}
                    {fields.custom.map((c) => (
                      <label key={c.id} className="lbl">{c.label}{c.required ? ' *' : ''}
                        <input className="field" name={`custom_${c.id}`} type="text" required={c.required} maxLength={500} />
                      </label>
                    ))}
                  </div>
                  {opt.zone && (
                    <fieldset className="fieldset">
                      <legend>Zona de residencia *</legend>
                      <div className="chips">
                        <label className="chip"><input type="radio" name="zone" value="Urbana" defaultChecked /> Urbana</label>
                        <label className="chip"><input type="radio" name="zone" value="Rural" /> Rural</label>
                      </div>
                    </fieldset>
                  )}
                  {opt.pets && (
                    <fieldset className="fieldset">
                      <legend>¿Convives con animales?</legend>
                      <div className="chips">
                        {PETS.map((a) => <label key={a} className="chip"><input type="checkbox" name="pets" value={a} /> {a}</label>)}
                      </div>
                    </fieldset>
                  )}
                  <div id="politica" className="consent">
                    <label>
                      <input type="checkbox" name="consentData" required />
                      <span>Autorizo de manera libre, previa, expresa e informada el tratamiento de mis datos personales según la Ley 1581 de 2012 y la{' '}
                        {event.policyUrl ? <a href={event.policyUrl} target="_blank" rel="noreferrer">Política de tratamiento de datos</a> : 'Política de tratamiento de datos'} del evento. *</span>
                    </label>
                    <label>
                      <input type="checkbox" name="consentNews" />
                      <span>Acepto recibir información sobre los resultados de esta convocatoria.</span>
                    </label>
                  </div>
                  <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>{busy ? 'Guardando…' : 'Continuar a la firma'}</button>
                </form>
              )}

              {step === 2 && (
                <div className="step rise">
                  <div className="step__head">
                    <h2 className="step__title">Dibuja tu firma</h2>
                    <p className="step__sub">Usa el dedo, un lápiz óptico o el mouse dentro del recuadro.</p>
                  </div>
                  <SignaturePad ref={sigRef} onSign={() => !signed && setSigned(true)} />
                  <div className="btn-row btn-row--between">
                    <button type="button" className="btn btn--outline" onClick={() => { sigRef.current?.clear(); setSigned(false); }}>Limpiar</button>
                    <div className="btn-row">
                      <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>Atrás</button>
                      <button type="button" className="btn btn--primary" onClick={sendSignature} disabled={busy}>{busy ? 'Enviando…' : 'Enviar código a mi correo'}</button>
                    </div>
                  </div>
                  <p className="small muted">
                    {signed
                      ? 'Firma capturada. Al continuar, te enviaremos un código para confirmarla.'
                      : 'La firma se guarda como imagen y queda pendiente hasta que verifiques el código.'}
                  </p>
                </div>
              )}

              {step === 3 && (
                <div className="step rise" style={{ gap: 22 }}>
                  <div className="icon-tile"><Icon name="mail" size={28} strokeWidth={1.6} color={colors.button} /></div>
                  <div className="step__head" style={{ gap: 6 }}>
                    <h2 className="step__title">Confirma tu firma</h2>
                    <p style={{ fontSize: 15, lineHeight: 1.55 }}>
                      Enviamos un código de 6 dígitos a <strong>{maskEmail(email)}</strong>. Ingrésalo para completar y sellar tu firma.
                    </p>
                  </div>
                  <CodeInput label="Código de verificación" onChange={setCode} />
                  <p className="small muted">
                    El código vence en {event.codeTtlMinutes} minutos · <button type="button" className="link-btn" onClick={resend} disabled={busy}>Reenviar código</button>
                  </p>
                  <div className="btn-row btn-row--end">
                    <button type="button" className="btn btn--ghost" onClick={() => { setSigned(false); setStep(2); }}>Cambiar firma</button>
                    <button type="button" className="btn btn--primary" onClick={verify} disabled={busy}>{busy ? 'Verificando…' : 'Verificar y firmar'}</button>
                  </div>
                </div>
              )}

              {step === 4 && receipt && (
                <div className="step done rise">
                  <AnimalDrawing animal="cat" color={colors.button} label="Gato dibujado en una sola línea" style={{ width: 160, height: 160 }} />
                  <h2 className="step__title" style={{ fontSize: 28 }}>¡Gracias! Tu firma quedó registrada</h2>
                  <p style={{ fontSize: 15, lineHeight: 1.55, maxWidth: 420 }}>
                    Recibirás en tu correo el comprobante con el folio, la fecha, la hora y la huella digital (hash) de tu firma.
                  </p>
                  <div className="done__receipt">
                    <span><strong>Folio:</strong> {receipt.folio}</span>
                    <span><strong>Verificada:</strong> {fmtDateTime(receipt.verifiedAt)}</span>
                  </div>
                  <div className="btn-row btn-row--center">
                    <a href={apiUrl(`/receipts/${receipt.token ?? token}/pdf`)} className="btn btn--primary" download>Descargar comprobante</a>
                    <button type="button" className="btn btn--outline" onClick={share}>Compartir convocatoria</button>
                  </div>
                  <Link to={`/comprobante/${receipt.token ?? token}`} className="small">Ver comprobante en línea</Link>
                </div>
              )}
            </>
          )}

          <p className="pub__secure">
            <Icon name="lock" size={14} strokeWidth={1.8} />
            Conexión cifrada. Tus datos se usan solo para esta convocatoria.
          </p>
        </section>
      </main>

      <footer className="pub__footer">Hecho con <strong>Animalista</strong></footer>
    </div>
  );
}
