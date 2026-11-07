import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type EventColors = { bg: string; title: string; text: string; button: string };

export type EventConfig = {
  name: string;
  description: string;
  organization: string;
  policyUrl: string;
  slug: string;
  colors: EventColors;
};

export const DEFAULT_EVENT: EventConfig = {
  name: 'Pacto por el bienestar de perros y gatos',
  description:
    'Descripción del evento configurable desde el panel. Explica en dos o tres líneas para qué se recogen las firmas, quién las recibe y hasta cuándo está abierta la convocatoria.',
  organization: 'Colectivo Huellas Pasto',
  policyUrl: '',
  slug: 'pacto-bienestar',
  colors: { bg: '#F7F6F2', title: '#161616', text: '#3D3B36', button: '#2C4BFF' },
};

const STORAGE_KEY = 'animalista.event';

function load(): EventConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<EventConfig>;
      return { ...DEFAULT_EVENT, ...saved, colors: { ...DEFAULT_EVENT.colors, ...saved.colors } };
    }
  } catch { /* storage unavailable */ }
  return DEFAULT_EVENT;
}

type Ctx = { event: EventConfig; saveEvent: (e: EventConfig) => void };
const EventContext = createContext<Ctx | null>(null);

/** Holds the active event's configuration (persisted locally until a backend exists). */
export function EventProvider({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<EventConfig>(load);
  const saveEvent = useCallback((e: EventConfig) => {
    setEvent(e);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(e)); } catch { /* ignore */ }
  }, []);
  return <EventContext.Provider value={{ event, saveEvent }}>{children}</EventContext.Provider>;
}

export function useEvent(): Ctx {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error('useEvent must be used inside <EventProvider>');
  return ctx;
}
