import { and, desc, eq, inArray } from 'drizzle-orm';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Plus, Search, ShieldAlert } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../db/client';
import { animales, fincas } from '../../db/schema';

type AnimalSelect = typeof animales.$inferSelect;
type FiltroEstado = 'Activos' | 'Vendidos' | 'Otros' | 'Todos';

const ESTADOS_OTROS = ['Fallecido', 'Consumo_Interno'] as const;

export default function InventarioScreen() {
  const router = useRouter();
  const [animalesLista, setAnimalesLista] = useState<AnimalSelect[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [fincaNombre, setFincaNombre] = useState('Cargando...');
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('Activos');

  useFocusEffect(
    useCallback(() => {
      async function cargarInventario() {
        try {
          setCargando(true);
          const actualFinca = await db.select().from(fincas).where(eq(fincas.activa, 1)).limit(1);

          if (actualFinca.length > 0) {
            setFincaNombre(actualFinca[0].nombre);
            const baseFinca = eq(animales.fincaId, actualFinca[0].id);
            const whereClause =
              filtroEstado === 'Activos'
                ? and(baseFinca, eq(animales.estado, 'Activo'))
                : filtroEstado === 'Vendidos'
                  ? and(baseFinca, eq(animales.estado, 'Vendido'))
                  : filtroEstado === 'Otros'
                    ? and(baseFinca, inArray(animales.estado, [...ESTADOS_OTROS]))
                    : baseFinca;

            const resultado = await db
              .select()
              .from(animales)
              .where(whereClause)
              .orderBy(desc(animales.creadoEn));
            setAnimalesLista(resultado);
          } else {
            setFincaNombre('Sin Finca Activa');
            setAnimalesLista([]);
          }
        } catch (error) {
          console.error('Error cargando inventario:', error);
        } finally {
          setCargando(false);
        }
      }
      cargarInventario();
    }, [filtroEstado])
  );

  const animalesFiltrados = animalesLista.filter(
    (a) =>
      a.areteCodigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (a.nombre?.toLowerCase() || '').includes(busqueda.toLowerCase()) ||
      a.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  const renderAnimalItem = ({ item }: { item: AnimalSelect }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/detalleAnimal', params: { id: item.id } })}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.areteBadge}>
          <Text style={styles.areteText}>#{item.areteCodigo}</Text>
        </View>
        <Text
          style={[
            styles.estadoTag,
            item.estado !== 'Activo' && styles.estadoTagMuted,
          ]}
        >
          {item.estado.replace('_', ' ')}
        </Text>
      </View>
      <Text style={styles.categoriaTag}>{item.categoria.replace('_', ' ')}</Text>
      <Text style={styles.animalNombre}>{item.nombre || 'Sin Nombre'}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.infoText}>
          Sexo: <Text style={styles.bold}>{item.sexo}</Text>
        </Text>
        <Text style={styles.infoText}>
          Propósito: <Text style={styles.bold}>{item.proposito.replace('_', ' ')}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );

  const filtros: FiltroEstado[] = ['Activos', 'Vendidos', 'Otros', 'Todos'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={24} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Inventario</Text>
          <Text style={styles.headerSubtitle}>
            {fincaNombre} · {filtroEstado.toLowerCase()}
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/crear-animal')}>
          <Plus color="#ffffff" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.filtroRow}>
        {filtros.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroChip, filtroEstado === f && styles.filtroChipActive]}
            onPress={() => setFiltroEstado(f)}
          >
            <Text style={[styles.filtroChipText, filtroEstado === f && styles.filtroChipTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchSection}>
        <Search size={20} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por arete o nombre..."
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#065f46" />
      ) : (
        <FlatList
          data={animalesFiltrados}
          keyExtractor={(item) => item.id}
          renderItem={renderAnimalItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <ShieldAlert color="#94a3b8" size={48} />
              <Text style={styles.emptyTitle}>No hay coincidencias</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#065f46', fontWeight: '600' },
  addButton: { padding: 10, borderRadius: 12, backgroundColor: '#065f46' },
  filtroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filtroChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filtroChipActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  filtroChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filtroChipTextActive: { color: '#fff' },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, padding: 12, fontSize: 15 },
  listContent: { padding: 16, paddingTop: 0 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 1,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  areteBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  areteText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  estadoTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  estadoTagMuted: { color: '#64748b', backgroundColor: '#f1f5f9' },
  categoriaTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  animalNombre: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  cardFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  infoText: { fontSize: 12, color: '#64748b' },
  bold: { fontWeight: '600', color: '#1e293b' },
  centerContainer: { alignItems: 'center', marginTop: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#475569', marginTop: 16 },
});
