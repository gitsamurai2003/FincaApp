import { db } from './client';
import * as schema from './schema';

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

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
  try {
    const dbEspecies = await db.select().from(schema.especies);
    const idBovino = dbEspecies.find(e => e.nombre.toLowerCase() === 'bovino')?.id;
    const idBufalino = dbEspecies.find(e => e.nombre.toLowerCase() === 'bufalino')?.id;
    const idOvino = dbEspecies.find(e => e.nombre.toLowerCase() === 'ovino')?.id;
    const idEquino = dbEspecies.find(e => e.nombre.toLowerCase() === 'equino')?.id;
    const idCaprino = dbEspecies.find(e => e.nombre.toLowerCase() === 'caprino')?.id;

    const dbRazas = await db.select().from(schema.razas);
    const idMurrah = dbRazas.find(r => r.nombre.toLowerCase() === 'murrah')?.id;
    const idMediterraneo = dbRazas.find(r => r.nombre.toLowerCase() === 'mediterráneo' || r.nombre.toLowerCase() === 'mediterraneo')?.id;
    const idJafarabadi = dbRazas.find(r => r.nombre.toLowerCase() === 'jafarabadi')?.id;
    const idCarora = dbRazas.find(r => r.nombre.toLowerCase() === 'carora')?.id;
    const idBrahman = dbRazas.find(r => r.nombre.toLowerCase() === 'brahman')?.id;
    const idMestizo = dbRazas.find(r => r.nombre.toLowerCase() === 'mestizo')?.id;
    const idCuartoMilla = dbRazas.find(r => r.nombre.toLowerCase() === 'cuarto de milla' || r.nombre.toLowerCase() === 'cuarto milla')?.id;

    if (!idBovino || !idBufalino || !idMurrah || !idMediterraneo || !idCarora) {
      throw new Error('Base catalogs not fully loaded.');
    }

    await db.delete(schema.historialMedico);
    await db.delete(schema.produccionLeche);
    await db.delete(schema.pesajes);
    await db.delete(schema.eventosReproductivos);
    await db.delete(schema.animales);
    await db.delete(schema.lotes);
    await db.delete(schema.rendimientosQueso);
    await db.delete(schema.fincas);

    const fincaActivaId = generateId();
    const fincaInactivaId = generateId();

    await db.insert(schema.fincas).values([
      { id: fincaActivaId, nombre: 'Hacienda El Búfalo Alegre', ubicacion: 'Machiques', activa: 1, creadoEn: Math.floor(Date.now() / 1000) },
      { id: fincaInactivaId, nombre: 'Fundo La Esperanza', ubicacion: 'Sur del Lago', activa: 0, creadoEn: Math.floor(Date.now() / 1000) }
    ]);

    const loteOrdeno1Id = generateId();
    const loteOrdeno2Id = generateId();
    const loteSecasId = generateId();
    const loteMauteraId = generateId();
    const loteBecerrosId = generateId();
    const loteEngordeId = generateId();
    const loteCaballerizaId = generateId();

    await db.insert(schema.lotes).values([
      { id: loteOrdeno1Id, fincaId: fincaActivaId, nombre: 'Ordeño Alta Producción', descripcion: 'Animales con picos superiores a 12L diarios' },
      { id: loteOrdeno2Id, fincaId: fincaActivaId, nombre: 'Ordeño Media / Baja', descripcion: 'Lactancias avanzadas o cola de ordeño' },
      { id: loteSecasId, fincaId: fincaActivaId, nombre: 'Escoteras / Secas', descripcion: 'Búfalas en descanso y próximas al parto' },
      { id: loteMauteraId, fincaId: fincaActivaId, nombre: 'Mautera y Novillas', descripcion: 'Hembras de reemplazo en desarrollo' },
      { id: loteBecerrosId, fincaId: fincaActivaId, nombre: 'Becerros / Bucerros', descripcion: 'Crías en etapa de lactancia' },
      { id: loteEngordeId, fincaId: fincaInactivaId, nombre: 'Potrero Engorde Ceba', descripcion: 'Levante de machos' },
      { id: loteCaballerizaId, fincaId: fincaActivaId, nombre: 'Caballeriza Principal', descripcion: 'Equinos de trabajo' }
    ]);

    const animalesData: any[] = [];
    const timestampAhora = Math.floor(Date.now() / 1000);

    const padreBufaloId = generateId();
    const madreBufalaId = generateId();
    const buvilloId = generateId();

    animalesData.push(
      { id: padreBufaloId, fincaId: fincaActivaId, especieId: idBufalino, razaId: idMurrah, loteId: loteSecasId, areteCodigo: 'PAD-001', nombre: 'Cacique', fechaNacimiento: '2019-01-15', sexo: 'M', pesoInicial: 750.0, categoria: 'Padrote', proposito: 'Genetica_Pura', estado: 'Activo', creadoEn: timestampAhora },
      { id: madreBufalaId, fincaId: fincaActivaId, especieId: idBufalino, razaId: idMurrah, loteId: loteOrdeno1Id, areteCodigo: 'BM-101', nombre: 'Reina', fechaNacimiento: '2020-05-20', sexo: 'F', pesoInicial: 550.0, categoria: 'Búfala', proposito: 'Leche', estado: 'Activo', creadoEn: timestampAhora },
      { id: buvilloId, fincaId: fincaActivaId, especieId: idBufalino, razaId: idMurrah, loteId: loteBecerrosId, areteCodigo: 'BC-201', nombre: 'Principito', fechaNacimiento: '2025-11-10', sexo: 'M', pesoInicial: 45.0, categoria: 'Buvillo', proposito: 'Doble_Proposito', estado: 'Activo', madreId: madreBufalaId, padreId: padreBufaloId, creadoEn: timestampAhora }
    );

    const idOvinoFinal = idOvino || idBovino;
    const idEquinoFinal = idEquino || idBovino;
    const idCaprinoFinal = idCaprino || idBovino;
    const idBrahmanFinal = idBrahman || idCarora;
    const idMestizoFinal = idMestizo || idCarora;
    const idCuartoMillaFinal = idCuartoMilla || idCarora;
    const idJafarabadiFinal = idJafarabadi || idMurrah;

    animalesData.push(
      { id: generateId(), fincaId: fincaActivaId, especieId: idBovino, razaId: idCarora, loteId: null, areteCodigo: 'VAC-099', nombre: 'Vieja Carora', fechaNacimiento: '2015-02-10', sexo: 'F', pesoInicial: 420.0, categoria: 'Vaca', proposito: 'Leche', estado: 'Fallecido', notas: 'Muerte natural senil', creadoEn: timestampAhora },
      { id: generateId(), fincaId: fincaActivaId, especieId: idBovino, razaId: idBrahmanFinal, loteId: null, areteCodigo: 'NOV-088', nombre: 'Macho Bravo', fechaNacimiento: '2023-01-10', sexo: 'M', pesoInicial: 210.0, categoria: 'Novillo', proposito: 'Carne', estado: 'Vendido', notas: 'Comercializado localmente', creadoEn: timestampAhora },
      { id: generateId(), fincaId: fincaActivaId, especieId: idOvinoFinal, razaId: idMestizoFinal, loteId: null, areteCodigo: 'OV-001', nombre: 'Copito', fechaNacimiento: '2025-01-01', sexo: 'M', pesoInicial: 22.0, categoria: 'Cordero', proposito: 'Carne', estado: 'Consumo_Interno', notas: 'Consumo trabajadores', creadoEn: timestampAhora },
      { id: generateId(), fincaId: fincaActivaId, especieId: idEquinoFinal, razaId: idCuartoMillaFinal, loteId: loteCaballerizaId, areteCodigo: 'CAB-001', nombre: 'Relámpago', fechaNacimiento: '2018-08-15', sexo: 'M', pesoInicial: 460.0, categoria: 'Caballo', proposito: 'Trabajo', estado: 'Activo', creadoEn: timestampAhora },
      { id: generateId(), fincaId: fincaActivaId, especieId: idCaprinoFinal, razaId: idMestizoFinal, loteId: null, areteCodigo: 'CAP-001', nombre: 'Cabra Uno', fechaNacimiento: '2024-03-05', sexo: 'F', pesoInicial: 35.0, categoria: 'Cabra', proposito: 'Doble_Proposito', estado: 'Activo', creadoEn: timestampAhora }
    );

    for (let i = 1; i <= 10; i++) {
      animalesData.push({
        id: generateId(), fincaId: fincaActivaId, especieId: idBufalino, razaId: idMediterraneo, loteId: loteOrdeno1Id, areteCodigo: `BZ-1${String(i).padStart(2, '0')}`, nombre: `Mariposa ${i}`, fechaNacimiento: `2021-03-${String(i + 5).padStart(2, '0')}`, sexo: 'F', pesoInicial: 430.0 + (i * 3), categoria: 'Búfala', proposito: 'Leche', estado: 'Activo', creadoEn: timestampAhora
      });
    }

    for (let i = 1; i <= 5; i++) {
      animalesData.push({
        id: generateId(), fincaId: fincaActivaId, especieId: idBufalino, razaId: idJafarabadiFinal, loteId: loteOrdeno2Id, areteCodigo: `BJ-2${String(i).padStart(2, '0')}`, nombre: `Jafara ${i}`, fechaNacimiento: `2022-04-${String(i + 2).padStart(2, '0')}`, sexo: 'F', pesoInicial: 450.0 + (i * 2), categoria: 'Búfala', proposito: 'Doble_Proposito', estado: 'Activo', creadoEn: timestampAhora
      });
    }

    for (let i = 1; i <= 5; i++) {
      animalesData.push({
        id: generateId(), fincaId: fincaInactivaId, especieId: idBovino, razaId: idBrahmanFinal, loteId: loteEngordeId, areteCodigo: `BR-3${String(i).padStart(2, '0')}`, nombre: `Toro Ceba ${i}`, fechaNacimiento: `2023-05-${String(i + 1).padStart(2, '0')}`, sexo: 'M', pesoInicial: 280.0 + (i * 10), categoria: 'Toro', proposito: 'Carne', estado: 'Activo', creadoEn: timestampAhora
      });
    }

    await db.insert(schema.animales).values(animalesData);

    const pesajesData: any[] = [];
    pesajesData.push(
      { id: generateId(), animalId: buvilloId, peso: 45.0, fechaPesaje: '2025-11-10', condicionCorporal: 3, notes: 'Peso al nacer' },
      { id: generateId(), animalId: buvilloId, peso: 78.5, fechaPesaje: '2026-01-15', condicionCorporal: 4, notes: 'Control bimensual' },
      { id: generateId(), animalId: buvilloId, peso: 112.0, fechaPesaje: '2026-03-20', condicionCorporal: 4, notes: 'Control desarrollo' },
      { id: generateId(), animalId: buvilloId, peso: 145.2, fechaPesaje: '2026-05-22', condicionCorporal: 4, notes: 'Pesaje previo a destete' }
    );
    await db.insert(schema.pesajes).values(pesajesData);

    const produccionData: any[] = [];
    const ultimosDias = generarFechasHistorial(5);
    ultimosDias.forEach(fecha => {
      produccionData.push(
        { id: generateId(), animalId: madreBufalaId, fecha, litros: parseFloat((6.2 + Math.random()).toFixed(1)), turno: 'M', notas: 'Normal' },
        { id: generateId(), animalId: madreBufalaId, fecha, litros: parseFloat((4.1 + Math.random()).toFixed(1)), turno: 'T', notas: 'Normal' },
        { id: generateId(), animalId: madreBufalaId, fecha, litros: parseFloat((1.8 + Math.random() * 0.5).toFixed(1)), turno: 'N', notas: 'Apoyo bucerro' }
      );
    });
    await db.insert(schema.produccionLeche).values(produccionData);

    const registrosMedicos: any[] = [];
    registrosMedicos.push(
      { id: generateId(), animalId: padreBufaloId, tipoManejo: 'Vacunacion_Obligatoria', diagnostico: null, medicamento: 'Aftovax', dosis: '2ml SC', fechaAplicacion: '2026-05-01', diasRetiroLeche: 0, diasRetiroCarne: 21, notas: 'Ciclo nacional' },
      { id: generateId(), animalId: madreBufalaId, tipoManejo: 'Tratamiento_Enfermedad', diagnostico: 'Mastitis subclínica', medicamento: 'Mastilac M', dosis: '1 jeringa intramamaria', fechaAplicacion: '2026-05-18', diasRetiroLeche: 4, diasRetiroCarne: 15, notas: 'Separar leche de tanque' },
      { id: generateId(), animalId: madreBufalaId, tipoManejo: 'Desparasitacion', diagnostico: 'Rutina', medicamento: 'Ivermectina 1%', dosis: '1ml x 50kg SC', fechaAplicacion: '2026-04-15', diasRetiroLeche: 28, diasRetiroCarne: 35, notas: 'Fin de temporada lluviosa' },
      { id: generateId(), animalId: buvilloId, tipoManejo: 'Vitamina', diagnostico: null, medicamento: 'Catosal B12', dosis: '5ml IM', fechaAplicacion: '2026-05-10', diasRetiroLeche: 0, diasRetiroCarne: 0, notas: 'Estímulo de crecimiento' }
    );
    await db.insert(schema.historialMedico).values(registrosMedicos);

    const eventosReproductivos: any[] = [];
    eventosReproductivos.push(
      { id: generateId(), animalId: madreBufalaId, tipoEvento: 'Celo_Detectado', fechaEvento: '2024-11-30', resultadoPalpacion: null, toroOPajuela: null, fechaProbableParto: null, detallesParto: null, notas: 'Celo estral claro' },
      { id: generateId(), animalId: madreBufalaId, tipoEvento: 'Monta_Natural', fechaEvento: '2024-12-01', resultadoPalpacion: null, toroOPajuela: 'Cacique (PAD-001)', fechaProbableParto: null, detallesParto: null, notas: 'Servicio directo potrero' },
      { id: generateId(), animalId: madreBufalaId, tipoEvento: 'Palpacion_Diagnostico', fechaEvento: '2025-02-05', resultadoPalpacion: 'Preñada', toroOPajuela: null, fechaProbableParto: '2025-11-12', detallesParto: null, notas: 'Confirmación preñez positiva' },
      { id: generateId(), animalId: madreBufalaId, tipoEvento: 'Parto', fechaEvento: '2025-11-10', resultadoPalpacion: null, toroOPajuela: null, fechaProbableParto: null, detallesParto: 'Normal', notas: 'Bucerro macho sano vivo' },
      { id: generateId(), animalId: madreBufalaId, tipoEvento: 'Inseminacion_Artificial', fechaEvento: '2026-03-20', resultadoPalpacion: null, toroOPajuela: 'Semen Criogénico Italiano - MI09', fechaProbableParto: null, detallesParto: null, notas: 'Protocolo IATF' },
      { id: generateId(), animalId: madreBufalaId, tipoEvento: 'Palpacion_Diagnostico', fechaEvento: '2026-05-15', resultadoPalpacion: 'Vacia', toroOPajuela: null, fechaProbableParto: null, detallesParto: null, notas: 'Repetir protocolo próximamente' },
      { id: generateId(), animalId: padreBufaloId, tipoEvento: 'Palpacion_Diagnostico', fechaEvento: '2025-08-10', resultadoPalpacion: 'Dudosa', toroOPajuela: null, fechaProbableParto: null, detallesParto: null, notas: 'Evaluación andrológica rutinaria' }
    );
    await db.insert(schema.eventosReproductivos).values(eventosReproductivos);

    await db.insert(schema.rendimientosQueso).values([
      { id: generateId(), fincaId: fincaActivaId, fechaInicio: '2026-05-01', fechaFin: '2026-05-07', totalLitros: 1200.0, kgQueso: 222.2, litrosPorKg: 5.4, notas: 'Semana de alta densidad de sólidos', creadoEn: timestampAhora },
      { id: generateId(), fincaId: fincaActivaId, fechaInicio: '2026-05-08', fechaFin: '2026-05-14', totalLitros: 1350.0, kgQueso: 245.5, litrosPorKg: 5.5, notas: 'Variación por lluvias leves', creadoEn: timestampAhora }
    ]);

  } catch (error) {
    throw error;
  }
}