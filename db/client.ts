// db/client.ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const expoDb = openDatabaseSync('finca.db');

// Función para inicializar las tablas necesarias
const initializeDatabase = () => {
  try {
    // 1. Crear la tabla de configuración si no existe
    expoDb.execSync(`
      CREATE TABLE IF NOT EXISTS configuracion_app (
        id INTEGER PRIMARY KEY,
        estado_licencia TEXT NOT NULL,
        fecha_inicio_prueba INTEGER NOT NULL
      );
    `);
    console.log('✅ Tabla "configuracion_app" verificada/creada.');

    // 2. Otros parches o migraciones manuales
    expoDb.execSync('ALTER TABLE fincas ADD COLUMN IF NOT EXISTS activa INTEGER DEFAULT 0;');
  } catch (e) {
    console.error('❌ Error al inicializar tablas:', e);
  }
};

// Ejecutamos la inicialización
initializeDatabase();

export const db = drizzle(expoDb, { schema });