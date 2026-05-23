import { db } from './client';
import * as schema from './schema';

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Auxiliar para generar rangos de fechas fácilmente
const generarFechasHistorial = (diasAtras: number): string[] => {
  const fechas: string[] = [];
  for (let i = diasAtras; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    fechas.push(d.toISOString().split('T')[0]);
  }
  return fechas;
};

export async function seedDatabase() {
  console.log('🌱 Iniciando super-seeding masivo y complejo...');

  try {
    console.log('🧹 Limpiando tablas...');
    await db.delete(schema.historialMedico);
    await db.delete(schema.produccionLeche);
    await db.delete(schema.pesajes);
    await db.delete(schema.eventosReproductivos);
    await db.delete(schema.animales);
    await db.delete(schema.lotes);
    await db.delete(schema.rendimientosQueso);
    await db.delete(schema.fincas);
    await db.delete(schema.razas);
    await db.delete(schema.especies);
    console.log('🧹 Base de datos limpia.');

    // 2. Especies fijas
    await db.insert(schema.especies).values([
      { id: 1, nombre: 'Bovino' },
      { id: 2, nombre: 'Bufalino' },
    ]);

    // 3. Razas expandidas
    await db.insert(schema.razas).values([
      { id: 1, especieId: 2, nombre: 'Murrah' },
      { id: 2, especieId: 2, nombre: 'Mediterráneo' },
      { id: 3, especieId: 1, nombre: 'Carora' },
      { id: 4, especieId: 1, nombre: 'Brahman' },
      { id: 5, especieId: 1, nombre: 'Gyr' },
      { id: 6, especieId: 2, nombre: 'Jafarabadi' },
    ]);

    // 4. Finca
    const fincaId = generateId();
    await db.insert(schema.fincas).values({
      id: fincaId,
      nombre: 'Hacienda El Búfalo Alegre',
      ubicacion: 'Machiques',
      activa: 1,
    });

    // 5. Lotes operacionales segmentados
    const loteOrdeno1Id = generateId();
    const loteOrdeno2Id = generateId();
    const loteEscoterasId = generateId();
    const loteMauteraId = generateId();
    const loteBecerrosId = generateId();

    await db.insert(schema.lotes).values([
      { id: loteOrdeno1Id, fincaId, nombre: 'Ordeño Alta Producción', descripcion: 'Animales con picos superiores a 12L diarios' },
      { id: loteOrdeno2Id, fincaId, nombre: 'Ordeño Media / Baja', descripcion: 'Lactancias avanzadas o cola de ordeño' },
      { id: loteEscoterasId, fincaId, nombre: 'Escoteras / Secas', descripcion: 'Búfalas en descanso y próximas al parto' },
      { id: loteMauteraId, fincaId, nombre: 'Mautera y Novillas', descripcion: 'Hembras de reemplazo en desarrollo' },
      { id: loteBecerrosId, fincaId, nombre: 'Becerros / Bucerros', descripcion: 'Crías en etapa de lactancia' },
    ]);

    // 6. Inserción Masiva de Animales (Multiplicado por más de 10)
    console.log('插入 Animales masivos...');
    const animalesData: any[] = [];
    
    // Arrays para guardar IDs por categorías para los registros relacionales posteriores
    const bufalasOrdenoIds: string[] = [];
    const bufalasSecasIds: string[] = [];
    const mautasIds: string[] = [];
    const padrotesIds: string[] = [];

    // Generar 15 Búfalas de Ordeño de Alta Producción (Murrah)
    for (let i = 1; i <= 15; i++) {
      const id = generateId();
      bufalasOrdenoIds.push(id);
      animalesData.push({
        id, fincaId, especieId: 2, razaId: 1, loteId: loteOrdeno1Id,
        areteCodigo: `BM-1${String(i).padStart(2, '0')}`,
        nombre: `Mariposa ${i}`, fechaNacimiento: `2019-0${(i % 9) + 1}-10`,
        sexo: 'F', pesoInicial: 420.0 + (i * 5), categoria: 'Búfala',
        proposito: 'Leche', estado: 'Activo', notas: `Grupo élite de ordeño mecanizado. Fila ${i}`
      });
    }

    // Generar 15 Búfalas de Ordeño de Media/Baja (Mediterráneo)
    for (let i = 1; i <= 15; i++) {
      const id = generateId();
      bufalasOrdenoIds.push(id);
      animalesData.push({
        id, fincaId, especieId: 2, razaId: 2, loteId: loteOrdeno2Id,
        areteCodigo: `BZ-2${String(i).padStart(2, '0')}`,
        nombre: `Gitana ${i}`, fechaNacimiento: `2020-0${(i % 9) + 1}-22`,
        sexo: 'F', pesoInicial: 410.0 + (i * 4), categoria: 'Búfala',
        proposito: 'Doble_Proposito', estado: 'Activo', notas: `Producción estable a pastoreo. Fila ${i}`
      });
    }

    // Generar 10 Búfalas Escoteras / Próximas
    for (let i = 1; i <= 10; i++) {
      const id = generateId();
      bufalasSecasIds.push(id);
      animalesData.push({
        id, fincaId, especieId: 2, razaId: 1, loteId: loteEscoterasId,
        areteCodigo: `BE-3${String(i).padStart(2, '0')}`,
        nombre: `Seca ${i}`, fechaNacimiento: `2018-11-${String(i + 5).padStart(2, '0')}`,
        sexo: 'F', pesoInicial: 480.0 + (i * 3), categoria: 'Búfala',
        proposito: 'Leche', estado: 'Activo', notas: `Preñadas confirmadas por eco, periodo de secado.`
      });
    }

    // Generar 12 Mautas / Novillas (Crecimiento para cálculo de GDP)
    for (let i = 1; i <= 12; i++) {
      const id = generateId();
      mautasIds.push(id);
      animalesData.push({
        id, fincaId, especieId: 1, razaId: 3, loteId: loteMauteraId, // Bovinos Carora
        areteCodigo: `VC-4${String(i).padStart(2, '0')}`,
        nombre: `Carorana ${i}`, fechaNacimiento: `2024-10-${String(i + 2).padStart(2, '0')}`,
        sexo: 'F', pesoInicial: 160.0 + (i * 8), categoria: 'Mauta',
        proposito: 'Leche', estado: 'Activo', notas: `Lote de levante con pesajes mensuales estrictos.`
      });
    }

    // Generar 3 Padrotes
    for (let i = 1; i <= 3; i++) {
      const id = generateId();
      padrotesIds.push(id);
      animalesData.push({
        id, fincaId, especieId: 2, razaId: i === 3 ? 6 : 1, loteId: loteEscoterasId,
        areteCodigo: `PAD-0${i}`,
        nombre: i === 1 ? 'General' : i === 2 ? 'Coronel' : 'Cacique',
        fechaNacimiento: `2018-01-05`, sexo: 'M', pesoInicial: 650.0 + (i * 20),
        categoria: 'Padrote', proposito: 'Genetica_Pura', estado: 'Activo',
        notas: `Reproductor asignado a potreros extensivos.`
      });
    }

    await db.insert(schema.animales).values(animalesData as any);


    // 7. Pesajes Históricos Complejos (Curvas de Crecimiento GPD)
    console.log('插入 Historial de Pesajes Secuenciales...');
    const pesajesData: any[] = [];
    const meses = ['2026-02-15', '2026-03-15', '2026-04-15', '2026-05-15'];

    // Simular ganancia de peso incremental y lógica para las mautas
    mautasIds.forEach((id, index) => {
      let pesoSimulado = 180 + (index * 3);
      meses.forEach((fecha, mi) => {
        pesoSimulado += 18 + Math.floor(Math.random() * 8); // Incremento realista mensual (~600g a 800g diarios)
        pesajesData.push({
          id: generateId(),
          animalId: id,
          peso: parseFloat(pesoSimulado.toFixed(1)),
          fechaPesaje: fecha,
          condicionCorporal: mi === 3 ? 4 : 3
        });
      });
    });

    // Pesajes para los toros principales
    padrotesIds.forEach(id => {
      pesajesData.push(
        { id: generateId(), animalId: id, peso: 710.0, fechaPesaje: '2026-02-01', condicionCorporal: 4 },
        { id: generateId(), animalId: id, peso: 728.5, fechaPesaje: '2026-05-01', condicionCorporal: 4 }
      );
    });

    await db.insert(schema.pesajes).values(pesajesData);


    // 8. Producción Masiva de Leche (Curva de los últimos 15 días)
    console.log('插入 Serie Temporal de Producción de Leche (Últimos 15 días x 30 búfalas)...');
    const produccionData: any[] = [];
    const ultimos15Dias = generarFechasHistorial(14); // Genera array de strings YYYY-MM-DD

    bufalasOrdenoIds.forEach((id, bIndex) => {
      // Factor base de producción por animal (unas dan más, otras menos)
      const factorBase = bIndex < 15 ? 10.5 + (bIndex * 0.2) : 7.0 + (bIndex * 0.15);

      ultimos15Dias.forEach(fecha => {
        // Fluctuación aleatoria diaria sutil del 10%
        const variacionM = (Math.random() * 1.6) - 0.8;
        const variacionT = (Math.random() * 1.2) - 0.6;

        // Turno Mañana (60% de la leche)
        produccionData.push({
          id: generateId(),
          animalId: id,
          fecha,
          litros: parseFloat(Math.max(3.0, (factorBase * 0.6) + variacionM).toFixed(1)),
          turno: 'M'
        });

        // Turno Tarde (40% de la leche)
        produccionData.push({
          id: generateId(),
          animalId: id,
          fecha,
          litros: parseFloat(Math.max(2.0, (factorBase * 0.4) + variacionT).toFixed(1)),
          turno: 'T'
        });
      });
    });

    // Inserción por lotes para evitar desbordes de memoria o de parámetros SQL
    const chunk = 500;
    for (let i = 0; i < produccionData.length; i += chunk) {
      await db.insert(schema.produccionLeche).values(produccionData.slice(i, i + chunk));
    }


    // 9. Historial Médico con Retiros Sanitarios y Controles
    console.log('插入 Historial Médico Complejo...');
    const registrosMedicos: any[] = [];
    
    // Casos clínicos específicos
    registrosMedicos.push(
      {
        id: generateId(), animalId: bufalasOrdenoIds[0],
        tipoManejo: 'Tratamiento_Enfermedad', diagnostico: 'Mastitis aguda cuarto anterior izquierdo',
        medicamento: 'Ubrolexin M intramamario', dosis: '1 jeringa c/24h',
        fechaAplicacion: '2026-05-20', diasRetiroLeche: 5, diasRetiroCarne: 10,
        notas: 'Alerta: Ordeño en balde separado obligatorio.'
      },
      {
        id: generateId(), animalId: bufalasOrdenoIds[4],
        tipoManejo: 'Tratamiento_Enfermedad', diagnostico: 'Papiromatosis cutánea (verrugas)',
        medicamento: 'Histovac (Autovacuna)', dosis: '5 ml Subcutáneo',
        fechaAplicacion: '2026-05-10', diasRetiroLeche: 0, diasRetiroCarne: 0,
        notas: 'Segunda dosis de control inmunológico.'
      },
      {
        id: generateId(), animalId: mautasIds[2],
        tipoManejo: 'Tratamiento_Enfermedad', diagnostico: 'Parásitos gastrointestinales',
        medicamento: 'Ivermectina 1%', dosis: '1 ml por cada 50kg',
        fechaAplicacion: '2026-04-12', diasRetiroLeche: 0, diasRetiroCarne: 28,
        notas: 'Lote completo desparasitado preventivo.'
      }
    );

    // Vacunación Masiva de Aftosa y Rabia a todo el rebaño de ordeño (Simulación de manejo sanitario colectivo)
    bufalasOrdenoIds.forEach((id, index) => {
      if (index % 3 === 0) { // Aplicado de forma aleatoria estructurada
        registrosMedicos.push({
          id: generateId(),
          animalId: id,
          tipoManejo: 'Vacunacion',
          diagnostico: 'Ciclo Obligatorio INSAI',
          medicamento: 'Aftogan + Rabogan',
          dosis: '2 ml Intramuscular',
          fechaAplicacion: '2026-05-01',
          diasRetiroLeche: 0,
          diasRetiroCarne: 0,
          notes: 'Esquema nacional de erradicación de Fiebre Aftosa.'
        });
      }
    });

    await db.insert(schema.historialMedico).values(registrosMedicos);


    // 10. Eventos Reproductivos Continuos (Ciclos de servicio)
    console.log('插入 Ciclos Reproductivos Dinámicos...');
    const eventosReproductivos: any[] = [];

    // Registrar Inseminaciones Artificiales y Palpaciones de confirmación
    bufalasOrdenoIds.slice(0, 10).forEach((id, index) => {
      const fechaIA = `2026-01-${10 + index}`;
      const fechaConfirmacion = `2026-03-${12 + index}`;
      
      // Evento 1: La Inseminación
      eventosReproductivos.push({
        id: generateId(),
        animalId: id,
        tipoEvento: 'Inseminacion_Artificial',
        fechaEvento: fechaIA,
        toroOPajuela: 'Semen Congelado Italiano - Taurus 09'
      });

      // Evento 2: Palpación rectal de confirmación a los 60 días (Alternando Positivos y Vacías)
      eventosReproductivos.push({
        id: generateId(),
        animalId: id,
        tipoEvento: 'Palpacion',
        fechaEvento: fechaConfirmacion,
        toroOPajuela: index % 4 !== 0 ? 'Confirmado PREÑADA' : 'Vacía / Repetir Celo'
      });
    });

    await db.insert(schema.eventosReproductivos).values(eventosReproductivos);


    // 11. Rendimiento Quesero de la Finca (Últimas 5 semanas consecutivas)
    console.log('插入 Historial de Rendimiento Quesero Semanal...');
    await db.insert(schema.rendimientosQueso).values([
      { id: generateId(), fincaId, fechaInicio: '2026-04-13', fechaFin: '2026-04-19', totalLitros: 1350.0, kgQueso: 241.0, litrosPorKg: 5.6, notas: 'Semana 15. Óptimo punto de sal.' },
      { id: generateId(), fincaId, fechaInicio: '2026-04-20', fechaFin: '2026-04-26', totalLitros: 1410.0, kgQueso: 256.3, litrosPorKg: 5.5, notas: 'Semana 16. Mayor proporción sólidos totales.' },
      { id: generateId(), fincaId, fechaInicio: '2026-04-27', fechaFin: '2026-05-03', totalLitros: 1480.0, kgQueso: 274.0, litrosPorKg: 5.4, notas: 'Semana 17. Despacho directo a distribuidores.' },
      { id: generateId(), fincaId, fechaInicio: '2026-05-04', fechaFin: '2026-05-10', totalLitros: 1520.0, kgQueso: 281.4, litrosPorKg: 5.4, notas: 'Semana 18. Inicio de lluvias, mejora pasto.' },
      { id: generateId(), fincaId, fechaInicio: '2026-05-11', fechaFin: '2026-05-17', totalLitros: 1590.0, kgQueso: 289.0, litrosPorKg: 5.5, notas: 'Semana 19. Registro de picos de lactancia.' },
    ]);

    console.log('🎉 ¡Super-Seeding completado con éxito absoluto! Base de datos lista para pruebas extremas.');
  } catch (error) {
    console.error('❌ Error fatal inyectando el seed masivo a la base de datos:', error);
    throw error;
  }
}