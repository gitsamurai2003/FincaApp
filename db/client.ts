// db/client.ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

// Abre o crea el archivo físico de la BD en el almacenamiento local
const expoDb = openDatabaseSync('finca.db');

// 👇 TRUCO DEFINITIVO: Obligamos a SQLite a meter la columna en caliente
try {
  expoDb.execSync('ALTER TABLE fincas ADD COLUMN activa INTEGER DEFAULT 0;');
  console.log('✅ Columna "activa" inyectada directamente en SQLite.');
} catch (e) {
  // Si la columna ya existía de un intento previo, SQLite lanzará un error que ignoramos seguro
  console.log('ℹ️ La columna "activa" ya existe en el archivo físico.');
}

// Exportamos la instancia de Drizzle configurada con nuestro esquema
export const db = drizzle(expoDb, { schema });