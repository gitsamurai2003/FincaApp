import { and, desc, eq, gte, lte, SQL } from 'drizzle-orm';
import * as Print from 'expo-print';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { FileText, Filter, Plus, Search } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItem,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { turnoLecheLabel } from '../constants/turnoLeche';
import { db } from '../db/client';
import { obtenerFincaActiva } from '../db/fincaActiva';
import { animales, especies, produccionLeche, razas } from '../db/schema';
import { fechaLocalISO, haceDiasLocal } from '../utils/fecha';

type RegistroLeche = {
  id: string;
  fecha: string;
  litros: number;
  turno: string;
  areteCodigo: string;
  especie?: string | number | null;
  raza?: string | number | null;
};

export default function HistorialLecheScreen() {
  const router = useRouter();
  const { arete } = useLocalSearchParams<{ arete?: string }>();
  const [registros, setRegistros] = useState<RegistroLeche[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [fincaNombre, setFincaNombre] = useState('');
  
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(haceDiasLocal(30));
  const [fechaFin, setFechaFin] = useState(fechaLocalISO());
const [filtroEspecie, setFiltroEspecie] = useState<number | null>(null);
const [filtroRaza, setFiltroRaza] = useState<number | null>(null);
const [listaEspecies, setListaEspecies] = useState<{id: number, nombre: string}[]>([]);
const [listaRazas, setListaRazas] = useState<{id: number, especieId: number, nombre: string}[]>([]);
  const [filtroTurno, setFiltroTurno] = useState('');

  const [editando, setEditando] = useState<RegistroLeche | null>(null);
  const [litrosEdit, setLitrosEdit] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  const cargarCatalogos = async () => {
  const especiesData = await db.select().from(especies);
  const razasData = await db.select().from(razas);
  setListaEspecies(especiesData as any);
  setListaRazas(razasData as any);
};

  const cargarRegistros = useCallback(async () => {
    try {
      setCargando(true);
      const fincaActiva = await obtenerFincaActiva();
      if (!fincaActiva) {
        setFincaNombre('Sin finca activa');
        setRegistros([]);
        return;
      }
      setFincaNombre(fincaActiva.nombre);

      const condiciones: (SQL | undefined)[] = [
        eq(animales.fincaId, fincaActiva.id),
        fechaInicio ? gte(produccionLeche.fecha, fechaInicio) : undefined,
        fechaFin ? lte(produccionLeche.fecha, fechaFin) : undefined,
        filtroTurno ? eq(produccionLeche.turno, filtroTurno as any) : undefined,
        filtroEspecie ? eq(animales.especieId, filtroEspecie) : undefined,
        filtroRaza ? eq(animales.razaId, filtroRaza) : undefined,
      ];

      const data = await db
        .select({
          id: produccionLeche.id,
          fecha: produccionLeche.fecha,
          litros: produccionLeche.litros,
          turno: produccionLeche.turno,
          areteCodigo: animales.areteCodigo,
          especie: animales.especieId,
          raza: animales.razaId,
        })
        .from(produccionLeche)
        .innerJoin(animales, eq(produccionLeche.animalId, animales.id))
        .where(and(...condiciones.filter(Boolean) as SQL[]))
        .orderBy(desc(produccionLeche.fecha), desc(produccionLeche.id));

      setRegistros(data as RegistroLeche[]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron cargar las pesadas de leche.');
    } finally {
      setCargando(false);
    }
  }, [fechaInicio, fechaFin, filtroTurno, filtroEspecie, filtroRaza]);

useFocusEffect(
  useCallback(() => {
    // 1. Cargamos catálogos y registros al enfocar la pantalla
    cargarCatalogos(); 
    
    if (typeof arete === 'string' && arete.trim()) {
      setBusqueda(arete.trim());
    }
    
    cargarRegistros();
  }, [cargarRegistros, arete]) // Agrega cualquier dependencia necesaria aquí
);

  const registrosFiltrados = registros.filter((reg) =>
    reg.areteCodigo.toLowerCase().includes(busqueda.toLowerCase())
  );

  const handleExportarPDF = async () => {
    if (registrosFiltrados.length === 0) {
      Alert.alert('Sin registros', 'No hay datos en la lista actual para exportar al reporte.');
      return;
    }

    try {
      setExportandoPdf(true);

      const totalLitros = registrosFiltrados.reduce((acc, curr) => acc + curr.litros, 0);
      const promedioLitros = totalLitros / registrosFiltrados.length;

      const filasHtml = registrosFiltrados.map((item, index) => `
        <tr>
          <td style="text-align: center; color: #64748b;">${index + 1}</td>
          <td style="font-weight: bold;">#${item.areteCodigo}</td>
          <td>${item.fecha}</td>
          <td>${turnoLecheLabel(item.turno)}</td>
          <td>${item.especie || 'N/A'}</td>
          <td>${item.raza || 'N/A'}</td>
          <td style="text-align: right; font-weight: bold; color: #065f46;">${item.litros.toFixed(1)} L</td>
        </tr>
      `).join('');

      // 1. Buscamos el nombre real de la especie seleccionada
const especieSeleccionada = listaEspecies.find(e => e.id === filtroEspecie);
const nombreEspecie = especieSeleccionada ? especieSeleccionada.nombre : 'Todas';

// 2. Buscamos el nombre real de la raza seleccionada
const razaSeleccionada = listaRazas.find(r => r.id === filtroRaza);
const nombreRaza = razaSeleccionada ? razaSeleccionada.nombre : 'Todas';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; margin: 30px; font-size: 11px; }
            .header-table { width: 100%; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 22px; font-weight: bold; color: #1e293b; margin: 0; }
            .subtitle { font-size: 13px; color: #065f46; margin: 4px 0 0 0; font-weight: bold; }
            
            .filter-badge-container { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
            .filter-title { font-weight: bold; text-transform: uppercase; font-size: 9px; color: #64748b; margin-bottom: 6px; letter-spacing: 0.5px; }
            .filter-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
            
            .kpi-container { display: flex; gap: 15px; margin-bottom: 20px; }
            .kpi-card { flex: 1; background-color: #f1f5f9; border-radius: 8px; padding: 10px; text-align: center; border: 1px solid #cbd5e1; }
            .kpi-val { font-size: 16px; font-weight: bold; color: #065f46; }
            .kpi-lbl { font-size: 9px; color: #64748b; text-transform: uppercase; }

            table { width: 100%; border-collapse: collapse; }
            th { background-color: #065f46; color: white; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
            td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background-color: #f8fafc; }
            
            .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <h1 class="title">Historial de Producción Lechera</h1>
                <p class="subtitle">Finca: ${fincaNombre || 'Producción General'}</p>
              </td>
              <td style="text-align: right; font-size: 10px; color: #64748b;">
                Generado: ${new Date().toLocaleDateString()}<br>
                Registros: ${registrosFiltrados.length}
              </td>
            </tr>
          </table>

<div class="filter-badge-container">
      <div class="filter-title">Parámetros aplicados al reporte</div>
      <div class="filter-grid">
        <div><strong>Rango:</strong> ${fechaInicio} hasta ${fechaFin}</div>
        <div><strong>Turno:</strong> ${filtroTurno ? turnoLecheLabel(filtroTurno) : 'Todos'}</div>
        <div><strong>Filtro Especie:</strong> ${nombreEspecie}</div>
        <div><strong>Filtro Raza:</strong> ${nombreRaza}</div>
        ${busqueda ? `<div><strong>Búsqueda por Arete:</strong> "${busqueda}"</div>` : ''}
      </div>
    </div>

          <div class="kpi-container">
            <div class="kpi-card">
              <div class="kpi-val">${totalLitros.toFixed(1)} L</div>
              <div class="kpi-lbl">Volumen Total</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${registrosFiltrados.length}</div>
              <div class="kpi-lbl">Total Pesadas</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${promedioLitros.toFixed(2)} L</div>
              <div class="kpi-lbl">Promedio por Pesada</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 30px;">N°</th>
                <th>Arete</th>
                <th>Fecha</th>
                <th>Turno</th>
                <th>Especie</th>
                <th>Raza</th>
                <th style="text-align: right;">Litros</th>
              </tr>
            </thead>
            <tbody>
              ${filasHtml}
            </tbody>
          </table>

          <div class="footer">
            Sistema de Gestión Ganadera · Reporte Oficial de Pesadas de Leche
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Historial_Leche_${fincaNombre}`,
        UTI: 'com.adobe.pdf',
      });

    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Ocurrió un problema generando el documento PDF.');
    } finally {
      setExportandoPdf(false);
    }
  };

  const abrirAcciones = (item: RegistroLeche) => {
    Alert.alert(
      `Arete ${item.areteCodigo}`,
      `${item.fecha} · ${turnoLecheLabel(item.turno)} · ${item.litros} L`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Editar litros',
          onPress: () => {
            setEditando(item);
            setLitrosEdit(String(item.litros));
          },
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => confirmarEliminar(item),
        },
      ]
    );
  };

  const confirmarEliminar = (item: RegistroLeche) => {
    Alert.alert('Eliminar registro', '¿Borrar esta pesada de leche?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.delete(produccionLeche).where(eq(produccionLeche.id, item.id));
            await cargarRegistros();
          } catch (e) {
            Alert.alert('Error', 'No se pudo eliminar.');
          }
        },
      },
    ]);
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    const litros = parseFloat(litrosEdit.replace(',', '.'));
    if (Number.isNaN(litros) || litros <= 0) {
      Alert.alert('Dato inválido', 'Ingresa litros mayores a 0.');
      return;
    }
    try {
      setGuardando(true);
      await db
        .update(produccionLeche)
        .set({ litros })
        .where(eq(produccionLeche.id, editando.id));
      setEditando(null);
      await cargarRegistros();
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar.');
    } finally {
      setGuardando(false);
    }
  };

  const renderItem: ListRenderItem<RegistroLeche> = ({ item }) => (
    <TouchableOpacity style={styles.card} onLongPress={() => abrirAcciones(item)} delayLongPress={400}>
      <View style={styles.cardHeader}>
        <Text style={styles.animalId}>Arete: {item.areteCodigo}</Text>
        <Text style={styles.fecha}>{item.fecha}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.litros}>{item.litros} L</Text>
        <View style={styles.badgeRow}>
          {item.raza && <Text style={styles.miniBadge}>{item.raza}</Text>}
          <Text style={styles.tipo}>Turno {turnoLecheLabel(item.turno)}</Text>
        </View>
      </View>
      <Text style={styles.hint}>Mantén presionado para editar o eliminar</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: fincaNombre ? `Leche · ${fincaNombre}` : 'Historial de Leche',
          headerStyle: { backgroundColor: '#065f46' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />

      <View style={styles.topActionsContainer}>
        <View style={styles.searchContainer}>
          <Search color="#94a3b8" size={18} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por arete..."
            value={busqueda}
            onChangeText={setBusqueda}
            placeholderTextColor="#94a3b8"
          />
        </View>
        
        <TouchableOpacity 
          style={[styles.iconButton, mostrarFiltros && styles.iconButtonActive]} 
          onPress={() => setMostrarFiltros(!mostrarFiltros)}
        >
          <Filter color={mostrarFiltros ? '#fff' : '#475569'} size={20} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.iconButtonPdf} 
          onPress={handleExportarPDF}
          disabled={exportandoPdf}
        >
          {exportandoPdf ? (
            <ActivityIndicator color="#065f46" size="small" />
          ) : (
            <FileText color="#065f46" size={20} />
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.iconButtonAdd} 
          onPress={() => router.push('/produccion')}
        >
          <Plus color="#ffffff" size={20} />
        </TouchableOpacity>
      </View>

      {mostrarFiltros && (
        <View style={styles.advancedFiltersCard}>
          <Text style={styles.filterMenuTitle}>Filtros del Historial</Text>
          {/* Contenedor con altura limitada y scroll */}
    <ScrollView 
      style={{ maxHeight: 300 }} // Ajusta este valor según el espacio que tengas disponible
      showsVerticalScrollIndicator={true}
    >
          <View style={styles.formGrid}>
            <View style={styles.inputGroup}>
              <Text style={styles.filterLabel}>Fecha Inicio</Text>
              <TextInput 
                style={styles.filterInput} 
                value={fechaInicio} 
                onChangeText={setFechaInicio} 
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.filterLabel}>Fecha Fin</Text>
              <TextInput 
                style={styles.filterInput} 
                value={fechaFin} 
                onChangeText={setFechaFin} 
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>

          <View style={styles.formGrid}>
<View style={styles.inputGroup}>
  <Text style={styles.filterLabel}>Especie</Text>
  <View style={styles.chipRow}>
{listaEspecies.map((esp) => (
  <TouchableOpacity 
    key={esp.id} 
    style={[styles.chip, filtroEspecie === esp.id && styles.chipActive]}
    onPress={() => {
      setFiltroEspecie(esp.id);
      setFiltroRaza(null);
    }}
  >
    {/* Cambiamos a un estilo que tenga contraste blanco si está activo */}
    <Text style={[styles.turnoChipText, filtroEspecie === esp.id && { color: '#fff' }]}>
      {esp.nombre}
    </Text>
  </TouchableOpacity>
))}
  </View>
</View>

{filtroEspecie && (
  <View style={styles.inputGroup}>
    <Text style={styles.filterLabel}>Raza</Text>
    <View style={styles.chipRow}>
      {listaRazas
        .filter(r => r.especieId === filtroEspecie)
        .map((raza) => (
          <TouchableOpacity 
            key={raza.id} 
            style={[styles.chip, filtroRaza === raza.id && styles.chipActive]}
            onPress={() => setFiltroRaza(raza.id)}
          >
            {/* AGREGADO: Condición para alternar el texto a blanco si está seleccionada */}
            <Text style={[styles.turnoChipText, filtroRaza === raza.id && { color: '#fff' }]}>
              {raza.nombre}
            </Text>
          </TouchableOpacity>
      ))}
    </View>
  </View>
)}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.filterLabel}>Turno</Text>
            <View style={styles.turnoSelectorRow}>
              {[
                ['', 'Todos'],
                ['M', 'Mañana'],
                ['T', 'Tarde'],
                ['N', 'Noche'],
              ].map(([key, value]) => (
                <TouchableOpacity 
                  key={key} 
                  style={[styles.turnoChip, filtroTurno === key && styles.turnoChipActive]}
                  onPress={() => setFiltroTurno(key)}
                >
                  <Text style={[styles.turnoChipText, filtroTurno === key && styles.turnoChipTextActive]}>{value}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
</ScrollView>
          <TouchableOpacity style={styles.btnAplicarFiltros} onPress={cargarRegistros}>
            <Text style={styles.btnAplicarFiltrosText}>Aplicar Filtros</Text>
          </TouchableOpacity>
        </View>
      )}

      {cargando ? (
        <ActivityIndicator size="large" color="#065f46" style={styles.loader} />
      ) : (
        <FlatList
          data={registrosFiltrados}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay registros de leche con los filtros aplicados.</Text>}
        />
      )}

      <Modal visible={editando !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar litros</Text>
            <Text style={styles.modalSub}>
              {editando?.areteCodigo} · {editando?.fecha} · {editando && turnoLecheLabel(editando.turno)}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={litrosEdit}
              onChangeText={setLitrosEdit}
              keyboardType="decimal-pad"
              placeholder="Litros"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setEditando(null)}
                disabled={guardando}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnSave, guardando && styles.modalBtnDisabled]}
                onPress={guardarEdicion}
                disabled={guardando}
              >
                <Text style={styles.modalBtnSaveText}>{guardando ? '...' : 'Guardar'}</Text>
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
  topActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, height: 44, fontSize: 14, color: '#1e293b' },
  iconButton: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconButtonActive: {
    backgroundColor: '#065f46',
    borderColor: '#065f46',
  },

advancedFiltersCard: {
  backgroundColor: '#fff',
  marginHorizontal: 16,
  marginBottom: 16,
  padding: 16,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#e2e8f0',
  // Añade esto para dar aire extra al final de la tarjeta
  paddingBottom: 24, 
},
  filterMenuTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  formGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inputGroup: { flex: 1 },
  filterLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  filterInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#1e293b',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  chipActive: {
    backgroundColor: '#065f46',
    borderColor: '#065f46',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
turnoSelectorRow: {
  flexDirection: 'row',
  flexWrap: 'wrap', // Esto permite que se acomoden si la pantalla es pequeña
  gap: 8,           // Un poco más de espacio entre ellos
  marginTop: 8,
},
turnoChip: {
  flex: 1, // Esto hará que todos los botones ocupen el mismo ancho
  alignItems: 'center', // Centra el texto dentro del botón
  paddingVertical: 8,
  height: 36,
  borderRadius: 20,
  backgroundColor: '#f1f5f9',
},
  turnoChipActive: { backgroundColor: '#065f46' },
  turnoChipText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  turnoChipTextActive: { color: '#fff', fontWeight: '600' },
btnAplicarFiltros: {
  backgroundColor: '#065f46',
  height: 44, // Aumenté un poco la altura para que sea más fácil de tocar
  borderRadius: 12,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 16, // Aumenté el margen para mayor separación
},
  btnAplicarFiltrosText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  loader: { marginTop: 40 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  animalId: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  fecha: { fontSize: 13, color: '#64748b' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  litros: { fontSize: 20, fontWeight: '800', color: '#065f46' },
  badgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  miniBadge: {
    fontSize: 11,
    color: '#065f46',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    fontWeight: '600',
  },
  tipo: {
    fontSize: 13,
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hint: { fontSize: 10, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#64748b', fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalSub: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 16,
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
  modalBtnCancelText: { fontWeight: '600', color: '#475569' },
  modalBtnSave: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#065f46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnDisabled: { backgroundColor: '#bfdbfe' },
  modalBtnSaveText: { fontWeight: '700', color: '#fff' },
  iconButtonPdf: {
    width: 44,
    height: 44,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  iconButtonAdd: {
    width: 44,
    height: 44,
    backgroundColor: '#065f46',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});