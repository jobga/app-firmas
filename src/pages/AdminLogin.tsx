import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AnimalDrawing } from '../components/LineArt';
import { Icon } from '../components/Icon';
import { CodeInput } from '../components/CodeInput';
import { makeIllustrativeQr } from '../lib/qr';
import './AdminLogin.css';

const TOTP_SECRET_PLACEHOLDER = '[CLAVE SECRETA TOTP]';

/** Admin sign-in, followed by mandatory TOTP (QR) enrollment on first access. */
export function AdminLogin() {
  const [view, setView] = useState<'login' | 'qr'>('login');
  const qr = useMemo(() => makeIllustrativeQr(), []);
  const login = (e: FormEvent) => { e.preventDefault(); setView('qr'); };

  return (
    <div className="login">
      <aside className="login__aside">
        <span className="login__brand">Animalista</span>
        <AnimalDrawing animal="dog" color="#FFFFFF" strokeWidth={1.6} slow label="Perro dibujado en una sola línea" className="login__art" />
        <div className="login__pitch">
          <h1>Panel de administración</h1>
          <p>Gestiona eventos, revisa firmas verificadas y analiza la caracterización de los participantes. Acceso protegido con verificación en dos pasos.</p>
        </div>
      </aside>

      <main className="login__main">
        <div className="login__box">
          {view === 'login' ? (
            <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="login__head">
                <h2 className="login__title">Ingresar</h2>
                <p style={{ fontSize: 14 }}>Usa tu cuenta de administrador.</p>
              </div>
              <label className="lbl">Correo<input className="field" type="email" required autoComplete="username" /></label>
              <label className="lbl">Contraseña<input className="field" type="password" required autoComplete="current-password" /></label>
              <div className="login__row">
                <label className="check-row"><input type="checkbox" /> Recordar este equipo 30 días</label>
                <a href="#recuperar">¿Olvidaste tu contraseña?</a>
              </div>
              <button type="submit" className="btn btn--primary btn--lg">Continuar</button>
              <p className="small muted">Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.</p>
            </form>
          ) : (
            <>
              <div className="login__head">
                <span className="pill pill--accent">Primer ingreso</span>
                <h2 className="login__title">Activa la verificación en dos pasos</h2>
                <p style={{ fontSize: 14, lineHeight: 1.55 }}>Es obligatoria para todas las cuentas administrativas. Solo la configurarás una vez.</p>
              </div>

              <div className="qr-card">
                <div className="qr">
                  <div className="qr__grid" role="img" aria-label="Código QR para la app autenticadora (ilustrativo)">
                    {qr.map((on, i) => <span key={i} className={on ? 'on' : undefined} />)}
                  </div>
                  <span className="qr__scan" aria-hidden="true" />
                </div>
                <ol className="qr-steps">
                  <li>Abre Google Authenticator, Microsoft Authenticator o Authy.</li>
                  <li>Toca <strong>Agregar cuenta</strong> y escanea este código.</li>
                  <li>Escribe abajo el código de 6 dígitos que muestra la app.</li>
                </ol>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="small" style={{ fontWeight: 500 }}>¿No puedes escanear? Ingresa esta clave manualmente</span>
                <div className="btn-row" style={{ gap: 8, alignItems: 'center' }}>
                  <code className="secret">{TOTP_SECRET_PLACEHOLDER}</code>
                  <button type="button" aria-label="Copiar clave" className="btn btn--outline btn--sm" style={{ minHeight: 46 }}
                    onClick={() => navigator.clipboard?.writeText(TOTP_SECRET_PLACEHOLDER)}>
                    <Icon name="copy" size={16} strokeWidth={1.8} />Copiar
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="small" style={{ fontWeight: 500 }}>Código de la app</span>
                <CodeInput label="Código de 6 dígitos" size="sm" />
              </div>

              <div className="note">
                <Icon name="warning" strokeWidth={1.8} style={{ flex: 'none', marginTop: 2 }} />
                <span>Al activar, descarga tus 10 códigos de recuperación. Son la única forma de entrar si pierdes el teléfono.</span>
              </div>

              <div className="btn-row btn-row--between">
                <button type="button" className="btn btn--ghost" onClick={() => setView('login')}>Volver</button>
                <Link to="/admin" className="btn btn--primary">Activar y entrar al panel</Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
