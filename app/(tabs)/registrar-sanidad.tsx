// app/(tabs)/registrar-sanidad.tsx
import { and, eq, like } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, Search, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
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
import { animales, historialMedico } from '../../db/schema';
import { fechaLocalISO } from '../../utils/fecha';

// ── Tipos ──────────────────────────────────────────────────────────────────────
const TIPOS = [
  'Vacunacion_Obligatoria',
  'Tratamiento_Enfermedad',
  'Desparasitacion',
  'Vitamina',
] as const;

type Sugerencia = { id: string; areteCodigo: string; nombre: string | null; categoria: string };

// ── Componente ─────────────────────────────────────────────────────────────────
export default function RegistrarSanidadScreen() {
  const router = useRouter();
  const { arete: areteParam } = useLocalSearchParams<{ arete?: string }>();
  const areteInputRef = useRef<TextInput>(null);

  // ── Form State ────────────────────────────────────────────────────────────
  const [arete, setArete] = useState('');
  const [animalEncontrado, setAnimalEncontrado] = useState<Sugerencia | null>(null);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('Vacunacion_Obligatoria');
  const [medicamento, setMedicamento] = useState('');
  const [dosis, setDosis] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [fecha, setFecha] = useState(fechaLocalISO());
  const [retiroLeche, setRetiroLeche] = useState('0');
  const [retiroCarne, setRetiroCarne] = useState('0');
  const [notas, setNotas] = useState('');
  
  const [guardando, setGuardando] = useState(false);
  const [modoRapido, setModoRapido] = useState(false); // Persistencia para trabajo en lote
  const [guardadosHoy, setGuardadosHoy] = useState(0);
  const [fincaId, setFincaId] = useState<string | null>(null);

  useEffect(() => {
  const backAction = () => {
    // Aquí defines a qué pantalla quieres que regrese
    router.replace('/registros'); 
    return true; // Importante: 'true' evita que el app se cierre o haga el comportamiento por defecto
  };

  const backHandler = BackHandler.addEventListener(
    'hardwareBackPress',
    backAction
  );

  // Esto limpia el evento al salir de la pantalla para no causar errores en otras partes
  return () => backHandler.remove();
}, []);
  // ── Inicialización ─────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const finca = await obtenerFincaActiva();
        if (finca) setFincaId(finca.id);
      })();
    }, [])
  );

  useEffect(() => {
    if (typeof areteParam === 'string' && areteParam.trim()) {
      setArete(areteParam.trim());
      buscarPorArete(areteParam.trim());
    }
  }, [areteParam]);

  // ── Autocompletado de Aretes ───────────────────────────────────────────────
  const buscarPorArete = useCallback(
    async (texto: string) => {
      if (!fincaId || texto.trim().length < 1) {
        setSugerencias([]);
        setAnimalEncontrado(null);
        return;
      }
      const upper = texto.trim().toUpperCase();
      
      // Match Exacto
      const exacto = await db
        .select({ id: animales.id, areteCodigo: animales.areteCodigo, nombre: animales.nombre, categoria: animales.categoria })
        .from(animales)
        .where(and(eq(animales.fincaId, fincaId), eq(animales.areteCodigo, upper)))
        .limit(1);

      if (exacto.length > 0) {
        setAnimalEncontrado(exacto[0]);
        setSugerencias([]);
        return;
      }
      setAnimalEncontrado(null);

      // Match Parcial
      const parcial = await db
        .select({ id: animales.id, areteCodigo: animales.areteCodigo, nombre: animales.nombre, categoria: animales.categoria })
        .from(animales)
        .where(and(eq(animales.fincaId, fincaId), like(animales.areteCodigo, `${upper}%`)))
        .limit(8);
      setSugerencias(parcial);
    },
    [fincaId]
  );

  const onChangeArete = (text: string) => {
    setArete(text.toUpperCase());
    buscarPorArete(text);
  };

  const seleccionarSugerencia = (s: Sugerencia) => {
    setArete(s.areteCodigo);
    setAnimalEncontrado(s);
    setSugerencias([]);
  };

  // ── Guardar Registro ───────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!arete.trim() || !medicamento.trim()) {
      Alert.alert('Datos requeridos', 'El arete y el medicamento son obligatorios.');
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
      
      const animal = animalEncontrado ?? await buscarAnimalPorArete(finca.id, arete);
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

      setGuardadosHoy((n) => n + 1);

      if (modoRapido) {
        // En lote (ej. Vacunación general), mantenemos el fármaco, dosis y días de retiro
        setArete('');
        setAnimalEncontrado(null);
        setSugerencias([]);
        setNotas('');
        if (tipo !== 'Tratamiento_Enfermedad') {
          setDiagnostico(''); // Limpiar diagnóstico si no es enfermedad
        }
        
        setTimeout(() => {
          areteInputRef.current?.focus();
        }, 100);
      } else {
        Alert.alert('Guardado', 'Tratamiento sanitario registrado con éxito.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo guardar el registro sanitario.');
    } finally {
      setGuardando(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/registros')}>          
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Registro Sanitario</Text>
          {modoRapido && guardadosHoy > 0 && (
            <Text style={styles.headerBadge}>⚡ {guardadosHoy} aplicados en lote</Text>
          )}
        </View>
        
        {/* Toggle Modo Rápido */}
        <TouchableOpacity
          style={[styles.modoRapidoBtn, modoRapido && styles.modoRapidoBtnOn]}
          onPress={() => setModoRapido((v) => !v)}
        >
          <Zap size={14} color={modoRapido ? '#fff' : '#dc2626'} />
          <Text style={[styles.modoRapidoText, modoRapido && { color: '#fff' }]}>Rápido</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* Tipo de Manejo */}
        <Text style={styles.label}>Tipo de manejo sanitario</Text>
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

        {/* Búsqueda de Arete con Autocompletado */}
        <Text style={styles.label}>Arete del animal</Text>
        <View style={styles.areteWrapper}>
          <Search color="#94a3b8" size={18} style={{ marginRight: 8 }} />
          <TextInput
            ref={areteInputRef}
            style={styles.areteInput}
            value={arete}
            onChangeText={onChangeArete}
            autoCapitalize="characters"
            placeholder="Buscar por arete..."
            placeholderTextColor="#94a3b8"
          />
          {animalEncontrado && <CheckCircle color="#065f46" size={20} />}
        </View>

        {/* Dropdown de Sugerencias */}
        {sugerencias.length > 0 && (
          <View style={styles.dropdown}>
            {sugerencias.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.dropdownItem}
                onPress={() => seleccionarSugerencia(s)}
              >
                <Text style={styles.dropdownArete}>#{s.areteCodigo}</Text>
                <Text style={styles.dropdownMeta}>{s.nombre || s.categoria.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Info del Animal Seleccionado */}
        {animalEncontrado && (
          <View style={styles.animalCard}>
            <Text style={styles.animalCardText}>
              ✓ {animalEncontrado.areteCodigo}
              {animalEncontrado.nombre ? ` — ${animalEncontrado.nombre}` : ''}
              {'  ·  '}{animalEncontrado.categoria.replace(/_/g, ' ')}
            </Text>
          </View>
        )}

        {/* Medicamento y Dosis */}
        <Text style={styles.label}>Medicamento / Biológico</Text>
        <TextInput 
          style={styles.input} 
          value={medicamento} 
          onChangeText={setMedicamento} 
          placeholder="Ej: Ivermectina, Vacuna Fiebre Aftosa"
        />

        <Text style={styles.label}>Dosis</Text>
        <TextInput 
          style={styles.input} 
          value={dosis} 
          onChangeText={setDosis} 
          placeholder="Ej: 5 ml, 2 cc (Opcional)"
        />

        {/* Diagnóstico (Relevante para tratamientos médicos) */}
        {tipo === 'Tratamiento_Enfermedad' && (
          <>
            <Text style={styles.label}>Diagnóstico Clínico</Text>
            <TextInput 
              style={styles.input} 
              value={diagnostico} 
              onChangeText={setDiagnostico} 
              placeholder="Ej: Mastitis, Pododermatitis"
            />
          </>
        )}

        <Text style={styles.label}>Fecha de aplicación</Text>
        <TextInput style={styles.input} value={fecha} onChangeText={setFecha} placeholder="YYYY-MM-DD" />

        {/* Tiempos de Retiro (Esencial para fincas lecheras) */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Retiro en Leche (días)</Text>
            <TextInput 
              style={styles.input} 
              value={retiroLeche} 
              onChangeText={setRetiroLeche} 
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Retiro en Carne (días)</Text>
            <TextInput 
              style={styles.input} 
              value={retiroCarne} 
              onChangeText={setRetiroCarne} 
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
        </View>

        <Text style={styles.label}>Notas y observaciones</Text>
        <TextInput 
          style={[styles.input, { height: 70 }]} 
          value={notas} 
          onChangeText={setNotas} 
          multiline 
          placeholder="Lote del fármaco, fabricante o síntomas..."
        />

        {/* Hint del Modo Lote */}
        {modoRapido && (
          <View style={styles.hintCard}>
            <Zap size={14} color="#dc2626" />
            <Text style={styles.hintText}>
              Modo rápido activo: Se preservará el medicamento, dosis y periodos de retiro para registrar rápidamente al siguiente animal.
            </Text>
          </View>
        )}

        {/* Botón de Guardado */}
        <TouchableOpacity 
          style={[styles.btn, guardando && styles.btnOff]} 
          onPress={handleGuardar} 
          disabled={guardando}
        >
          <Text style={styles.btnText}>
            {guardando ? 'Guardando...' : modoRapido ? '⚡ Registrar y Continuar' : 'Registrar Tratamiento'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Estilos Mejorados ──────────────────────────────────────────────────────────
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
    gap: 10,
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  headerBadge: { fontSize: 11, color: '#dc2626', fontWeight: '600', marginTop: 2 },
  modoRapidoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  modoRapidoBtnOn: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  modoRapidoText: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
  content: { padding: 20 },
  label: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    color: '#1e293b',
    fontSize: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  chipOn: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextOn: { color: '#fff' },
  areteWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  areteInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownArete: { fontWeight: '700', color: '#1e293b', fontSize: 14 },
  dropdownMeta: { color: '#64748b', fontSize: 12 },
  animalCard: {
    marginTop: 6,
    padding: 10,
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  animalCardText: { color: '#065f46', fontWeight: '600', fontSize: 13 },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  hintText: { flex: 1, fontSize: 12, color: '#dc2626', lineHeight: 16 },
  btn: { backgroundColor: '#dc2626', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  btnOff: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});