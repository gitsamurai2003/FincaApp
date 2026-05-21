export type TurnoLecheUi = 'Mañana' | 'Tarde' | 'Noche';

export function turnoLecheToCodigo(turno: TurnoLecheUi): 'M' | 'T' | 'N' {
  if (turno === 'Tarde') return 'T';
  if (turno === 'Noche') return 'N';
  return 'M';
}

export function turnoLecheLabel(codigo: string): string {
  if (codigo === 'T') return 'Tarde';
  if (codigo === 'N') return 'Noche';
  return 'Mañana';
}
