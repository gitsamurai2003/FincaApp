// db/init.ts
import { sql } from 'drizzle-orm';
import { db } from './client';
import { especies, razas } from './schema';

export async function inicializarBaseDeDatos() {
  // Aseguramos que las llaves foráneas estén activas para la creación de tablas
  await db.run(sql`PRAGMA foreign_keys = ON;`);

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

  // Migración: corregir typo en instalaciones previas
  try {
    await db.run(
      sql`ALTER TABLE historial_medico RENAME COLUMN fecha_application TO fecha_aplicacion;`
    );
  } catch {
    // Ya corregida o SQLite sin RENAME COLUMN
  }

  // ── APAGAR LLAVES FORÁNEAS TEMPORALMENTE PARA CARGAR SEMILLAS ────────────
  await db.run(sql`PRAGMA foreign_keys = OFF;`);

  try {
    // ── Semillas de Especies ─────────────────────────────────────────────────
    const cantidadEspecies = await db.select().from(especies);
    if (cantidadEspecies.length === 0) {
      await db.insert(especies).values([
        { id: 1, nombre: 'Bovino' },
        { id: 2, nombre: 'Bufalino' },
        { id: 3, nombre: 'Ovino' },
        { id: 4, nombre: 'Equino' },
        { id: 5, nombre: 'Caprino' },
        { id: 6, nombre: 'Porcino' },
      ]);
      console.log('🌱 Especies base cargadas.');
    } else {
      // Verificar e inyectar las especies que falten si la DB ya existía
      const nombresEspeciesExistentes = cantidadEspecies.map((e: any) => e.nombre.toLowerCase());
      const especiesRequeridas = [
        { id: 1, nombre: 'Bovino' },
        { id: 2, nombre: 'Bufalino' },
        { id: 3, nombre: 'Ovino' },
        { id: 4, nombre: 'Equino' },
        { id: 5, nombre: 'Caprino' },
        { id: 6, nombre: 'Porcino' },
      ];

      for (const esp of especiesRequeridas) {
        if (!nombresEspeciesExistentes.includes(esp.nombre.toLowerCase())) {
          await db.insert(especies).values(esp);
          console.log(`🌱 Especie ${esp.nombre} inyectada en base de datos existente.`);
        }
      }
    }

// Definición maestra del catálogo extendido de razas
    const catalogoExtendidoRazas = [
      // === Bovino (1) ===
      { especieId: 1, nombre: 'Gyr' },
      { especieId: 1, nombre: 'Holstein' },
      { especieId: 1, nombre: 'Brahman' },
      { especieId: 1, nombre: 'Carora' },
      { especieId: 1, nombre: 'Girolando' },
      { especieId: 1, nombre: 'Jersey' },
      { especieId: 1, nombre: 'Brown Swiss (Pardo Suizo)' },
      { especieId: 1, nombre: 'Guzerá' },
      { especieId: 1, nombre: 'Nelore' },
      { especieId: 1, nombre: 'Senepol' },
      { especieId: 1, nombre: 'Angus' },
      { especieId: 1, nombre: 'Simmental' },
      { especieId: 1, nombre: 'Criollo Limonero' },
      { especieId: 1, nombre: 'Mosaico Perijanero' },
      { especieId: 1, nombre: 'Sahiwal' },
      { especieId: 1, nombre: 'Simental-Gyr (Simmgyr)' },
      { especieId: 1, nombre: 'Romosinuano' },
      { especieId: 1, nombre: 'Brangus' },
      { especieId: 1, nombre: 'Braford' },
      { especieId: 1, nombre: 'Normando' },
      { especieId: 1, nombre: 'Charolais' },
      { especieId: 1, nombre: 'Santa Gertrudis' },
      { especieId: 1, nombre: 'Mestizo Doble Propósito' },
      { especieId: 1, nombre: 'Mestizo de Leche' },
      { especieId: 1, nombre: 'Mestizo de Carne' },
      { especieId: 1, nombre: 'Criollo' },

      // === Bufalino (2) ===
      { especieId: 2, nombre: 'Murrah' },
      { especieId: 2, nombre: 'Mediterráneo' },
      { especieId: 2, nombre: 'Jafarabadi' },
      { especieId: 2, nombre: 'Nili-Ravi' },
      { especieId: 2, nombre: 'Carabao' },
      { especieId: 2, nombre: 'Mestizo Bufalino' },

      // === Ovino (3) ===
      { especieId: 3, nombre: 'Pelibuey' },
      { especieId: 3, nombre: 'Dorper' },
      { especieId: 3, nombre: 'White Dorper' },
      { especieId: 3, nombre: 'West African' },
      { especieId: 3, nombre: 'Santa Inés' },
      { especieId: 3, nombre: 'Katahdin' },
      { especieId: 3, nombre: 'Blackbelly (Barbados Blackbelly)' },
      { especieId: 3, nombre: 'Charollais' },
      { especieId: 3, nombre: 'Assaf' },
      { especieId: 3, nombre: 'Lacaune' },
      { especieId: 3, nombre: 'Bergamasca' },
      { especieId: 3, nombre: 'Texel' },
      { especieId: 3, nombre: 'Mestizo Ovino' },
      { especieId: 3, nombre: 'Criollo' },

      // === Equino (4) ===
      { especieId: 4, nombre: 'Criollo Venezolano' },
      { especieId: 4, nombre: 'Cuarto de Milla (Quarter Horse)' },
      { especieId: 4, nombre: 'Paso Fino' },
      { especieId: 4, nombre: 'Pura Sangre Inglés' },
      { especieId: 4, nombre: 'Appaloosa' },
      { especieId: 4, nombre: 'Árabe' },
      { especieId: 4, nombre: 'Percherón' },
      { especieId: 4, nombre: 'Pinto' },
      { especieId: 4, nombre: 'Lusitano' },
      { especieId: 4, nombre: 'Pura Raza Española (Andaluz)' },
      { especieId: 4, nombre: 'Iberoamericano' },
      { especieId: 4, nombre: 'Mestizo Equino' },

      // === Caprino (5) ===
      { especieId: 5, nombre: 'Nubia / Anglo-Nubian' },
      { especieId: 5, nombre: 'Boer' },
      { especieId: 5, nombre: 'Saanen' },
      { especieId: 5, nombre: 'Alpina' },
      { especieId: 5, nombre: 'Toggenburg' },
      { especieId: 5, nombre: 'Murciano-Granadina' },
      { especieId: 5, nombre: 'Canaria' },
      { especieId: 5, nombre: 'Kalahari Red' },
      { especieId: 5, nombre: 'Mestizo Caprino' },
      { especieId: 5, nombre: 'Criolla' },

      // === Porcino (6) ===
      { especieId: 6, nombre: 'Landrace' },
      { especieId: 6, nombre: 'Large White (Yorkshire)' },
      { especieId: 6, nombre: 'Duroc' },
      { especieId: 6, nombre: 'Hampshire' },
      { especieId: 6, nombre: 'Pietrain' },
      { especieId: 6, nombre: 'Berkshire' },
      { especieId: 6, nombre: 'Meishan' },
      { especieId: 6, nombre: 'Criollo / Casco de Mula' },
      { especieId: 6, nombre: 'Mestizo Porcino' },
    ];

    // ── Semillas de Razas (Instalación desde cero o Migración) ────────────────
    const cantidadRazas = await db.select().from(razas);
    if (cantidadRazas.length === 0) {
      await db.insert(razas).values(catalogoExtendidoRazas);
      console.log('🌱 Catálogo extendido de razas cargado con éxito.');
    } else {
      console.log('🔄 Sincronizando catálogo de razas con nuevas inclusiones...');
      
      const mapeoExistentes = cantidadRazas.reduce((acc: Record<number, string[]>, r: any) => {
        if (!acc[r.especieId]) acc[r.especieId] = [];
        acc[r.especieId].push(r.nombre.toLowerCase().trim());
        return acc;
      }, {});

      const razasFaltantes = catalogoExtendidoRazas.filter((nuevaRaza) => {
        const nombresEnEspecie = mapeoExistentes[nuevaRaza.especieId] || [];
        return !nombresEnEspecie.includes(nuevaRaza.nombre.toLowerCase().trim());
      });

      if (razasFaltantes.length > 0) {
        await db.insert(razas).values(razasFaltantes);
        console.log(`🌱 Migración completa: Se inyectaron ${razasFaltantes.length} nuevas razas sin alterar los registros existentes.`);
      } else {
        console.log('✅ Catálogo de razas al día.');
      }
    }
  } finally {
    // ── REENCENDER LLAVES FORÁNEAS ANTES DE SALIR ───────────────────────────
    await db.run(sql`PRAGMA foreign_keys = ON;`);
  }
}