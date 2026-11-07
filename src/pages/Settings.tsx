/**
 * Seguridad y ajustes: plataforma, correo SMTP, contraseña, 2FA y administradores.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Alert } from '../components/Alert';
import { CodeInput } from '../components/CodeInput';
import { RecoveryCodes } from './AdminLogin';
import { ApiError, fmtDateTime, get, post, put, type Settings as SettingsData } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { APP_AUTHOR, APP_COPYRIGHT, APP_NAME } from '../lib/credits';
import './EventConfig.css';
import './Dashboard.css';

type Msg = { tone: 'ok' | 'error'; text: string } | null;

function useAction() {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setMsg(null);
    try { setMsg({ tone: 'ok', text: await fn() }); } catch (e) { setMsg({ tone: 'error', text: (e as ApiError).message }); } finally { setBusy(false); }
  };
  return { msg, busy, run };
}

function Section({ title, children, msg }: { title: string; children: ReactNode; msg?: Msg }) {
  return (
    <section className="card card--roomy">
      <h2 className="card-title card-title--lg">{title}</h2>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {children}
    </section>
  );
}

type AdminRow = { id: number; name: string; email: string; totpEnabled: boolean; lastLoginAt: string | null };

export function Settings() {
  const settings = useAsync(() => get<SettingsData>('/admin/settings'), []);
  const admins = useAsync(() => get<AdminRow[]>('/admin/admins'), []);
  const [form, setForm] = useState<SettingsData | null>(null);
  const [smtpPass, setSmtpPass] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const general = useAction(), mail = useAction(), pass = useAction(), mfa = useAction(), team = useAction();

  useEffect(() => { if (settings.data) setForm(settings.data); }, [settings.data]);
  if (!form) return <AdminLayout><div className="page-loading" aria-busy="true">{settings.error?.message ?? 'Cargando…'}</div></AdminLayout>;
  const m = form.mail;
  const setMail = (patch: Partial<SettingsData['mail']>) => setForm({ ...form, mail: { ...m, ...patch } });

  const saveAll = () => put('/admin/settings', {
    siteName: form.siteName, siteUrl: form.siteUrl,
    mail: { host: m.host, port: m.port, secure: m.secure, user: m.user, password: smtpPass, fromEmail: m.fromEmail, fromName: m.fromName },
  });

  const changePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    const fd = new FormData(el);
    pass.run(async () => {
      if (fd.get('new') !== fd.get('new2')) throw new ApiError(422, 'Las contraseñas nuevas no coinciden');
      await post('/admin/password', { current: fd.get('current'), new: fd.get('new') });
      el.reset();
      return 'Contraseña actualizada';
    });
  };

  const addAdmin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    const fd = new FormData(el);
    team.run(async () => {
      await post('/admin/admins', { name: fd.get('name'), email: fd.get('email'), password: fd.get('password') });
      el.reset();
      admins.reload();
      return 'Administrador creado. Activará su verificación en dos pasos en el primer ingreso.';
    });
  };

  return (
    <AdminLayout>
      <header className="admin-header">
        <div className="admin-header__titles"><h1 className="admin-title">Seguridad y ajustes</h1></div>
      </header>

      <div className="ev-layout">
        <div className="ev-form">
          <Section title="Plataforma" msg={general.msg}>
            <div className="grid-fields">
              <label className="lbl">Nombre de la plataforma<input className="field" value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} /></label>
              <label className="lbl">URL del sitio<input className="field" type="url" value={form.siteUrl} placeholder="https://firmas.tudominio.com" onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} /></label>
            </div>
            <button type="button" className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-start' }} disabled={general.busy}
              onClick={() => general.run(async () => { await saveAll(); return 'Ajustes guardados'; })}>Guardar</button>
          </Section>

          <Section title="Correo saliente (SMTP)" msg={mail.msg}>
            <p className="small muted">Se usa para enviar los códigos de verificación y los comprobantes. En Plesk usa un buzón de tu dominio: servidor <code>mail.tudominio.com</code>, puerto 465 (SSL) o 587 (STARTTLS). Si dejas el servidor vacío se usa la función mail() de PHP.</p>
            <div className="grid-fields">
              <label className="lbl">Servidor<input className="field" value={m.host} placeholder="mail.tudominio.com" onChange={(e) => setMail({ host: e.target.value })} /></label>
              <label className="lbl">Puerto<input className="field" type="number" value={m.port} onChange={(e) => setMail({ port: Number(e.target.value) })} /></label>
              <label className="lbl">Seguridad
                <select className="field" value={m.secure} onChange={(e) => setMail({ secure: e.target.value as SettingsData['mail']['secure'] })}>
                  <option value="tls">STARTTLS (587)</option><option value="ssl">SSL/TLS (465)</option><option value="none">Ninguna</option>
                </select>
              </label>
              <label className="lbl">Usuario<input className="field" value={m.user} autoComplete="off" onChange={(e) => setMail({ user: e.target.value })} /></label>
              <label className="lbl">Contraseña<input className="field" type="password" value={smtpPass} autoComplete="new-password" placeholder={m.hasPassword ? '•••••• (guardada)' : ''} onChange={(e) => setSmtpPass(e.target.value)} /></label>
              <label className="lbl">Correo remitente<input className="field" type="email" value={m.fromEmail} placeholder="firmas@tudominio.com" onChange={(e) => setMail({ fromEmail: e.target.value })} /></label>
              <label className="lbl">Nombre remitente<input className="field" value={m.fromName} onChange={(e) => setMail({ fromName: e.target.value })} /></label>
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn--primary btn--sm" disabled={mail.busy} onClick={() => mail.run(async () => { await saveAll(); setSmtpPass(''); return 'Correo guardado'; })}>Guardar</button>
              <button type="button" className="btn btn--outline btn--sm" disabled={mail.busy}
                onClick={() => mail.run(async () => { await saveAll(); const r = await post<{ sentTo: string }>('/admin/settings/test-mail'); return `Correo de prueba enviado a ${r.sentTo}`; })}>
                Guardar y enviar prueba
              </button>
            </div>
          </Section>

          <Section title="Cambiar contraseña" msg={pass.msg}>
            <form className="grid-fields" onSubmit={changePassword}>
              <label className="lbl lbl--full">Contraseña actual<input className="field" name="current" type="password" required autoComplete="current-password" /></label>
              <label className="lbl">Nueva contraseña<input className="field" name="new" type="password" required minLength={10} autoComplete="new-password" /></label>
              <label className="lbl">Repite la nueva contraseña<input className="field" name="new2" type="password" required minLength={10} autoComplete="new-password" /></label>
              <div><button type="submit" className="btn btn--primary btn--sm" disabled={pass.busy}>Cambiar contraseña</button></div>
            </form>
          </Section>

          <Section title="Códigos de recuperación" msg={mfa.msg}>
            <p className="small">Genera 10 códigos nuevos. Los anteriores dejarán de funcionar. Confirma con el código de tu app autenticadora.</p>
            {codes ? <RecoveryCodes codes={codes} /> : (
              <>
                <CodeInput label="Código de la app" size="sm" onChange={setCode} />
                <button type="button" className="btn btn--outline btn--sm" style={{ alignSelf: 'flex-start' }} disabled={mfa.busy}
                  onClick={() => mfa.run(async () => { const r = await post<{ recoveryCodes: string[] }>('/admin/2fa/recovery-codes', { code }); setCodes(r.recoveryCodes); return 'Códigos nuevos generados. Guárdalos ahora: no volverán a mostrarse.'; })}>
                  Generar códigos nuevos
                </button>
              </>
            )}
          </Section>

          <Section title="Administradores" msg={team.msg}>
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Nombre</th><th>Correo</th><th>2FA</th><th>Último ingreso</th></tr></thead>
                <tbody>
                  {admins.data?.map((a) => (
                    <tr key={a.id}><td>{a.name}</td><td>{a.email}</td>
                      <td><span className={`status status--${a.totpEnabled ? 'ok' : 'wait'}`}>{a.totpEnabled ? 'Activa' : 'Pendiente'}</span></td>
                      <td>{fmtDateTime(a.lastLoginAt)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form className="grid-fields" onSubmit={addAdmin}>
              <label className="lbl">Nombre<input className="field" name="name" required /></label>
              <label className="lbl">Correo<input className="field" name="email" type="email" required /></label>
              <label className="lbl">Contraseña inicial<input className="field" name="password" type="password" required minLength={10} autoComplete="new-password" /></label>
              <div style={{ alignSelf: 'end' }}><button type="submit" className="btn btn--outline btn--sm" disabled={team.busy}>+ Agregar administrador</button></div>
            </form>
          </Section>
        </div>

        <aside className="ev-side" aria-label="Acerca de">
          <div className="card card--roomy">
            <h2 className="card-title card-title--lg">Acerca de</h2>
            <dl className="about">
              <dt>Aplicación</dt><dd>{APP_NAME}</dd>
              <dt>Versión</dt><dd>{form.version}</dd>
              <dt>Autor</dt><dd>{APP_AUTHOR}</dd>
            </dl>
            <p className="xsmall muted">{APP_COPYRIGHT}</p>
          </div>
        </aside>
      </div>
    </AdminLayout>
  );
}
