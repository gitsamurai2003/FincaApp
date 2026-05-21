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
import { animales, eventosReproductivos } from '../../db/schema';
import { fechaLocalISO } from '../../utils/fecha';

const TIPOS = [
  'Celo_Detectado',
  'Monta_Natural',
  'Inseminacion_Artificial',
  'Palpacion_Diagnostico',
  'Parto',
] as const;

const RESULTADOS = ['Preñada', 'Vacia', 'Dudosa'] as const;
const DETALLES_PARTO = ['Normal', 'Distocico_Asistido', 'Aborto', 'Natimuerto'] as const;

export default function RegistrarReproduccionScreen() {
  const router = useRouter();
  const { arete: areteParam } = useLocalSearchParams<{ arete?: string }>();
  const [arete, setArete] = useState('');

  useEffect(() => {
    if (typeof areteParam === 'string' && areteParam.trim()) {
      setArete(areteParam.trim());
    }
  }, [areteParam]);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('Palpacion_Diagnostico');
  const [fecha, setFecha] = useState(fechaLocalISO());
  const [resultado, setResultado] = useState<(typeof RESULTADOS)[number]>('Preñada');
  const [toroPajuela, setToroPajuela] = useState('');
  const [fechaParto, setFechaParto] = useState('');
  const [detalleParto, setDetalleParto] = useState<(typeof DETALLES_PARTO)[number]>('Normal');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!arete.trim()) {
      Alert.alert('Arete requerido', 'Ingresa el arete del animal.');
      return;
    }
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
      if (animal.sexo !== 'F') {
        Alert.alert('Atención', 'Este evento suele registrarse en hembras.');
      }

      await db.insert(eventosReproductivos).values({
        id: Crypto.randomUUID(),
        animalId: animal.id,
        tipoEvento: tipo,
        fechaEvento: fecha.trim(),
        resultadoPalpacion: tipo === 'Palpacion_Diagnostico' ? resultado : null,
        toroOPajuela: toroPajuela.trim() || null,
        fechaProbableParto: fechaParto.trim() || null,
        detallesParto: tipo === 'Parto' ? detalleParto : null,
        notas: notas.trim() || null,
      });

      Alert.alert('Guardado', 'Evento reproductivo registrado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo guardar el evento.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Evento reproductivo</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.label}>Arete del animal</Text>
        <TextInput style={styles.input} value={arete} onChangeText={setArete} autoCapitalize="characters" />

        <Text style={styles.label}>Tipo de evento</Text>
        <View style={styles.chipRow}>
          {TIPOS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, tipo === t && styles.chipOn]}
              onPress={() => setTipo(t)}
            >
              <Text style={[styles.chipText, tipo === t && styles.chipTextOn]}>
                {t.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Fecha del evento</Text>
        <TextInput style={styles.input} value={fecha} onChangeText={setFecha} placeholder="YYYY-MM-DD" />

        {(tipo === 'Monta_Natural' || tipo === 'Inseminacion_Artificial') && (
          <>
            <Text style={styles.label}>Toro / pajuela</Text>
            <TextInput style={styles.input} value={toroPajuela} onChangeText={setToroPajuela} />
          </>
        )}

        {tipo === 'Palpacion_Diagnostico' && (
          <>
            <Text style={styles.label}>Resultado palpación</Text>
            <View style={styles.chipRow}>
              {RESULTADOS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, resultado === r && styles.chipOn]}
                  onPress={() => setResultado(r)}
                >
                  <Text style={[styles.chipText, resultado === r && styles.chipTextOn]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Fecha probable de parto (opcional)</Text>
            <TextInput style={styles.input} value={fechaParto} onChangeText={setFechaParto} />
          </>
        )}

        {tipo === 'Parto' && (
          <>
            <Text style={styles.label}>Detalle del parto</Text>
            <View style={styles.chipRow}>
              {DETALLES_PARTO.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, detalleParto === d && styles.chipOn]}
                  onPress={() => setDetalleParto(d)}
                >
                  <Text style={[styles.chipText, detalleParto === d && styles.chipTextOn]}>
                    {d.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>Notas</Text>
        <TextInput style={[styles.input, { height: 70 }]} value={notas} onChangeText={setNotas} multiline />

        <TouchableOpacity
          style={[styles.btn, guardando && styles.btnOff]}
          onPress={handleGuardar}
          disabled={guardando}
        >
          <Text style={styles.btnText}>{guardando ? 'Guardando...' : 'Registrar evento'}</Text>
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
    color: '#1e293b',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipOn: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  chipTextOn: { color: '#fff' },
  btn: {
    backgroundColor: '#7c3aed',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  btnOff: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700' },
});
