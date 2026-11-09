/**
 * Cliente de la API PHP (`<carpeta de instalación>/api`).
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { apiUrl } from './base';

export class ApiError extends Error {
  constructor(public status: number, message: string, public field?: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function api<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'animalista' } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(apiUrl(path), init);
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Error inesperado', data.field, data);
  return data as T;
}

export const get = <T>(p: string) => api<T>(p);
export const post = <T>(p: string, b?: unknown) => api<T>(p, 'POST', b ?? {});
export const put = <T>(p: string, b: unknown) => api<T>(p, 'PUT', b);
export const del = <T>(p: string, b?: unknown) => api<T>(p, 'DELETE', b ?? {});

// ---------- Tipos ----------
export type EventColors = { bg: string; title: string; text: string; button: string };
export type OptionalField = 'phone' | 'birth_date' | 'gender' | 'municipality' | 'zone' | 'ethnic_group' | 'pets' | 'education' | 'disability';
export type CustomFieldType = 'text' | 'select' | 'multi';
export type CustomField = { id?: string; label: string; required: boolean; type: CustomFieldType; options: string[] };
/** Campos de caracterización cuya lista de opciones se configura en cada evento. */
export type ListKey = 'gender' | 'zone' | 'ethnic_group' | 'pets' | 'education' | 'disability';
export type EventFields = {
  optional: Record<OptionalField, boolean>;
  custom: CustomField[];
  lists: Record<ListKey, string[]>;
  /** Códigos DIVIPOLA de los departamentos permitidos ([] = todo el país). */
  geo: { departments: string[] };
};

export type PublicEvent = {
  id: number;
  slug: string;
  status: 'draft' | 'published';
  name: string;
  description: string;
  organization: string;
  policyUrl: string;
  opensAt: string | null;
  closesAt: string | null;
  goal: number | null;
  colors: EventColors;
  logoUrl: string | null;
  backgroundUrl: string | null;
  fields: EventFields;
  municipalities: string[];
  animation: 'both' | 'cats' | 'dogs' | 'off';
  intensity: 'subtle' | 'medium' | 'high';
  codeTtlMinutes: number;
  /** Si es false, la firma se registra sin el código de verificación por correo. */
  requireEmailCode: boolean;
  sendReceipt: boolean;
  isOpen: boolean;
  verifiedCount: number;
};

export type AdminEvent = PublicEvent & {
  maxAttempts: number;
  emailSubject: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
};

export type Receipt = {
  folio: string;
  eventName: string;
  organization: string;
  signer: string;
  document: string;
  verifiedAt: string;
  hash: string;
  /** 'email': se verificó con el código enviado al correo; 'none': el evento no lo exigía. */
  verification: 'email' | 'none';
  signature: string | null;
  token?: string;
};

export type Me = { id: number; name: string; email: string; totpEnabled: boolean; siteName: string };

export type SignatureStatus = 'started' | 'signed' | 'pending_code' | 'verified' | 'expired';

export type Analytics = {
  totals: { visits: number; started: number; signed: number; verified: number; rate: number | null; avgSeconds: number | null; mobileShare: number | null };
  previous: { started: number; verified: number; rate: number | null } | null;
  daily: { day: string; started: number; verified: number }[];
  gender: { label: string; value: number }[];
  age: { label: string; value: number }[];
  zone: { label: string; value: number }[];
  department: { label: string; value: number }[];
  municipality: { label: string; value: number }[];
  ethnic: { label: string; value: number }[];
  pets: { label: string; value: number }[];
};

export type SignatureRow = {
  id: number; folio: string | null; name: string; municipality: string | null; department: string | null; event: string;
  createdAt: string; verifiedAt: string | null; status: SignatureStatus;
};

export type SignatureDetail = {
  id: number; folio: string | null; status: SignatureStatus; event: string; fullName: string; docType: string; docNumber: string;
  email: string; phone: string | null; birthDate: string | null; gender: string | null; department: string | null; municipality: string | null; zone: string | null;
  ethnicGroup: string | null; pets: string | null; extra: Record<string, string | null> | null; consentNews: boolean;
  signature: string | null; hash: string | null; verification: 'email' | 'none' | null; device: string | null; ip: string | null;
  createdAt: string; signedAt: string | null; verifiedAt: string | null;
};

export type Settings = {
  siteName: string; siteUrl: string; version: string; author: string;
  mail: { host: string; port: number; secure: 'tls' | 'ssl' | 'none'; user: string; hasPassword: boolean; fromEmail: string; fromName: string };
};

export const fmtNumber = (n: number) => n.toLocaleString('es-CO');
export const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-CO', { dateStyle: 'long' }) : '—');

/** Opción excluyente en listas de opción múltiple («Ninguno», «Ninguna»). */
export const isExclusiveOption = (o: string) => /^ningun[oa]s?$/i.test(o.trim());
