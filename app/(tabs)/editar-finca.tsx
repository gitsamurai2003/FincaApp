import { eq } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import { ArrowLeft, Landmark, MapPin } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { fincas } from '../../db/schema';

export default function EditarFincaScreen() {
  const router = useRouter();
  const [fincaId, setFincaId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const finca = await obtenerFincaActiva();
        if (!finca) {
          Alert.alert('Sin finca activa', 'Selecciona una finca en Inicio primero.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
          return;
        }
        const row = await db.select().from(fincas).where(eq(fincas.id, finca.id)).limit(1);
        if (row[0]) {
          setFincaId(row[0].id);
          setNombre(row[0].nombre);
          setUbicacion(row[0].ubicacion || '');
        }
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'No se pudieron cargar los datos de la finca.');
      } finally {
        setCargando(false);
      }
    })();
  }, [router]);

  const handleGuardar = async () => {
    if (!fincaId) return;
    if (!nombre.trim()) {
      Alert.alert('Faltan datos', 'El nombre de la finca es obligatorio.');
      return;
    }

    try {
      setGuardando(true);
      await db
        .update(fincas)
        .set({
          nombre: nombre.trim(),
          ubicacion: ubicacion.trim() || null,
        })
        .where(eq(fincas.id, fincaId));

      Alert.alert('¡Éxito!', 'Datos de la finca actualizados.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo actualizar la finca.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#065f46" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Finca</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instructions}>
          Actualiza el nombre o la ubicación del predio activo. Los animales y registros no se modifican.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre de la Finca</Text>
          <View style={styles.inputWrapper}>
            <Landmark color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nombre del predio"
              placeholderTextColor="#94a3b8"
              value={nombre}
              onChangeText={setNombre}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ubicación / Sector</Text>
          <View style={styles.inputWrapper}>
            <MapPin color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ej. Machiques, Perijá"
              placeholderTextColor="#94a3b8"
              value={ubicacion}
              onChangeText={setUbicacion}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btnGuardar, guardando && styles.btnDeshabilitado]}
          onPress={handleGuardar}
          disabled={guardando}
        >
          <Text style={styles.btnGuardarText}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { justifyContent: 'center', alignItems: 'center' },
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
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  spacer: { width: 40 },
  content: { flex: 1, padding: 24 },
  instructions: { color: '#64748b', fontSize: 14, marginBottom: 32, lineHeight: 20 },
  inputGroup: { marginBottom: 24 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, color: '#1e293b', fontSize: 15 },
  btnGuardar: {
    backgroundColor: '#065f46',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  btnDeshabilitado: { backgroundColor: '#a7f3d0' },
  btnGuardarText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
