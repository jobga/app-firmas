/**
 * Crear una contraseña nueva desde el enlace enviado por correo.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, post } from '../lib/api';
import { Alert } from '../components/Alert';
import { LoginShell } from './AdminLogin';
import './AdminLogin.css';

export function ResetPassword() {
  const { token = '' } = useParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    if (fd.get('password') !== fd.get('password2')) { setErr('Las contraseñas no coinciden'); return; }
    setBusy(true);
    try {
      await post('/admin/password/reset', { token, password: fd.get('password') });
      setDone(true);
    } catch (ex) {
      setErr((ex as ApiError).message);
    } finally { setBusy(false); }
  };

  return (
    <LoginShell>
      <div className="login__box">
        <Alert>{err}</Alert>
        {done ? (
          <>
            <div className="login__head">
              <h2 className="login__title">Contraseña actualizada</h2>
              <p style={{ fontSize: 14, lineHeight: 1.55 }}>Ya puedes ingresar con tu nueva contraseña y el código de tu app autenticadora.</p>
            </div>
            <Link to="/admin/acceso" className="btn btn--primary btn--lg">Ir a ingresar</Link>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="login__head">
              <h2 className="login__title">Crea una contraseña nueva</h2>
              <p style={{ fontSize: 14 }}>Mínimo 10 caracteres. La verificación en dos pasos se mantiene activa.</p>
            </div>
            <label className="lbl">Nueva contraseña<input className="field" name="password" type="password" required minLength={10} autoComplete="new-password" /></label>
            <label className="lbl">Repite la contraseña<input className="field" name="password2" type="password" required minLength={10} autoComplete="new-password" /></label>
            <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
            <Link to="/admin/acceso" className="small">Volver a ingresar</Link>
          </form>
        )}
      </div>
    </LoginShell>
  );
}
