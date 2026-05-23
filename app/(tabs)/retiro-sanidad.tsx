// app/(tabs)/retiro-sanidad.tsx
import { eq } from 'drizzle-orm';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, Beef, Milk, RefreshCw } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { animales, historialMedico } from '../../db/schema';
import { fechaLocalISO, sumarDiasLocal } from '../../utils/fecha';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type RetiroRow = {
  areteCodigo: string;
  nombre: string | null;
  medicamento: string;
  fechaAplicacion: string;
  finRetiroLeche: string | null;
  finRetiroCarne: string | null;
  tipo: 'leche' | 'carne' | 'ambos';
};

type FiltroTipo = 'TODOS' | 'LECHE' | 'CARNE';

// ── Componente ─────────────────────────────────────────────────────────────────
export default function RetiroSanidadScreen() {
  const router = useRouter();
  const [lista, setLista] = useState<RetiroRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<FiltroTipo>('TODOS');
  const hoy = fechaLocalISO();

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const finca = await obtenerFincaActiva();
      if (!finca) {
        setLista([]);
        return;
      }

      const registros = await db
        .select({
          areteCodigo: animales.areteCodigo,
          nombre: animales.nombre,
          medicamento: historialMedico.medicamento,
          fechaAplicacion: historialMedico.fechaAplicacion,
          diasLeche: historialMedico.diasRetiroLeche,
          diasCarne: historialMedico.diasRetiroCarne,
        })
        .from(historialMedico)
        .innerJoin(animales, eq(historialMedico.animalId, animales.id))
        .where(eq(animales.fincaId, finca.id));

      const activos: RetiroRow[] = [];
      
      for (const r of registros) {
        const finLeche = r.diasLeche > 0 ? sumarDiasLocal(r.fechaAplicacion, r.diasLeche) : null;
        const finCarne = r.diasCarne > 0 ? sumarDiasLocal(r.fechaAplicacion, r.diasCarne) : null;
        
        const enLeche = finLeche !== null && finLeche >= hoy;
        const enCarne = finCarne !== null && finCarne >= hoy;
        
        if (!enLeche && !enCarne) continue;

        activos.push({
          areteCodigo: r.areteCodigo,
          nombre: r.nombre,
          medicamento: r.medicamento,
          fechaAplicacion: r.fechaAplicacion,
          finRetiroLeche: enLeche ? finLeche : null,
          finRetiroCarne: enCarne ? finCarne : null,
          tipo: enLeche && enCarne ? 'ambos' : enLeche ? 'leche' : 'carne',
        });
      }

      // Ordenar: Los que vencen más tarde primero (Prioridad crítica)
      activos.sort((a, b) => {
        const fa = a.finRetiroLeche || a.finRetiroCarne || '';
        const fb = b.finRetiroLeche || b.finRetiroCarne || '';
        return fb.localeCompare(fa);
      });

      setLista(activos);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, [hoy]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  // Filtrado reactivo en memoria para evitar llamadas extras a la DB
  const listaFiltrada = lista.filter((item) => {
    if (filtro === 'LECHE') return item.tipo === 'leche' || item.tipo === 'ambos';
    if (filtro === 'CARNE') return item.tipo === 'carne' || item.tipo === 'ambos';
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/registros')}>          
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Periodos de Retiro</Text>
        <TouchableOpacity onPress={cargar} style={styles.syncButton} disabled={cargando}>
          <RefreshCw color="#475569" size={18} />
        </TouchableOpacity>
      </View>

      {/* Banner Informativo */}
      <View style={styles.bannerContainer}>
        <AlertTriangle color="#b91c1c" size={18} />
        <Text style={styles.banner}>
          Producción restringida. No enviar leche al tanque ni animales a matadero hasta la fecha indicada.
        </Text>
      </View>

      {/* Segmented Control / Filtros */}
      <View style={styles.filterRow}>
        {(['TODOS', 'LECHE', 'CARNE'] as FiltroTipo[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filtro === f && styles.filterTabActive]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[styles.filterTabText, filtro === f && styles.filterTabTextActive]}>
              {f === 'TODOS' ? 'Todos' : f === 'LECHE' ? '🥛 Leche' : '🥩 Carne'}
            </Text>
            {f === 'TODOS' && lista.length > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{lista.length}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenido Principal */}
      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.loadingText}>Verificando historiales médicos...</Text>
        </View>
      ) : (
        <FlatList
          data={listaFiltrada}
          keyExtractor={(item, i) => `${item.areteCodigo}-${i}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>¡Todo despejado!</Text>
              <Text style={styles.emptySub}>No se encontraron animales bajo restricciones sanitarias activas.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const esAmbos = item.tipo === 'ambos';
            return (
              <View style={[styles.card, esAmbos && styles.cardCritica]}>
                
                {/* Cabecera del Card */}
                <View style={styles.cardHeader}>
                  <View style={styles.animalInfo}>
                    <Text style={styles.arete}>#{item.areteCodigo}</Text>
                    {item.nombre && <Text style={styles.animalNombre}>— {item.nombre}</Text>}
                  </View>
                  <View style={styles.iconIndicatorRow}>
                    {(item.tipo === 'leche' || esAmbos) && <Milk size={18} color="#2563eb" />}
                    {(item.tipo === 'carne' || esAmbos) && <Beef size={18} color="#b91c1c" />}
                  </View>
                </View>

                {/* Detalles Clínicos */}
                <View style={styles.detailsDivider} />
                <Text style={styles.medText}>{item.medicamento}</Text>
                <Text style={styles.fechaAplicacionText}>Aplicado el: {item.fechaAplicacion}</Text>

                {/* Tiempos Límites */}
                <View style={styles.fechasRetiroBox}>
                  {item.finRetiroLeche && (
                    <View style={styles.fechaRow}>
                      <Text style={styles.labelRetiro}>Vence Leche:</Text>
                      <Text style={styles.fechaValorLeche}>{item.finRetiroLeche}</Text>
                    </View>
                  )}
                  {item.finRetiroCarne && (
                    <View style={styles.fechaRow}>
                      <Text style={styles.labelRetiro}>Vence Carne:</Text>
                      <Text style={styles.fechaValorCarne}>{item.finRetiroCarne}</Text>
                    </View>
                  )}
                </View>

              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// ── Estilos Robustos ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  syncButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  bannerContainer: {
    margin: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  banner: {
    flex: 1,
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginVertical: 8,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterTabTextActive: { color: '#fff' },
  badge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 2,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 13, fontWeight: '500' },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCritica: {
    borderColor: '#fecaca',
    backgroundColor: '#fffafb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  animalInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arete: { fontSize: 16, fontWeight: '800', color: '#0f172a', letterSpacing: 0.5 },
  animalNombre: { fontSize: 14, color: '#475569', fontWeight: '500' },
  iconIndicatorRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  detailsDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },
  medText: { fontWeight: '700', color: '#334155', fontSize: 14 },
  fechaAplicacionText: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  fechasRetiroBox: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  fechaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelRetiro: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  fechaValorLeche: { fontSize: 13, color: '#2563eb', fontWeight: '700' },
  fechaValorCarne: { fontSize: 13, color: '#b91c1c', fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#475569', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
});