export const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha local YYYY-MM-DD (evita desfase UTC de toISOString en zonas como Venezuela). */
export function fechaLocalISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function haceDiasLocal(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return fechaLocalISO(d);
}

export function esFechaValida(fecha: string): boolean {
  if (!FECHA_REGEX.test(fecha)) return false;
  const [y, m, day] = fecha.split('-').map(Number);
  const parsed = new Date(y, m - 1, day);
  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() === m - 1 &&
    parsed.getDate() === day
  );
}

export function sumarDiasLocal(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dias);
  return fechaLocalISO(dt);
}

export function validarRangoFechas(inicio: string, fin: string): { ok: boolean; mensaje?: string } {
  if (!esFechaValida(inicio) || !esFechaValida(fin)) {
    return { ok: false, mensaje: 'Usa el formato YYYY-MM-DD (ej. 2026-05-15).' };
  }
  if (fin < inicio) {
    return { ok: false, mensaje: 'La fecha fin debe ser igual o posterior a la fecha inicio.' };
  }
  return { ok: true };
}
