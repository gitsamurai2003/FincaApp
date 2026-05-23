import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import { ArrowLeft, Medal, Scale } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { animales, pesajes } from '../../db/schema';
import { fechaLocalISO, haceDiasLocal, validarRangoFechas } from '../../utils/fecha';

type RankingRow = {
  animalId: string;
  areteCodigo: string;
  nombre: string | null;
  pesoMaximo: number;
  pesoPromedio: number;
  pesadas: number;
};

type CriterioOrden = 'pesoMaximo' | 'pesoPromedio' | 'pesadas';

export default function RankingPesoScreen() {
  const router = useRouter();
  const [fincaNombre, setFincaNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState(haceDiasLocal(30));
  const [fechaFin, setFechaFin] = useState(fechaLocalISO());
  const [soloActivos, setSoloActivos] = useState(true);
  const [soloCarne, setSoloCarne] = useState(false);
  
  const [soloHembras, setSoloHembras] = useState(false); 
  
  const [criterio, setCriterio] = useState<CriterioOrden>('pesoMaximo');
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [calculado, setCalculado] = useState(false);

  useEffect(() => {
    const backAction = () => {
      // Redirige a registros en lugar de hacer el 'pop' normal
      router.replace('/registros'); 
      return true; // Esto le dice a React Native: "Yo me encargo, no hagas la acción por defecto"
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);
  
  const aplicarPreset = (dias: number) => {
    setFechaInicio(haceDiasLocal(dias - 1));
    setFechaFin(fechaLocalISO());
  };

  const handleCalcular = useCallback(async () => {
    const rango = validarRangoFechas(fechaInicio, fechaFin);
    if (!rango.ok) {
      Alert.alert('Fechas inválidas', rango.mensaje);
      return;
    }

    try {
      setCalculando(true);
      setCalculado(false);

      const finca = await obtenerFincaActiva();
      if (!finca) {
        Alert.alert('Sin finca activa', 'Activa una finca en Inicio primero.');
        setRanking([]);
        return;
      }
      setFincaNombre(finca.nombre);

      const condiciones = [
        eq(animales.fincaId, finca.id),
        gte(pesajes.fechaPesaje, fechaInicio),
        lte(pesajes.fechaPesaje, fechaFin),
      ];

      if (soloActivos) condiciones.push(eq(animales.estado, 'Activo'));
      if (soloCarne) {
        condiciones.push(inArray(animales.proposito, ['Carne', 'Doble_Proposito']));
      }
      if (soloHembras) condiciones.push(eq(animales.sexo, 'F'));

      const filtro = and(...condiciones);

      const rows = await db
        .select({
          animalId: animales.id,
          areteCodigo: animales.areteCodigo,
          nombre: animales.nombre,
          pesoMaximo: sql<string>`max(${pesajes.peso})`.mapWith(String),
          pesoPromedio: sql<string>`avg(${pesajes.peso})`.mapWith(String),
          pesadas: sql<number>`count(*)`.mapWith(Number),
        })
        .from(pesajes)
        .innerJoin(animales, eq(pesajes.animalId, animales.id))
        .where(filtro)
        .groupBy(animales.id, animales.areteCodigo, animales.nombre);

      const lista: RankingRow[] = rows
        .map((r) => {
          const maximo = parseFloat(r.pesoMaximo) || 0;
          const promedio = parseFloat(r.pesoPromedio) || 0;
          const pesadas = r.pesadas || 0;
          return {
            animalId: r.animalId,
            areteCodigo: r.areteCodigo,
            nombre: r.nombre,
            pesoMaximo: maximo,
            pesoPromedio: promedio,
            pesadas,
          };
        })
        .filter((r) => r.pesadas > 0);

      lista.sort((a, b) => {
        if (criterio === 'pesoMaximo') return b.pesoMaximo - a.pesoMaximo;
        if (criterio === 'pesadas') return b.pesadas - a.pesadas;
        return b.pesoPromedio - a.pesoPromedio;
      });

      setRanking(lista);
      setCalculado(true);
    } catch (e) {
      console.error('Error calculando ranking de peso:', e);
      Alert.alert('Error', 'No se pudo calcular el ranking.');
    } finally {
      setCalculando(false);
    }
  }, [fechaInicio, fechaFin, soloActivos, soloCarne, soloHembras, criterio]);

  const etiquetaCriterio =
    criterio === 'pesoMaximo'
      ? 'Peso Máximo'
      : criterio === 'pesadas'
        ? 'Nº Pesadas'
        : 'Peso Promedio';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/registros')}>          
        <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Ranking de Peso</Text>
          <Text style={styles.headerSubtitle}>{fincaNombre || 'Evolución de peso'}</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <View style={styles.card}>
        <Text style={styles.formTitle}>Período</Text>
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetChip} onPress={() => aplicarPreset(30)}>
            <Text style={styles.presetText}>30 días</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => aplicarPreset(90)}>
            <Text style={styles.presetText}>90 días</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => aplicarPreset(180)}>
            <Text style={styles.presetText}>6 meses</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Fecha inicio</Text>
        <TextInput
          style={styles.input}
          value={fechaInicio}
          onChangeText={setFechaInicio}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
        />
        <Text style={styles.label}>Fecha fin</Text>
        <TextInput
          style={styles.input}
          value={fechaFin}
          onChangeText={setFechaFin}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>Ordenar por</Text>
        <View style={styles.presetRow}>
          {(
            [
              ['pesoMaximo', 'Peso Máx'],
              ['pesoPromedio', 'Promedio'],
              ['pesadas', 'Pesadas'],
            ] as const
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.presetChip, criterio === key && styles.presetChipActive]}
              onPress={() => setCriterio(key)}
            >
              <Text style={[styles.presetText, criterio === key && styles.presetTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Filtros</Text>
        <FiltroToggle label="Solo activos" value={soloActivos} onToggle={() => setSoloActivos((v) => !v)} />
        <FiltroToggle label="Solo propósito carne / doble" value={soloCarne} onToggle={() => setSoloCarne((v) => !v)} />
        <FiltroToggle label="Solo hembras" value={soloHembras} onToggle={() => setSoloHembras((v) => !v)} />

        <TouchableOpacity
          style={[styles.btnCalcular, calculando && styles.btnDisabled]}
          onPress={handleCalcular}
          disabled={calculando}
        >
          {calculando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Scale color="#fff" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.btnText}>Calcular ranking</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {calculado && (
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            {etiquetaCriterio} · {fechaInicio} → {fechaFin}
          </Text>
          {ranking.length === 0 ? (
            <Text style={styles.empty}>No hay registros de peso en este período con los filtros elegidos.</Text>
          ) : (
            ranking.map((row, index) => (
              <TouchableOpacity
                key={row.animalId}
                style={styles.rankCard}
                onPress={() =>
                  router.push({ pathname: '/historial-pesajes', params: { arete: row.areteCodigo } })
                }
              >
                <View style={styles.rankLeft}>
                  <View style={[styles.rankBadge, index < 3 && styles.rankBadgeTop]}>
                    {index < 3 ? (
                      <Medal color={index === 0 ? '#ca8a04' : '#94a3b8'} size={18} />
                    ) : (
                      <Text style={styles.rankNum}>{index + 1}</Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.rankArete}>#{row.areteCodigo}</Text>
                    <Text style={styles.rankNombre}>{row.nombre || 'Sin nombre'}</Text>
                    <Text style={styles.rankMeta}>
                      Máx: {row.pesoMaximo.toFixed(1)} kg · {row.pesadas} pesadas
                    </Text>
                  </View>
                </View>
                <View style={styles.rankRight}>
                  <Text style={styles.rankValor}>
                    {criterio === 'pesoMaximo'
                      ? row.pesoMaximo.toFixed(1)
                      : criterio === 'pesadas'
                        ? row.pesadas
                        : row.pesoPromedio.toFixed(1)}
                  </Text>
                  <Text style={styles.rankUnidad}>
                    {criterio === 'pesadas' ? 'reg' : 'kg'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function FiltroToggle({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={styles.filtroRow} onPress={onToggle}>
      <View style={[styles.checkbox, value && styles.checkboxOn]} />
      <Text style={styles.filtroLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingBottom: 100 },
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
  headerText: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#065f46', fontWeight: '600', marginTop: 2 },
  spacer: { width: 40 },
  card: {
    margin: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  presetText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  presetTextActive: { color: '#fff' },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 12,
    color: '#1e293b',
  },
  filtroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    marginRight: 10,
  },
  checkboxOn: { backgroundColor: '#065f46', borderColor: '#065f46' },
  filtroLabel: { fontSize: 14, color: '#334155' },
  btnCalcular: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#065f46',
    height: 48,
    borderRadius: 14,
    marginTop: 8,
  },
  btnDisabled: { backgroundColor: '#a7f3d0' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  listSection: { paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 16 },
  rankCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  rankLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankBadgeTop: { backgroundColor: '#fef9c3' },
  rankNum: { fontWeight: '800', color: '#64748b' },
  rankArete: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  rankNombre: { fontSize: 12, color: '#64748b' },
  rankMeta: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  rankRight: { alignItems: 'flex-end' },
  rankValor: { fontSize: 20, fontWeight: '800', color: '#065f46' },
  rankUnidad: { fontSize: 10, color: '#64748b', fontWeight: '600' },
});