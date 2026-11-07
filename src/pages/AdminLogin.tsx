/**
 * Acceso de administrador: contraseña y verificación en dos pasos (TOTP).
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, post } from '../lib/api';
import { AnimalDrawing } from '../components/LineArt';
import { Icon } from '../components/Icon';
import { CodeInput } from '../components/CodeInput';
import { QrCode } from '../components/QrCode';
import { Alert } from '../components/Alert';
import './AdminLogin.css';

type View =
  | { kind: 'login' }
  | { kind: 'enroll'; secret: string; otpauth: string }
  | { kind: 'verify' }
  | { kind: 'recovery-codes'; codes: string[] }
  | { kind: 'forgot' }
  | { kind: 'forgot-sent'; email: string };

type LoginResponse = { next: 'verify' } | { next: 'enroll'; secret: string; otpauth: string };

export function downloadRecoveryCodes(codes: string[]) {
  const text = `Códigos de recuperación · Animalista\nGenerados: ${new Date().toLocaleString('es-CO')}\n\nCada código sirve una sola vez.\n\n${codes.join('\n')}\n`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  a.download = 'codigos-recuperacion-animalista.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="recovery">
      <ol>{codes.map((c) => <li key={c}><code>{c}</code></li>)}</ol>
      <div className="btn-row">
        <button type="button" className="btn btn--outline btn--sm" onClick={() => downloadRecoveryCodes(codes)}>
          <Icon name="download" size={16} strokeWidth={1.8} />Descargar .txt
        </button>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}>
          <Icon name="copy" size={16} strokeWidth={1.8} />Copiar
        </button>
      </div>
    </div>
  );
}

/** Estructura de las pantallas de acceso: panel oscuro con el dibujo + formulario. */
export function LoginShell({ children }: { children: ReactNode }) {
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
      <main className="login__main">{children}</main>
    </div>
  );
}

export function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const target = (location.state as { from?: string } | null)?.from ?? '/admin';
  const [view, setView] = useState<View>({ kind: 'login' });
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) {
      const ae = e as ApiError;
      setErr(ae.message);
      if (ae.status === 401 && view.kind !== 'login') setView({ kind: 'login' });
    } finally { setBusy(false); }
  };

  const login = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(async () => {
      const r = await post<LoginResponse>('/admin/login', { email: fd.get('email'), password: fd.get('password') });
      setCode('');
      setView(r.next === 'enroll' ? { kind: 'enroll', secret: r.secret, otpauth: r.otpauth } : { kind: 'verify' });
    });
  };

  const forgot = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '');
    run(async () => {
      await post('/admin/password/forgot', { email });
      setView({ kind: 'forgot-sent', email });
    });
  };

  const enroll = () => run(async () => {
    if (code.length !== 6) throw new ApiError(422, 'Escribe los 6 dígitos que muestra la app.');
    const r = await post<{ recoveryCodes: string[] }>('/admin/2fa/enroll', { code });
    setView({ kind: 'recovery-codes', codes: r.recoveryCodes });
  });

  const verify = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (useRecovery) await post('/admin/2fa/verify', { recoveryCode: recovery });
      else {
        if (code.length !== 6) throw new ApiError(422, 'Escribe los 6 dígitos que muestra la app.');
        await post('/admin/2fa/verify', { code });
      }
      navigate(target, { replace: true });
    });
  };

  const secretGroups = view.kind === 'enroll' ? view.secret.match(/.{1,4}/g)?.join(' ') : '';

  return (
    <LoginShell>
        <div className="login__box">
          <Alert>{err}</Alert>

          {view.kind === 'login' && (
            <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="login__head">
                <h2 className="login__title">Ingresar</h2>
                <p style={{ fontSize: 14 }}>Usa tu cuenta de administrador.</p>
              </div>
              <label className="lbl">Correo<input className="field" name="email" type="email" required autoComplete="username" /></label>
              <label className="lbl">Contraseña<input className="field" name="password" type="password" required autoComplete="current-password" /></label>
              <div className="login__row">
                <button type="button" className="link-btn" onClick={() => { setErr(null); setView({ kind: 'forgot' }); }}>¿Olvidaste tu contraseña?</button>
              </div>
              <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>{busy ? 'Verificando…' : 'Continuar'}</button>
              <p className="small muted">Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.</p>
            </form>
          )}

          {view.kind === 'forgot' && (
            <form onSubmit={forgot} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="login__head">
                <h2 className="login__title">Restablecer contraseña</h2>
                <p style={{ fontSize: 14, lineHeight: 1.55 }}>Escribe el correo de tu cuenta. Te enviaremos un enlace para crear una contraseña nueva; vence en 1 hora.</p>
              </div>
              <label className="lbl">Correo<input className="field" name="email" type="email" required autoComplete="username" /></label>
              <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>{busy ? 'Enviando…' : 'Enviar enlace'}</button>
              <button type="button" className="btn btn--ghost" onClick={() => setView({ kind: 'login' })}>Volver</button>
            </form>
          )}

          {view.kind === 'forgot-sent' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="login__head">
                <h2 className="login__title">Revisa tu correo</h2>
                <p style={{ fontSize: 14, lineHeight: 1.55 }}>
                  Si <strong>{view.email}</strong> corresponde a una cuenta de administrador, recibirás un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.
                </p>
              </div>
              <button type="button" className="btn btn--outline" onClick={() => setView({ kind: 'login' })}>Volver a ingresar</button>
            </div>
          )}

          {view.kind === 'enroll' && (
            <>
              <div className="login__head">
                <span className="pill pill--accent">Primer ingreso</span>
                <h2 className="login__title">Activa la verificación en dos pasos</h2>
                <p style={{ fontSize: 14, lineHeight: 1.55 }}>Es obligatoria para todas las cuentas administrativas. Solo la configurarás una vez.</p>
              </div>

              <div className="qr-card">
                <div className="qr">
                  <QrCode value={view.otpauth} label="Código QR para la app autenticadora" />
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
                  <code className="secret">{secretGroups}</code>
                  <button type="button" aria-label="Copiar clave" className="btn btn--outline btn--sm" style={{ minHeight: 46 }}
                    onClick={() => { navigator.clipboard?.writeText(view.secret); setCopied(true); }}>
                    <Icon name="copy" size={16} strokeWidth={1.8} />{copied ? 'Copiada' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="small" style={{ fontWeight: 500 }}>Código de la app</span>
                <CodeInput label="Código de 6 dígitos" size="sm" onChange={setCode} />
              </div>

              <div className="note">
                <Icon name="warning" strokeWidth={1.8} style={{ flex: 'none', marginTop: 2 }} />
                <span>Al activar, descarga tus 10 códigos de recuperación. Son la única forma de entrar si pierdes el teléfono.</span>
              </div>

              <div className="btn-row btn-row--between">
                <button type="button" className="btn btn--ghost" onClick={() => setView({ kind: 'login' })}>Volver</button>
                <button type="button" className="btn btn--primary" onClick={enroll} disabled={busy}>{busy ? 'Activando…' : 'Activar y entrar al panel'}</button>
              </div>
            </>
          )}

          {view.kind === 'verify' && (
            <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="login__head">
                <h2 className="login__title">Verificación en dos pasos</h2>
                <p style={{ fontSize: 14 }}>
                  {useRecovery ? 'Escribe uno de tus códigos de recuperación. Cada código sirve una sola vez.' : 'Escribe el código de 6 dígitos que muestra tu app autenticadora.'}
                </p>
              </div>
              {useRecovery ? (
                <label className="lbl">Código de recuperación<input className="field" value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="XXXXX-XXXXX" autoComplete="one-time-code" required /></label>
              ) : (
                <CodeInput label="Código de 6 dígitos" size="sm" onChange={setCode} />
              )}
              <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>{busy ? 'Verificando…' : 'Entrar al panel'}</button>
              <div className="btn-row btn-row--between small">
                <button type="button" className="link-btn" onClick={() => { setUseRecovery(!useRecovery); setErr(null); }}>
                  {useRecovery ? 'Usar la app autenticadora' : '¿Perdiste el teléfono? Usa un código de recuperación'}
                </button>
                <button type="button" className="link-btn" onClick={() => setView({ kind: 'login' })}>Volver</button>
              </div>
            </form>
          )}

          {view.kind === 'recovery-codes' && (
            <>
              <div className="login__head">
                <span className="pill pill--accent">2FA activa</span>
                <h2 className="login__title">Guarda tus códigos de recuperación</h2>
                <p style={{ fontSize: 14, lineHeight: 1.55 }}>Si pierdes el teléfono, podrás entrar con uno de estos códigos. No volverán a mostrarse: descárgalos y guárdalos en un lugar seguro.</p>
              </div>
              <RecoveryCodes codes={view.codes} />
              <div className="btn-row btn-row--end">
                <button type="button" className="btn btn--primary" onClick={() => navigate(target, { replace: true })}>Ya los guardé, entrar al panel</button>
              </div>
            </>
          )}
        </div>
    </LoginShell>
  );
}
