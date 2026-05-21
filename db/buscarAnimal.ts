import { and, eq } from 'drizzle-orm';
import { db } from './client';
import { animales } from './schema';

export async function buscarAnimalPorArete(fincaId: string, arete: string) {
  const codigo = arete.trim().toUpperCase();
  if (!codigo) return null;
  const rows = await db
    .select()
    .from(animales)
    .where(and(eq(animales.fincaId, fincaId), eq(animales.areteCodigo, codigo)))
    .limit(1);
  return rows[0] ?? null;
}
