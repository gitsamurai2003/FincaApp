// app/(tabs)/historial-reproduccion.tsx
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Baby, Filter, Plus, Search } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { animales, eventosReproductivos } from '../../db/schema';
import { fechaLocalISO, haceDiasLocal } from '../../utils/fecha';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type EventoRow = {
  id: string;
  fechaEvento: string;
  tipoEvento: string;
  areteCodigo: string;
  animalNombre: string | null;
  resultadoPalpacion: string | null;
  fechaProbableParto: string | null;
  detallesParto: string | null;
  notas: string | null;
};

const PAGE_SIZE = 25;

const TIPO_COLORES: Record<string, { bg: string; text: string }> = {
  Celo_Detectado:          { bg: '#fef3c7', text: '#92400e' },
  Monta_Natural:            { bg: '#ede9fe', text: '#5b21b6' },
  Inseminacion_Artificial:  { bg: '#dbeafe', text: '#1e40af' },
  Palpacion_Diagnostico:    { bg: '#d1fae5', text: '#065f46' },
  Parto:                    { bg: '#fee2e2', text: '#991b1b' },
};

// ── Componente ─────────────────────────────────────────────────────────────────
export default function HistorialReproduccionScreen() {
  const router = useRouter();

  const [lista, setLista] = useState<EventoRow[]>([]);
  const [partosProximos, setPartosProximos] = useState<EventoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [paginaActual, setPaginaActual] = useState(0);
  const [hayMas, setHayMas] = useState(true);
  const [fincaNombre, setFincaNombre] = useState('');
  const [fincaId, setFincaId] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('Todos');
  const [filtroDesde, setFiltroDesde] = useState(haceDiasLocal(89));
  const [filtroHasta, setFiltroHasta] = useState(fechaLocalISO());
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Edición
  const [editando, setEditando] = useState<EventoRow | null>(null);
  const [editNotas, setEditNotas] = useState('');
  const [editFechaParto, setEditFechaParto] = useState('');
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // ── Carga de datos ─────────────────────────────────────────────────────────
  const cargarDatos = useCallback(
    async (pagina: number, reset = false) => {
      if (pagina === 0) setCargando(true); else setCargandoMas(true);
      try {
        const finca = await obtenerFincaActiva();
        if (!finca) { setLista([]); return; }
        setFincaNombre(finca.nombre);
        setFincaId(finca.id);

        // Construir condiciones
        const conds: any[] = [eq(animales.fincaId, finca.id)];
        if (filtroDesde) conds.push(gte(eventosReproductivos.fechaEvento, filtroDesde));
        if (filtroHasta) conds.push(lte(eventosReproductivos.fechaEvento, filtroHasta));
        if (filtroTipo !== 'Todos') conds.push(eq(eventosReproductivos.tipoEvento, filtroTipo as any));

        const rows = await db
          .select({
            id: eventosReproductivos.id,
            fechaEvento: eventosReproductivos.fechaEvento,
            tipoEvento: eventosReproductivos.tipoEvento,
            areteCodigo: animales.areteCodigo,
            animalNombre: animales.nombre,
            resultadoPalpacion: eventosReproductivos.resultadoPalpacion,
            fechaProbableParto: eventosReproductivos.fechaProbableParto,
            detallesParto: eventosReproductivos.detallesParto,
            notas: eventosReproductivos.notas,
          })
          .from(eventosReproductivos)
          .innerJoin(animales, eq(eventosReproductivos.animalId, animales.id))
          .where(and(...conds))
          .orderBy(desc(eventosReproductivos.fechaEvento))
          .limit(PAGE_SIZE + 1)
          .offset(pagina * PAGE_SIZE);

        const hayMasPaginas = rows.length > PAGE_SIZE;
        const datos = hayMasPaginas ? rows.slice(0, PAGE_SIZE) : rows;

        // Filtro de búsqueda por arete en memoria (ya paginado del server)
        const filtrados = busqueda
          ? datos.filter((r) => r.areteCodigo.toLowerCase().includes(busqueda.toLowerCase()))
          : datos;

        setHayMas(hayMasPaginas);
        setLista((prev) => (reset || pagina === 0 ? filtrados : [...prev, ...filtrados]));

        // Partos próximos (próximos 30 días)
        if (pagina === 0) {
          const hoy = fechaLocalISO();
          const en30 = new Date();
          en30.setDate(en30.getDate() + 30);
          const hasta30 = `${en30.getFullYear()}-${String(en30.getMonth() + 1).padStart(2, '0')}-${String(en30.getDate()).padStart(2, '0')}`;

          const proximos = await db
            .select({
              id: eventosReproductivos.id,
              fechaEvento: eventosReproductivos.fechaEvento,
              tipoEvento: eventosReproductivos.tipoEvento,
              areteCodigo: animales.areteCodigo,
              animalNombre: animales.nombre,
              resultadoPalpacion: eventosReproductivos.resultadoPalpacion,
              fechaProbableParto: eventosReproductivos.fechaProbableParto,
              detallesParto: eventosReproductivos.detallesParto,
              notas: eventosReproductivos.notas,
            })
            .from(eventosReproductivos)
            .innerJoin(animales, eq(eventosReproductivos.animalId, animales.id))
            .where(
              and(
                eq(animales.fincaId, finca.id),
                gte(eventosReproductivos.fechaProbableParto, hoy),
                lte(eventosReproductivos.fechaProbableParto, hasta30)
              )
            )
            .orderBy(eventosReproductivos.fechaProbableParto)
            .limit(20);
          setPartosProximos(proximos);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setCargando(false);
        setCargandoMas(false);
      }
    },
    [filtroDesde, filtroHasta, filtroTipo, busqueda]
  );

  useFocusEffect(
    useCallback(() => {
      setPaginaActual(0);
      cargarDatos(0, true);
    }, [cargarDatos])
  );

  const cargarMas = () => {
    if (!hayMas || cargandoMas) return;
    const siguiente = paginaActual + 1;
    setPaginaActual(siguiente);
    cargarDatos(siguiente);
  };

  const aplicarFiltros = () => {
    setMostrarFiltros(false);
    setPaginaActual(0);
    cargarDatos(0, true);
  };

  // ── Acciones ───────────────────────────────────────────────────────────────
  const abrirAcciones = (item: EventoRow) => {
    Alert.alert(
      `#${item.areteCodigo} · ${item.tipoEvento.replace(/_/g, ' ')}`,
      `Fecha: ${item.fechaEvento}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Editar notas/fecha parto',
          onPress: () => {
            setEditando(item);
            setEditNotas(item.notas || '');
            setEditFechaParto(item.fechaProbableParto || '');
          },
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => confirmarEliminar(item),
        },
      ]
    );
  };

  const confirmarEliminar = (item: EventoRow) => {
    Alert.alert('Eliminar evento', '¿Borrar este registro reproductivo?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.delete(eventosReproductivos).where(eq(eventosReproductivos.id, item.id));
            setPaginaActual(0);
            cargarDatos(0, true);
          } catch (e) {
            Alert.alert('Error', 'No se pudo eliminar.');
          }
        },
      },
    ]);
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    try {
      setGuardandoEdit(true);
      await db
        .update(eventosReproductivos)
        .set({
          notas: editNotas.trim() || null,
          fechaProbableParto: editFechaParto.trim() || null,
        })
        .where(eq(eventosReproductivos.id, editando.id));
      setEditando(null);
      setPaginaActual(0);
      cargarDatos(0, true);
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar.');
    } finally {
      setGuardandoEdit(false);
    }
  };

  // ── Render item ────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: EventoRow }) => {
    const colores = TIPO_COLORES[item.tipoEvento] ?? { bg: '#f1f5f9', text: '#475569' };
    return (
      <TouchableOpacity
        style={styles.card}
        onLongPress={() => abrirAcciones(item)}
        delayLongPress={400}
      >
        <View style={styles.cardTop}>
          <View style={styles.areteBadge}>
            <Text style={styles.areteText}>#{item.areteCodigo}</Text>
          </View>
          <View style={[styles.tipoBadge, { backgroundColor: colores.bg }]}>
            <Text style={[styles.tipoText, { color: colores.text }]}>
              {item.tipoEvento.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        {item.animalNombre && (
          <Text style={styles.animalNombreText}>{item.animalNombre}</Text>
        )}
        <Text style={styles.fechaText}>{item.fechaEvento}</Text>

        {item.resultadoPalpacion && (
          <Text style={styles.detText}>Resultado: {item.resultadoPalpacion}</Text>
        )}
        {item.fechaProbableParto && (
          <Text style={styles.detText}>🤰 Parto estimado: {item.fechaProbableParto}</Text>
        )}
        {item.detallesParto && (
          <Text style={styles.detText}>Detalle: {item.detallesParto.replace(/_/g, ' ')}</Text>
        )}
        {item.notas && (
          <Text style={styles.notasText} numberOfLines={2}>{item.notas}</Text>
        )}
        <Text style={styles.hintText}>Mantén presionado para editar o eliminar</Text>
      </TouchableOpacity>
    );
  };

  // ── Header list (partos próximos + filtros) ────────────────────────────────
  const ListHeader = () => (
    <>
      {/* Alerta partos próximos */}
      {partosProximos.length > 0 && (
        <View style={styles.alertaSection}>
          <View style={styles.alertaHeader}>
            <Baby color="#dc2626" size={18} />
            <Text style={styles.alertaTitle}>Partos próximos (30 días)</Text>
          </View>
          {partosProximos.map((p) => {
            const diasRestantes = Math.round(
              (new Date(`${p.fechaProbableParto}T12:00:00`).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24)
            );
            return (
              <View key={p.id} style={styles.alertaRow}>
                <View>
                  <Text style={styles.alertaArete}>#{p.areteCodigo}</Text>
                  <Text style={styles.alertaFecha}>{p.fechaProbableParto}</Text>
                </View>
                <View style={[styles.diasBadge, diasRestantes <= 7 && styles.diasBadgeUrgente]}>
                  <Text style={[styles.diasText, diasRestantes <= 7 && { color: '#fff' }]}>
                    {diasRestantes}d
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Barra búsqueda + filtros */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search color="#94a3b8" size={16} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar arete..."
            value={busqueda}
            onChangeText={(t) => {
              setBusqueda(t);
              setPaginaActual(0);
              cargarDatos(0, true);
            }}
            placeholderTextColor="#94a3b8"
          />
        </View>
        <TouchableOpacity
          style={[styles.filtroBtn, mostrarFiltros && styles.filtroBtnOn]}
          onPress={() => setMostrarFiltros((v) => !v)}
        >
          <Filter size={16} color={mostrarFiltros ? '#fff' : '#7c3aed'} />
        </TouchableOpacity>
      </View>

      {/* Panel de filtros */}
      {mostrarFiltros && (
        <View style={styles.filtroPanel}>
          <Text style={styles.filtroPanelLabel}>Tipo de evento</Text>
          <View style={styles.chipRow}>
            {['Todos', ...Array.from(Object.keys(TIPO_COLORES))].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, filtroTipo === t && styles.chipOn]}
                onPress={() => setFiltroTipo(t)}
              >
                <Text style={[styles.chipText, filtroTipo === t && styles.chipTextOn]}>
                  {t.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filtroPanelLabel}>Desde</Text>
          <TextInput
            style={styles.filtroInput}
            value={filtroDesde}
            onChangeText={setFiltroDesde}
            placeholder="YYYY-MM-DD"
          />
          <Text style={styles.filtroPanelLabel}>Hasta</Text>
          <TextInput
            style={styles.filtroInput}
            value={filtroHasta}
            onChangeText={setFiltroHasta}
            placeholder="YYYY-MM-DD"
          />
          <TouchableOpacity style={styles.filtroAplicar} onPress={aplicarFiltros}>
            <Text style={styles.filtroAplicarText}>Aplicar filtros</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Eventos · {fincaNombre}</Text>
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/registros')}>          
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial Reproductivo</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/registrar-reproduccion')}
        >
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#7c3aed" />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          ListHeaderComponent={<ListHeader />}
          contentContainerStyle={styles.listContent}
          onEndReached={cargarMas}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            cargandoMas ? (
              <ActivityIndicator color="#7c3aed" style={{ marginVertical: 12 }} />
            ) : !hayMas && lista.length > 0 ? (
              <Text style={styles.finLista}>— Fin del historial ({lista.length} registros) —</Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Sin eventos en el rango seleccionado.</Text>
          }
        />
      )}

      {/* Modal edición */}
      <Modal visible={editando !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar registro</Text>
            <Text style={styles.modalSub}>
              #{editando?.areteCodigo} · {editando?.tipoEvento.replace(/_/g, ' ')}
            </Text>

            <Text style={styles.label}>Notas</Text>
            <TextInput
              style={[styles.filtroInput, { height: 70 }]}
              value={editNotas}
              onChangeText={setEditNotas}
              multiline
              placeholder="Observaciones..."
            />

            {(editando?.tipoEvento === 'Palpacion_Diagnostico' ||
              editando?.tipoEvento === 'Monta_Natural' ||
              editando?.tipoEvento === 'Inseminacion_Artificial') && (
              <>
                <Text style={styles.label}>Fecha probable de parto</Text>
                <TextInput
                  style={styles.filtroInput}
                  value={editFechaParto}
                  onChangeText={setEditFechaParto}
                  placeholder="YYYY-MM-DD"
                />
              </>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setEditando(null)}
              >
                <Text style={{ fontWeight: '600', color: '#475569' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnSave, guardandoEdit && { opacity: 0.5 }]}
                onPress={guardarEdicion}
                disabled={guardandoEdit}
              >
                <Text style={{ fontWeight: '700', color: '#fff' }}>
                  {guardandoEdit ? '...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  addBtn: { backgroundColor: '#7c3aed', padding: 10, borderRadius: 12 },
  listContent: { padding: 16, paddingBottom: 80 },

  // Partos próximos
  alertaSection: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  alertaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  alertaTitle: { fontWeight: '700', color: '#991b1b', fontSize: 14 },
  alertaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#fee2e2',
  },
  alertaArete: { fontWeight: '700', color: '#1e293b' },
  alertaFecha: { fontSize: 12, color: '#64748b' },
  diasBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  diasBadgeUrgente: { backgroundColor: '#dc2626' },
  diasText: { fontWeight: '800', fontSize: 13, color: '#1e293b' },

  // Búsqueda y filtros
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 40,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  filtroBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtroBtnOn: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  filtroPanel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filtroPanelLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 8, textTransform: 'uppercase' },
  filtroInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 4,
    color: '#1e293b',
  },
  filtroAplicar: {
    backgroundColor: '#7c3aed',
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  filtroAplicarText: { color: '#fff', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipOn: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  chipTextOn: { color: '#fff' },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

  // Card de evento
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  areteBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  areteText: { fontWeight: '700', color: '#1e293b', fontSize: 13 },
  tipoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tipoText: { fontSize: 11, fontWeight: '700' },
  animalNombreText: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 2 },
  fechaText: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  detText: { fontSize: 12, color: '#475569', marginTop: 2 },
  notasText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 4 },
  hintText: { fontSize: 10, color: '#cbd5e1', marginTop: 6 },
  empty: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
  finLista: { textAlign: 'center', color: '#cbd5e1', fontSize: 12, marginVertical: 12 },

  // Modal
  label: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4, marginTop: 10, textTransform: 'uppercase' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalSub: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 4 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtnCancel: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  modalBtnSave: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },
});
