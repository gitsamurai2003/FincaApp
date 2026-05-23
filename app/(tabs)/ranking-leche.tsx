import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import { ArrowLeft, Medal, Milk } from 'lucide-react-native';
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
import { animales, produccionLeche } from '../../db/schema';
import { fechaLocalISO, haceDiasLocal, validarRangoFechas } from '../../utils/fecha';

type RankingRow = {
  animalId: string;
  areteCodigo: string;
  nombre: string | null;
  totalLitros: number;
  diasOrdeño: number;
  pesadas: number;
  promedioDia: number;
  promedioPesada: number;
};

type CriterioOrden = 'promedioDia' | 'totalLitros' | 'promedioPesada';

export default function RankingLecheScreen() {
  const router = useRouter();
  const [fincaNombre, setFincaNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState(haceDiasLocal(6));
  const [fechaFin, setFechaFin] = useState(fechaLocalISO());
  const [soloActivos, setSoloActivos] = useState(true);
  const [soloLeche, setSoloLeche] = useState(true);
  
  // ARREGLO 1: Por defecto en true. Al ser un ranking lechero, el foco son las hembras.
  const [soloHembras, setSoloHembras] = useState(true); 
  
  const [criterio, setCriterio] = useState<CriterioOrden>('promedioDia');
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
        gte(produccionLeche.fecha, fechaInicio),
        lte(produccionLeche.fecha, fechaFin),
      ];

      if (soloActivos) condiciones.push(eq(animales.estado, 'Activo'));
      if (soloLeche) {
        condiciones.push(inArray(animales.proposito, ['Leche', 'Doble_Proposito']));
      }
      if (soloHembras) condiciones.push(eq(animales.sexo, 'F'));

      const filtro = and(...condiciones);

      // ARREGLO 2: Mapeo explícito con .mapWith() para curar los retornos de SQLite en Expo
      const rows = await db
        .select({
          animalId: animales.id,
          areteCodigo: animales.areteCodigo,
          nombre: animales.nombre,
          totalLitros: sql<string>`sum(${produccionLeche.litros})`.mapWith(String),
          diasOrdeño: sql<number>`count(distinct ${produccionLeche.fecha})`.mapWith(Number),
          pesadas: sql<number>`count(*)`.mapWith(Number),
        })
        .from(produccionLeche)
        .innerJoin(animales, eq(produccionLeche.animalId, animales.id))
        .where(filtro)
        .groupBy(animales.id, animales.areteCodigo, animales.nombre);

      const lista: RankingRow[] = rows
        .map((r) => {
          const total = parseFloat(r.totalLitros) || 0;
          const dias = r.diasOrdeño || 0;
          const pesadas = r.pesadas || 0;
          return {
            animalId: r.animalId,
            areteCodigo: r.areteCodigo,
            nombre: r.nombre,
            totalLitros: total,
            diasOrdeño: dias,
            pesadas,
            promedioDia: dias > 0 ? total / dias : 0,
            promedioPesada: pesadas > 0 ? total / pesadas : 0,
          };
        })
        .filter((r) => r.pesadas > 0);

      lista.sort((a, b) => {
        if (criterio === 'totalLitros') return b.totalLitros - a.totalLitros;
        if (criterio === 'promedioPesada') return b.promedioPesada - a.promedioPesada;
        return b.promedioDia - a.promedioDia;
      });

      setRanking(lista);
      setCalculado(true);
    } catch (e) {
      console.error('Error calculando ranking:', e);
      Alert.alert('Error', 'No se pudo calcular el ranking.');
    } finally {
      setCalculando(false);
    }
  }, [fechaInicio, fechaFin, soloActivos, soloLeche, soloHembras, criterio]);

  const etiquetaCriterio =
    criterio === 'totalLitros'
      ? 'Total litros'
      : criterio === 'promedioPesada'
        ? 'Promedio L/pesada'
        : 'Promedio L/día';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/registros')}>          
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Ranking Lechero</Text>
          <Text style={styles.headerSubtitle}>{fincaNombre || 'Promedio de producción'}</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <View style={styles.card}>
        <Text style={styles.formTitle}>Período</Text>
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetChip} onPress={() => aplicarPreset(7)}>
            <Text style={styles.presetText}>7 días</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => aplicarPreset(14)}>
            <Text style={styles.presetText}>14 días</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => aplicarPreset(30)}>
            <Text style={styles.presetText}>30 días</Text>
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
              ['promedioDia', 'L/día'],
              ['promedioPesada', 'L/pesada'],
              ['totalLitros', 'Total L'],
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
        <FiltroToggle label="Solo propósito leche / doble" value={soloLeche} onToggle={() => setSoloLeche((v) => !v)} />
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
              <Milk color="#fff" size={20} style={{ marginRight: 8 }} />
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
            <Text style={styles.empty}>No hay producción de leche en este período con los filtros elegidos.</Text>
          ) : (
            ranking.map((row, index) => (
              <TouchableOpacity
                key={row.animalId}
                style={styles.rankCard}
                onPress={() =>
                  router.push({ pathname: '/historial-leche', params: { arete: row.areteCodigo } })
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
                      {row.totalLitros.toFixed(1)} L total · {row.diasOrdeño} días · {row.pesadas} pesadas
                    </Text>
                  </View>
                </View>
                <View style={styles.rankRight}>
                  <Text style={styles.rankValor}>
                    {criterio === 'totalLitros'
                      ? row.totalLitros.toFixed(1)
                      : criterio === 'promedioPesada'
                        ? row.promedioPesada.toFixed(2)
                        : row.promedioDia.toFixed(2)}
                  </Text>
                  <Text style={styles.rankUnidad}>
                    {criterio === 'totalLitros' ? 'litros' : 'L'}
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