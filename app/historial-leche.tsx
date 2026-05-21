import { desc, eq } from 'drizzle-orm';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItem,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { turnoLecheLabel } from '../constants/turnoLeche';
import { db } from '../db/client';
import { obtenerFincaActiva } from '../db/fincaActiva';
import { animales, produccionLeche } from '../db/schema';

type RegistroLeche = {
  id: string;
  fecha: string;
  litros: number;
  turno: string;
  areteCodigo: string;
};

export default function HistorialLecheScreen() {
  const { arete } = useLocalSearchParams<{ arete?: string }>();
  const [registros, setRegistros] = useState<RegistroLeche[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [fincaNombre, setFincaNombre] = useState('');
  const [editando, setEditando] = useState<RegistroLeche | null>(null);
  const [litrosEdit, setLitrosEdit] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarRegistros = useCallback(async () => {
    try {
      setCargando(true);
      const fincaActiva = await obtenerFincaActiva();
      if (!fincaActiva) {
        setFincaNombre('Sin finca activa');
        setRegistros([]);
        return;
      }
      setFincaNombre(fincaActiva.nombre);

      const data = await db
        .select({
          id: produccionLeche.id,
          fecha: produccionLeche.fecha,
          litros: produccionLeche.litros,
          turno: produccionLeche.turno,
          areteCodigo: animales.areteCodigo,
        })
        .from(produccionLeche)
        .innerJoin(animales, eq(produccionLeche.animalId, animales.id))
        .where(eq(animales.fincaId, fincaActiva.id))
        .orderBy(desc(produccionLeche.fecha), desc(produccionLeche.id));

      setRegistros(data);
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (typeof arete === 'string' && arete.trim()) {
        setBusqueda(arete.trim());
      }
      cargarRegistros();
    }, [cargarRegistros, arete])
  );

  const abrirAcciones = (item: RegistroLeche) => {
    Alert.alert(
      `Arete ${item.areteCodigo}`,
      `${item.fecha} · ${turnoLecheLabel(item.turno)} · ${item.litros} L`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Editar litros',
          onPress: () => {
            setEditando(item);
            setLitrosEdit(String(item.litros));
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

  const confirmarEliminar = (item: RegistroLeche) => {
    Alert.alert('Eliminar registro', '¿Borrar esta pesada de leche?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.delete(produccionLeche).where(eq(produccionLeche.id, item.id));
            await cargarRegistros();
          } catch (e) {
            Alert.alert('Error', 'No se pudo eliminar.');
          }
        },
      },
    ]);
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    const litros = parseFloat(litrosEdit.replace(',', '.'));
    if (Number.isNaN(litros) || litros <= 0) {
      Alert.alert('Dato inválido', 'Ingresa litros mayores a 0.');
      return;
    }
    try {
      setGuardando(true);
      await db
        .update(produccionLeche)
        .set({ litros })
        .where(eq(produccionLeche.id, editando.id));
      setEditando(null);
      await cargarRegistros();
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar.');
    } finally {
      setGuardando(false);
    }
  };

  const registrosFiltrados = registros.filter((reg) =>
    reg.areteCodigo.toLowerCase().includes(busqueda.toLowerCase())
  );

  const renderItem: ListRenderItem<RegistroLeche> = ({ item }) => (
    <TouchableOpacity style={styles.card} onLongPress={() => abrirAcciones(item)} delayLongPress={400}>
      <View style={styles.cardHeader}>
        <Text style={styles.animalId}>Arete: {item.areteCodigo}</Text>
        <Text style={styles.fecha}>{item.fecha}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.litros}>{item.litros} L</Text>
        <Text style={styles.tipo}>Turno {turnoLecheLabel(item.turno)}</Text>
      </View>
      <Text style={styles.hint}>Mantén presionado para editar o eliminar</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: fincaNombre ? `Leche · ${fincaNombre}` : 'Historial de Leche',
          headerStyle: { backgroundColor: '#065f46' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />

      <View style={styles.searchContainer}>
        <Search color="#94a3b8" size={20} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por arete..."
          value={busqueda}
          onChangeText={setBusqueda}
          placeholderTextColor="#94a3b8"
        />
      </View>

      {cargando ? (
        <ActivityIndicator size="large" color="#065f46" style={styles.loader} />
      ) : (
        <FlatList
          data={registrosFiltrados}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay registros de leche.</Text>}
        />
      )}

      <Modal visible={editando !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar litros</Text>
            <Text style={styles.modalSub}>
              {editando?.areteCodigo} · {editando?.fecha} · {editando && turnoLecheLabel(editando.turno)}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={litrosEdit}
              onChangeText={setLitrosEdit}
              keyboardType="decimal-pad"
              placeholder="Litros"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setEditando(null)}
                disabled={guardando}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnSave, guardando && styles.modalBtnDisabled]}
                onPress={guardarEdicion}
                disabled={guardando}
              >
                <Text style={styles.modalBtnSaveText}>{guardando ? '...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: '#1e293b' },
  loader: { marginTop: 40 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  animalId: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  fecha: { fontSize: 13, color: '#64748b' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  litros: { fontSize: 20, fontWeight: '800', color: '#065f46' },
  tipo: {
    fontSize: 14,
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hint: { fontSize: 10, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#64748b', fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalSub: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnCancelText: { fontWeight: '600', color: '#475569' },
  modalBtnSave: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#065f46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnDisabled: { backgroundColor: '#a7f3d0' },
  modalBtnSaveText: { fontWeight: '700', color: '#fff' },
});
