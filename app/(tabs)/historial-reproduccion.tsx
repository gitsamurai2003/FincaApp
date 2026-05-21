import { useFocusEffect, useRouter } from 'expo-router';
import { desc, eq } from 'drizzle-orm';
import { ArrowLeft, Plus } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { animales, eventosReproductivos } from '../../db/schema';

type EventoRow = {
  id: string;
  fechaEvento: string;
  tipoEvento: string;
  areteCodigo: string;
  resultadoPalpacion: string | null;
  fechaProbableParto: string | null;
};

export default function HistorialReproduccionScreen() {
  const router = useRouter();
  const [lista, setLista] = useState<EventoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fincaNombre, setFincaNombre] = useState('');

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const finca = await obtenerFincaActiva();
      if (!finca) {
        setLista([]);
        setFincaNombre('');
        return;
      }
      setFincaNombre(finca.nombre);
      const data = await db
        .select({
          id: eventosReproductivos.id,
          fechaEvento: eventosReproductivos.fechaEvento,
          tipoEvento: eventosReproductivos.tipoEvento,
          areteCodigo: animales.areteCodigo,
          resultadoPalpacion: eventosReproductivos.resultadoPalpacion,
          fechaProbableParto: eventosReproductivos.fechaProbableParto,
        })
        .from(eventosReproductivos)
        .innerJoin(animales, eq(eventosReproductivos.animalId, animales.id))
        .where(eq(animales.fincaId, finca.id))
        .orderBy(desc(eventosReproductivos.fechaEvento));
      setLista(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Reproducción</Text>
          <Text style={styles.sub}>{fincaNombre}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/registrar-reproduccion')}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#7c3aed" />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ListEmptyComponent={<Text style={styles.empty}>Sin eventos registrados.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.arete}>#{item.areteCodigo}</Text>
              <Text style={styles.tipo}>{item.tipoEvento.replace(/_/g, ' ')}</Text>
              <Text style={styles.fecha}>{item.fechaEvento}</Text>
              {item.resultadoPalpacion && (
                <Text style={styles.extra}>Palpación: {item.resultadoPalpacion}</Text>
              )}
              {item.fechaProbableParto && (
                <Text style={styles.extra}>Parto estimado: {item.fechaProbableParto}</Text>
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
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 12, color: '#7c3aed', fontWeight: '600' },
  addBtn: { backgroundColor: '#7c3aed', padding: 10, borderRadius: 12 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  arete: { fontWeight: '800', color: '#1e293b', fontSize: 15 },
  tipo: { color: '#7c3aed', fontWeight: '700', marginTop: 4 },
  fecha: { color: '#64748b', marginTop: 4 },
  extra: { fontSize: 12, color: '#475569', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
});
