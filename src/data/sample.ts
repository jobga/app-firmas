/** Sample analytics shown in the dashboard until the API is wired up. */
export const TOTAL_VERIFIED = 1976;

export const kpis = [
  { label: 'Registros iniciados', value: '2.418', delta: '+12 % vs. periodo anterior', tone: 'ok' },
  { label: 'Firmas verificadas', value: '1.976', delta: '+9 % vs. periodo anterior', tone: 'ok' },
  { label: 'Tasa de verificación', value: '81,7 %', delta: '−1,4 pts vs. periodo anterior', tone: 'bad' },
  { label: 'Tiempo medio para firmar', value: '2 min 40 s', delta: '72 % desde celular', tone: 'neutral' },
] as const;

export const funnel: [string, number][] = [
  ['Iniciaron el registro', 2418],
  ['Completaron datos y autorización', 2210],
  ['Dibujaron la firma', 2105],
  ['Verificaron el código', 1976],
];

export const gender: [string, number, string][] = [
  ['Femenino', 1086, '#2C4BFF'],
  ['Masculino', 812, '#9BA9FF'],
  ['No binario', 38, '#E07A1F'],
  ['Prefiere no decir', 40, '#B9B6AD'],
];

export const ages: [string, number][] = [['18–24', 412], ['25–34', 598], ['35–44', 431], ['45–59', 352], ['60+', 183]];

export const zones = { urban: 1532, rural: 444 };

export const towns: [string, number][] = [['Pasto', 1204], ['Ipiales', 236], ['Tumaco', 148], ['Túquerres', 97], ['Otros', 291]];

export const ethnic: [string, number][] = [['Ninguno', 1388], ['Campesino', 241], ['Indígena', 214], ['Afrocolombiano', 109], ['Otros', 24]];

export const pets: [string, number][] = [['Perros', 1120], ['Gatos', 864], ['Otros animales', 156], ['Ninguno', 402]];

export type SignatureStatus = 'ok' | 'wait' | 'exp';

export const recentRows: { folio: string; name: string; town: string; date: string; status: SignatureStatus }[] = [
  { folio: 'AN-001976', name: 'Laura M. •••', town: 'Pasto', date: 'Hoy, 15:42', status: 'ok' },
  { folio: 'AN-001975', name: 'Andrés R. •••', town: 'Ipiales', date: 'Hoy, 15:38', status: 'wait' },
  { folio: 'AN-001974', name: 'Camila T. •••', town: 'Pasto', date: 'Hoy, 15:21', status: 'ok' },
  { folio: 'AN-001973', name: 'Jorge E. •••', town: 'Tumaco', date: 'Hoy, 14:57', status: 'ok' },
  { folio: 'AN-001972', name: 'Diana P. •••', town: 'Túquerres', date: 'Hoy, 14:30', status: 'exp' },
  { folio: 'AN-001971', name: 'Mateo G. •••', town: 'Pasto', date: 'Hoy, 14:12', status: 'ok' },
];

/** 30 days of started vs verified registrations, in a 640×220 chart space. */
export function dailySeries(): { started: [number, number][]; verified: [number, number][] } {
  const started: [number, number][] = [], verified: [number, number][] = [];
  for (let i = 0; i < 30; i++) {
    const base = 60 + 30 * Math.sin(i / 4) + i * 1.6 + (i % 7 === 5 ? 28 : 0);
    started.push([i * (640 / 29), 200 - base * 1.25]);
    verified.push([i * (640 / 29), 200 - base * 0.82 * 1.25]);
  }
  return { started, verified };
}
