// db/init.ts
import { sql } from 'drizzle-orm';
import { db } from './client';
import { especies, razas } from './schema';

export async function inicializarBaseDeDatos() {
  await db.run(sql`PRAGMA foreign_keys = ON;`);

  // 1. Crear la tabla fincas asegurando la columna "activa"
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS fincas (
      id TEXT PRIMARY KEY NOT NULL, 
      nombre TEXT NOT NULL, 
      ubicacion TEXT, 
      activa INTEGER DEFAULT 0,
      creado_en INTEGER NOT NULL
    );
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS especies (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      nombre TEXT NOT NULL UNIQUE
    );
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS razas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      especie_id INTEGER NOT NULL, 
      nombre TEXT NOT NULL, 
      FOREIGN KEY (especie_id) REFERENCES especies(id) ON DELETE CASCADE
    );
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS lotes (
      id TEXT PRIMARY KEY NOT NULL, 
      finca_id TEXT NOT NULL, 
      nombre TEXT NOT NULL, 
      descripcion TEXT, 
      FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE CASCADE
    );
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS animales (
      id TEXT PRIMARY KEY NOT NULL, 
      finca_id TEXT NOT NULL, 
      especie_id INTEGER NOT NULL, 
      raza_id INTEGER NOT NULL, 
      lote_id TEXT, 
      arete_codigo TEXT NOT NULL, 
      nombre TEXT, 
      fecha_nacimiento TEXT NOT NULL, 
      sexo TEXT NOT NULL, 
      peso_inicial REAL NOT NULL, 
      categoria TEXT NOT NULL,
      proposito TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'Activo', 
      madre_id TEXT, 
      padre_id TEXT, 
      notas TEXT,
      creado_en INTEGER NOT NULL, 
      FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE CASCADE, 
      FOREIGN KEY (especie_id) REFERENCES especies(id), 
      FOREIGN KEY (raza_id) REFERENCES razas(id), 
      FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE SET NULL
    );
  `);

  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_animal_finca ON animales(finca_id);`);
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_arete_finca ON animales(finca_id, arete_codigo);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_animal_lote ON animales(lote_id);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_animal_categoria ON animales(categoria);`);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS pesajes (
      id TEXT PRIMARY KEY NOT NULL, 
      animal_id TEXT NOT NULL, 
      peso REAL NOT NULL, 
      fecha_pesaje TEXT NOT NULL, 
      condicion_corporal INTEGER,
      notas TEXT, 
      FOREIGN KEY (animal_id) REFERENCES animales(id) ON DELETE CASCADE
    );
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS produccion_leche (
      id TEXT PRIMARY KEY NOT NULL, 
      animal_id TEXT NOT NULL, 
      fecha TEXT NOT NULL, 
      litros REAL NOT NULL, 
      turno TEXT NOT NULL, 
      notas TEXT, 
      FOREIGN KEY (animal_id) REFERENCES animales(id) ON DELETE CASCADE
    );
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS eventos_reproductivos (
      id TEXT PRIMARY KEY NOT NULL,
      animal_id TEXT NOT NULL,
      tipo_evento TEXT NOT NULL,
      fecha_evento TEXT NOT NULL,
      resultado_palpacion TEXT,
      toro_o_pajuela TEXT,
      fecha_probable_parto TEXT,
      detalles_parto TEXT,
      notas TEXT,
      FOREIGN KEY (animal_id) REFERENCES animales(id) ON DELETE CASCADE
    );
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS historial_medico (
      id TEXT PRIMARY KEY NOT NULL,
      animal_id TEXT NOT NULL,
      tipo_manejo TEXT NOT NULL,
      diagnostico TEXT,
      medicamento TEXT NOT NULL,
      dosis TEXT,
      fecha_aplicacion TEXT NOT NULL,
      dias_retiro_leche INTEGER NOT NULL DEFAULT 0,
      dias_retiro_carne INTEGER NOT NULL DEFAULT 0,
      notas TEXT,
      FOREIGN KEY (animal_id) REFERENCES animales(id) ON DELETE CASCADE
    );
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS rendimientos_queso (
      id TEXT PRIMARY KEY NOT NULL,
      finca_id TEXT NOT NULL,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      total_litros REAL NOT NULL,
      kg_queso REAL NOT NULL,
      litros_por_kg REAL NOT NULL,
      notas TEXT,
      creado_en INTEGER NOT NULL,
      FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE CASCADE
    );
  `);

  // Migración: corregir typo en instalaciones previas (fecha_application → fecha_aplicacion)
  try {
    await db.run(
      sql`ALTER TABLE historial_medico RENAME COLUMN fecha_application TO fecha_aplicacion;`
    );
    console.log('DB: Columna historial_medico.fecha_aplicacion corregida.');
  } catch {
    // Tabla nueva, columna ya correcta, o SQLite sin RENAME COLUMN
  }

  // 2. Insertar Semillas de Especies
  const cantidadEspecies = await db.select().from(especies);
  if (cantidadEspecies.length === 0) {
    await db.insert(especies).values([
      { id: 1, nombre: 'Bovino' },
      { id: 2, nombre: 'Bufalino' },
      { id: 3, nombre: 'Ovino' },
      { id: 4, nombre: 'Equino' },
      { id: 5, nombre: 'Caprino' }
    ]);
    console.log('🌱 Especies base cargadas.');
  }

  // 3. Insertar Semillas de Razas correspondientes a los IDs de las especies
  const cantidadRazas = await db.select().from(razas);
  if (cantidadRazas.length === 0) {
    await db.insert(razas).values([
      // Razas Bovinas (especie_id: 1)
      { especieId: 1, nombre: 'Gyr' },
      { especieId: 1, nombre: 'Holstein' },
      { especieId: 1, nombre: 'Brahman' },
      { especieId: 1, nombre: 'Carora' },
      // Razas Bufalinas (especie_id: 2)
      { especieId: 2, nombre: 'Murrah' },
      { especieId: 2, nombre: 'Mediterráneo' },
      { especieId: 2, nombre: 'Jafarabadi' }
    ]);
    console.log('🌱 Razas base cargadas (Murrah, Gyr, Mediterráneo, etc.).');
  }
}