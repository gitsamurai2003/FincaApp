import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Calculator, Save } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { animales, produccionLeche, rendimientosQueso } from '../../db/schema';
import {
  esFechaValida,
  fechaLocalISO,
  haceDiasLocal,
  validarRangoFechas,
} from '../../utils/fecha';

type HistorialQueso = {
  id: string;
  fincaId: string;
  fechaInicio: string;
  fechaFin: string;
  totalLitros: number;
  kgQueso: number;
  litrosPorKg: number;
  notas: string | null;
  creadoEn: number | null;
};

type DesgloseAnimal = {
  areteCodigo: string;
  litros: number;
};

export default function RendimientoQuesoScreen() {
  const router = useRouter();
  const [fincaNombre, setFincaNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState(() => haceDiasLocal(6));
  const [fechaFin, setFechaFin] = useState(() => fechaLocalISO());
  const [soloLeche, setSoloLeche] = useState(true);
  const [kgQueso, setKgQueso] = useState('');
  const [totalLitros, setTotalLitros] = useState<number | null>(null);
  const [conteoRegistros, setConteoRegistros] = useState(0);
  const [conteoAnimales, setConteoAnimales] = useState(0);
  const [desglose, setDesglose] = useState<DesgloseAnimal[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [calculado, setCalculado] = useState(false);
  const [fincaId, setFincaId] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialQueso[]>([]);
  const [notasLote, setNotasLote] = useState('');

  const litrosPorKg = useMemo(() => {
    const kg = parseFloat(kgQueso.replace(',', '.'));
    if (!calculado || totalLitros === null || !Number.isFinite(kg) || kg <= 0) return null;
    return totalLitros / kg;
  }, [calculado, totalLitros, kgQueso]);

  const aplicarPreset = (dias: number) => {
    setFechaInicio(haceDiasLocal(dias - 1));
    setFechaFin(fechaLocalISO());
    setCalculado(false); // Limpiar cálculo previo para evitar datos inconsistentes
  };

  const cargarHistorial = useCallback(async () => {
    try {
      const finca = await obtenerFincaActiva();
      if (!finca) {
        setHistorial([]);
        setFincaId(null);
        return;
      }
      setFincaId(finca.id);
      setFincaNombre(finca.nombre);

      const rows = await db
        .select()
        .from(rendimientosQueso)
        .where(eq(rendimientosQueso.fincaId, finca.id))
        .orderBy(desc(rendimientosQueso.creadoEn))
        .limit(15);

      // Mapeo seguro asegurando que cumpla con la estructura de la interfaz
      const historialMapeado: HistorialQueso[] = rows.map((r) => ({
        id: r.id,
        fincaId: r.fincaId,
        fechaInicio: r.fechaInicio,
        fechaFin: r.fechaFin,
        totalLitros: Number(r.totalLitros) || 0,
        kgQueso: Number(r.kgQueso) || 0,
        litrosPorKg: Number(r.litrosPorKg) || 0,
        notas: r.notas ?? null,
        creadoEn: r.creadoEn ?? null,
      }));

      setHistorial(historialMapeado);
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarHistorial();
    }, [cargarHistorial])
  );

  const guardarLote = async () => {
    if (!fincaId || totalLitros === null || litrosPorKg === null) {
      Alert.alert('Calcular primero', 'Completa el cálculo L/kg antes de guardar el lote.');
      return;
    }
    const kg = parseFloat(kgQueso.replace(',', '.'));
    if (Number.isNaN(kg) || kg <= 0) return;

    try {
      await db.insert(rendimientosQueso).values({
        id: Crypto.randomUUID(),
        fincaId,
        fechaInicio,
        fechaFin,
        totalLitros,
        kgQueso: kg,
        litrosPorKg,
        notas: McCut(notasLote),
      });

      Alert.alert('Guardado', 'Lote de queso registrado en el historial.');
      setNotasLote('');
      await cargarHistorial();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo guardar el lote.');
    }
  };

  const McCut = (text: string) => text.trim() || null;

  const cargarLitros = useCallback(
    async (requiereKg: boolean) => {
      const rango = validarRangoFechas(fechaInicio, fechaFin);
      if (!rango.ok) {
        Alert.alert('Fechas inválidas', rango.mensaje);
        return;
      }

      const kg = parseFloat(kgQueso.replace(',', '.'));
      if (requiereKg && (!kgQueso.trim() || Number.isNaN(kg) || kg <= 0)) {
        Alert.alert('Kg de queso', 'Ingresa el total de kg de queso producido (mayor a 0).');
        return;
      }

      try {
        setCalculando(true);
        setCalculado(false);

        const finca = await obtenerFincaActiva();
        if (!finca) {
          Alert.alert('Sin finca activa', 'Activa una finca antes de calcular el rendimiento.');
          setFincaNombre('');
          setTotalLitros(null);
          setDesglose([]);
          return;
        }

        // Mantener sincronizado el estado base de la pantalla
        setFincaNombre(finca.nombre);
        setFincaId(finca.id);

        const condiciones = [
          eq(animales.fincaId, finca.id),
          gte(produccionLeche.fecha, fechaInicio),
          lte(produccionLeche.fecha, fechaFin),
        ];

        if (soloLeche) {
          condiciones.push(inArray(animales.proposito, ['Leche', 'Doble_Proposito']));
        }
        
        const filtroRango = and(...condiciones);

        // Forzar casting nativo en SQL para evitar fallos de strings en SQLite
        const [totales] = await db
          .select({
            totalLitros: sql<number>`CAST(coalesce(sum(${produccionLeche.litros}), 0) AS REAL)`,
            conteo: sql<number>`CAST(count(*) AS INTEGER)`,
            animales: sql<number>`CAST(count(distinct ${produccionLeche.animalId}) AS INTEGER)`,
          })
          .from(produccionLeche)
          .innerJoin(animales, eq(produccionLeche.animalId, animales.id))
          .where(filtroRango);

        const porAnimal = await db
          .select({
            areteCodigo: animales.areteCodigo,
            litros: sql<number>`CAST(sum(${produccionLeche.litros}) AS REAL)`,
          })
          .from(produccionLeche)
          .innerJoin(animales, eq(produccionLeche.animalId, animales.id))
          .where(filtroRango)
          .groupBy(animales.id, animales.areteCodigo)
          .orderBy(desc(sql`sum(${produccionLeche.litros})`));

        setTotalLitros(Number(totales?.totalLitros) || 0);
        setConteoRegistros(Number(totales?.conteo) || 0);
        setConteoAnimales(Number(totales?.animales) || 0);
        
        setDesglose(
          porAnimal.map((r) => ({
            areteCodigo: r.areteCodigo ?? 'S/N',
            litros: Number(r.litros) || 0,
          }))
        );
        
        setCalculado(true);
      } catch (error) {
        console.error('Error en cálculo de litros:', error);
        Alert.alert('Error', 'No se pudo calcular el rendimiento. Intenta de nuevo.');
      } finally {
        setCalculando(false);
      }
    },
    [fechaInicio, fechaFin, kgQueso, soloLeche]
  );

  const etiquetaRango = useMemo(() => {
    return esFechaValida(fechaInicio) && esFechaValida(fechaFin)
      ? `${fechaInicio} → ${fechaFin}`
      : '—';
  }, [fechaInicio, fechaFin]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/registros')}>          
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Rendimiento Quesero</Text>
          <Text style={styles.headerSubtitle}>
            {fincaNombre || 'Litros de leche por kg de queso'}
          </Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <View style={styles.card}>
        <Text style={styles.formTitle}>Período de ordeño</Text>
        <Text style={styles.hint}>Suma todos los turnos (M/T/N) de la finca activa.</Text>

        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetChip} onPress={() => aplicarPreset(7)}>
            <Text style={styles.presetText}>7 días</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => aplicarPreset(14)}>
            <Text style={styles.presetText}>14 días</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.filtroRow} onPress={() => { setSoloLeche((v) => !v); setCalculado(false); }}>
          <View style={[styles.checkbox, soloLeche && styles.checkboxOn]} />
          <Text style={styles.filtroLabel}>Solo animales de propósito leche / doble</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Fecha inicio</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          value={fechaInicio}
          onChangeText={(txt) => { setFechaInicio(txt); setCalculado(false); }}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Fecha fin (inclusive)</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          value={fechaFin}
          onChangeText={(txt) => { setFechaFin(txt); setCalculado(false); }}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Total kg de queso en el período</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. 12.5"
          placeholderTextColor="#94a3b8"
          keyboardType="decimal-pad"
          value={kgQueso}
          onChangeText={setKgQueso}
        />

        <TouchableOpacity
          style={[styles.btnSecundario, calculando && styles.btnCalcularDisabled]}
          onPress={() => cargarLitros(false)}
          disabled={calculando}
        >
          <Text style={styles.btnSecundarioText}>Solo sumar leche del período</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnCalcular, calculando && styles.btnCalcularDisabled]}
          onPress={() => cargarLitros(true)}
          disabled={calculando}
        >
          {calculando ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Calculator color="#fff" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.btnCalcularText}>Calcular L/kg de queso</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {calculado && totalLitros !== null && (
        <>
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Rango</Text>
            <Text style={styles.resultMeta}>{etiquetaRango}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{totalLitros.toFixed(1)}</Text>
                <Text style={styles.statCaption}>Litros leche</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {(parseFloat(kgQueso.replace(',', '.')) || 0).toFixed(1)}
                </Text>
                <Text style={styles.statCaption}>Kg queso</Text>
              </View>
            </View>

            <Text style={styles.ratioLabel}>Litros de leche por kg de queso</Text>
            {litrosPorKg !== null ? (
              <Text style={styles.ratioValue}>{litrosPorKg.toFixed(2)} L/kg</Text>
            ) : (
              <Text style={styles.ratioEmpty}>—</Text>
            )}

            <Text style={styles.resultFootnote}>
              {conteoRegistros} registro{conteoRegistros !== 1 ? 's' : ''} de leche ·{' '}
              {conteoAnimales} animal{conteoAnimales !== 1 ? 'es' : ''}
            </Text>

            {litrosPorKg !== null && (
              <>
                <Text style={[styles.label, { marginTop: 16 }]}>Notas del lote (opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Lote semana 12, queso fresco"
                  placeholderTextColor="#94a3b8"
                  value={notasLote}
                  onChangeText={setNotasLote}
                />
                <TouchableOpacity style={styles.btnGuardarLote} onPress={guardarLote}>
                  <Save color="#fff" size={18} style={{ marginRight: 8 }} />
                  <Text style={styles.btnCalcularText}>Guardar en historial</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {desglose.length > 0 ? (
            <View style={styles.desgloseSection}>
              <Text style={styles.sectionTitle}>Desglose por animal</Text>
              {desglose.map((row) => (
                <View key={row.areteCodigo} style={styles.desgloseRow}>
                  <Text style={styles.desgloseArete}>Arete {row.areteCodigo}</Text>
                  <Text style={styles.desgloseLitros}>{row.litros.toFixed(1)} L</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No hay registros de leche en este rango para la finca activa.
            </Text>
          )}
        </>
      )}

      {historial.length > 0 && (
        <View style={styles.desgloseSection}>
          <Text style={styles.sectionTitle}>Historial de lotes guardados</Text>
          {historial.map((h) => (
            <TouchableOpacity
              key={h.id}
              style={styles.historialRow}
              onPress={() => {
                setFechaInicio(h.fechaInicio);
                setFechaFin(h.fechaFin);
                setKgQueso(String(h.kgQueso));
                setNotasLote(h.notas || '');
                setCalculado(false); // Forzar recálculo si el usuario toca un elemento antiguo
              }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.historialRango}>
                  {h.fechaInicio} → {h.fechaFin}
                </Text>
                <Text style={styles.historialMeta} numberOfLines={2}>
                  {h.totalLitros.toFixed(1)} L · {h.kgQueso.toFixed(1)} kg queso
                  {h.notas ? ` · ${h.notas}` : ''}
                </Text>
              </View>
              <Text style={styles.historialRatio}>{h.litrosPorKg.toFixed(2)} L/kg</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// Los estilos se mantienen idénticos
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerText: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#065f46', fontWeight: '600', marginTop: 2 },
  spacer: { width: 40 },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 1,
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    color: '#1e293b',
    marginBottom: 16,
    fontSize: 14,
  },
  btnCalcular: {
    backgroundColor: '#065f46',
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  btnCalcularDisabled: { backgroundColor: '#a7f3d0' },
  btnCalcularText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filtroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  checkboxOn: { backgroundColor: '#065f46', borderColor: '#065f46' },
  filtroLabel: { fontSize: 13, color: '#475569', flex: 1 },
  btnSecundario: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#065f46',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSecundarioText: { color: '#065f46', fontWeight: '700', fontSize: 14 },
  resultCard: {
    backgroundColor: '#ecfdf5',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  resultLabel: { fontSize: 11, fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: 1 },
  resultMeta: { fontSize: 14, color: '#1e293b', fontWeight: '600', marginTop: 4, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#065f46' },
  statCaption: { fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: '600' },
  ratioLabel: { fontSize: 12, color: '#475569', fontWeight: '600', textAlign: 'center' },
  ratioValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#065f46',
    textAlign: 'center',
    marginTop: 8,
  },
  ratioEmpty: { fontSize: 28, color: '#94a3b8', textAlign: 'center', marginTop: 8 },
  resultFootnote: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 16 },
  desgloseSection: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
    paddingLeft: 4,
  },
  desgloseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  desgloseArete: { fontSize: 14, fontWeight: '700', color: '#334155' },
  desgloseLitros: { fontSize: 15, fontWeight: '700', color: '#065f46' },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    marginHorizontal: 24,
    color: '#64748b',
    fontSize: 14,
  },
  btnGuardarLote: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#047857',
    height: 44,
    borderRadius: 12,
    marginTop: 8,
  },
  historialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  historialRango: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  historialMeta: { fontSize: 11, color: '#64748b', marginTop: 2, maxWidth: 220 },
  historialRatio: { fontSize: 16, fontWeight: '800', color: '#ca8a04' },
});