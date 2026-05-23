import { useFocusEffect } from '@react-navigation/native';
import { and, desc, eq, inArray } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, FileText, Plus, Search, ShieldAlert } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../db/client';
import { animales, fincas } from '../../db/schema';

type AnimalSelect = typeof animales.$inferSelect;
type FiltroEstado = 'Activos' | 'Vendidos' | 'Otros' | 'Todos';

const ESTADOS_OTROS = ['Fallecido', 'Consumo_Interno'] as const;

export default function InventarioScreen() {
  const router = useRouter();
  const { origen } = useLocalSearchParams<{ origen: string }>();
  const [animalesLista, setAnimalesLista] = useState<AnimalSelect[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [fincaNombre, setFincaNombre] = useState('Cargando...');
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('Activos');
  const generarReporteExcelPDF = async () => {
  if (animalesFiltrados.length === 0) {
    alert('No hay registros en la lista actual para exportar.');
    return;
  }

  // Mapeamos las filas con celdas explícitas, formateando los textos crudos de la BD
  const filasTabla = animalesFiltrados.map((animal, index) => `
    <tr>
      <td style="text-align: center; color: #64748b; font-weight: 500;">${index + 1}</td>
      <td style="font-weight: bold; color: #0f172a;">${animal.areteCodigo}</td>
      <td>${animal.nombre || '—'}</td>
      <td>${animal.categoria.replace('_', ' ')}</td>
      <td style="text-align: center;">${animal.sexo}</td>
      <td>${animal.proposito.replace('_', ' ')}</td>
      <td style="text-align: center;">
        <span class="status-text ${animal.estado === 'Activo' ? 'status-activo' : 'status-vlo'}">
          ${animal.estado.replace('_', ' ')}
        </span>
      </td>
    </tr>
  `).join('');

  // Estructura HTML con CSS diseñado para simular una hoja de cálculo limpia
  const htmlHojaCalculo = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: letter; margin: 40px; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
          color: #1e293b; 
          margin: 0; 
          padding: 0;
          font-size: 11px;
        }
        
        /* Encabezado del Reporte */
        .report-header { margin-bottom: 24px; }
        .report-title { font-size: 20px; font-weight: 700; color: #065f46; margin: 0 0 4px 0; letter-spacing: -0.5px; }
        .report-subtitle { font-size: 12px; color: #475569; margin: 0 0 12px 0; }
        
        /* Metadatos en cuadrícula fina */
        .meta-grid { 
          display: table; 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 20px; 
          background-color: #f8fafc;
          border: 1px solid #cbd5e1;
        }
        .meta-row { display: table-row; }
        .meta-cell { 
          display: table-cell; 
          padding: 8px 12px; 
          border: 1px solid #cbd5e1; 
          font-size: 11px; 
        }
        .meta-label { font-weight: 600; color: #475569; }

        /* Tabla Estilo Excel */
        .excel-table { 
          width: 100%; 
          border-collapse: collapse; 
          font-size: 11px;
          border: 2px solid #065f46; /* Borde exterior fuerte */
        }
        .excel-table th { 
          background-color: #065f46; /* Verde principal de tu app */
          color: #ffffff; 
          font-weight: 600; 
          text-transform: uppercase; 
          font-size: 10px; 
          letter-spacing: 0.5px;
          padding: 8px 10px;
          border: 1px solid #047857;
        }
        .excel-table td { 
          padding: 8px 10px; 
          border: 1px solid #cbd5e1; /* Cuadrícula gris estándar */
          text-align: left;
          vertical-align: middle;
        }
        
        /* Filas alternas (Cebra) */
        .excel-table tr:nth-child(even) { background-color: #f8fafc; }
        /* Efecto al imprimir para asegurar legibilidad */
        .excel-table tr { page-break-inside: avoid; }

        /* Estados discretos dentro de la celda */
        .status-text { font-weight: 600; font-size: 10px; }
        .status-activo { color: #059669; }
        .status-vlo { color: #64748b; }

        .resumen-conteo {
          margin-top: 12px;
          text-align: right;
          font-weight: 700;
          font-size: 12px;
          color: #0f172a;
          padding: 8px;
        }
      </style>
    </head>
    <body>

      <div class="report-header">
        <h1 class="report-title">Inventario General de Semovientes</h1>
        <p class="report-subtitle">Establecimiento: <strong>${fincaNombre}</strong></p>
      </div>
      
      <!-- Ficha de control de filtros aplicados -->
      <div class="meta-grid">
        <div class="meta-row">
          <div class="meta-cell"><span class="meta-label">Criterio Estado:</span> ${filtroEstado}</div>
          <div class="meta-cell"><span class="meta-label">Generado el:</span> ${new Date().toLocaleDateString()}</div>
        </div>
        ${busqueda ? `
        <div class="meta-row">
          <div class="meta-cell" style="grid-column: span 2;"><span class="meta-label">Filtro de búsqueda por texto:</span> "${busqueda}"</div>
        </div>
        ` : ''}
      </div>

      <!-- Tabla Principal -->
      <table class="excel-table">
        <thead>
          <tr>
            <th style="width: 5%; text-align: center;">Item</th>
            <th style="width: 15%;">Código Arete</th>
            <th style="width: 25%;">Nombre del Animal</th>
            <th style="width: 20%;">Categoría</th>
            <th style="width: 10%; text-align: center;">Sexo</th>
            <th style="width: 15%;">Propósito</th>
            <th style="width: 10%; text-align: center;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${filasTabla}
        </tbody>
      </table>

      <div class="resumen-conteo">
        Total Registros Listados: ${animalesFiltrados.length} u.
      </div>

    </body>
    </html>
  `;

try {
    // 1. Generar el PDF temporal por defecto
    const { uri } = await Print.printToFileAsync({ html: htmlHojaCalculo });
    
    // 2. Obtener la fecha de hoy formateada (DD_MM_AAAA)
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const anio = hoy.getFullYear();
    const fechaFormateada = `${dia}_${mes}_${anio}`;
    
    // 3. Definir el nombre del archivo final y su nueva ruta
    const nombreArchivo = `reporte_inventario_${fechaFormateada}.pdf`;
    const nuevaRuta = `${FileSystem.cacheDirectory}${nombreArchivo}`;
    
    // 4. Mover el archivo al nuevo destino con el nombre correcto
    await FileSystem.moveAsync({
      from: uri,
      to: nuevaRuta
    });
    
    // 5. Abrir el menú para compartir usando la nueva ruta
    await Sharing.shareAsync(nuevaRuta, {
      mimeType: 'application/pdf',
      dialogTitle: nombreArchivo,
      UTI: 'com.adobe.pdf'
    });
  } catch (error) {
    console.error('Error generando reporte tabulado:', error);
    alert('Ocurrió un error al compilar la tabla del reporte.');
  }
};

// ... tus estados, useLocalSearchParams, etc.

  const manejarRegreso = () => {
    if (origen === 'index') {
      router.replace('/');
    } else if (origen === 'registros') {
      router.replace('/registros');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
    return true; // Le dice al sistema que nosotros manejamos el evento
  };

  // CONTROL DEL BOTÓN FÍSICO DE ANDROID
  useEffect(() => {
    const alPresionarAtras = () => {
      manejarRegreso();
      return true; // Evita que la app ejecute el comportamiento por defecto (que es salir o ir a index)
    };

    // Escuchamos el evento nativo
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', alPresionarAtras);

    // Limpiamos la escucha cuando el usuario sale de la pantalla
    return () => suscripcion.remove();
  }, [origen]); // Se vuelve a ejecutar si cambia el origen
  
  useFocusEffect(
    useCallback(() => {
      async function cargarInventario() {
        try {
          setCargando(true);
          const actualFinca = await db.select().from(fincas).where(eq(fincas.activa, 1)).limit(1);

          if (actualFinca.length > 0) {
            setFincaNombre(actualFinca[0].nombre);
            const baseFinca = eq(animales.fincaId, actualFinca[0].id);
            const whereClause =
              filtroEstado === 'Activos'
                ? and(baseFinca, eq(animales.estado, 'Activo'))
                : filtroEstado === 'Vendidos'
                  ? and(baseFinca, eq(animales.estado, 'Vendido'))
                  : filtroEstado === 'Otros'
                    ? and(baseFinca, inArray(animales.estado, [...ESTADOS_OTROS]))
                    : baseFinca;

            const resultado = await db
              .select()
              .from(animales)
              .where(whereClause)
              .orderBy(desc(animales.creadoEn));
            setAnimalesLista(resultado);
          } else {
            setFincaNombre('Sin Finca Activa');
            setAnimalesLista([]);
          }
        } catch (error) {
          console.error('Error cargando inventario:', error);
        } finally {
          setCargando(false);
        }
      }
      cargarInventario();
    }, [filtroEstado])
  );

  const animalesFiltrados = animalesLista.filter(
    (a) =>
      a.areteCodigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (a.nombre?.toLowerCase() || '').includes(busqueda.toLowerCase()) ||
      a.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  const renderAnimalItem = ({ item }: { item: AnimalSelect }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/detalleAnimal', params: { id: item.id } })}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.areteBadge}>
          <Text style={styles.areteText}>#{item.areteCodigo}</Text>
        </View>
        <Text
          style={[
            styles.estadoTag,
            item.estado !== 'Activo' && styles.estadoTagMuted,
          ]}
        >
          {item.estado.replace('_', ' ')}
        </Text>
      </View>
      <Text style={styles.categoriaTag}>{item.categoria.replace('_', ' ')}</Text>
      <Text style={styles.animalNombre}>{item.nombre || 'Sin Nombre'}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.infoText}>
          Sexo: <Text style={styles.bold}>{item.sexo}</Text>
        </Text>
        <Text style={styles.infoText}>
          Propósito: <Text style={styles.bold}>{item.proposito.replace('_', ' ')}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );

  const filtros: FiltroEstado[] = ['Activos', 'Vendidos', 'Otros', 'Todos'];

  return (
  <View style={styles.container}>
    {/* Deja un solo contenedor Header */}
    <View style={styles.header}>
        <TouchableOpacity onPress={manejarRegreso} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={24} />
        </TouchableOpacity>
      
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.headerTitle}>Inventario</Text>
        <Text style={styles.headerSubtitle}>
          {fincaNombre} · {filtroEstado.toLowerCase()}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={styles.pdfButton} onPress={generarReporteExcelPDF}>
          <FileText color="#065f46" size={20} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/crear-animal')}>
          <Plus color="#ffffff" size={20} />
        </TouchableOpacity>
      </View>
    </View>

      <View style={styles.filtroRow}>
        {filtros.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroChip, filtroEstado === f && styles.filtroChipActive]}
            onPress={() => setFiltroEstado(f)}
          >
            <Text style={[styles.filtroChipText, filtroEstado === f && styles.filtroChipTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchSection}>
        <Search size={20} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por arete o nombre..."
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#065f46" />
      ) : (
        <FlatList
          data={animalesFiltrados}
          keyExtractor={(item) => item.id}
          renderItem={renderAnimalItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <ShieldAlert color="#94a3b8" size={48} />
              <Text style={styles.emptyTitle}>No hay coincidencias</Text>
            </View>
          }
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
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#065f46', fontWeight: '600' },
  addButton: { padding: 10, borderRadius: 12, backgroundColor: '#065f46' },
  filtroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filtroChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filtroChipActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  filtroChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filtroChipTextActive: { color: '#fff' },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, padding: 12, fontSize: 15 },
  listContent: { padding: 16, paddingTop: 0 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 1,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  areteBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  areteText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  estadoTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  estadoTagMuted: { color: '#64748b', backgroundColor: '#f1f5f9' },
  categoriaTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  animalNombre: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  cardFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  infoText: { fontSize: 12, color: '#64748b' },
  bold: { fontWeight: '600', color: '#1e293b' },
  centerContainer: { alignItems: 'center', marginTop: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#475569', marginTop: 16 },

  pdfButton: {
  padding: 10,
  borderRadius: 12,
  backgroundColor: '#e6f4ea', // Un tono verde muy claro para contrastar con el botón principal
  borderWidth: 1,
  borderColor: '#a3e635',
  alignItems: 'center',
  justifyContent: 'center',
},
});
