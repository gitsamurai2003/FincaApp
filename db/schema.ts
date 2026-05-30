// db/schema.ts
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// 1. FINCAS / PROYECTOS (Actualizado con flag de activación)
export const fincas = sqliteTable('fincas', {
  id: text('id').primaryKey(), // Los IDs los inyectamos en la app usando expo-crypto
  nombre: text('nombre').notNull(),
  ubicacion: text('ubicacion'), // Ej. "Machiques", "Coloncito", etc.
  activa: integer('activa').default(0), // MULTI-FINCA: 0 = Inactiva, 1 = Activa en la App
  creadoEn: integer('creado_en').$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// 2. ESPECIES (Bovino, Bufalino, Ovino, Equino, Caprino)
export const especies = sqliteTable('especies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull().unique(), 
});

// 3. RAZAS / CRUCES (Ej: Murrah, Mediterráneo, Carora, Brahman, Girolando)
export const razas = sqliteTable('razas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  especieId: integer('especie_id').notNull().references(() => especies.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
});

// 4. LOTES / POTREROS (Subconjuntos clave: "Ordeño 1", "Escoteras", "Mautera")
export const lotes = sqliteTable('lotes', {
  id: text('id').primaryKey(),
  fincaId: text('finca_id').notNull().references(() => fincas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
});

// 5. ANIMALES (El núcleo adaptado)
export const animales = sqliteTable('animales', {
  id: text('id').primaryKey(),
  fincaId: text('finca_id').notNull().references(() => fincas.id, { onDelete: 'cascade' }),
  especieId: integer('especie_id').notNull().references(() => especies.id),
  razaId: integer('raza_id').notNull().references(() => razas.id),
  loteId: text('lote_id').references(() => lotes.id, { onDelete: 'set null' }),
  
  areteCodigo: text('arete_codigo').notNull(), // Chapeta, hierro o chip RFID
  nombre: text('nombre'),
  fechaNacimiento: text('fecha_nacimiento').notNull(), // 'YYYY-MM-DD'
  sexo: text('sexo', { enum: ['M', 'F'] }).notNull(),
  pesoInicial: real('peso_inicial').notNull(),
  
  // REALIDAD DEL CAMPO: Categoría zootécnica actual dinámica
  categoria: text('categoria', { 
    enum: [
      // Vacunos (Bovinos estándar)
      'Becerro', 'Becerra', 
      'Maute', 'Mauta', 
      'Novillo', 'Novilla', 
      'Vaca', 'Toro', 'Padrote', 'Buey',
      
      // Bufalinos (Específico y apegado al Zulia/Latam)
      'Bubillo_Lactante', 'Bubilla_Lactante',
      'Buvillo', 'Buvilla',
      'Baute', 'Bauta',
      'Búfala',
      'Butoro',
      
      // Ovinos / Caprinos
      'Cordero', 'Cordera', 'Oveja', 'Carnero', 'Cabrito', 'Cabrita', 'Cabra', 'Chivato',
      
      // Equinos
      'Potrillo', 'Potranca', 'Yegua', 'Caballo', 'Padrillo', 'Asno', 'Mula'
    ] 
  }).notNull(),

  proposito: text('proposito', { enum: ['Leche', 'Carne', 'Doble_Proposito', 'Trabajo', 'Genetica_Pura'] }).notNull(),
  estado: text('estado', { enum: ['Activo', 'Vendido', 'Fallecido', 'Consumo_Interno'] }).notNull().default('Activo'),
  
  madreId: text('madre_id'), 
  padreId: text('padre_id'),
  
  notas: text('notas'),
  creadoEn: integer('creado_en').$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  fincaIdx: index('idx_animal_finca').on(table.fincaId),
  areteFincaIdx: uniqueIndex('idx_arete_finca').on(table.fincaId, table.areteCodigo),
  loteIdx: index('idx_animal_lote').on(table.loteId),
  categoriaIdx: index('idx_animal_categoria').on(table.categoria),
}));

// 6. CONTROL DE PESAJES (Evaluación de GDP - Ganancia Diaria de Peso)
export const pesajes = sqliteTable('pesajes', {
  id: text('id').primaryKey(),
  animalId: text('animal_id').notNull().references(() => animales.id, { onDelete: 'cascade' }),
  peso: real('peso').notNull(),
  fechaPesaje: text('fecha_pesaje').notNull(),
  condicionCorporal: integer('condicion_corporal'),
  notes: text('notas'), // Mantenemos compatibilidad con tu esquema
});

// 7. PRODUCCIÓN DE LECHE (Control diario por animal)
export const produccionLeche = sqliteTable('produccion_leche', {
  id: text('id').primaryKey(),
  animalId: text('animal_id').notNull().references(() => animales.id, { onDelete: 'cascade' }),
  fecha: text('fecha').notNull(),
  litros: real('litros').notNull(),
  turno: text('turno', { enum: ['M', 'T', 'N'] }).notNull(),
  notas: text('notas'),
});

// 8. REPRODUCCIÓN (Montas, Inseminaciones, Palpaciones y Partos)
export const eventosReproductivos = sqliteTable('eventos_reproductivos', {
  id: text('id').primaryKey(),
  animalId: text('animal_id').notNull().references(() => animales.id, { onDelete: 'cascade' }),
  tipoEvento: text('tipo_evento', { 
    enum: ['Celo_Detectado', 'Monta_Natural', 'Inseminacion_Artificial', 'Palpacion_Diagnostico', 'Parto'] 
  }).notNull(),
  fechaEvento: text('fecha_evento').notNull(),
  
  resultadoPalpacion: text('resultado_palpacion', { enum: ['Preñada', 'Vacia', 'Dudosa'] }),
  toroOPajuela: text('toro_o_pajuela'),
  fechaProbableParto: text('fecha_probable_parto'),
  detallesParto: text('detalles_parto', { enum: ['Normal', 'Distocico_Asistido', 'Aborto', 'Natimuerto'] }),
  
  notas: text('notas'),
});

// 9. RENDIMIENTO QUESERO (Lotes / períodos guardados)
export const rendimientosQueso = sqliteTable('rendimientos_queso', {
  id: text('id').primaryKey(),
  fincaId: text('finca_id').notNull().references(() => fincas.id, { onDelete: 'cascade' }),
  fechaInicio: text('fecha_inicio').notNull(),
  fechaFin: text('fecha_fin').notNull(),
  totalLitros: real('total_litros').notNull(),
  kgQueso: real('kg_queso').notNull(),
  litrosPorKg: real('litros_por_kg').notNull(),
  notas: text('notas'),
  creadoEn: integer('creado_en').$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// 10. SANIDAD Y CONTROL CLÍNICO
export const historialMedico = sqliteTable('historial_medico', {
  id: text('id').primaryKey(),
  animalId: text('animal_id').notNull().references(() => animales.id, { onDelete: 'cascade' }),
  tipoManejo: text('tipo_manejo', { enum: ['Vacunacion_Obligatoria', 'Tratamiento_Enfermedad', 'Desparasitacion', 'Vitamina'] }).notNull(),
  diagnostico: text('diagnostico'),
  medicamento: text('medicamento').notNull(),
  dosis: text('dosis'),
  fechaAplicacion: text('fecha_aplicacion').notNull(),
  
  diasRetiroLeche: integer('dias_retiro_leche').notNull().default(0),
  diasRetiroCarne: integer('dias_retiro_carne').notNull().default(0),
  
  notas: text('notas'),
});

export const configuracionApp = sqliteTable('configuracion_app', {
  id: integer('id').primaryKey(),
  estadoLicencia: text('estado_licencia').notNull(),
  fechaInicioPrueba: integer('fecha_inicio_prueba').notNull(),
});