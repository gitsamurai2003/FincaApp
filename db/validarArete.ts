import { and, eq } from 'drizzle-orm';
import { db } from './client';
import { animales } from './schema';

/** Devuelve true si el arete existe en la finca (comparación en mayúsculas). */
export async function areteExisteEnFinca(
  fincaId: string,
  arete: string
): Promise<boolean> {
  const codigo = arete.trim().toUpperCase();
  if (!codigo) return false;
  const rows = await db
    .select({ id: animales.id })
    .from(animales)
    .where(and(eq(animales.fincaId, fincaId), eq(animales.areteCodigo, codigo)))
    .limit(1);
  return rows.length > 0;
}
