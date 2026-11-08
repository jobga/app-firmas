/**
 * Comprobante imprimible de una firma verificada.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { useParams } from 'react-router-dom';
import { fmtDateTime, get, type Receipt as ReceiptData } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { CatMark } from '../components/LineArt';
import { apiUrl } from '../lib/base';
import './Receipt.css';

export function Receipt() {
  const { token = '' } = useParams();
  const { data, error, loading } = useAsync(() => get<ReceiptData>(`/receipts/${encodeURIComponent(token)}`), [token]);
  if (loading && !data) return <div className="page-loading" aria-busy="true">Cargando…</div>;
  if (error || !data) return <div className="page-loading">{error?.message ?? 'Comprobante no disponible'}</div>;

  return (
    <div className="rcpt">
      <article className="rcpt__card">
        <header className="rcpt__head">
          <CatMark color="#161616" size={40} strokeWidth={7} />
          <div>
            <p className="rcpt__kicker">Comprobante de firma verificada</p>
            <h1>{data.eventName}</h1>
            {data.organization && <p className="muted small">{data.organization}</p>}
          </div>
        </header>
        <dl className="rcpt__data">
          <dt>Folio</dt><dd className="mono">{data.folio}</dd>
          <dt>Firmante</dt><dd>{data.signer}</dd>
          <dt>Documento</dt><dd>{data.document}</dd>
          <dt>{data.verification === 'none' ? 'Registrada' : 'Verificada'}</dt><dd>{fmtDateTime(data.verifiedAt)}</dd>
          <dt>Verificación</dt><dd>{data.verification === 'none' ? 'Sin código por correo (no exigido en este evento)' : 'Código enviado al correo del firmante'}</dd>
          <dt>Huella SHA-256</dt><dd className="mono rcpt__hash">{data.hash}</dd>
        </dl>
        {data.signature && (
          <figure className="rcpt__sig">
            <img src={data.signature} alt="Firma registrada" />
            <figcaption>Firma registrada</figcaption>
          </figure>
        )}
        <p className="xsmall muted">
          {data.verification === 'none'
            ? 'La huella digital permite comprobar que el registro no fue alterado después de firmar. En este evento no se verificó el correo con un código.'
            : 'La huella digital permite comprobar que el registro no fue alterado después de la verificación del código enviado al correo del firmante.'}
        </p>
        <div className="btn-row rcpt__actions">
          <a className="btn btn--primary" href={apiUrl(`/receipts/${encodeURIComponent(token)}/pdf`)} download>Descargar PDF</a>
          <button type="button" className="btn btn--outline" onClick={() => window.print()}>Imprimir</button>
        </div>
      </article>
    </div>
  );
}
