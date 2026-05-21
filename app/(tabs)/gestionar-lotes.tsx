import { eq } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { lotes } from '../../db/schema';

type LoteRow = typeof lotes.$inferSelect;

export default function GestionarLotesScreen() {
  const router = useRouter();
  const [fincaNombre, setFincaNombre] = useState('');
  const [fincaId, setFincaId] = useState<string | null>(null);
  const [lista, setLista] = useState<LoteRow[]>([]);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargarLotes = useCallback(async () => {
    try {
      setCargando(true);
      const finca = await obtenerFincaActiva();
      if (!finca) {
        setFincaId(null);
        setFincaNombre('Sin finca activa');
        setLista([]);
        return;
      }
      setFincaId(finca.id);
      setFincaNombre(finca.nombre);
      const rows = await db.select().from(lotes).where(eq(lotes.fincaId, finca.id));
      setLista(rows);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudieron cargar los lotes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarLotes();
    }, [cargarLotes])
  );

  const handleCrear = async () => {
    if (!fincaId) {
      Alert.alert('Finca requerida', 'Selecciona o crea una finca activa primero.');
      return;
    }
    if (!nombre.trim()) {
      Alert.alert('Faltan datos', 'El nombre del lote es obligatorio.');
      return;
    }

    try {
      setGuardando(true);
      await db.insert(lotes).values({
        id: Crypto.randomUUID(),
        fincaId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
      });
      setNombre('');
      setDescripcion('');
      await cargarLotes();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo crear el lote.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = (lote: LoteRow) => {
    Alert.alert(
      'Eliminar lote',
      `¿Eliminar "${lote.nombre}"? Los animales quedarán sin lote asignado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.delete(lotes).where(eq(lotes.id, lote.id));
              await cargarLotes();
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'No se pudo eliminar el lote.');
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Lotes / Potreros</Text>
          <Text style={styles.headerSubtitle}>{fincaNombre}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Nuevo lote</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre (Ej. Ordeño 1, Escotera)"
          placeholderTextColor="#94a3b8"
          value={nombre}
          onChangeText={setNombre}
        />
        <TextInput
          style={[styles.input, styles.inputArea]}
          placeholder="Descripción (opcional)"
          placeholderTextColor="#94a3b8"
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
        />
        <TouchableOpacity
          style={[styles.btnGuardar, guardando && styles.btnDisabled]}
          onPress={handleCrear}
          disabled={guardando || !fincaId}
        >
          <Plus color="#fff" size={18} />
          <Text style={styles.btnGuardarText}>{guardando ? 'Guardando...' : 'Agregar lote'}</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 24 }} size="large" color="#065f46" />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {fincaId
                ? 'No hay lotes. Crea uno arriba para asignarlo al registrar animales.'
                : 'Activa una finca en Inicio para gestionar lotes.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.loteCard}>
              <View style={styles.loteInfo}>
                <MapPin color="#065f46" size={18} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.loteNombre}>{item.nombre}</Text>
                  {item.descripcion ? (
                    <Text style={styles.loteDesc}>{item.descripcion}</Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity onPress={() => handleEliminar(item)} style={styles.deleteBtn}>
                <Trash2 color="#ef4444" size={20} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#065f46', fontWeight: '600' },
  formCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  formTitle: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 12 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 10,
    color: '#1e293b',
  },
  inputArea: { height: 64, paddingTop: 10, textAlignVertical: 'top' },
  btnGuardar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#065f46',
    height: 48,
    borderRadius: 12,
    marginTop: 4,
  },
  btnDisabled: { backgroundColor: '#a7f3d0' },
  btnGuardarText: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  loteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  loteInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  loteNombre: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  loteDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  deleteBtn: { padding: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 24, lineHeight: 20, paddingHorizontal: 16 },
});
