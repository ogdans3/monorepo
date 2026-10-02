export type Row = Record<string, any>;
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Noe gikk galt. Prøv igjen.');
  return data;
}
export const kinds: Record<string, string> = {
  video: 'Video',
  image: 'Bilde',
  audio: 'Lyd',
  hook: 'Hook',
  script: 'Manus',
  copy: 'Posttekst',
  brief: 'Brief',
  reference: 'Referanse',
  template: 'Mal',
  knowledge: 'Kunnskap',
  carousel: 'Karusell',
};
export const states: Record<string, string> = {
  idea: 'Idé',
  ready: 'Klar',
  running: 'Pågår',
  review: 'Til gjennomgang',
  done: 'Ferdig',
  draft: 'Utkast',
  approved: 'Godkjent',
  archived: 'Arkivert',
  planned: 'Planlagt',
  published: 'Publisert',
  queued: 'I kø',
  completed: 'Ferdig',
  failed: 'Mislyktes',
  cancelled: 'Stoppet',
  limited: 'Grense nådd',
};
export const formatDate = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) =>
  new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', ...options }).format(new Date(date));
export function localInput(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return parts.replace(' ', 'T');
}
// Convert a wall time in Oslo, including DST, without depending on the browser's time zone.
export function osloISO(value: string): string {
  const wall = new Date(value + ':00Z');
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const shown = new Date(localInput(instant) + ':00Z');
    const delta = wall.getTime() - shown.getTime();
    if (!delta) return instant.toISOString();
    instant = new Date(instant.getTime() + delta);
  }
  if (localInput(instant) !== value)
    throw new Error('Tidspunktet finnes ikke ved overgang til sommertid. Velg et annet tidspunkt.');
  return instant.toISOString();
}
