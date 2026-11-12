/**
 * Página pública: datos → firma dibujada → código por correo → comprobante.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, DEFAULT_THANKS_TITLE, defaultThanksMessage, fmtDate, fmtDateTime, fmtNumber, get, isExclusiveOption, post, type PublicEvent, type Receipt } from '../lib/api';
import { loadGeo, type Department } from '../lib/geo';
import { useAsync } from '../lib/useAsync';
import { absoluteUrl, apiUrl } from '../lib/base';
import { AnimalDrawing, CatAndDog, CatMark } from '../components/LineArt';
import { Icon } from '../components/Icon';
import { CodeInput } from '../components/CodeInput';
import { Alert } from '../components/Alert';
import { SignaturePad, type SignaturePadHandle } from '../components/SignaturePad';
import './PublicSign.css';

// Pasos internos: 1 datos, 2 firma, 3 código por correo (solo si el evento lo pide), 4 listo.
const STEPS_WITH_CODE: [number, string][] = [[1, 'Datos'], [2, 'Firma'], [3, 'Verificación'], [4, 'Listo']];
const STEPS_WITHOUT_CODE: [number, string][] = [[1, 'Datos'], [2, 'Firma'], [4, 'Listo']];
const DOC_TYPES = ['Cédula de ciudadanía', 'Cédula de extranjería', 'PEP / PPT', 'Pasaporte'];

/** Casillas de opción múltiple; una opción «Ninguno» desmarca y deshabilita las demás. */
function MultiChips({ name, options, value, onChange }: { name: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const exclusive = value.find(isExclusiveOption);
  const toggle = (o: string, on: boolean) => {
    if (isExclusiveOption(o)) return onChange(on ? [o] : []);
    onChange(on ? [...value.filter((x) => !isExclusiveOption(x)), o] : value.filter((x) => x !== o));
  };
  return (
    <div className="chips">
      {options.map((o) => {
        const disabled = !!exclusive && o !== exclusive;
        return (
          <label key={o} className={'chip' + (disabled ? ' is-disabled' : '')}>
            <input type="checkbox" name={name} value={o} checked={value.includes(o)} disabled={disabled} onChange={(e) => toggle(o, e.target.checked)} /> {o}
          </label>
        );
      })}
    </div>
  );
}

/** Texto de autorización: {politica} se convierte en el enlace a la política del evento. */
export function ConsentText({ text, policyUrl }: { text: string; policyUrl: string }) {
  const parts = text.split('{politica}');
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (policyUrl
            ? <a href={policyUrl} target="_blank" rel="noreferrer">Política de tratamiento de datos</a>
            : 'Política de tratamiento de datos')}
        </span>
      ))}
    </>
  );
}

/** Banner opcional del evento, encima o debajo de la descripción. */
function Banner({ banner }: { banner: NonNullable<PublicEvent['banner']> }) {
  return <figure className="pub__banner"><img src={banner.url} alt={banner.alt} /></figure>;
}

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
  // Respuestas de opción múltiple: 'pets' y 'custom_<id>'.
  const [multi, setMulti] = useState<Record<string, string[]>>({});
  const setMultiValue = (k: string) => (v: string[]) => setMulti((m) => ({ ...m, [k]: v }));
  const [geo, setGeo] = useState<Department[] | null>(null);
  const [geoErr, setGeoErr] = useState(false);
  const [department, setDepartment] = useState('');
  const sigRef = useRef<SignaturePadHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const L = fields.lists;

  useEffect(() => {
    if (!opt.municipality) return;
    loadGeo().then(setGeo).catch(() => setGeoErr(true));
  }, [opt.municipality]);
  const allowedDeps = geo ? (fields.geo.departments.length ? geo.filter((d) => fields.geo.departments.includes(d.code)) : geo) : [];
  // Con un solo departamento permitido se selecciona solo.
  useEffect(() => { if (allowedDeps.length === 1 && department !== allowedDeps[0].code) setDepartment(allowedDeps[0].code); }, [allowedDeps, department]);
  const municipalities = allowedDeps.find((d) => d.code === department)?.municipalities ?? [];

  const policyHref = event.policyUrl || '#politica';
  const progress = event.showCount && event.goal && event.verifiedCount !== null ? Math.min(100, (event.verifiedCount / event.goal) * 100) : null;
  const drawings = event.lineDrawings;
  const showDateStats = event.showDates && (event.opensAt || event.closesAt);

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
    const custom: Record<string, string | string[]> = {};
    fields.custom.forEach((c) => { if (c.id) custom[c.id] = c.type === 'multi' ? multi[`custom_${c.id}`] ?? [] : s(`custom_${c.id}`); });
    const missingMulti = fields.custom.find((c) => c.type === 'multi' && c.required && !(multi[`custom_${c.id}`] ?? []).length);
    if (missingMulti) { setErr(`Elige al menos una opción en «${missingMulti.label}».`); return; }
    run(async () => {
      const r = await post<{ token: string }>(`/events/${event.slug}/signatures`, {
        fullName: s('fullName'), docType: s('docType'), docNumber: s('docNumber'), email: s('email'), phone: s('phone'),
        birthDate: s('birthDate'), gender: s('gender'), department, municipality: s('municipality'), zone: s('zone'), ethnicGroup: s('ethnicGroup'),
        education: s('education'), disability: s('disability'), pets: multi.pets ?? [],
        consentData: fd.get('consentData') === 'on', consentNews: fd.get('consentNews') === 'on', custom,
      });
      setToken(r.token);
      setStep(2);
    });
  };

  const sendSignature = () => run(async () => {
    const image = sigRef.current?.toDataURL();
    if (!signed || !image) throw new ApiError(422, 'Dibuja tu firma dentro del recuadro.');
    const r = await post<{ verified: true } & Receipt | { verified: false }>(`/signatures/${token}/sign`, { image });
    if (r.verified) { setReceipt(r); setStep(4); }
    else setStep(3);
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
    '--form-bg': colors.formBg, '--form-title': colors.formTitle, '--form-text': colors.formText, '--field-bg': colors.fieldBg, '--field-border': colors.fieldBorder,
    ...(event.backgroundUrl ? { backgroundImage: `linear-gradient(${colors.bg}e6, ${colors.bg}e6), url("${event.backgroundUrl}")` } : {}),
  } as CSSProperties;

  return (
    <div className="pub" style={themeVars}>
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
          {event.banner?.position === 'above' && <Banner banner={event.banner} />}
          {event.description && <p className="pub__desc">{event.description}</p>}
          {event.banner?.position === 'below' && <Banner banner={event.banner} />}
          {(event.showCount || showDateStats) && (
            <div className="pub__stats">
              {event.showCount && event.verifiedCount !== null && (
                <div className="pub__stat"><strong>{fmtNumber(event.verifiedCount)}</strong>firmas verificadas{event.goal ? ` de ${fmtNumber(event.goal)}` : ''}</div>
              )}
              {event.showDates && event.opensAt && <div className="pub__stat"><strong>{fmtDate(event.opensAt)}</strong>apertura de la convocatoria</div>}
              {event.showDates && event.closesAt && <div className="pub__stat"><strong>{fmtDate(event.closesAt)}</strong>cierre de la convocatoria</div>}
            </div>
          )}
          {progress !== null && (
            <div className="pub__goal" role="progressbar" aria-label="Avance hacia la meta" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${progress}%` }} />
            </div>
          )}
          {drawings !== 'hidden' && (
            <CatAndDog catColor={colors.title} dogColor={colors.button} animated={drawings === 'animated'} style={{ width: '100%', maxWidth: 460, height: 'auto' }} />
          )}
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
                {(event.requireEmailCode ? STEPS_WITH_CODE : STEPS_WITHOUT_CODE).map(([n, label], i) => (
                  <li key={label} className={n <= step ? 'is-done' : undefined} aria-current={n === step ? 'step' : undefined}>
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
                        <select className="field" name="gender" required defaultValue=""><option value="" disabled>Selecciona…</option>{L.gender.map((g) => <option key={g}>{g}</option>)}</select>
                      </label>
                    )}
                    {opt.municipality && (
                      <>
                        <label className="lbl">Departamento *
                          <select className="field" name="department" required value={department} disabled={!geo || allowedDeps.length < 2}
                            onChange={(e) => setDepartment(e.target.value)}>
                            <option value="" disabled>{geo ? 'Selecciona…' : geoErr ? 'No se pudo cargar' : 'Cargando…'}</option>
                            {allowedDeps.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                          </select>
                        </label>
                        <label className="lbl">Municipio *
                          <select key={department} className="field" name="municipality" required defaultValue="" disabled={!department}>
                            <option value="" disabled>{department ? 'Selecciona…' : 'Primero elige el departamento'}</option>
                            {municipalities.map((m) => <option key={m}>{m}</option>)}
                          </select>
                        </label>
                      </>
                    )}
                    {opt.ethnic_group && (
                      <label className="lbl">Grupo étnico o poblacional
                        <select className="field" name="ethnicGroup">{L.ethnic_group.map((g) => <option key={g}>{g}</option>)}</select>
                      </label>
                    )}
                    {opt.education && (
                      <label className="lbl">Nivel educativo
                        <select className="field" name="education" defaultValue=""><option value="">Prefiero no decir</option>{L.education.map((g) => <option key={g}>{g}</option>)}</select>
                      </label>
                    )}
                    {opt.disability && (
                      <label className="lbl">¿Tienes alguna discapacidad?
                        <select className="field" name="disability" defaultValue=""><option value="">Prefiero no decir</option>{L.disability.map((g) => <option key={g}>{g}</option>)}</select>
                      </label>
                    )}
                    {fields.custom.filter((c) => c.type !== 'multi').map((c) => (
                      <label key={c.id} className="lbl">{c.label}{c.required ? ' *' : ''}
                        {c.type === 'select' ? (
                          <select className="field" name={`custom_${c.id}`} required={c.required} defaultValue="">
                            <option value="" disabled={c.required}>{c.required ? 'Selecciona…' : 'Sin respuesta'}</option>
                            {c.options.map((o) => <option key={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input className="field" name={`custom_${c.id}`} type="text" required={c.required} maxLength={500} />
                        )}
                      </label>
                    ))}
                  </div>
                  {opt.zone && (
                    <fieldset className="fieldset">
                      <legend>Zona de residencia *</legend>
                      <div className="chips">
                        {L.zone.map((z, i) => <label key={z} className="chip"><input type="radio" name="zone" value={z} defaultChecked={i === 0} required /> {z}</label>)}
                      </div>
                    </fieldset>
                  )}
                  {opt.pets && (
                    <fieldset className="fieldset">
                      <legend>¿Convives con animales?</legend>
                      <MultiChips name="pets" options={L.pets} value={multi.pets ?? []} onChange={setMultiValue('pets')} />
                    </fieldset>
                  )}
                  {fields.custom.filter((c) => c.type === 'multi').map((c) => (
                    <fieldset key={c.id} className="fieldset">
                      <legend>{c.label}{c.required ? ' *' : ''}</legend>
                      <MultiChips name={`custom_${c.id}`} options={c.options} value={multi[`custom_${c.id}`] ?? []} onChange={setMultiValue(`custom_${c.id}`)} />
                    </fieldset>
                  ))}
                  <div id="politica" className="consent">
                    <label>
                      <input type="checkbox" name="consentData" required />
                      <span><ConsentText text={event.consentDataText} policyUrl={event.policyUrl} /> *</span>
                    </label>
                    {event.consentNewsEnabled && (
                      <label>
                        <input type="checkbox" name="consentNews" />
                        <span>{event.consentNewsText}</span>
                      </label>
                    )}
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
                      <button type="button" className="btn btn--primary" onClick={sendSignature} disabled={busy}>{busy ? 'Enviando…' : event.requireEmailCode ? 'Enviar código a mi correo' : 'Firmar'}</button>
                    </div>
                  </div>
                  <p className="small muted">
                    {event.requireEmailCode
                      ? signed
                        ? 'Firma capturada. Al continuar, te enviaremos un código para confirmarla.'
                        : 'La firma se guarda como imagen y queda pendiente hasta que verifiques el código.'
                      : signed
                        ? 'Firma capturada. Al pulsar «Firmar» quedará registrada.'
                        : 'La firma se guarda como imagen junto con tus datos.'}
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
                  {drawings !== 'hidden' && (
                    <AnimalDrawing animal="cat" color={colors.button} animated={drawings === 'animated'} label="Gato dibujado en una sola línea" style={{ width: 160, height: 160 }} />
                  )}
                  {event.thanks.enabled && (
                    <>
                      <h2 className="step__title" style={{ fontSize: 28 }}>{event.thanks.title ?? DEFAULT_THANKS_TITLE}</h2>
                      <p className="done__message">{event.thanks.message ?? defaultThanksMessage(event.sendReceipt)}</p>
                    </>
                  )}
                  <div className="done__receipt">
                    <span><strong>Folio:</strong> {receipt.folio}</span>
                    <span><strong>{receipt.verification === 'none' ? 'Registrada' : 'Verificada'}:</strong> {fmtDateTime(receipt.verifiedAt)}</span>
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
