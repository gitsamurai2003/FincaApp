import { eq } from 'drizzle-orm';
import * as Print from 'expo-print';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ChevronDown, ChevronUp, FileText, Filter, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../db/client';
import { obtenerFincaActiva } from '../db/fincaActiva';
import { animales, especies, lotes, pesajes, razas } from '../db/schema';

type RegistroPesaje = {
  id: string | number;
  fechaPesaje: string;
  peso: number;
  condicionCorporal: number | null;
  areteCodigo: string;
  animalId: string;
  cambioPorcentaje?: number;
  especieId: number;
  razaId: number;
  loteId: string | null;
  categoria: string;
  estado: string;
};

type AnimalAgrupado = {
  areteCodigo: string;
  registros: RegistroPesaje[];
  especieId: number;
  razaId: number;
  loteId: string | null;
  categoria: string;
  estado: string;
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

  const [modalFiltrosVisible, setModalFiltrosVisible] = useState(false);
  const [listaEspecies, setListaEspecies] = useState<{ id: number; nombre: string }[]>([]);
  const [listaRazas, setListaRazas] = useState<{ id: number; nombre: string; especieId: number }[]>([]);
  const [listaLotes, setListaLotes] = useState<{ id: string; nombre: string }[]>([]);

  const [filtroEspecie, setFiltroEspecie] = useState<number | null>(null);
  const [filtroRaza, setFiltroRaza] = useState<number | null>(null);
  const [filtroLote, setFiltroLote] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string | null>('Activo');

  const cargarCatalogos = async () => {
    try {
      const esp = await db.select().from(especies);
      const raz = await db.select().from(razas);
      setListaEspecies(esp);
      setListaRazas(raz);
    } catch (e) {
      console.error(e);
    }
  };

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

      const lotesFinca = await db.select().from(lotes).where(eq(lotes.fincaId, fincaActiva.id));
      setListaLotes(lotesFinca);

      const pesajesData = await db
        .select({
          id: pesajes.id,
          fechaPesaje: pesajes.fechaPesaje,
          peso: pesajes.peso,
          condicionCorporal: pesajes.condicionCorporal,
          areteCodigo: animales.areteCodigo,
          animalId: animales.id,
          especieId: animales.especieId,
          razaId: animales.razaId,
          loteId: animales.loteId,
          categoria: animales.categoria,
          estado: animales.estado,
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
          animalId: a.id,
          especieId: a.especieId,
          razaId: a.razaId,
          loteId: a.loteId,
          categoria: a.categoria,
          estado: a.estado,
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

        const metaAnimal = regs[0];

        return {
          areteCodigo: arete,
          especieId: metaAnimal.especieId,
          razaId: metaAnimal.razaId,
          loteId: metaAnimal.loteId,
          categoria: metaAnimal.categoria,
          estado: metaAnimal.estado,
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
    cargarCatalogos();
    cargarDatos();
  }, [cargarDatos, arete]);

  const toggleExpand = (arete: string) => {
    setExpandidos(prev => ({ ...prev, [arete]: !prev[arete] }));
  };

  const esPesajeReal = (reg: RegistroPesaje) => !reg.id.toString().startsWith('init-');

  const esEditablePorFecha = (fechaStr: string) => {
    try {
      const fechaRegistro = new Date(fechaStr);
      if (isNaN(fechaRegistro.getTime())) return false;
      const hoy = new Date();
      const diferenciaTiempo = hoy.getTime() - fechaRegistro.getTime();
      const diferenciaDias = diferenciaTiempo / (1000 * 60 * 60 * 24);
      return diferenciaDias <= 7;
    } catch (e) {
      return false;
    }
  };

  const abrirAccionesPesaje = (reg: RegistroPesaje) => {
    if (!esPesajeReal(reg)) return;

    if (!esEditablePorFecha(reg.fechaPesaje)) {
      Alert.alert(
        'Registro antiguo', 
        'Los pesajes con más de una semana de antigüedad están bloqueados y no pueden ser modificados.'
      );
      return;
    }

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

  const limpiarFiltros = () => {
    setFiltroEspecie(null);
    setFiltroRaza(null);
    setFiltroLote(null);
    setFiltroEstado('Activo');
  };

  const datosFiltrados = dataAgrupada.filter(g => {
    const coincideBusqueda = g.areteCodigo.toLowerCase().includes(busqueda.toLowerCase());
    const coincideEspecie = filtroEspecie ? g.especieId === filtroEspecie : true;
    const coincideRaza = filtroRaza ? g.razaId === filtroRaza : true;
    const coincideLote = filtroLote ? g.loteId === filtroLote : true;
    const coincideEstado = filtroEstado === 'Todos' ? true : g.estado === filtroEstado;

    return coincideBusqueda && coincideEspecie && coincideRaza && coincideLote && coincideEstado;
  });

  const exportarPDF = async () => {
    if (datosFiltrados.length === 0) {
      Alert.alert('Sin datos', 'No hay registros para exportar con los filtros seleccionados.');
      return;
    }

    try {
      const nombreEspecie = filtroEspecie ? listaEspecies.find(e => e.id === filtroEspecie)?.nombre : 'Todas';
      const nombreRaza = filtroRaza ? listaRazas.find(r => r.id === filtroRaza)?.nombre : 'Todas';
      const nombreLote = filtroLote ? listaLotes.find(l => l.id === filtroLote)?.nombre : 'Todos';

      let html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 24px; }
              .header { border-bottom: 2px solid #065f46; padding-bottom: 12px; margin-bottom: 20px; }
              .title { font-size: 22px; font-weight: bold; color: #065f46; margin: 0; }
              .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
              .filter-box { background-color: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 24px; font-size: 11px; color: #475569; border: 1px solid #e2e8f0; }
              .animal-block { margin-bottom: 28px; page-break-inside: avoid; }
              .animal-info { background-color: #f1f5f9; padding: 10px 14px; border-radius: 6px; font-weight: bold; font-size: 13px; color: #0f172a; border-left: 5px solid #065f46; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
              th { background-color: #f8fafc; text-align: left; padding: 8px 10px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0; }
              td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
              .peso-text { font-weight: bold; color: #b45309; }
              .up { color: #16a34a; font-weight: bold; }
              .down { color: #dc2626; font-weight: bold; }
              .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Historial de Pesajes Ganaderos</div>
              <div class="subtitle">Finca: ${fincaNombre || 'N/A'} &bull; Fecha de Emisión: ${new Date().toLocaleDateString()}</div>
            </div>
            
            <div class="filter-box">
              <strong>Criterios de filtrado aplicados:</strong><br/>
              Búsqueda: ${busqueda || 'Ninguna'} &bull; Estado: ${filtroEstado} &bull; Especie: ${nombreEspecie} &bull; Raza: ${nombreRaza} &bull; Lote: ${nombreLote}
            </div>
      `;

      datosFiltrados.forEach(animal => {
        const razaTxt = listaRazas.find(r => r.id === animal.razaId)?.nombre || 'S/R';
        html += `
          <div class="animal-block">
            <div class="animal-info">
              Arete: ${animal.areteCodigo} &nbsp;|&nbsp; Categoría: ${animal.categoria} &nbsp;|&nbsp; Raza: ${razaTxt}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Fecha Pesaje</th>
                  <th>Peso</th>
                  <th>Variación</th>
                  <th>Condición Corporal</th>
                </tr>
              </thead>
              <tbody>
        `;

        animal.registros.forEach(reg => {
          const esInit = reg.id.toString().startsWith('init-');
          const cambioTxt = reg.cambioPorcentaje && reg.cambioPorcentaje !== 0
            ? `<span class="${reg.cambioPorcentaje > 0 ? 'up' : 'down'}">${reg.cambioPorcentaje > 0 ? '▲' : '▼'} ${Math.abs(reg.cambioPorcentaje).toFixed(1)}%</span>`
            : '-';

          html += `
            <tr>
              <td>${reg.fechaPesaje} ${esInit ? '(Inicial)' : ''}</td>
              <td class="peso-text">${reg.peso} kg</td>
              <td>${cambioTxt}</td>
              <td>${reg.condicionCorporal || '-'}</td>
            </tr>
          `;
        });

        html += `
              </tbody>
            </table>
          </div>
        `;
      });

      html += `
            <div class="footer">Reporte generado de forma digital desde el Historial de Pesajes.</div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Exportar Pesajes', UTI: 'com.adobe.pdf' });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo generar ni compartir el archivo PDF.');
    }
  };

  const renderAnimal = ({ item }: { item: AnimalAgrupado }) => (
    <View style={styles.grupoContainer}>
      <TouchableOpacity style={styles.headerGrupo} onPress={() => toggleExpand(item.areteCodigo)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tituloGrupo}>Arete: {item.areteCodigo}</Text>
          <Text style={styles.subtituloGrupo}>
            {item.categoria} · {listaRazas.find(r => r.id === item.razaId)?.nombre || 'S/R'}
          </Text>
        </View>
        {expandidos[item.areteCodigo] ? <ChevronUp color="#475569" /> : <ChevronDown color="#475569" />}
      </TouchableOpacity>

      {expandidos[item.areteCodigo] && item.registros.map((reg) => {
        const editable = esPesajeReal(reg) && esEditablePorFecha(reg.fechaPesaje);

        return (
          <TouchableOpacity
            key={reg.id}
            style={[styles.card, reg.id.toString().startsWith('init-') && styles.cardInicial]}
            onLongPress={() => abrirAccionesPesaje(reg)}
            delayLongPress={400}
            disabled={!esPesajeReal(reg)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.fecha}>{reg.fechaPesaje} {reg.id.toString().startsWith('init-') && '(Peso Inicial)'}</Text>
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
            {editable ? (
              <Text style={styles.hint}>Mantén presionado para editar o eliminar</Text>
            ) : esPesajeReal(reg) ? (
              <Text style={[styles.hint, { color: '#cbd5e1' }]}>Historial bloqueado (más de 7 días)</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: fincaNombre ? `Pesajes · ${fincaNombre}` : 'Historial por Animal', headerStyle: { backgroundColor: '#065f46' }, headerTintColor: '#ffffff' }} />
      
      <View style={styles.topBar}>
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
        <TouchableOpacity
          style={[styles.filterBtn, (filtroEspecie !== null || filtroRaza !== null || filtroLote !== null || filtroEstado !== 'Activo') ? styles.filterBtnActive : null]}
          onPress={() => setModalFiltrosVisible(true)}
        >
          <Filter color={(filtroEspecie !== null || filtroRaza !== null || filtroLote !== null || filtroEstado !== 'Activo') ? '#fff' : '#475569'} size={22} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.pdfBtn} onPress={exportarPDF}>
          <FileText color="#fff" size={22} />
        </TouchableOpacity>
      </View>

      {(filtroEspecie || filtroRaza || filtroLote || filtroEstado !== 'Todos') && (
        <View style={styles.activeFiltersRow}>
          <Text style={styles.activeFiltersText}>Filtros activos</Text>
          <TouchableOpacity onPress={limpiarFiltros}>
            <Text style={styles.clearLink}>Limpiar</Text>
          </TouchableOpacity>
        </View>
      )}

      {cargando ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#065f46" />
      ) : (
        <FlatList
          data={datosFiltrados}
          renderItem={renderAnimal}
          keyExtractor={item => item.areteCodigo}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No se encontraron animales con los filtros seleccionados.</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalFiltrosVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalFiltrosCard}>
            <View style={styles.modalFiltrosHeader}>
              <Text style={styles.modalFiltrosTitle}>Filtrar Pesajes</Text>
              <TouchableOpacity onPress={() => setModalFiltrosVisible(false)}>
                <X color="#1e293b" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.labelFiltro}>Estado del Animal</Text>
              <View style={styles.selectorRow}>
                {['Activo', 'Vendido', 'Todos'].map((est) => (
                  <TouchableOpacity
                    key={est}
                    style={[styles.chip, filtroEstado === est && styles.chipSelected]}
                    onPress={() => setFiltroEstado(est)}
                  >
                    <Text style={[styles.chipText, filtroEstado === est && styles.chipTextSelected]}>{est}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.labelFiltro}>Especie</Text>
              <View style={styles.selectorRow}>
                <TouchableOpacity
                  style={[styles.chip, filtroEspecie === null && styles.chipSelected]}
                  onPress={() => { setFiltroEspecie(null); setFiltroRaza(null); }}
                >
                  <Text style={[styles.chipText, filtroEspecie === null && styles.chipTextSelected]}>Todas</Text>
                </TouchableOpacity>
                {listaEspecies.map((esp) => (
                  <TouchableOpacity
                    key={esp.id}
                    style={[styles.chip, filtroEspecie === esp.id && styles.chipSelected]}
                    onPress={() => { setFiltroEspecie(esp.id); setFiltroRaza(null); }}
                  >
                    <Text style={[styles.chipText, filtroEspecie === esp.id && styles.chipTextSelected]}>{esp.nombre}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.labelFiltro}>Raza</Text>
              <View style={styles.selectorRow}>
                <TouchableOpacity
                  style={[styles.chip, filtroRaza === null && styles.chipSelected]}
                  onPress={() => setFiltroRaza(null)}
                >
                  <Text style={[styles.chipText, filtroRaza === null && styles.chipTextSelected]}>Todas</Text>
                </TouchableOpacity>
                {listaRazas
                  .filter(r => filtroEspecie === null || r.especieId === filtroEspecie)
                  .map((raz) => (
                    <TouchableOpacity
                      key={raz.id}
                      style={[styles.chip, filtroRaza === raz.id && styles.chipSelected]}
                      onPress={() => setFiltroRaza(raz.id)}
                    >
                      <Text style={[styles.chipText, filtroRaza === raz.id && styles.chipTextSelected]}>{raz.nombre}</Text>
                    </TouchableOpacity>
                  ))}
              </View>

              <Text style={styles.labelFiltro}>Lote / Potrero</Text>
              <View style={styles.selectorRow}>
                <TouchableOpacity
                  style={[styles.chip, filtroLote === null && styles.chipSelected]}
                  onPress={() => setFiltroLote(null)}
                >
                  <Text style={[styles.chipText, filtroLote === null && styles.chipTextSelected]}>Todos</Text>
                </TouchableOpacity>
                {listaLotes.map((lot) => (
                  <TouchableOpacity
                    key={lot.id}
                    style={[styles.chip, filtroLote === lot.id && styles.chipSelected]}
                    onPress={() => setFiltroLote(lot.id)}
                  >
                    <Text style={[styles.chipText, filtroLote === lot.id && styles.chipTextSelected]}>{lot.nombre}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFiltrosActions}>
              <TouchableOpacity style={styles.btnLimpiarModal} onPress={limpiarFiltros}>
                <Text style={{ color: '#475569', fontWeight: '600' }}>Restablecer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAplicarModal} onPress={() => setModalFiltrosVisible(false)}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Aplicar Filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 12 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: '#1e293b' },
  filterBtn: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
  filterBtnActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  pdfBtn: { width: 44, height: 44, backgroundColor: '#065f46', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#065f46' },
  activeFiltersRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 8, alignItems: 'center' },
  activeFiltersText: { fontSize: 13, color: '#065f46', fontWeight: '600' },
  clearLink: { fontSize: 13, color: '#dc2626', fontWeight: '700' },
  grupoContainer: { marginBottom: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  headerGrupo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#f1f5f9' },
  tituloGrupo: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  subtituloGrupo: { fontSize: 12, color: '#64748b', marginTop: 2 },
  card: { padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  cardInicial: { backgroundColor: '#eef2ff' },
  cardHeader: { marginBottom: 4 },
  fecha: { fontSize: 12, color: '#64748b' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  peso: { fontSize: 16, fontWeight: '700', color: '#d97706' },
  cambio: { fontSize: 12, fontWeight: '700' },
  condicion: { fontSize: 14, color: '#475569' },
  hint: { fontSize: 10, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#64748b', textAlign: 'center', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, margin: 24 },
  modalFiltrosCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalFiltrosHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalFiltrosTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  labelFiltro: { fontSize: 14, fontWeight: '700', color: '#475569', marginTop: 12, marginBottom: 8 },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipSelected: { backgroundColor: '#e0e7ff', borderColor: '#065f46' },
  chipText: { fontSize: 13, color: '#475569' },
  chipTextSelected: { color: '#065f46', fontWeight: '700' },
  modalFiltrosActions: { flexDirection: 'row', gap: 12, marginTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  btnLimpiarModal: { flex: 1, height: 46, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  btnAplicarModal: { flex: 2, height: 46, borderRadius: 12, backgroundColor: '#065f46', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, height: 48, paddingHorizontal: 14, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  modalBtnSave: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#065f46', justifyContent: 'center', alignItems: 'center' },
});