import { eq } from 'drizzle-orm';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, Search } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../db/client';
import { obtenerFincaActiva } from '../db/fincaActiva';
import { animales, pesajes } from '../db/schema';

type RegistroPesaje = {
  id: string | number;
  fechaPesaje: string;
  peso: number;
  condicionCorporal: number | null;
  areteCodigo: string;
  animalId: string;
  cambioPorcentaje?: number;
};

type AnimalAgrupado = {
  areteCodigo: string;
  registros: RegistroPesaje[];
};

export default function HistorialPesajesScreen() {
  const { arete } = useLocalSearchParams<{ arete?: string }>();
  const [dataAgrupada, setDataAgrupada] = useState<AnimalAgrupado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [fincaNombre, setFincaNombre] = useState('');
  const [editando, setEditando] = useState<RegistroPesaje | null>(null);
  const [pesoEdit, setPesoEdit] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const fincaActiva = await obtenerFincaActiva();
      if (!fincaActiva) {
        setFincaNombre('Sin finca activa');
        setDataAgrupada([]);
        return;
      }
      setFincaNombre(fincaActiva.nombre);

      const pesajesData = await db
        .select({
          id: pesajes.id,
          fechaPesaje: pesajes.fechaPesaje,
          peso: pesajes.peso,
          condicionCorporal: pesajes.condicionCorporal,
          areteCodigo: animales.areteCodigo,
          animalId: animales.id
        })
        .from(pesajes)
        .innerJoin(animales, eq(pesajes.animalId, animales.id))
        .where(eq(animales.fincaId, fincaActiva.id));

      const animalesData = await db
        .select()
        .from(animales)
        .where(eq(animales.fincaId, fincaActiva.id));
      
      const pesosIniciales: RegistroPesaje[] = animalesData
        .filter(a => a.pesoInicial && a.pesoInicial > 0)
        .map(a => ({
          id: `init-${a.id}`,
          fechaPesaje: a.fechaNacimiento || 'N/A',
          peso: a.pesoInicial || 0,
          condicionCorporal: null,
          areteCodigo: a.areteCodigo,
          animalId: a.id
        }));

      const historialCompleto = [...pesosIniciales, ...pesajesData];

      const grupos = historialCompleto.reduce((acc, reg) => {
        if (!acc[reg.areteCodigo]) acc[reg.areteCodigo] = [];
        acc[reg.areteCodigo].push(reg);
        return acc;
      }, {} as Record<string, RegistroPesaje[]>);

      const listaFormateada = Object.entries(grupos).map(([arete, regs]) => {
        const ordenados = [...regs].sort((a, b) => new Date(a.fechaPesaje).getTime() - new Date(b.fechaPesaje).getTime());
        
        const conCalculo = ordenados.map((reg, index) => {
          if (index === 0) return { ...reg, cambioPorcentaje: 0 };
          const anterior = ordenados[index - 1];
          const porcentaje = ((reg.peso - anterior.peso) / anterior.peso) * 100;
          return { ...reg, cambioPorcentaje: porcentaje };
        });

        return {
          areteCodigo: arete,
          registros: conCalculo.reverse()
        };
      });

      setDataAgrupada(listaFormateada);
    } catch (e) { console.error(e); } finally { setCargando(false); }
  }, []);

  useEffect(() => {
    if (typeof arete === 'string' && arete.trim()) {
      setBusqueda(arete.trim());
      setExpandidos({ [arete.trim().toUpperCase()]: true });
    }
    cargarDatos();
  }, [cargarDatos, arete]);

  const toggleExpand = (arete: string) => {
    setExpandidos(prev => ({ ...prev, [arete]: !prev[arete] }));
  };

  const esPesajeReal = (reg: RegistroPesaje) => !reg.id.toString().startsWith('init-');

  const abrirAccionesPesaje = (reg: RegistroPesaje) => {
    if (!esPesajeReal(reg)) return;
    Alert.alert(`Pesaje ${reg.fechaPesaje}`, `${reg.peso} kg`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Editar peso',
        onPress: () => {
          setEditando(reg);
          setPesoEdit(String(reg.peso));
        },
      },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Eliminar', '¿Borrar este pesaje?', [
            { text: 'No', style: 'cancel' },
            {
              text: 'Sí',
              style: 'destructive',
              onPress: async () => {
                await db.delete(pesajes).where(eq(pesajes.id, String(reg.id)));
                cargarDatos();
              },
            },
          ]);
        },
      },
    ]);
  };

  const guardarPeso = async () => {
    if (!editando || !esPesajeReal(editando)) return;
    const peso = parseFloat(pesoEdit.replace(',', '.'));
    if (Number.isNaN(peso) || peso <= 0) {
      Alert.alert('Dato inválido', 'Peso debe ser mayor a 0.');
      return;
    }
    try {
      setGuardando(true);
      await db.update(pesajes).set({ peso }).where(eq(pesajes.id, String(editando.id)));
      setEditando(null);
      await cargarDatos();
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar.');
    } finally {
      setGuardando(false);
    }
  };

  const renderAnimal = ({ item }: { item: AnimalAgrupado }) => (
    <View style={styles.grupoContainer}>
      <TouchableOpacity style={styles.headerGrupo} onPress={() => toggleExpand(item.areteCodigo)}>
        <Text style={styles.tituloGrupo}>Arete: {item.areteCodigo}</Text>
        {expandidos[item.areteCodigo] ? <ChevronUp color="#475569" /> : <ChevronDown color="#475569" />}
      </TouchableOpacity>

      {expandidos[item.areteCodigo] && item.registros.map((reg) => (
        <TouchableOpacity
          key={reg.id}
          style={[styles.card, reg.id.toString().startsWith('init-') && styles.cardInicial]}
          onLongPress={() => abrirAccionesPesaje(reg)}
          delayLongPress={400}
          disabled={!esPesajeReal(reg)}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.fecha}>{reg.fechaPesaje}</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.peso}>{reg.peso} kg</Text>
            
            {reg.cambioPorcentaje !== 0 && (
              <Text style={[styles.cambio, { color: reg.cambioPorcentaje! > 0 ? '#16a34a' : '#dc2626' }]}>
                {reg.cambioPorcentaje! > 0 ? '▲' : '▼'} {Math.abs(reg.cambioPorcentaje!).toFixed(1)}%
              </Text>
            )}

            <Text style={styles.condicion}>C.C: {reg.condicionCorporal || '-'}</Text>
          </View>
          {esPesajeReal(reg) && (
            <Text style={styles.hint}>Mantén presionado para editar o eliminar</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const datosFiltrados = dataAgrupada.filter(g => 
    g.areteCodigo.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: fincaNombre ? `Pesajes · ${fincaNombre}` : 'Historial por Animal', headerStyle: { backgroundColor: '#065f46' }, headerTintColor: '#ffffff' }} />
      
      {/* Buscador en la parte superior */}
      <View style={styles.searchContainer}>
        <Search color="#94a3b8" size={20} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por arete..."
          value={busqueda}
          onChangeText={setBusqueda}
          placeholderTextColor="#94a3b8"
        />
      </View>

      {cargando ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#065f46" />
      ) : (
        <FlatList
          data={datosFiltrados}
          renderItem={renderAnimal}
          keyExtractor={item => item.areteCodigo}
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      <Modal visible={editando !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar peso (kg)</Text>
            <TextInput
              style={styles.modalInput}
              value={pesoEdit}
              onChangeText={setPesoEdit}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setEditando(null)}>
                <Text>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnSave}
                onPress={guardarPeso}
                disabled={guardando}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', margin: 16, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: '#1e293b' },
  grupoContainer: { marginBottom: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  headerGrupo: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#f1f5f9' },
  tituloGrupo: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  card: { padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  cardInicial: { backgroundColor: '#f0fdf4' },
  cardHeader: { marginBottom: 4 },
  fecha: { fontSize: 12, color: '#64748b' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  peso: { fontSize: 16, fontWeight: '700', color: '#d97706' },
  cambio: { fontSize: 12, fontWeight: '700' },
  condicion: { fontSize: 14, color: '#475569' },
  hint: { fontSize: 10, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnSave: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#065f46',
    justifyContent: 'center',
    alignItems: 'center',
  },
});