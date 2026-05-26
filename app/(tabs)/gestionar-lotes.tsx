import { eq } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, FileText, MapPin, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { lotes } from '../../db/schema';

type LoteRow = typeof lotes.$inferSelect;

export default function GestionarLotesScreen() {
  const router = useRouter();
  const [fincaNombre, setFincaNombre] = useState('');
  const [fincaId, setFincaId] = useState<string | null>(null);
  const [lista, setLista] = useState<LoteRow[]>([]);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const backAction = () => {
      router.replace('/registros'); 
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);
      
  const cargarLotes = useCallback(async () => {
    try {
      setCargando(true);
      const finca = await obtenerFincaActiva();
      if (!finca) {
        setFincaId(null);
        setFincaNombre('Sin finca activa');
        setLista([]);
        return;
      }
      setFincaId(finca.id);
      setFincaNombre(finca.nombre);
      const rows = await db.select().from(lotes).where(eq(lotes.fincaId, finca.id));
      setLista(rows);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudieron cargar los lotes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarLotes();
    }, [cargarLotes])
  );

  const handleCrear = async () => {
    if (!fincaId) {
      Alert.alert('Finca requerida', 'Selecciona o crea una finca activa primero.');
      return;
    }
    if (!nombre.trim()) {
      Alert.alert('Faltan datos', 'El nombre del lote es obligatorio.');
      return;
    }

    try {
      setGuardando(true);
      await db.insert(lotes).values({
        id: Crypto.randomUUID(),
        fincaId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
      });
      setNombre('');
      setDescripcion('');
      await cargarLotes();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo crear el lote.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = (lote: LoteRow) => {
    Alert.alert(
      'Eliminar lote',
      `¿Eliminar "${lote.nombre}"? Los animales quedarán sin lote asignado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.delete(lotes).where(eq(lotes.id, lote.id));
              await cargarLotes();
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'No se pudo eliminar el lote.');
            }
          },
        },
      ]
    );
  };

  // NUEVA FUNCIÓN: Generar Reporte PDF para los Lotes
  const generarReporteLotesPDF = async () => {
    if (lista.length === 0) {
      Alert.alert('Sin datos', 'No hay lotes registrados en esta finca para exportar.');
      return;
    }

    const filasTabla = lista.map((lote, index) => `
      <tr>
        <td style="text-align: center; color: #64748b; font-weight: 500;">${index + 1}</td>
        <td style="font-weight: bold; color: #0f172a;">${lote.nombre}</td>
        <td style="color: #475569;">${lote.descripcion || '—'}</td>
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
            font-size: 12px;
          }
          .report-header { margin-bottom: 24px; }
          .report-title { font-size: 20px; font-weight: 700; color: #065f46; margin: 0 0 4px 0; letter-spacing: -0.5px; }
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
            font-size: 12px;
            border: 2px solid #065f46;
          }
          .excel-table th { 
            background-color: #065f46; 
            color: #ffffff; 
            font-weight: 600; 
            text-transform: uppercase; 
            font-size: 11px; 
            letter-spacing: 0.5px;
            padding: 10px;
            border: 1px solid #047857;
          }
          .excel-table td { 
            padding: 10px; 
            border: 1px solid #cbd5e1; 
            text-align: left;
            vertical-align: middle;
          }
          .excel-table tr:nth-child(even) { background-color: #f8fafc; }
          .excel-table tr { page-break-inside: avoid; }

          .resumen-conteo {
            margin-top: 16px;
            text-align: right;
            font-weight: 700;
            font-size: 13px;
            color: #0f172a;
            padding: 8px;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1 class="report-title">Reporte de Lotes y Potreros</h1>
          <p class="report-subtitle">Establecimiento: <strong>${fincaNombre}</strong></p>
        </div>
        
        <div class="meta-grid">
          <div class="meta-row">
            <div class="meta-cell"><span class="meta-label">Ubicación:</span> ${fincaNombre}</div>
            <div class="meta-cell"><span class="meta-label">Generado el:</span> ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <table class="excel-table">
          <thead>
            <tr>
              <th style="width: 10%; text-align: center;">Item</th>
              <th style="width: 35%;">Nombre del Lote / Potrero</th>
              <th style="width: 55%;">Descripción / Detalles</th>
            </tr>
          </thead>
          <tbody>
            ${filasTabla}
          </tbody>
        </table>

        <div class="resumen-conteo">
          Total Lotes Registrados: ${lista.length} u.
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
      
      // Nombre de archivo ajustado a tu solicitud
      const nombreArchivo = `reporte_lotes_${fechaFormateada}.pdf`;
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
      console.error('Error generando reporte de lotes:', error);
      Alert.alert('Error', 'Ocurrió un error al compilar el reporte de lotes.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/registros')}>          
          <ArrowLeft color="#1e293b" size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Lotes / Potreros</Text>
          <Text style={styles.headerSubtitle}>{fincaNombre}</Text>
        </View>
        
        {/* Botón de PDF agregado exitosamente a la derecha del header */}
        <TouchableOpacity style={styles.pdfButton} onPress={generarReporteLotesPDF}>
          <FileText color="#065f46" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Nuevo lote</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre (Ej. Ordeño 1, Escotera)"
          placeholderTextColor="#94a3b8"
          value={nombre}
          onChangeText={setNombre}
        />
        <TextInput
          style={[styles.input, styles.inputArea]}
          placeholder="Descripción (opcional)"
          placeholderTextColor="#94a3b8"
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
        />
        <TouchableOpacity
          style={[styles.btnGuardar, guardando && styles.btnDisabled]}
          onPress={handleCrear}
          disabled={guardando || !fincaId}
        >
          <Plus color="#fff" size={18} />
          <Text style={styles.btnGuardarText}>{guardando ? 'Guardando...' : 'Agregar lote'}</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 24 }} size="large" color="#065f46" />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {fincaId
                ? 'No hay lotes. Crea uno arriba para asignarlo al registrar animales.'
                : 'Activa una finca en Inicio para gestionar lotes.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.loteCard}>
              <View style={styles.loteInfo}>
                <MapPin color="#065f46" size={18} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.loteNombre}>{item.nombre}</Text>
                  {item.descripcion ? (
                    <Text style={styles.loteDesc}>{item.descripcion}</Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity onPress={() => handleEliminar(item)} style={styles.deleteBtn}>
                <Trash2 color="#ef4444" size={20} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </KeyboardAvoidingView>
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#065f46', fontWeight: '600' },
  pdfButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#e6f4ea',
    borderWidth: 1,
    borderColor: '#a3e635',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  formTitle: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 12 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 10,
    color: '#1e293b',
  },
  inputArea: { height: 64, paddingTop: 10, textAlignVertical: 'top' },
  btnGuardar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#065f46',
    height: 48,
    borderRadius: 12,
    marginTop: 4,
  },
  btnDisabled: { backgroundColor: '#a7f3d0' },
  btnGuardarText: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  loteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  loteInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  loteNombre: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  loteDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  deleteBtn: { padding: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 24, lineHeight: 20, paddingHorizontal: 16 },
});