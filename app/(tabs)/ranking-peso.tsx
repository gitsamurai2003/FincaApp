import { and, eq, gte, lte } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import { ArrowLeft, Medal, Scale } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
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
import { animales, pesajes } from '../../db/schema';
import { fechaLocalISO, haceDiasLocal, validarRangoFechas } from '../../utils/fecha';

type RankingPeso = {
  animalId: string;
  areteCodigo: string;
  pesoInicial: number;
  pesoFinal: number;
  dias: number;
  gdp: number;
};

export default function RankingPesoScreen() {
  const router = useRouter();
  const [fincaNombre, setFincaNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState(haceDiasLocal(89));
  const [fechaFin, setFechaFin] = useState(fechaLocalISO());
  const [ranking, setRanking] = useState<RankingPeso[]>([]);
  const [calculando, setCalculando] = useState(false);

  const handleCalcular = useCallback(async () => {
    const rango = validarRangoFechas(fechaInicio, fechaFin);
    if (!rango.ok) {
      Alert.alert('Fechas inválidas', rango.mensaje);
      return;
    }

    try {
      setCalculando(true);
      const finca = await obtenerFincaActiva();
      if (!finca) {
        Alert.alert('Sin finca activa', 'Activa una finca primero.');
        return;
      }
      setFincaNombre(finca.nombre);

      const rows = await db
        .select({
          animalId: animales.id,
          areteCodigo: animales.areteCodigo,
          fechaPesaje: pesajes.fechaPesaje,
          peso: pesajes.peso,
        })
        .from(pesajes)
        .innerJoin(animales, eq(pesajes.animalId, animales.id))
        .where(
          and(
            eq(animales.fincaId, finca.id),
            eq(animales.estado, 'Activo'),
            gte(pesajes.fechaPesaje, fechaInicio),
            lte(pesajes.fechaPesaje, fechaFin)
          )
        );

      // CORRECCIÓN AQUÍ: Se cambió el '} }' final por '} >'
      const porAnimal: Record<string, { arete: string; puntos: { fecha: string; peso: number }[] }> = {};

      for (const r of rows) {
        if (!porAnimal[r.animalId]) {
          porAnimal[r.animalId] = { arete: r.areteCodigo, puntos: [] };
        }
        porAnimal[r.animalId].puntos.push({ fecha: r.fechaPesaje, peso: r.peso });
      }

      const lista: RankingPeso[] = [];

      for (const [animalId, data] of Object.entries(porAnimal)) {
        if (data.puntos.length < 2) continue;
        const ordenados = [...data.puntos].sort((a, b) => a.fecha.localeCompare(b.fecha));
        const primero = ordenados[0];
        const ultimo = ordenados[ordenados.length - 1];
        const d1 = new Date(`${primero.fecha}T12:00:00`).getTime();
        const d2 = new Date(`${ultimo.fecha}T12:00:00`).getTime();
        const dias = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
        const gdp = (ultimo.peso - primero.peso) / dias;
        lista.push({
          animalId,
          areteCodigo: data.arete,
          pesoInicial: primero.peso,
          pesoFinal: ultimo.peso,
          dias,
          gdp,
        });
      }

      lista.sort((a, b) => b.gdp - a.gdp);
      setRanking(lista);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo calcular el ranking de peso.');
    } finally {
      setCalculando(false);
    }
  }, [fechaInicio, fechaFin]);
    
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Ranking de peso (GDP)</Text>
          <Text style={styles.sub}>{fincaNombre || 'Ganancia diaria de peso'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.hint}>Requiere al menos 2 pesajes por animal en el rango.</Text>
        <Text style={styles.label}>Fecha inicio</Text>
        <TextInput style={styles.input} value={fechaInicio} onChangeText={setFechaInicio} />
        <Text style={styles.label}>Fecha fin</Text>
        <TextInput style={styles.input} value={fechaFin} onChangeText={setFechaFin} />
        <TouchableOpacity style={styles.btn} onPress={handleCalcular} disabled={calculando}>
          {calculando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Scale color="#fff" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.btnText}>Calcular GDP</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {ranking.map((row, i) => (
        <TouchableOpacity
          key={row.animalId}
          style={styles.rankCard}
          onPress={() =>
            router.push({ pathname: '/historial-pesajes', params: { arete: row.areteCodigo } })
          }
        >
          <View style={styles.rankLeft}>
            <View style={[styles.badge, i < 3 && styles.badgeTop]}>
              {i < 3 ? <Medal color="#d97706" size={18} /> : <Text style={styles.num}>{i + 1}</Text>}
            </View>
            <View>
              <Text style={styles.arete}>#{row.areteCodigo}</Text>
              <Text style={styles.meta}>
                {row.pesoInicial.toFixed(0)} → {row.pesoFinal.toFixed(0)} kg en {row.dias} días
              </Text>
            </View>
          </View>
          <Text style={styles.gdp}>{row.gdp >= 0 ? '+' : ''}{row.gdp.toFixed(3)} kg/d</Text>
        </TouchableOpacity>
      ))}

      {ranking.length === 0 && !calculando && (
        <Text style={styles.empty}>Calcula para ver animales con ganancia de peso en el período.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 12, color: '#d97706', fontWeight: '600' },
  card: { margin: 16, padding: 20, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, height: 44, paddingHorizontal: 12, backgroundColor: '#f8fafc' },
  btn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#d97706',
    height: 48,
    borderRadius: 14,
    marginTop: 16,
  },
  btnText: { color: '#fff', fontWeight: '700' },
  rankCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  rankLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  badgeTop: { backgroundColor: '#fef3c7' },
  num: { fontWeight: '800', color: '#64748b' },
  arete: { fontWeight: '800', fontSize: 15 },
  meta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  gdp: { fontSize: 16, fontWeight: '800', color: '#d97706' },
  empty: { textAlign: 'center', margin: 24, color: '#94a3b8' },
});
