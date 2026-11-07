import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useEvent } from '../data/event';
import { AnimalDrawing, CatAndDog, CatMark } from '../components/LineArt';
import { Icon } from '../components/Icon';
import { CodeInput } from '../components/CodeInput';
import { SignaturePad, type SignaturePadHandle } from '../components/SignaturePad';
import './PublicSign.css';

const STEP_LABELS = ['Datos', 'Firma', 'Verificación', 'Listo'];

function maskEmail(email: string) {
  const at = email.indexOf('@');
  return at > 0 ? email[0] + '•••' + email.slice(at) : 'tu correo';
}

/** Public registration → signature → email code → confirmation flow. */
export function PublicSign() {
  const { event } = useEvent();
  const { colors } = event;
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [signed, setSigned] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  const go = (n: number) => setStep(Math.max(1, Math.min(4, n)));
  const submitData = (e: FormEvent) => { e.preventDefault(); go(2); };
  const policyHref = event.policyUrl || '#politica';

  const themeVars = {
    '--ev-bg': colors.bg,
    '--ev-title': colors.title,
    '--ev-text': colors.text,
    '--ev-button': colors.button,
    '--btn-bg': colors.button,
  } as CSSProperties;

  return (
    <div className="pub" style={themeVars}>
      <header className="pub__header">
        <div className="pub__org">
          <div className="pub__logo"><CatMark color={colors.title} strokeWidth={7} size={34} /></div>
          <div className="pub__org-text">
            <span className="pub__org-name">{event.organization}</span>
            <span className="xsmall">Logo y organización del evento</span>
          </div>
        </div>
        <a href={policyHref} className="pub__policy-link">Política de tratamiento de datos</a>
      </header>

      <main className="pub__main">
        <section className="pub__intro">
          <span className="pub__badge">Recolección de firmas · abierta</span>
          <h1 className="pub__title">{event.name}</h1>
          <p className="pub__desc">{event.description}</p>
          <div className="pub__stats">
            <div className="pub__stat"><strong>[N.º]</strong>firmas verificadas</div>
            <div className="pub__stat"><strong>[Fecha]</strong>cierre de la convocatoria</div>
          </div>
          <CatAndDog catColor={colors.title} dogColor={colors.button} style={{ width: '100%', maxWidth: 460, height: 'auto' }} />
        </section>

        <section aria-label="Formulario de firma" className="pub__panel">
          <ol className="steps">
            {STEP_LABELS.map((label, i) => (
              <li key={label} className={i + 1 <= step ? 'is-done' : undefined} aria-current={i + 1 === step ? 'step' : undefined}>
                <span className="steps__bar" />
                <span className="steps__label">{i + 1}. {label}</span>
              </li>
            ))}
          </ol>

          {step === 1 && (
            <form className="step rise" onSubmit={submitData}>
              <div className="step__head">
                <h2 className="step__title">Tus datos</h2>
                <p className="step__sub">Todos los campos con * son obligatorios.</p>
              </div>
              <div className="grid-fields">
                <label className="lbl lbl--full">Nombres y apellidos *<input className="field" type="text" required autoComplete="name" /></label>
                <label className="lbl">Tipo de documento *
                  <select className="field" required>
                    <option>Cédula de ciudadanía</option><option>Cédula de extranjería</option><option>PEP / PPT</option><option>Pasaporte</option>
                  </select>
                </label>
                <label className="lbl">Número de documento *<input className="field" type="text" inputMode="numeric" required /></label>
                <label className="lbl">Correo electrónico *<input className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                <label className="lbl">Celular<input className="field" type="tel" autoComplete="tel" /></label>
                <label className="lbl">Fecha de nacimiento *<input className="field" type="date" required /></label>
                <label className="lbl">Género *
                  <select className="field" required>
                    <option>Femenino</option><option>Masculino</option><option>No binario</option><option>Prefiero no decir</option>
                  </select>
                </label>
                <label className="lbl">Municipio *
                  <select className="field" required>
                    <option>Pasto</option><option>Ipiales</option><option>Tumaco</option><option>Túquerres</option><option>Otro</option>
                  </select>
                </label>
                <label className="lbl">Grupo étnico o poblacional
                  <select className="field">
                    <option>Ninguno</option><option>Indígena</option><option>Afrocolombiano</option><option>Raizal</option><option>Palenquero</option><option>Rrom</option><option>Campesino</option>
                  </select>
                </label>
              </div>
              <fieldset className="fieldset">
                <legend>Zona de residencia *</legend>
                <div className="chips">
                  <label className="chip"><input type="radio" name="zona" defaultChecked /> Urbana</label>
                  <label className="chip"><input type="radio" name="zona" /> Rural</label>
                </div>
              </fieldset>
              <fieldset className="fieldset">
                <legend>¿Convives con animales?</legend>
                <div className="chips">
                  {['Perros', 'Gatos', 'Otros', 'Ninguno'].map((a) => (
                    <label key={a} className="chip"><input type="checkbox" /> {a}</label>
                  ))}
                </div>
              </fieldset>
              <div id="politica" className="consent">
                <label>
                  <input type="checkbox" required />
                  <span>Autorizo de manera libre, previa, expresa e informada el tratamiento de mis datos personales según la Ley 1581 de 2012 y la <a href={policyHref}>Política de tratamiento de datos</a> del evento. *</span>
                </label>
                <label>
                  <input type="checkbox" />
                  <span>Acepto recibir información sobre los resultados de esta convocatoria.</span>
                </label>
              </div>
              <button type="submit" className="btn btn--primary btn--lg btn--block">Continuar a la firma</button>
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
                  <button type="button" className="btn btn--ghost" onClick={() => go(1)}>Atrás</button>
                  <button type="button" className="btn btn--primary" onClick={() => go(3)}>Enviar código a mi correo</button>
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
              <CodeInput label="Código de verificación" />
              <p className="small muted">El código vence en 10 minutos · <a href="#reenviar">Reenviar código</a></p>
              <div className="btn-row btn-row--end">
                <button type="button" className="btn btn--ghost" onClick={() => go(2)}>Cambiar firma</button>
                <button type="button" className="btn btn--primary" onClick={() => go(4)}>Verificar y firmar</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="step done rise">
              <AnimalDrawing animal="cat" color={colors.button} label="Gato dibujado en una sola línea" style={{ width: 160, height: 160 }} />
              <h2 className="step__title" style={{ fontSize: 28 }}>¡Gracias! Tu firma quedó registrada</h2>
              <p style={{ fontSize: 15, lineHeight: 1.55, maxWidth: 420 }}>
                Recibirás en tu correo el comprobante con el folio, la fecha, la hora y la huella digital (hash) de tu firma.
              </p>
              <div className="done__receipt">
                <span><strong>Folio:</strong> [AUTO-0000]</span>
                <span><strong>Verificada:</strong> [fecha · hora]</span>
              </div>
              <div className="btn-row btn-row--center">
                <button type="button" className="btn btn--primary">Descargar comprobante</button>
                <button type="button" className="btn btn--outline" onClick={() => go(1)}>Compartir convocatoria</button>
              </div>
            </div>
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
