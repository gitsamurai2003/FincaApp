import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ClipboardList, Database, Home, LayoutGrid, PlusCircle, Scale, TrendingUp, Trophy, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { seedDatabase } from '../../db/seed';

// Conexión a la BD, Operadores y Esquemas
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { animales, fincas, produccionLeche, rendimientosQueso } from '../../db/schema';
import { fechaLocalISO } from '../../utils/fecha';

interface AnimalRanking {
  codigo: string;
  nombre: string | null;
  valor: number;
}

export default function HomeScreen() {
  const router = useRouter();
  
  // Estados de control y básicos
  const [cargando, setCargando] = useState(true);
  const [inyectando, setInyectando] = useState(false); 
  const [fincaActiva, setFincaActiva] = useState<{ id: string; nombre: string } | null>(null);
  const [totalAnimales, setTotalAnimales] = useState(0);
  const [litrosHoy, setLitrosHoy] = useState(0);

  // MÉTRICAS Y GRÁFICOS ANTERIORES
  const [litrosPorKgQueso, setLitrosPorKgQueso] = useState<number>(0);
  const [historicoLeche, setHistoricoLeche] = useState<number[]>([]); 
  const [distribucionCategorias, setDistribucionCategorias] = useState<{ categoria: string; cantidad: number }[]>([]);
  
  // ESTADOS DE RANKING (TOP 3)
  const [topLecheros, setTopLecheros] = useState<AnimalRanking[]>([]);
  const [topPesados, setTopPesados] = useState<AnimalRanking[]>([]);

  const consultarDatosDeFinca = useCallback(async () => {
    try {
      setCargando(true);
      const hoy = fechaLocalISO();

      const listaFincas = await db.select().from(fincas).where(eq(fincas.activa, 1)).limit(1);
      
      if (listaFincas.length > 0) {
        const finca = listaFincas[0];
        setFincaActiva({ id: finca.id, nombre: finca.nombre });

        // 1. Conteo global de animales activos
        const conteoAnimales = await db
          .select({ count: sql<number>`count(*)` })
          .from(animales)
          .where(and(eq(animales.fincaId, finca.id), eq(animales.estado, 'Activo')));
        const total = conteoAnimales[0]?.count || 0;
        setTotalAnimales(total);

        // 2. Producción del día
        const { totalLeche } = (await db
          .select({ totalLeche: sql<number>`sum(litros)` })
          .from(produccionLeche)
          .where(sql`fecha = ${hoy} AND animal_id IN (SELECT id FROM animales WHERE finca_id = ${finca.id})`))[0] || { totalLeche: 0 };
        setLitrosHoy(totalLeche || 0);

        // 3. KPI Quesero
        const ultimoRendimiento = await db
          .select({ litrosPorKg: rendimientosQueso.litrosPorKg })
          .from(rendimientosQueso)
          .where(eq(rendimientosQueso.fincaId, finca.id))
          .orderBy(sql`${rendimientosQueso.creadoEn} DESC`)
          .limit(1);
        setLitrosPorKgQueso(ultimoRendimiento[0]?.litrosPorKg || 0);

        // 4. Histórico semanal de producción
        const diasProduccion = await db
          .select({
            fecha: produccionLeche.fecha,
            total: sql<number>`sum(${produccionLeche.litros})`
          })
          .from(produccionLeche)
          .where(sql`animal_id IN (SELECT id FROM animales WHERE finca_id = ${finca.id})`)
          .groupBy(produccionLeche.fecha)
          .orderBy(sql`${produccionLeche.fecha} DESC`)
          .limit(5);
        
        const valoresLeche = diasProduccion.map(d => d.total).reverse();
        setHistoricoLeche(valoresLeche.length > 0 ? valoresLeche : [0, 0, 0, 0, 0]);

        // 5. Distribución Zootécnica de grupos
        const conteoPorCategoria = await db
          .select({
            categoria: animales.categoria,
            cantidad: sql<number>`count(*)`
          })
          .from(animales)
          .where(and(eq(animales.fincaId, finca.id), eq(animales.estado, 'Activo')))
          .groupBy(animales.categoria)
          .orderBy(sql`count(*) DESC`)
          .limit(3);
        setDistribucionCategorias(conteoPorCategoria);

        // 6. CORREGIDO: TOP 3 ANIMALES MÁS LECHEROS HOY (Evitando fallos de mapeo de Drizzle en Joins)
        const rankingLeche = await db
          .select({
            codigo: animales.areteCodigo,
            nombre: animales.nombre,
            valor: sql<number>`sum(${produccionLeche.litros})`.as('total_litros')
          })
          .from(produccionLeche)
          .innerJoin(animales, eq(produccionLeche.animalId, animales.id))
          .where(sql`produccion_leche.fecha = ${hoy} AND animales.finca_id = ${finca.id}`)
          .groupBy(animales.id, animales.areteCodigo, animales.nombre)
          .orderBy(sql`total_litros DESC`)
          .limit(3);

        // Mapeamos explícitamente para asegurar la interfaz limpia
        setTopLecheros(rankingLeche.map(r => ({
          codigo: r.codigo || '',
          nombre: r.nombre,
          valor: Number(r.valor)
        })));

        // 7. CORREGIDO: TOP 3 ANIMALES MÁS PESADOS (Selección explícita sin campos ambiguos)
        const rankingPeso = await db
          .select({
            codigo: animales.areteCodigo,
            nombre: animales.nombre,
            valor: animales.pesoInicial
          })
          .from(animales)
          .where(and(eq(animales.fincaId, finca.id), eq(animales.estado, 'Activo')))
          .orderBy(sql`${animales.pesoInicial} DESC`)
          .limit(3);
        
        setTopPesados(rankingPeso.map(p => ({
          codigo: p.codigo || '',
          nombre: p.nombre,
          valor: Number(p.valor || 0)
        })));

      } else {
        setFincaActiva(null);
        setTotalAnimales(0);
        setLitrosHoy(0);
        setLitrosPorKgQueso(0);
        setHistoricoLeche([0, 0, 0, 0, 0]);
        setDistribucionCategorias([]);
        setTopLecheros([]);
        setTopPesados([]);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudieron sincronizar las métricas de rendimiento.");
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      consultarDatosDeFinca();
    }, [consultarDatosDeFinca])
  );

  const manejarSeleccionFinca = async () => {
    try {
      const todosLosPredios = await db.select().from(fincas);
      if (todosLosPredios.length === 0) {
        router.push('/crear-finca');
        return;
      }
      const opciones = todosLosPredios.map((predio) => ({
        text: predio.id === fincaActiva?.id ? `Seleccionado: ${predio.nombre}` : predio.nombre,
        onPress: async () => {
          try {
            setCargando(true);
            await db.update(fincas).set({ activa: 0 });
            await db.update(fincas).set({ activa: 1 }).where(eq(fincas.id, predio.id));
            await consultarDatosDeFinca();
          } catch (e) {
            Alert.alert("Error", "No se pudo cambiar de predio.");
          }
        }
      }));
      if (fincaActiva) {
        opciones.unshift({ text: `Editar: ${fincaActiva.nombre}`, onPress: async () => router.push('/editar-finca') });
      }
      opciones.push({ text: "+ Registrar Nueva Finca", onPress: async () => { await router.push('/crear-finca'); } });
      opciones.push({ text: "Cancelar", onPress: () => {} } as any);

      Alert.alert("Cambiar de Predio", "Selecciona la unidad de producción:", opciones, { cancelable: true });
    } catch (error) {
      console.error(error);
    }
  };

  const navegarModulo = (ruta: string) => {
    if (!fincaActiva) {
      Alert.alert("Finca Requerida", "Primero debes seleccionar una Finca.");
      return;
    }
    router.push({ pathname: ruta as any, params: { origen: 'index' } }); 
  };

  const ejecutarSeed = async () => {
    try {
      setInyectando(true);
      await seedDatabase();
      await consultarDatosDeFinca();
      Alert.alert("¡Éxito!", "Datos de prueba inyectados.");
    } catch (error) {
      Alert.alert("Error de Seeding", "Revisa la consola.");
    } finally {
      setInyectando(false);
    }
  };

  const limpiarCategoriaTag = (tag: string) => tag.replace('_', ' ');
  
  const obtenerMedalla = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    return '🥉';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* HEADER DE BIENVENIDA */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.iconBgTranslucido}>
            <Home color="#ffffff" size={24} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.headerSubtitle}>Panel de Control</Text>
            <Text style={styles.headerTitle}>{fincaActiva ? fincaActiva.nombre : 'Finca Pro'}</Text>
          </View>
        </View>
        <View style={styles.badgeContainer}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>{fincaActiva ? 'Proyecto Activo Seleccionado' : 'Sin Finca Seleccionada'}</Text>
        </View>
      </View>

      <View style={styles.menuContent}>
        
        {/* SELECTOR DE FINCA */}
        <TouchableOpacity activeOpacity={0.8} style={styles.mainButton} onPress={manejarSeleccionFinca}>
          <View style={styles.iconContainerMain}>
            <PlusCircle color="#065f46" size={28} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mainButtonTitle}>{fincaActiva ? 'Cambiar de Finca' : 'Crear tu primera Finca'}</Text>
            <Text style={styles.mainButtonSubtitle}>Toca para alternar entre tus proyectos agropecuarios</Text>
          </View>
        </TouchableOpacity>

                {/* REJILLA DE MENÚS PRINCIPALES */}
        <Text style={styles.sectionTitle}>Gestión de Datos</Text>

        {cargando ? (
          <View style={{ padding: 20 }}><ActivityIndicator size="small" color="#065f46" /></View>
        ) : (
          <View style={styles.gridContainer}>
            <TouchableOpacity style={styles.gridButton} onPress={() => navegarModulo('/inventario')}>
              <LayoutGrid color="#1e293b" size={24} />
              <Text style={styles.gridButtonTitle}>Inventario</Text>
              <Text style={styles.gridButtonSubtitle}>{fincaActiva ? `${totalAnimales} Animales activos` : 'Ver catálogo'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.gridButton} onPress={() => navegarModulo('/produccion')}>
              <ClipboardList color="#1e293b" size={24} />
              <Text style={styles.gridButtonTitle}>Producción</Text>
              <Text style={styles.gridButtonSubtitle}>{fincaActiva ? `${litrosHoy} Lts hoy` : 'Leche y Pesajes'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.fullWidthButton} onPress={() => router.push('/respaldo')}>
              <View style={styles.rowCentered}>
                <Database color="#64748b" size={20} />
                <Text style={styles.fullWidthButtonTitle}>Copia de Seguridad</Text>
              </View>
              <View style={styles.badgeSqlite}><Text style={styles.badgeSqliteText}>IMPORTANTE</Text></View>
            </TouchableOpacity>

            {__DEV__ && (
              <TouchableOpacity style={[styles.fullWidthButton, styles.seedButton]} onPress={ejecutarSeed} disabled={inyectando}>
                <View style={styles.rowCentered}>
                  {inyectando ? <ActivityIndicator size="small" color="#b45309" style={{ marginRight: 12 }} /> : <Database color="#b45309" size={20} />}
                  <Text style={[styles.fullWidthButtonTitle, styles.seedButtonTitle]}>{inyectando ? 'Inyectando...' : 'Poblar Base de Datos (Seed)'}</Text>
                </View>
                <View style={styles.badgeSeed}><Text style={styles.badgeSeedText}>DEV_DATA</Text></View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ---------------- SECCIÓN DE ANALÍTICAS GRÁFICAS ---------------- */}
        {fincaActiva && !cargando && (
          <View>
            <Text style={styles.sectionTitle}>Análisis del Negocio</Text>
            
            {/* TARJETA 1: RENDIMIENTO QUESERO E HISTÓRICO DE LECHE */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeaderRow}>
                <View style={styles.rowCentered}>
                  <View style={[styles.miniIconBg, { backgroundColor: '#eff6ff' }]}>
                    <TrendingUp color="#3b82f6" size={18} />
                  </View>
                  <Text style={styles.chartCardTitle}>Producción e Historial</Text>
                </View>
                <View style={styles.kpiBadge}>
                  <Text style={styles.kpiBadgeValue}>{litrosPorKgQueso > 0 ? `${litrosPorKgQueso.toFixed(1)} L/Kg` : 'N/A'}</Text>
                  <Text style={styles.kpiBadgeLabel}>Rend. Queso</Text>
                </View>
              </View>
              <Text style={styles.chartLabelDescription}>Tendencia de producción total de leche (Últimos días activos):</Text>
              <View style={styles.sparklineCanvas}>
                {historicoLeche.map((litros, index) => {
                  const maxLitros = Math.max(...historicoLeche, 1);
                  const alturaPorcentual = Math.max((litros / maxLitros) * 100, 15); 
                  return (
                    <View key={index} style={styles.sparklineCol}>
                      <View style={[styles.sparklineBar, { height: `${alturaPorcentual}%` }]}>
                        <Text style={styles.sparklineBarValue}>{Math.round(litros)}L</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* TARJETA 2: DISTRIBUCIÓN DE CATEGORÍAS */}
            <View style={styles.chartCard}>
              <View style={styles.rowCentered}>
                <View style={[styles.miniIconBg, { backgroundColor: '#f0fdf4' }]}>
                  <Users color="#22c55e" size={18} />
                </View>
                <Text style={styles.chartCardTitle}>Grupos Críticos en Inventario</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                {distribucionCategorias.length === 0 ? (
                  <Text style={styles.gridButtonSubtitle}>No hay suficientes animales registrados.</Text>
                ) : (
                  distribucionCategorias.map((item, idx) => {
                    const porcentaje = totalAnimales > 0 ? (item.cantidad / totalAnimales) * 100 : 0;
                    return (
                      <View key={idx} style={{ marginBottom: 10 }}>
                        <View style={styles.progressTextRow}>
                          <Text style={styles.progressLabel}>{limpiarCategoriaTag(item.categoria)}</Text>
                          <Text style={styles.progressValue}>{item.cantidad} cab. ({Math.round(porcentaje)}%)</Text>
                        </View>
                        <View style={styles.progressBarBackground}>
                          <View style={[styles.progressBarFill, { width: `${porcentaje}%`, backgroundColor: '#22c55e' }]} />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* 🏆 TARJETA 3: TOP 3 MÁS LECHEROS HOY */}
            <View style={styles.chartCard}>
              <View style={styles.rowCentered}>
                <View style={[styles.miniIconBg, { backgroundColor: '#fef3c7' }]}>
                  <Trophy color="#d97706" size={18} />
                </View>
                <Text style={styles.chartCardTitle}>Top 3 Producción (Litros Hoy)</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                {topLecheros.length === 0 ? (
                  <Text style={styles.emptyRankingText}>No hay pesajes de leche registrados hoy.</Text>
                ) : (
                  topLecheros.map((animal, idx) => (
                    <View key={idx} style={styles.rankingRow}>
                      <View style={styles.rowCentered}>
                        <Text style={styles.medalText}>{obtenerMedalla(idx)}</Text>
                        <View style={{ marginLeft: 8 }}>
                          <Text style={styles.animalCodeText}>#{animal.codigo}</Text>
                          {animal.nombre && <Text style={styles.animalNameText}>{animal.nombre}</Text>}
                        </View>
                      </View>
                      <View style={styles.valueBadgeLeche}>
                        <Text style={styles.valueBadgeText}>{animal.valor.toFixed(1)} Lts</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* ⚖️ TARJETA 4: TOP 3 MÁS PESADOS */}
            <View style={styles.chartCard}>
              <View style={styles.rowCentered}>
                <View style={[styles.miniIconBg, { backgroundColor: '#f3e8ff' }]}>
                  <Scale color="#a855f7" size={18} />
                </View>
                <Text style={styles.chartCardTitle}>Top 3 Mayor Peso Corporal</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                {topPesados.length === 0 ? (
                  <Text style={styles.emptyRankingText}>No hay animales registrados con peso.</Text>
                ) : (
                  topPesados.map((animal, idx) => (
                    <View key={idx} style={styles.rankingRow}>
                      <View style={styles.rowCentered}>
                        <Text style={styles.medalText}>{obtenerMedalla(idx)}</Text>
                        <View style={{ marginLeft: 8 }}>
                          <Text style={styles.animalCodeText}>#{animal.codigo}</Text>
                          {animal.nombre && <Text style={styles.animalNameText}>{animal.nombre}</Text>}
                        </View>
                      </View>
                      <View style={styles.valueBadgePeso}>
                        <Text style={styles.valueBadgeText}>{animal.valor} Kg</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

          </View>
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#065f46',
    paddingTop: 60, paddingBottom: 32, paddingHorizontal: 24,
    borderBottomLeftRadius: 40, borderBottomRightRadius: 40, elevation: 5,
  },
  iconBgTranslucido: {
    padding: 10, borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerSubtitle: { color: '#a7f3d0', fontWeight: '700', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5 },
  headerTitle: { color: '#ffffff', fontSize: 26, fontWeight: '900', marginTop: 2 },
  badgeContainer: {
    flexDirection: 'row', alignItems: 'center', marginTop: 20, 
    backgroundColor: 'rgba(2, 45, 34, 0.5)', alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1, borderColor: '#047857',
  },
  badgeDot: { width: 8, height: 8, backgroundColor: '#34d399', borderRadius: 4, marginRight: 8 },
  badgeText: { color: '#d1fae5', fontSize: 12, fontWeight: '500' },
  menuContent: { paddingHorizontal: 24, marginTop: -24 },
  mainButton: {
    backgroundColor: '#ffffff', padding: 24, borderRadius: 24,
    borderWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
    marginBottom: 8,
  },
  iconContainerMain: { backgroundColor: '#d1fae5', padding: 12, borderRadius: 16, marginRight: 16 },
  mainButtonTitle: { color: '#1e293b', fontWeight: '700', fontSize: 18 },
  mainButtonSubtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  sectionTitle: { color: '#94a3b8', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 24, marginBottom: 12, marginLeft: 8 },
  
  // TARJETAS DE GRÁFICOS REDONDEADOS
  chartCard: {
    backgroundColor: '#ffffff', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
  },
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartCardTitle: { color: '#1e293b', fontWeight: '700', fontSize: 15, marginLeft: 10 },
  miniIconBg: { padding: 8, borderRadius: 10 },
  chartLabelDescription: { color: '#64748b', fontSize: 12, marginBottom: 14, marginTop: 4 },
  kpiBadge: { alignItems: 'flex-end', backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  kpiBadgeValue: { color: '#0f172a', fontWeight: '800', fontSize: 14 },
  kpiBadgeLabel: { color: '#94a3b8', fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
  
  // SPARKLINE CANVAS
  sparklineCanvas: { flexDirection: 'row', height: 70, alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 6 },
  sparklineCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  sparklineBar: { backgroundColor: '#3b82f6', width: '70%', borderRadius: 6, justifyContent: 'flex-start', paddingTop: 4, alignItems: 'center' },
  sparklineBarValue: { color: '#ffffff', fontSize: 9, fontWeight: '700' },
  
  // BARRAS DE PROGRESO
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { color: '#475569', fontSize: 13, fontWeight: '500' },
  progressValue: { color: '#1e293b', fontSize: 12, fontWeight: '700' },
  progressBarBackground: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginBottom: 4 },
  progressBarFill: { height: '100%', borderRadius: 999 },

  // ESTILOS DE LOS COMPONENTES DE RANKING (TOP 3)
  rankingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
  },
  medalText: { fontSize: 22 },
  animalCodeText: { color: '#1e293b', fontWeight: '700', fontSize: 14 },
  animalNameText: { color: '#64748b', fontSize: 11, marginTop: 1 },
  emptyRankingText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  valueBadgeLeche: { backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a' },
  valueBadgePeso: { backgroundColor: '#f3e8ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#e9d5ff' },
  valueBadgeText: { color: '#1e293b', fontWeight: '700', fontSize: 12 },

  // REJILLA TRADICIONAL
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridButton: {
    backgroundColor: '#ffffff', width: '48%', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  gridButtonTitle: { color: '#1e293b', fontWeight: '700', fontSize: 14, marginTop: 12 },
  gridButtonSubtitle: { color: '#94a3b8', fontSize: 10, marginTop: 4 },
  fullWidthButton: {
    backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#f1f5f9',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2, marginBottom: 16,
  },
  rowCentered: { flexDirection: 'row', alignItems: 'center' },
  fullWidthButtonTitle: { color: '#475569', fontWeight: '700', fontSize: 14, marginLeft: 12 },
  badgeSqlite: { backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeSqliteText: { color: '#059669', fontWeight: '700', fontSize: 10 },
  seedButton: { borderColor: '#fef3c7', backgroundColor: '#fffdf5', marginTop: 4 },
  seedButtonTitle: { color: '#92400e' },
  badgeSeed: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeSeedText: { color: '#d97706', fontWeight: '700', fontSize: 10 }
});