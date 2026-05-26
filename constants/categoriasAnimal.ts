// constants/categoriasAnimal.ts

export const CATEGORIAS_AGRUPADAS = {
  '🐄 Bovinos': [
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
  '🐖 Porcinos': [
    'Lechon_Lactante', 'Lechon_Destetado', 'Cerdo_Crecimiento', 'Cerdo_Acabado',
    'Cerdita_Reemplazo', 'Cerda_Gestante', 'Cerda_Lactante', 'Cerda_Vacia', 'Verraco',
  ],
} as const;

export type CategoriaAnimal = (typeof CATEGORIAS_AGRUPADAS)[keyof typeof CATEGORIAS_AGRUPADAS][number];

export function categoriaSugeridaPorEspecie(especieNombre: string, sexo: 'M' | 'F'): CategoriaAnimal {
  const n = especieNombre.toLowerCase();
  
  if (n.includes('bufa')) return sexo === 'F' ? 'Bubilla_Lactante' : 'Bubillo_Lactante';
  if (n.includes('ovi') || n.includes('capri')) return sexo === 'F' ? 'Cordera' : 'Cordero';
  if (n.includes('equi')) return sexo === 'F' ? 'Potranca' : 'Potrillo';
  if (n.includes('porci')) return 'Lechon_Lactante'; // Categoría base indiferente del sexo al nacer/entrar
  
  return sexo === 'F' ? 'Becerra' : 'Becerro';
}