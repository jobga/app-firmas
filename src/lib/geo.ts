/**
 * Departamentos y municipios de Colombia (DANE · DIVIPOLA), servidos por la API y guardados en memoria.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
import { get } from './api';

export type Department = { code: string; name: string; municipalities: string[] };

let cache: Promise<Department[]> | null = null;

export function loadGeo(): Promise<Department[]> {
  cache ??= get<{ departments: Department[] }>('/geo').then((r) => r.departments).catch((e) => { cache = null; throw e; });
  return cache;
}
