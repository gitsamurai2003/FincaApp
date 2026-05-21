import { eq } from 'drizzle-orm';
import { db } from './client';
import { fincas } from './schema';

export async function obtenerFincaActivaId(): Promise<string | null> {
  const rows = await db.select({ id: fincas.id }).from(fincas).where(eq(fincas.activa, 1)).limit(1);
  return rows[0]?.id ?? null;
}

export async function obtenerFincaActiva(): Promise<{ id: string; nombre: string } | null> {
  const rows = await db
    .select({ id: fincas.id, nombre: fincas.nombre })
    .from(fincas)
    .where(eq(fincas.activa, 1))
    .limit(1);
  return rows[0] ?? null;
}
