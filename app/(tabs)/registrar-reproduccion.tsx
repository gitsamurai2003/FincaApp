// app/(tabs)/registrar-reproduccion.tsx
import { and, eq, like } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, Search, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { buscarAnimalPorArete } from '../../db/buscarAnimal';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { animales, eventosReproductivos } from '../../db/schema';
import { fechaLocalISO, sumarDiasLocal } from '../../utils/fecha';

// ── Tipos ──────────────────────────────────────────────────────────────────────
const TIPOS = [
  'Celo_Detectado',
  'Monta_Natural',
  'Inseminacion_Artificial',
  'Palpacion_Diagnostico',
  'Parto',
] as const;

const RESULTADOS = ['Preñada', 'Vacia', 'Dudosa'] as const;
const DETALLES_PARTO = ['Normal', 'Distocico_Asistido', 'Aborto', 'Natimuerto'] as const;

type Sugerencia = { id: string; areteCodigo: string; nombre: string | null; categoria: string };

// ── Componente ─────────────────────────────────────────────────────────────────
export default function RegistrarReproduccionScreen() {
  const router = useRouter();
  const { arete: areteParam } = useLocalSearchParams<{ arete?: string }>();
  const areteInputRef = useRef<TextInput>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [arete, setArete] = useState('');
  const [animalEncontrado, setAnimalEncontrado] = useState<Sugerencia | null>(null);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('Palpacion_Diagnostico');
  const [fecha, setFecha] = useState(fechaLocalISO());
  const [resultado, setResultado] = useState<(typeof RESULTADOS)[number]>('Preñada');
  const [toroPajuela, setToroPajuela] = useState('');
  const [fechaParto, setFechaParto] = useState('');
  const [detalleParto, setDetalleParto] = useState<(typeof DETALLES_PARTO)[number]>('Normal');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [modoRapido, setModoRapido] = useState(false); // stay-on-form after save
  const [guardadosHoy, setGuardadosHoy] = useState(0);
  const [fincaId, setFincaId] = useState<string | null>(null);

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

  // Calcular fecha probable de parto automáticamente (gestación promedio bovina ~283 días)
  useEffect(() => {
    if (
      (tipo === 'Monta_Natural' || tipo === 'Inseminacion_Artificial') &&
      fecha.length === 10 &&
      !fechaParto
    ) {
      setFechaParto(sumarDiasLocal(fecha, 283));
    }
  }, [tipo, fecha]);

  // ── Autocompletado ─────────────────────────────────────────────────────────
  const buscarPorArete = useCallback(
    async (texto: string) => {
      if (!fincaId || texto.trim().length < 1) {
        setSugerencias([]);
        setAnimalEncontrado(null);
        return;
      }
      const upper = texto.trim().toUpperCase();
      // Exact match primero
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

      // Búsqueda parcial
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

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!arete.trim()) {
      Alert.alert('Arete requerido', 'Ingresa o selecciona el arete del animal.');
      return;
    }
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

      await db.insert(eventosReproductivos).values({
        id: Crypto.randomUUID(),
        animalId: animal.id,
        tipoEvento: tipo,
        fechaEvento: fecha.trim(),
        resultadoPalpacion: tipo === 'Palpacion_Diagnostico' ? resultado : null,
        toroOPajuela: toroPajuela.trim() || null,
        fechaProbableParto: (tipo === 'Palpacion_Diagnostico' || tipo === 'Monta_Natural' || tipo === 'Inseminacion_Artificial')
          ? (fechaParto.trim() || null)
          : null,
        detallesParto: tipo === 'Parto' ? detalleParto : null,
        notas: notas.trim() || null,
      });

      setGuardadosHoy((n) => n + 1);

      if (modoRapido) {
        // Limpia solo el arete para registrar el siguiente
        setArete('');
        setAnimalEncontrado(null);
        setSugerencias([]);
        setNotas('');
        setToroPajuela('');
        setFechaParto(tipo === 'Monta_Natural' || tipo === 'Inseminacion_Artificial' ? sumarDiasLocal(fecha, 283) : '');
        areteInputRef.current?.focus();
      } else {
        Alert.alert('Guardado', 'Evento reproductivo registrado.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo guardar el evento.');
    } finally {
      setGuardando(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Evento Reproductivo</Text>
          {modoRapido && guardadosHoy > 0 && (
            <Text style={styles.headerBadge}>⚡ {guardadosHoy} guardados esta sesión</Text>
          )}
        </View>
        {/* Toggle modo rápido */}
        <TouchableOpacity
          style={[styles.modoRapidoBtn, modoRapido && styles.modoRapidoBtnOn]}
          onPress={() => setModoRapido((v) => !v)}
        >
          <Zap size={14} color={modoRapido ? '#fff' : '#7c3aed'} />
          <Text style={[styles.modoRapidoText, modoRapido && { color: '#fff' }]}>Rápido</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">

        {/* Tipo de evento */}
        <Text style={styles.label}>Tipo de evento</Text>
        <View style={styles.chipRow}>
          {TIPOS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, tipo === t && styles.chipOn]}
              onPress={() => {
                setTipo(t);
                setFechaParto('');
              }}
            >
              <Text style={[styles.chipText, tipo === t && styles.chipTextOn]}>
                {t.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fecha */}
        <Text style={styles.label}>Fecha del evento</Text>
        <TextInput style={styles.input} value={fecha} onChangeText={setFecha} placeholder="YYYY-MM-DD" />

        {/* Arete con autocompletado */}
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
          {animalEncontrado && (
            <CheckCircle color="#065f46" size={20} />
          )}
        </View>

        {/* Dropdown sugerencias */}
        {sugerencias.length > 0 && (
          <View style={styles.dropdown}>
            {sugerencias.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.dropdownItem}
                onPress={() => seleccionarSugerencia(s)}
              >
                <Text style={styles.dropdownArete}>#{s.areteCodigo}</Text>
                <Text style={styles.dropdownMeta}>{s.nombre || s.categoria}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Info animal encontrado */}
        {animalEncontrado && (
          <View style={styles.animalCard}>
            <Text style={styles.animalCardText}>
              ✓ {animalEncontrado.areteCodigo}
              {animalEncontrado.nombre ? ` — ${animalEncontrado.nombre}` : ''}
              {'  ·  '}{animalEncontrado.categoria.replace('_', ' ')}
            </Text>
          </View>
        )}

        {/* Campos condicionales por tipo */}
        {(tipo === 'Monta_Natural' || tipo === 'Inseminacion_Artificial') && (
          <>
            <Text style={styles.label}>
              {tipo === 'Monta_Natural' ? 'Toro (arete/nombre)' : 'Pajuela / Código IA'}
            </Text>
            <TextInput
              style={styles.input}
              value={toroPajuela}
              onChangeText={setToroPajuela}
              placeholder="Opcional"
              autoCapitalize="characters"
            />
            <Text style={styles.label}>Fecha probable de parto</Text>
            <TextInput
              style={styles.input}
              value={fechaParto}
              onChangeText={setFechaParto}
              placeholder="YYYY-MM-DD (se calcula automáticamente)"
            />
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
            {resultado === 'Preñada' && (
              <>
                <Text style={styles.label}>Fecha probable de parto</Text>
                <TextInput
                  style={styles.input}
                  value={fechaParto}
                  onChangeText={setFechaParto}
                  placeholder="YYYY-MM-DD"
                />
              </>
            )}
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
        <TextInput
          style={[styles.input, { height: 70 }]}
          value={notas}
          onChangeText={setNotas}
          multiline
          placeholder="Observaciones adicionales..."
        />

        {/* Modo rápido hint */}
        {modoRapido && (
          <View style={styles.hintCard}>
            <Zap size={14} color="#7c3aed" />
            <Text style={styles.hintText}>
              Modo rápido activo: el formulario se limpiará para el siguiente arete sin cerrar la pantalla.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, guardando && styles.btnOff]}
          onPress={handleGuardar}
          disabled={guardando}
        >
          <Text style={styles.btnText}>
            {guardando ? 'Guardando...' : modoRapido ? '⚡ Guardar y continuar' : 'Registrar evento'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
    gap: 10,
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  headerBadge: { fontSize: 11, color: '#7c3aed', fontWeight: '600', marginTop: 2 },
  modoRapidoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7c3aed',
    backgroundColor: '#faf5ff',
  },
  modoRapidoBtnOn: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  modoRapidoText: { fontSize: 12, fontWeight: '700', color: '#7c3aed' },
  content: { padding: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.4 },
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
  chipOn: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
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
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#faf5ff',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  hintText: { flex: 1, fontSize: 12, color: '#7c3aed', lineHeight: 17 },
  btn: {
    backgroundColor: '#7c3aed',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  btnOff: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
