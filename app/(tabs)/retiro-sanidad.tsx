import { useFocusEffect, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { ArrowLeft, AlertTriangle } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { animales, historialMedico } from '../../db/schema';
import { fechaLocalISO, sumarDiasLocal } from '../../utils/fecha';

type RetiroRow = {
  areteCodigo: string;
  medicamento: string;
  fechaAplicacion: string;
  finRetiroLeche: string | null;
  finRetiroCarne: string | null;
  tipo: 'leche' | 'carne' | 'ambos';
};

export default function RetiroSanidadScreen() {
  const router = useRouter();
  const [lista, setLista] = useState<RetiroRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const hoy = fechaLocalISO();

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const finca = await obtenerFincaActiva();
      if (!finca) {
        setLista([]);
        return;
      }

      const registros = await db
        .select({
          areteCodigo: animales.areteCodigo,
          medicamento: historialMedico.medicamento,
          fechaAplicacion: historialMedico.fechaAplicacion,
          diasLeche: historialMedico.diasRetiroLeche,
          diasCarne: historialMedico.diasRetiroCarne,
        })
        .from(historialMedico)
        .innerJoin(animales, eq(historialMedico.animalId, animales.id))
        .where(eq(animales.fincaId, finca.id));

      const activos: RetiroRow[] = [];
      for (const r of registros) {
        const finLeche =
          r.diasLeche > 0 ? sumarDiasLocal(r.fechaAplicacion, r.diasLeche) : null;
        const finCarne =
          r.diasCarne > 0 ? sumarDiasLocal(r.fechaAplicacion, r.diasCarne) : null;
        const enLeche = finLeche !== null && finLeche >= hoy;
        const enCarne = finCarne !== null && finCarne >= hoy;
        if (!enLeche && !enCarne) continue;

        activos.push({
          areteCodigo: r.areteCodigo,
          medicamento: r.medicamento,
          fechaAplicacion: r.fechaAplicacion,
          finRetiroLeche: enLeche ? finLeche : null,
          finRetiroCarne: enCarne ? finCarne : null,
          tipo: enLeche && enCarne ? 'ambos' : enLeche ? 'leche' : 'carne',
        });
      }

      activos.sort((a, b) => {
        const fa = a.finRetiroLeche || a.finRetiroCarne || '';
        const fb = b.finRetiroLeche || b.finRetiroCarne || '';
        return fb.localeCompare(fa);
      });

      setLista(activos);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, [hoy]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Animales en retiro</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.banner}>
        Animales que no deben ordeñarse o sacrificarse hasta la fecha indicada (hoy: {hoy}).
      </Text>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#dc2626" />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(item, i) => `${item.areteCodigo}-${i}`}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No hay animales en período de retiro activo.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <AlertTriangle color="#dc2626" size={20} />
                <Text style={styles.arete}>#{item.areteCodigo}</Text>
              </View>
              <Text style={styles.med}>{item.medicamento}</Text>
              <Text style={styles.fecha}>Aplicado: {item.fechaAplicacion}</Text>
              {item.finRetiroLeche && (
                <Text style={styles.retiro}>🥛 Leche hasta: {item.finRetiroLeche}</Text>
              )}
              {item.finRetiroCarne && (
                <Text style={styles.retiro}>🥩 Carne hasta: {item.finRetiroCarne}</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
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
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  banner: {
    margin: 16,
    marginBottom: 0,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    color: '#991b1b',
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arete: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  med: { marginTop: 8, fontWeight: '600', color: '#475569' },
  fecha: { fontSize: 12, color: '#64748b', marginTop: 4 },
  retiro: { fontSize: 13, color: '#dc2626', fontWeight: '700', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
});
