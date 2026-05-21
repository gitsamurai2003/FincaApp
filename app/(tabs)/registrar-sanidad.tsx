import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { buscarAnimalPorArete } from '../../db/buscarAnimal';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { historialMedico } from '../../db/schema';
import { fechaLocalISO } from '../../utils/fecha';

const TIPOS = [
  'Vacunacion_Obligatoria',
  'Tratamiento_Enfermedad',
  'Desparasitacion',
  'Vitamina',
] as const;

export default function RegistrarSanidadScreen() {
  const router = useRouter();
  const { arete: areteParam } = useLocalSearchParams<{ arete?: string }>();
  const [arete, setArete] = useState('');

  useEffect(() => {
    if (typeof areteParam === 'string' && areteParam.trim()) {
      setArete(areteParam.trim());
    }
  }, [areteParam]);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('Vacunacion_Obligatoria');
  const [medicamento, setMedicamento] = useState('');
  const [dosis, setDosis] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [fecha, setFecha] = useState(fechaLocalISO());
  const [retiroLeche, setRetiroLeche] = useState('0');
  const [retiroCarne, setRetiroCarne] = useState('0');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!arete.trim() || !medicamento.trim()) {
      Alert.alert('Datos requeridos', 'Arete y medicamento son obligatorios.');
      return;
    }
    const dLeche = parseInt(retiroLeche, 10) || 0;
    const dCarne = parseInt(retiroCarne, 10) || 0;

    try {
      setGuardando(true);
      const finca = await obtenerFincaActiva();
      if (!finca) {
        Alert.alert('Sin finca activa', 'Selecciona una finca en Inicio.');
        return;
      }
      const animal = await buscarAnimalPorArete(finca.id, arete);
      if (!animal) {
        Alert.alert('No encontrado', `Arete ${arete.toUpperCase()} no está en esta finca.`);
        return;
      }

      await db.insert(historialMedico).values({
        id: Crypto.randomUUID(),
        animalId: animal.id,
        tipoManejo: tipo,
        diagnostico: diagnostico.trim() || null,
        medicamento: medicamento.trim(),
        dosis: dosis.trim() || null,
        fechaAplicacion: fecha.trim(),
        diasRetiroLeche: dLeche,
        diasRetiroCarne: dCarne,
        notas: notas.trim() || null,
      });

      Alert.alert('Guardado', 'Tratamiento registrado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo guardar. Verifica que la base de datos esté actualizada.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registro sanitario</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.label}>Arete</Text>
        <TextInput style={styles.input} value={arete} onChangeText={setArete} autoCapitalize="characters" />

        <Text style={styles.label}>Tipo de manejo</Text>
        <View style={styles.chipRow}>
          {TIPOS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, tipo === t && styles.chipOn]}
              onPress={() => setTipo(t)}
            >
              <Text style={[styles.chipText, tipo === t && styles.chipTextOn]}>{t.replace(/_/g, ' ')}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Medicamento</Text>
        <TextInput style={styles.input} value={medicamento} onChangeText={setMedicamento} />

        <Text style={styles.label}>Dosis (opcional)</Text>
        <TextInput style={styles.input} value={dosis} onChangeText={setDosis} />

        <Text style={styles.label}>Diagnóstico (opcional)</Text>
        <TextInput style={styles.input} value={diagnostico} onChangeText={setDiagnostico} />

        <Text style={styles.label}>Fecha de aplicación</Text>
        <TextInput style={styles.input} value={fecha} onChangeText={setFecha} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Retiro leche (días)</Text>
            <TextInput style={styles.input} value={retiroLeche} onChangeText={setRetiroLeche} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Retiro carne (días)</Text>
            <TextInput style={styles.input} value={retiroCarne} onChangeText={setRetiroCarne} keyboardType="number-pad" />
          </View>
        </View>

        <Text style={styles.label}>Notas</Text>
        <TextInput style={[styles.input, { height: 64 }]} value={notas} onChangeText={setNotas} multiline />

        <TouchableOpacity style={[styles.btn, guardando && styles.btnOff]} onPress={handleGuardar} disabled={guardando}>
          <Text style={styles.btnText}>{guardando ? 'Guardando...' : 'Registrar tratamiento'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  chipOn: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  chipTextOn: { color: '#fff' },
  btn: { backgroundColor: '#dc2626', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 24, marginBottom: 40 },
  btnOff: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700' },
});
