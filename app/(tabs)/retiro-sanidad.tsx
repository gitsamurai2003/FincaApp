import { eq } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { AlertTriangle, ArrowLeft, Beef, FileText, Milk, RefreshCw, Search } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { animales, historialMedico } from '../../db/schema';
import { fechaLocalISO, sumarDiasLocal } from '../../utils/fecha';

type RetiroRow = {
  areteCodigo: string;
  nombre: string | null;
  medicamento: string;
  fechaAplicacion: string;
  finRetiroLeche: string | null;
  finRetiroCarne: string | null;
  tipo: 'leche' | 'carne' | 'ambos';
};

type FiltroTipo = 'TODOS' | 'LECHE' | 'CARNE';

export default function RetiroSanidadScreen() {
  const router = useRouter();
  const [lista, setLista] = useState<RetiroRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<FiltroTipo>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [fincaNombre, setFincaNombre] = useState('Cargando...');
  const hoy = fechaLocalISO();

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const finca = await obtenerFincaActiva();
      if (!finca) {
        setLista([]);
        setFincaNombre('Sin Finca Activa');
        return;
      }
      setFincaNombre(finca.nombre);

      const registros = await db
        .select({
          areteCodigo: animales.areteCodigo,
          nombre: animales.nombre,
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
        const finLeche = r.diasLeche > 0 ? sumarDiasLocal(r.fechaAplicacion, r.diasLeche) : null;
        const finCarne = r.diasCarne > 0 ? sumarDiasLocal(r.fechaAplicacion, r.diasCarne) : null;
        
        const enLeche = finLeche !== null && finLeche >= hoy;
        const enCarne = finCarne !== null && finCarne >= hoy;
        
        if (!enLeche && !enCarne) continue;

        activos.push({
          areteCodigo: r.areteCodigo,
          nombre: r.nombre,
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

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const listaFiltrada = lista.filter((item) => {
    const cumpleTipo =
      filtro === 'TODOS' ||
      (filtro === 'LECHE' && (item.tipo === 'leche' || item.tipo === 'ambos')) ||
      (filtro === 'CARNE' && (item.tipo === 'carne' || item.tipo === 'ambos'));

    const cumpleBusqueda =
      item.areteCodigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (item.nombre && item.nombre.toLowerCase().includes(busqueda.toLowerCase())) ||
      item.medicamento.toLowerCase().includes(busqueda.toLowerCase());

    return cumpleTipo && cumpleBusqueda;
  });

  const generarReporteExcelPDF = async () => {
    if (listaFiltrada.length === 0) {
      Alert.alert('Sin datos', 'No hay registros en la lista actual para exportar.');
      return;
    }

    const filasTabla = listaFiltrada.map((item, index) => `
      <tr>
        <td style="text-align: center; color: #64748b; font-weight: 500;">${index + 1}</td>
        <td style="font-weight: bold; color: #0f172a;">#${item.areteCodigo}</td>
        <td>${item.nombre || '—'}</td>
        <td>${item.medicamento}</td>
        <td style="text-align: center;">${item.fechaAplicacion}</td>
        <td style="text-align: center; font-weight: 600;" class="${item.finRetiroLeche ? 'status-leche' : ''}">
          ${item.finRetiroLeche || '—'}
        </td>
        <td style="text-align: center; font-weight: 600;" class="${item.finRetiroCarne ? 'status-carne' : ''}">
          ${item.finRetiroCarne || '—'}
        </td>
      </tr>
    `).join('');

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
          
          .report-header { margin-bottom: 24px; }
          .report-title { font-size: 20px; font-weight: 700; color: #b91c1c; margin: 0 0 4px 0; letter-spacing: -0.5px; }
          .report-subtitle { font-size: 12px; color: #475569; margin: 0 0 12px 0; }
          
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

          .excel-table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 11px;
            border: 2px solid #b91c1c; 
          }
          .excel-table th { 
            background-color: #b91c1c; 
            color: #ffffff; 
            font-weight: 600; 
            text-transform: uppercase; 
            font-size: 10px; 
            letter-spacing: 0.5px;
            padding: 8px 10px;
            border: 1px solid #991b1b;
          }
          .excel-table td { 
            padding: 8px 10px; 
            border: 1px solid #cbd5e1; 
            text-align: left;
            vertical-align: middle;
          }
          
          .excel-table tr:nth-child(even) { background-color: #f8fafc; }
          .excel-table tr { page-break-inside: avoid; }

          .status-leche { color: #2563eb; }
          .status-carne { color: #dc2626; }

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
          <h1 class="report-title">Reporte de Periodos de Retiro</h1>
          <p class="report-subtitle">Establecimiento: <strong>${fincaNombre}</strong></p>
        </div>
        
        <div class="meta-grid">
          <div class="meta-row">
            <div class="meta-cell"><span class="meta-label">Filtro Aplicado:</span> ${filtro}</div>
            <div class="meta-cell"><span class="meta-label">Generado el:</span> ${new Date().toLocaleDateString()}</div>
          </div>
          ${busqueda ? `
          <div class="meta-row">
            <div class="meta-cell" style="grid-column: span 2;"><span class="meta-label">Filtro de búsqueda:</span> "${busqueda}"</div>
          </div>
          ` : ''}
        </div>

        <table class="excel-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">Item</th>
              <th style="width: 15%;">Código Arete</th>
              <th style="width: 20%;">Nombre</th>
              <th style="width: 25%;">Medicamento</th>
              <th style="width: 15%; text-align: center;">Aplicación</th>
              <th style="width: 10%; text-align: center;">Vence Leche</th>
              <th style="width: 10%; text-align: center;">Vence Carne</th>
            </tr>
          </thead>
          <tbody>
            ${filasTabla}
          </tbody>
        </table>

        <div class="resumen-conteo">
          Total Registros Listados: ${listaFiltrada.length} u.
        </div>

      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlHojaCalculo });
      
      const hoy = new Date();
      const dia = String(hoy.getDate()).padStart(2, '0');
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const anio = hoy.getFullYear();
      const fechaFormateada = `${dia}_${mes}_${anio}`;
      
      const nombreArchivo = `reporte_retiros_${fechaFormateada}.pdf`;
      const nuevaRuta = `${FileSystem.cacheDirectory}${nombreArchivo}`;
      
      await FileSystem.moveAsync({
        from: uri,
        to: nuevaRuta
      });
      
      await Sharing.shareAsync(nuevaRuta, {
        mimeType: 'application/pdf',
        dialogTitle: nombreArchivo,
        UTI: 'com.adobe.pdf'
      });
    } catch (error) {
      console.error('Error generando reporte tabulado:', error);
      Alert.alert('Error', 'Ocurrió un error al compilar la tabla del reporte.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/registros')}>          
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Periodos de Retiro</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={cargar} style={styles.syncButton} disabled={cargando}>
            <RefreshCw color="#475569" size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={generarReporteExcelPDF}>
            <FileText color="#b91c1c" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bannerContainer}>
        <AlertTriangle color="#b91c1c" size={18} />
        <Text style={styles.banner}>
          Producción restringida. No enviar leche al tanque ni animales a matadero hasta la fecha indicada.
        </Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search color="#94a3b8" size={16} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar arete o medicamento..."
            value={busqueda}
            onChangeText={setBusqueda}
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['TODOS', 'LECHE', 'CARNE'] as FiltroTipo[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filtro === f && styles.filterTabActive]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[styles.filterTabText, filtro === f && styles.filterTabTextActive]}>
              {f === 'TODOS' ? 'Todos' : f === 'LECHE' ? '🥛 Leche' : '🥩 Carne'}
            </Text>
            {f === 'TODOS' && lista.length > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{lista.length}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#b91c1c" />
          <Text style={styles.loadingText}>Verificando historiales médicos...</Text>
        </View>
      ) : (
        <FlatList
          data={listaFiltrada}
          keyExtractor={(item, i) => `${item.areteCodigo}-${i}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>¡Todo despejado!</Text>
              <Text style={styles.emptySub}>No se encontraron animales bajo restricciones sanitarias activas.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const esAmbos = item.tipo === 'ambos';
            return (
              <View style={[styles.card, esAmbos && styles.cardCritica]}>
                <View style={styles.cardHeader}>
                  <View style={styles.animalInfo}>
                    <Text style={styles.arete}>#{item.areteCodigo}</Text>
                    {item.nombre && <Text style={styles.animalNombre}>— {item.nombre}</Text>}
                  </View>
                  <View style={styles.iconIndicatorRow}>
                    {(item.tipo === 'leche' || esAmbos) && <Milk size={18} color="#2563eb" />}
                    {(item.tipo === 'carne' || esAmbos) && <Beef size={18} color="#b91c1c" />}
                  </View>
                </View>

                <View style={styles.detailsDivider} />
                <Text style={styles.medText}>{item.medicamento}</Text>
                <Text style={styles.fechaAplicacionText}>Aplicado el: {item.fechaAplicacion}</Text>

                <View style={styles.fechasRetiroBox}>
                  {item.finRetiroLeche && (
                    <View style={styles.fechaRow}>
                      <Text style={styles.labelRetiro}>Vence Leche:</Text>
                      <Text style={styles.fechaValorLeche}>{item.finRetiroLeche}</Text>
                    </View>
                  )}
                  {item.finRetiroCarne && (
                    <View style={styles.fechaRow}>
                      <Text style={styles.labelRetiro}>Vence Carne:</Text>
                      <Text style={styles.fechaValorCarne}>{item.finRetiroCarne}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
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
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  syncButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportBtn: { backgroundColor: '#fef2f2', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#fee2e2' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  bannerContainer: {
    margin: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  banner: {
    flex: 1,
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  searchRow: { paddingHorizontal: 16, marginVertical: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 40,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginVertical: 8,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterTabTextActive: { color: '#fff' },
  badge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 2,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 13, fontWeight: '500' },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCritica: {
    borderColor: '#fecaca',
    backgroundColor: '#fffafb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  animalInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arete: { fontSize: 16, fontWeight: '800', color: '#0f172a', letterSpacing: 0.5 },
  animalNombre: { fontSize: 14, color: '#475569', fontWeight: '500' },
  iconIndicatorRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  detailsDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },
  medText: { fontWeight: '700', color: '#334155', fontSize: 14 },
  fechaAplicacionText: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  fechasRetiroBox: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  fechaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelRetiro: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  fechaValorLeche: { fontSize: 13, color: '#2563eb', fontWeight: '700' },
  fechaValorCarne: { fontSize: 13, color: '#b91c1c', fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#475569', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
});