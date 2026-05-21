export const CATEGORIAS_AGRUPADAS = {
  '🐄 Vacunos': [
    'Becerro', 'Becerra', 'Maute', 'Mauta', 'Novillo', 'Novilla',
    'Vaca', 'Toro', 'Padrote', 'Buey',
  ],
  '🐃 Bufalinos': [
    'Bubillo_Lactante', 'Bubilla_Lactante', 'Buvillo', 'Buvilla',
    'Baute', 'Bauta', 'Búfala', 'Butoro',
  ],
  '🐑 Ovinos/Caprinos': [
    'Cordero', 'Cordera', 'Oveja', 'Carnero', 'Cabrito', 'Cabrita', 'Cabra', 'Chivato',
  ],
  '🐴 Equinos': [
    'Potrillo', 'Potranca', 'Yegua', 'Caballo', 'Padrillo', 'Asno', 'Mula',
  ],
} as const;

export type CategoriaAnimal = (typeof CATEGORIAS_AGRUPADAS)[keyof typeof CATEGORIAS_AGRUPADAS][number];

export function categoriaSugeridaPorEspecie(especieNombre: string, sexo: 'M' | 'F'): CategoriaAnimal {
  const n = especieNombre.toLowerCase();
  if (n.includes('bufa')) return sexo === 'F' ? 'Bubilla_Lactante' : 'Bubillo_Lactante';
  if (n.includes('ovi') || n.includes('capri')) return sexo === 'F' ? 'Cordera' : 'Cordero';
  if (n.includes('equi')) return sexo === 'F' ? 'Potranca' : 'Potrillo';
  return sexo === 'F' ? 'Becerra' : 'Becerro';
}
